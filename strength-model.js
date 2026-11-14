// 筋トレ記録 → 部位別ボリューム → 筋肥大の見込み評価（純粋な計算モジュール。DOM非依存）
//
// 根拠（係数のうち ★ は研究の「形」だけを使い、数値は本モデルの仮定。画面にもその旨を表示する）
//  - 週あたりセット数と筋肥大: Pelland et al. 2026 (Sports Med 56(2):481-505)。平方根型の逓減カーブ、明確な頭打ちなし、
//    間接的に鍛えた部位は0.5セット換算（fractional法）、頻度そのものの追加効果は小さい → セット数の合計で評価する
//  - 限界までの余力(RIR): Robinson et al. 2024 (Sports Med 54(9)) 。筋肥大は限界に近いセットほど有利 ★重みは連続カーブの近似
//  - 負荷/回数: Lopez et al. 2021 (MSSE 53(6)) 。限界近くまでやれば低〜高負荷で筋肥大は同程度 → 5〜30回を満額で数える
//  - エネルギー収支: Murphy & Koehler 2022 (SJMSS) 。不足量と除脂肪量変化の回帰直線は、平均して約500kcal/日の不足でゼロと交わる。
//    ただし対象は平均51〜60歳で未経験者・過体重が多く、鍛錬者のデータは不足、維持カロリー付近の人は多くが除脂肪量を増やしていた。
//    → ゼロ点(500kcal)は論文どおりに置き、軽い赤字ほど影響が小さい凸のカーブにする。経験が浅い人・体脂肪が多い人はさらに緩める ★
//  - リコンプ: Barakat et al. 2020 (Strength Cond J 42(5))。鍛錬者でも、漸進的な筋トレ・十分なタンパク質・控えめなエネルギー収支がそろえば
//    脂肪減少と除脂肪量増加は同時に起こりうる。体脂肪が多いほど蓄えのエネルギーを使えるため起こりやすい。筋肉を1kg作るエネルギーは約3〜4.6kcal/g（Slater 2019）
//    → 筋肥大に必要な余剰エネルギーは小さく、軽い赤字では阻害されにくい。体組成の変化(脂肪)は 7200kcal/kg・筋肉 4500kcal/kg で収支から見積もる（アプリの体組成モードと同じ換算）
//  - タンパク質: Morton et al. 2018 (BJSM) 。除脂肪量の増加は約1.6g/kg/日で頭打ち
//  - 経験の蓄積: 区分(初心者/中級…)ではなく、部位ごとの累積「有効セット数」から伸びしろの残りを指数で減衰させる ★
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StrengthModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // share: 骨格筋量に占める概算割合（評価対象の13部位。脊柱起立筋・内転筋・前腕などは対象外なので合計は1未満）
  const MUSCLES = [
    { key: 'chest', name: '大胸筋', share: 0.05 },
    { key: 'lats', name: '広背筋', share: 0.07 },
    { key: 'upperback', name: '僧帽筋・菱形筋', share: 0.07 },
    { key: 'delt_front', name: '三角筋 前部', share: 0.02 },
    { key: 'delt_side', name: '三角筋 中部', share: 0.02 },
    { key: 'delt_rear', name: '三角筋 後部', share: 0.02 },
    { key: 'biceps', name: '上腕二頭筋', share: 0.03 },
    { key: 'triceps', name: '上腕三頭筋', share: 0.04 },
    { key: 'quads', name: '大腿四頭筋', share: 0.16 },
    { key: 'hams', name: 'ハムストリングス', share: 0.09 },
    { key: 'glutes', name: '大臀筋', share: 0.10 },
    { key: 'calves', name: '下腿三頭筋', share: 0.05 },
    { key: 'abs', name: '腹筋', share: 0.04 },
  ];
  const MUSCLE_BY_KEY = Object.fromEntries(MUSCLES.map(m => [m.key, m]));

  // d: 直接鍛える部位(1.0) / i: 間接的に使われる部位(0.5)
  const EXERCISES = [
    { k: 'bench', n: 'ベンチプレス', g: '胸', d: ['chest'], i: ['delt_front', 'triceps'] },
    { k: 'incline', n: 'インクラインプレス', g: '胸', d: ['chest'], i: ['delt_front', 'triceps'] },
    { k: 'db_press', n: 'ダンベルプレス', g: '胸', d: ['chest'], i: ['delt_front', 'triceps'] },
    { k: 'fly', n: 'フライ（ダンベル/ケーブル）', g: '胸', d: ['chest'], i: ['delt_front'] },
    { k: 'pushup', n: '腕立て伏せ', g: '胸', d: ['chest'], i: ['delt_front', 'triceps'] },
    { k: 'dips', n: 'ディップス', g: '胸', d: ['chest', 'triceps'], i: ['delt_front'] },
    { k: 'pullup', n: '懸垂', g: '背中', d: ['lats'], i: ['biceps', 'upperback'] },
    { k: 'pulldown', n: 'ラットプルダウン', g: '背中', d: ['lats'], i: ['biceps'] },
    { k: 'bb_row', n: 'ベントオーバーロウ', g: '背中', d: ['lats', 'upperback'], i: ['biceps', 'delt_rear'] },
    { k: 'db_row', n: 'ワンハンドロウ', g: '背中', d: ['lats', 'upperback'], i: ['biceps', 'delt_rear'] },
    { k: 'seated_row', n: 'シーテッドロウ', g: '背中', d: ['upperback', 'lats'], i: ['biceps', 'delt_rear'] },
    { k: 'shrug', n: 'シュラッグ', g: '背中', d: ['upperback'], i: [] },
    { k: 'deadlift', n: 'デッドリフト', g: '脚・背中', d: ['hams', 'glutes'], i: ['quads', 'upperback'] },
    { k: 'rdl', n: 'ルーマニアンデッドリフト', g: '脚・背中', d: ['hams', 'glutes'], i: [] },
    { k: 'ohp', n: 'ショルダープレス', g: '肩', d: ['delt_front', 'delt_side'], i: ['triceps'] },
    { k: 'lateral', n: 'サイドレイズ', g: '肩', d: ['delt_side'], i: [] },
    { k: 'front_raise', n: 'フロントレイズ', g: '肩', d: ['delt_front'], i: [] },
    { k: 'rear_fly', n: 'リアレイズ/フェイスプル', g: '肩', d: ['delt_rear'], i: ['upperback'] },
    { k: 'curl', n: 'カール（バーベル/ダンベル）', g: '腕', d: ['biceps'], i: [] },
    { k: 'hammer', n: 'ハンマーカール', g: '腕', d: ['biceps'], i: [] },
    { k: 'pushdown', n: 'プッシュダウン', g: '腕', d: ['triceps'], i: [] },
    { k: 'overhead_ext', n: 'オーバーヘッドエクステンション', g: '腕', d: ['triceps'], i: [] },
    { k: 'close_bench', n: 'クローズグリップベンチ', g: '腕', d: ['triceps', 'chest'], i: ['delt_front'] },
    { k: 'squat', n: 'スクワット', g: '脚', d: ['quads', 'glutes'], i: ['hams'] },
    { k: 'front_squat', n: 'フロントスクワット', g: '脚', d: ['quads'], i: ['glutes'] },
    { k: 'leg_press', n: 'レッグプレス', g: '脚', d: ['quads', 'glutes'], i: [] },
    { k: 'lunge', n: 'ランジ/ブルガリアンスクワット', g: '脚', d: ['quads', 'glutes'], i: ['hams'] },
    { k: 'leg_ext', n: 'レッグエクステンション', g: '脚', d: ['quads'], i: [] },
    { k: 'leg_curl', n: 'レッグカール', g: '脚', d: ['hams'], i: [] },
    { k: 'hip_thrust', n: 'ヒップスラスト', g: '脚', d: ['glutes'], i: ['hams'] },
    { k: 'calf', n: 'カーフレイズ', g: '脚', d: ['calves'], i: [] },
    { k: 'crunch', n: 'クランチ/レッグレイズ', g: '腹', d: ['abs'], i: [] },
  ];
  const EX_BY_KEY = Object.fromEntries(EXERCISES.map(e => [e.k, e]));

  // 種目 → 部位ごとの換算セット数（直接1.0 / 間接0.5）。カスタム種目は {custom:[muscleKey,...]}（直接のみ）
  function muscleWeights(entry) {
    const out = {};
    if (entry && entry.custom && entry.custom.length) { entry.custom.forEach(m => { if (MUSCLE_BY_KEY[m]) out[m] = 1; }); return out; }
    const ex = EX_BY_KEY[entry && entry.ex]; if (!ex) return out;
    ex.i.forEach(m => { out[m] = 0.5; }); ex.d.forEach(m => { out[m] = 1; });
    return out;
  }

  // ★ 限界までの余力(RIR)による重み。0〜1RIR=満額、遠いほど逓減（Robinson 2024 の連続的な傾向の近似）
  const RIR_Q = [1, 1, 0.95, 0.85, 0.65, 0.4, 0.2, 0.1];
  const DEFAULT_RIR = 2;
  function rirQuality(rir) {
    let r = Number.isFinite(rir) ? rir : DEFAULT_RIR; r = Math.max(0, Math.min(RIR_Q.length - 1, r));
    const lo = Math.floor(r), hi = Math.ceil(r); return RIR_Q[lo] + (RIR_Q[hi] - RIR_Q[lo]) * (r - lo);
  }
  // ★ 回数による重み。5〜30回は満額（Lopez 2021: 限界近くなら負荷によらず同程度）。1〜4回・31回超は根拠が薄いため割引
  function repQuality(reps) {
    if (!(reps > 0)) return 0; if (reps < 5) return 0.75; if (reps <= 30) return 1; if (reps <= 40) return 0.85; return 0.6;
  }
  function setQuality(s) { return rirQuality(s.rir) * repQuality(s.reps); }

  function dayNum(s) { const [y, m, d] = s.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); }

  // ★ エネルギー収支の係数。ゼロ点は論文の回帰直線（-500kcal/日）、形は凸（軽い赤字ほど影響が小さい: 100kcalで約0.91、250kcalで約0.65）。
  //   実効の不足量は 不足 × (1 - 0.5×初心者度) × (1 - 0.4×体脂肪の多さ) に縮める（最大で約0.3倍）。凸の形と緩和の大きさは本モデルの仮定。
  //   余剰側のボーナスは根拠が弱いので付けない
  function energyFactor(deltaKcal, A, fatShare) {
    if (!Number.isFinite(deltaKcal) || deltaKcal >= 0) return 1;
    const novice = Number.isFinite(A) ? Math.max(0, Math.min(1, (A - EXP_FLOOR) / (1 - EXP_FLOOR))) : 0;
    const fat = Number.isFinite(fatShare) ? Math.max(0, Math.min(1, fatShare)) : 0;
    const x = Math.min(1, (-deltaKcal * (1 - 0.5 * novice) * (1 - 0.4 * fat)) / 500);
    return Math.max(0, 1 - Math.pow(x, 1.5));
  }
  // ★ 体脂肪の多さ(0〜1)。男性12%以下=0〜25%以上=1、女性20%以下=0〜33%以上=1。体脂肪率が未入力なら0（緩和しない）
  function fatShareOf(bodyFatPct, sex) {
    if (!(bodyFatPct > 0)) return 0; const lo = sex === 'female' ? 20 : 12, hi = sex === 'female' ? 33 : 25;
    return Math.max(0, Math.min(1, (bodyFatPct - lo) / (hi - lo)));
  }
  // ★ タンパク質の係数: 1.6g/kgで1、0.5g/kg以下で0.85（Morton 2018 の頭打ち位置のみ根拠）
  function proteinFactor(gPerKg) { if (!Number.isFinite(gPerKg)) return 1; return 0.85 + 0.15 * Math.max(0, Math.min(1, (gPerKg - 0.5) / 1.1)); }
  // ★ 経験の係数: 累積有効セット C が増えるほど伸びしろが減る。C=0で1.0、C≈620(週12セット×1年)で約0.5、C≈3100(5年)で約0.1
  const EXP_TAU = 700, EXP_FLOOR = 0.08;
  function experienceFactor(C) { return EXP_FLOOR + (1 - EXP_FLOOR) * Math.exp(-Math.max(0, C) / EXP_TAU); }
  // ★ 4週あたりの筋サイズ変化(%)の係数: 経験0・週10有効セット・限界近くで12週+約7%（未経験者のRCTの典型値）になるよう較正
  const FAT_KCAL_PER_KG = 7200, MUSCLE_KCAL_PER_KG = 4500;
  const K4 = 0.73, RANGE_LOW = 0.55, RANGE_HIGH = 1.5;
  const SCORE_REF_SETS = 20;

  function statusOf(S) {
    if (S <= 0) return '未実施'; if (S < 4) return '刺激不足'; if (S < 10) return '最低限〜標準'; if (S <= 20) return '良好'; return '高ボリューム';
  }

  // opts: { log, endDate, seedSets(累積の初期値), deltaKcal, proteinPerKg, smm(骨格筋量kg) }
  function estimate(opts) {
    const log = (opts.log || []).filter(l => l && l.date && l.date <= opts.endDate && l.sets && l.sets.length);
    const seed = Math.max(0, opts.seedSets || 0), smm = opts.smm > 0 ? opts.smm : 25;
    if (!log.length) return { empty: true };
    const end = dayNum(opts.endDate), first = Math.min(...log.map(l => dayNum(l.date)));
    const windowDays = Math.max(7, Math.min(28, end - first + 1)), start = end - windowDays + 1;
    const win = {}, cum = {}; MUSCLES.forEach(m => { win[m.key] = 0; cum[m.key] = seed; });
    log.forEach(l => {
      const w = muscleWeights(l), q = l.sets.reduce((a, s) => a + setQuality(s), 0), dn = dayNum(l.date);
      Object.keys(w).forEach(k => { cum[k] += q * w[k]; if (dn >= start && dn <= end) win[k] += q * w[k]; });
    });
    const pF = proteinFactor(opts.proteinPerKg), fatShare = fatShareOf(opts.bodyFatPct, opts.sex); let eFsum = 0;
    let kgLow = 0, kgMid = 0, kgHigh = 0, scoreSum = 0;
    const muscles = MUSCLES.map(m => {
      const S = win[m.key] / windowDays * 7, A = experienceFactor(cum[m.key]);
      const eF = energyFactor(opts.deltaKcal, A, fatShare); eFsum += eF * m.share;
      const mid = K4 * Math.sqrt(S) * A * eF * pF;
      const score = Math.round(100 * Math.min(1, Math.sqrt(S / SCORE_REF_SETS)));
      kgLow += m.share * smm * mid * RANGE_LOW / 100; kgMid += m.share * smm * mid / 100; kgHigh += m.share * smm * mid * RANGE_HIGH / 100;
      scoreSum += m.share * score;
      return { key: m.key, name: m.name, weeklySets: Math.round(S * 10) / 10, cumSets: Math.round(cum[m.key]), expFactor: Math.round(A * 100) / 100, score,
        status: statusOf(S), gainLow: Math.round(mid * RANGE_LOW * 100) / 100, gainMid: Math.round(mid * 100) / 100, gainHigh: Math.round(mid * RANGE_HIGH * 100) / 100 };
    });
    const shareTotal = MUSCLES.reduce((a, m) => a + m.share, 0);
    // 4週間の体脂肪の変化(kg)の見込み: (収支 − 筋肉に回るエネルギー) / 脂肪のエネルギー。収支が不明なら出さない。筋肉が多く付く側ほど脂肪は減る方向
    let fatKg = null;
    if (Number.isFinite(opts.deltaKcal)) {
      const f = kg => Math.round(((opts.deltaKcal * 28 - kg * MUSCLE_KCAL_PER_KG) / FAT_KCAL_PER_KG) * 100) / 100, a = f(kgLow), b = f(kgHigh);
      fatKg = { low: Math.min(a, b), high: Math.max(a, b), mid: f(kgMid) };
    }
    return { empty: false, windowDays, energyFactor: Math.round(eFsum / shareTotal * 100) / 100, proteinFactor: pF, muscles, overallScore: Math.round(scoreSum / shareTotal), fatShare, fatKg,
      kgLow: Math.round(kgLow * 100) / 100, kgMid: Math.round(kgMid * 100) / 100, kgHigh: Math.round(kgHigh * 100) / 100 };
  }

  // 週(月曜始まり)×部位ごとの有効セット数（CSV出力用）
  function weekStart(ds) { const n = dayNum(ds), dow = (n + 3) % 7; /* 1970-01-01は木曜 → 月曜=0 */ return new Date((n - dow) * 86400000).toISOString().slice(0, 10); }
  function weeklyEffectiveSets(log) {
    const acc = {};
    (log || []).forEach(l => {
      const w = muscleWeights(l), q = (l.sets || []).reduce((a, s) => a + setQuality(s), 0), ws = weekStart(l.date);
      Object.keys(w).forEach(k => { const key = ws + '|' + k; acc[key] = (acc[key] || 0) + q * w[k]; });
    });
    return Object.keys(acc).sort().map(key => { const [week, m] = key.split('|'); return { week, key: m, name: MUSCLE_BY_KEY[m].name, sets: Math.round(acc[key] * 100) / 100 }; });
  }

  return { weekStart, weeklyEffectiveSets, MUSCLES, MUSCLE_BY_KEY, EXERCISES, EX_BY_KEY, muscleWeights, rirQuality, repQuality, setQuality, energyFactor, fatShareOf, proteinFactor, experienceFactor, estimate, statusOf, DEFAULT_RIR };
});
