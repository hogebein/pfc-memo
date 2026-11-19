// 体内グリコーゲン（肝臓・筋肉）の推定モデル。DOM非依存。
//
// 構造: 肝臓1つ＋筋肉の部位ごと（＋その他）の貯蔵庫を1時間刻みで追う。
//  入る分: 食事の糖質（利用可能炭水化物）。摂取後4時間で吸収し、まず安静時の糖質酸化に使われ、余りが肝臓と筋肉に貯蔵される。
//  出る分: 肝臓は安静時の血糖維持（脳など）。筋肉は運動中の糖質酸化（持久系）と筋トレのセット（部位別）、および日常活動のわずかな消費。
//  誤差範囲: 不確かなパラメータを分布から振ってモデルを多数回走らせ、結果の10〜90パーセンタイルを出す（Monte Carlo）。
//
// 根拠（★は研究の「形・桁」だけを使い、係数は本モデルの仮定。画面にもその旨を表示する）
//  - 貯蔵量: 全身で約500g。肝臓約100g、筋肉約400g（筋肉1kgあたり約15g）。
//  - 肝臓の枯渇: 絶食24時間で肝グリコーゲンは約65%減る（Magnusson 1992）→ 1次の減少として較正 ★
//  - 筋トレによる筋グリコーゲンの減少: 1回のセッションで24〜40%（MacDougall, Tesch）。Robergs 1991: 12RM×3セットで約26%、6セットで約38%。
//    2025年のメタ解析（Acute effects of resistance exercise on skeletal muscle glycogen depletion）は、セット数・時間が多いほど減少が大きく、
//    予測区間が非常に広いことを示した → 有効セット数からの指数飽和（3セット約25%、6セット約38%、上限55%）で表し、スケールを不確かさとして振る ★
//  - 絶食中、筋グリコーゲンはほとんど減らない（Jensen 2011 レビュー等）: 筋は血糖を作れないため、安静時の糖質は肝臓・食事由来
//  - 回復速度: 運動後は筋グリコーゲン合成が速まる（枯渇度に応じた補正） ★
//  - 糖質酸化の自己調節: 貯蔵が少ないと糖質酸化が減り脂肪酸化が増える（Flattのグリコーゲン緩衝モデル）。強さは本モデルの仮定 ★
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GlycogenModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const KCAL_PER_G_CHO = 4.1;
  const LEG_KEYS = ['quads', 'hams', 'glutes', 'calves'];
  const ABSORB = [0.35, 0.30, 0.20, 0.15];   // 摂取した糖質の吸収（摂取時刻から4時間）
  const NOMINAL = {
    gpk: 15,                 // 筋肉1kgあたりの貯蔵量(g)
    liverCapBase: 100,       // 肝臓の貯蔵量(g)（除脂肪量60kg相当）
    fFed: 0.55, fFast: 0.38, // 安静時エネルギーに占める糖質の割合（吸収中 / 絶食時）
    gng0: 0.60, gngSlope: 0.30,   // 糖新生が血糖維持に占める割合（肝グリコーゲンが減るほど増える）
    liverUptakeW: 1.5, liverUptakeMaxGh: 12,
    rateBase: 0.35, rateBoost: 2, rateMax: 1.1,   // 筋のグリコーゲン合成速度(g/kg筋肉/h)。枯渇しているほど速い
    exMuscleShare: 0.7,      // 運動の糖質酸化のうち筋グリコーゲン由来の割合
    legWeight: 3, oxFeedback: 0.5,            // 部位を特定できない運動(METs)は脚に重みを置く
    basalMuscle: 0.002,      // 日常活動による筋グリコーゲンの自然な減少(/h)
    lambda: 0.20, dmax: 0.55, strengthScale: 1,   // 筋トレ: 有効セットsでの減少割合 = dmax×(1−exp(−λ·s))
    carbScale: 1, eeScale: 1, exHourShift: 0, capMuscleMult: 1, liverCapMult: 1, rateMult: 1,
    initLiverFill: 0.6, initMuscleFill: 0.75,
  };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // days: [{date, carbIn:[24](g), eeRest:[24](kcal), exCho:[{hour, g, legs:bool}], strength:[{hour, sets:{key:有効セット}}], imputed}]
  // body: {lbm, smm}  groups: [{key, share}]（shareの合計は1）
  function run(days, body, groups, p, endHour, wantSeries) {
    const smm = body.smm > 0 ? body.smm : 25, lbm = body.lbm > 0 ? body.lbm : 55;
    const liverCap = clamp(p.liverCapBase * lbm / 60, 70, 130) * p.liverCapMult;
    const mass = groups.map(g => g.share * smm);                       // kg
    const cap = mass.map(m => m * p.gpk * p.capMuscleMult);           // g
    const legW = groups.map(g => g.share * (LEG_KEYS.includes(g.key) ? p.legWeight : 1)), legSum = legW.reduce((a, b) => a + b, 0);   // 筋量×(脚は3倍)で配分
    const capSum = cap.reduce((a, b) => a + b, 0);
    let L = liverCap * p.initLiverFill, M = cap.map(c => c * p.initMuscleFill);
    let surplus = 0; const series = [];
    const nd = days.length;
    // 吸収スケジュール: 日×時間の配列
    const absorbed = days.map(() => Array(24).fill(0));
    days.forEach((d, di) => d.carbIn.forEach((g, h) => {
      if (!(g > 0)) return;
      ABSORB.forEach((w, k) => { const hh = h + k, dd = di + Math.floor(hh / 24); if (dd < nd) absorbed[dd][hh % 24] += g * p.carbScale * w; });
    }));
    for (let di = 0; di < nd; di++) {
      const d = days[di], last = di === nd - 1, hEnd = last && endHour != null ? clamp(Math.round(endHour), 0, 24) : 24;
      for (let h = 0; h < hEnd; h++) {
        const A = absorbed[di][h], EEn = d.eeRest[h] * p.eeScale;
        // ── 安静時の糖質需要: 吸収中は多く、絶食中は少ない ──
        // 貯蔵が少ないほど糖質の酸化を減らして脂肪酸化に回し（自己調節: Flatt）、満タンに近いほど糖質を多く使う。満タン比0.8で係数1
        const fillAll = (L + M.reduce((a, b) => a + b, 0)) / (liverCap + capSum), oxScale = clamp(1 + p.oxFeedback * (fillAll - 0.8), 0.6, 1.2);
        const absNeed = EEn * p.fFed * oxScale / KCAL_PER_G_CHO;
        const f = (p.fFast + (p.fFed - p.fFast) * (absNeed > 0 ? Math.min(1, A / absNeed) : 0)) * oxScale;
        const need = EEn * f / KCAL_PER_G_CHO;
        const fromAbs = Math.min(A, need); let avail = A - fromAbs; const shortfall = need - fromAbs;
        const gng = clamp(p.gng0 + p.gngSlope * (1 - L / liverCap), 0, 0.95);
        L -= Math.min(L, shortfall * (1 - gng));
        // ── 運動（持久系・METs）: 糖質酸化の一部を筋グリコーゲンから ──
        (d.exCho || []).forEach(e => {
          if (Math.round(e.hour + p.exHourShift) % 24 !== h) return;
          const want = e.g * p.exMuscleShare; let took = 0;
          groups.forEach((g, gi) => { const w = e.legs ? legW[gi] / legSum : g.share; const t = Math.min(M[gi], want * w); M[gi] -= t; took += t; });
          const blood = e.g - took, fromA = Math.min(avail, blood); avail -= fromA; L -= Math.min(L, blood - fromA);
        });
        // ── 筋トレ: セッション中の有効セット数に応じて、その部位の筋グリコーゲンが減る ──
        (d.strength || []).forEach(s => {
          if (Math.round(s.hour + p.exHourShift) % 24 !== h) return;
          groups.forEach((g, gi) => { const sets = (s.sets && s.sets[g.key]) || 0; if (sets > 0) M[gi] -= M[gi] * p.dmax * (1 - Math.exp(-p.lambda * sets * p.strengthScale)); });
        });
        // ── 日常活動の自然な減少 ──
        for (let gi = 0; gi < M.length; gi++) M[gi] -= M[gi] * p.basalMuscle;
        // ── 余った糖質の貯蔵: 肝臓（必要量に応じて優先）→ 筋肉（枯渇度で加速）→ 残りは肝臓へ ──
        if (avail > 0) {
          const Mtot = M.reduce((a, b) => a + b, 0), capTot = cap.reduce((a, b) => a + b, 0);
          const wL = p.liverUptakeW * (liverCap - L), wM = capTot - Mtot;
          let uL = (wL + wM) > 0 ? Math.min(avail * wL / (wL + wM), liverCap - L, p.liverUptakeMaxGh) : 0;
          L += uL; let rest = avail - uL;
          const desired = groups.map((g, gi) => { const fill = cap[gi] > 0 ? M[gi] / cap[gi] : 1;
            return Math.max(0, Math.min(Math.min(p.rateMax, p.rateBase * (1 + p.rateBoost * (1 - fill))) * mass[gi] * p.rateMult, cap[gi] - M[gi])); });
          const dSum = desired.reduce((a, b) => a + b, 0), sc = dSum > 0 ? Math.min(1, rest / dSum) : 0;
          desired.forEach((x, gi) => { M[gi] += x * sc; rest -= x * sc; });
          const uL2 = Math.min(rest, liverCap - L); L += uL2; rest -= uL2; surplus += Math.max(0, rest);
        }
        if (wantSeries) series.push({ day: di, hour: h, liver: L, muscle: M.reduce((a, b) => a + b, 0) });
      }
    }
    const muscle = M.reduce((a, b) => a + b, 0);
    return { liver: L, muscle, total: L + muscle, liverCap, muscleCap: cap.reduce((a, b) => a + b, 0), groups: groups.map((g, gi) => ({ key: g.key, g: M[gi], cap: cap[gi] })), surplus, series };
  }

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const U = (r, a, b) => a + (b - a) * r();
  // 不確かなパラメータの分布（★本モデルの仮定。範囲は幅の目安であり、統計的な信頼区間ではない）
  function sampleParams(r) {
    return { ...NOMINAL,
      capMuscleMult: U(r, 0.8, 1.25), liverCapMult: U(r, 0.8, 1.25), gpk: NOMINAL.gpk,
      carbScale: U(r, 0.88, 1.12), eeScale: U(r, 0.92, 1.08),
      fFed: NOMINAL.fFed + U(r, -0.07, 0.07), fFast: NOMINAL.fFast + U(r, -0.06, 0.06),
      gng0: U(r, 0.5, 0.7), liverUptakeMaxGh: U(r, 8, 16),
      oxFeedback: U(r, 0.2, 0.8), rateMult: U(r, 0.7, 1.3), strengthScale: U(r, 0.6, 1.4), exMuscleShare: U(r, 0.55, 0.85), basalMuscle: U(r, 0.001, 0.003),
      exHourShift: Math.round(U(r, -2, 2)), initLiverFill: U(r, 0.35, 1), initMuscleFill: U(r, 0.5, 1),
    };
  }
  function perc(arr, q) { const a = arr.slice().sort((x, y) => x - y), i = (a.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return a[lo] + (a[hi] - a[lo]) * (i - lo); }

  // opts: {days, body, groups, endHour, runs, seed}
  function estimate(opts) {
    const groups = opts.groups && opts.groups.length ? opts.groups : [{ key: 'all', share: 1 }], days = opts.days, body = opts.body || {};
    if (!days || !days.length) return { empty: true };
    const nominal = run(days, body, groups, NOMINAL, opts.endHour, true);
    const runs = opts.runs || 120, r = mulberry32(opts.seed || 20261117), fin = [], serTot = [];
    const nSer = nominal.series.length; for (let i = 0; i < nSer; i++) serTot.push([]);
    for (let k = 0; k < runs; k++) {
      const p = sampleParams(r);
      // 未記録日の補完分は、日ごとに摂取量を±30%振る
      // （別の乱数列を使い、パラメータの抽選に影響しないようにする。日ごとに1つの倍率）
      const rd = mulberry32((opts.seed || 20261117) * 7919 + k + 1);
      const dd = days.map(d => { if (!d.imputed) return d; const f = U(rd, 0.7, 1.3); return { ...d, carbIn: d.carbIn.map(g => g * f) }; });
      const res = run(dd, body, groups, p, opts.endHour, true);
      fin.push(res); res.series.forEach((s, i) => { if (i < nSer) serTot[i].push(s.liver + s.muscle); });
    }
    const q = (f, a) => perc(fin.map(f), a);
    const range = f => ({ lo: q(f, 0.1), hi: q(f, 0.9) });
    const bandSeries = nominal.series.map((s, i) => ({ day: s.day, hour: s.hour, total: s.liver + s.muscle, lo: perc(serTot[i], 0.1), hi: perc(serTot[i], 0.9) }));
    return {
      empty: false, runs, now: { liver: nominal.liver, muscle: nominal.muscle, total: nominal.total },
      caps: { liver: nominal.liverCap, muscle: nominal.muscleCap, total: nominal.liverCap + nominal.muscleCap },
      range: { liver: range(x => x.liver), muscle: range(x => x.muscle), total: range(x => x.total) },
      groups: nominal.groups, surplus: nominal.surplus, series: bandSeries,
    };
  }
  // 運動の糖質酸化の割合(強度が高いほど糖質の寄与が大きい)
  function choFractionByMets(mets) { return mets < 3 ? 0.35 : mets < 6 ? 0.5 : mets < 9 ? 0.65 : 0.75; }
  return { NOMINAL, ABSORB, run, estimate, sampleParams, mulberry32, choFractionByMets, KCAL_PER_G_CHO, LEG_KEYS };
});
