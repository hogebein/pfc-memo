// グリコーゲン推定（モデルの生理学的な妥当性・誤差範囲・アプリ統合）のテスト
const { loadApp, makeT, sleep } = require('./harness');
const G = require('../glycogen-model.js');
const { w, errs } = loadApp(); const t = makeT(); const ev = s => w.eval(s);
const near = (a, b, e) => Math.abs(a - b) <= e;
const body = { lbm: 54, smm: 27 };
const groups = [{ key: 'quads', share: 0.16 }, { key: 'hams', share: 0.09 }, { key: 'glutes', share: 0.10 }, { key: 'calves', share: 0.05 }, { key: 'chest', share: 0.05 }, { key: 'other', share: 0.55 }];
const ee = kcal => Array.from({ length: 24 }, (_, h) => (h < 7 ? 0.85 : 1) * kcal / 24 / ((7 * 0.85 + 17) / 24));
const day = (o = {}) => ({ date: 'x', carbIn: Array(24).fill(0), eeRest: ee(2100), exCho: [], strength: [], ...o });
const meals = g => { const a = Array(24).fill(0); a[7] = g; a[12] = g; a[19] = g; return a; };
const P = o => ({ ...G.NOMINAL, ...o });
const full = { initLiverFill: 1, initMuscleFill: 1 };

// ── モデル ──
const f24 = G.run([day()], body, groups, P(full), 24, false);
t('24h fast: liver falls ~65% (Magnusson 1992), within 55–75%', (1 - f24.liver / f24.liverCap) > 0.55 && (1 - f24.liver / f24.liverCap) < 0.75);
t('24h fast: muscle glycogen barely changes (< 8% down)', f24.muscle / f24.muscleCap > 0.92);
const f72 = G.run([day(), day(), day()], body, groups, P(full), 24, false);
t('72h fast: liver nearly empty, muscle still > 75%', f72.liver < 10 && f72.muscle / f72.muscleCap > 0.75);
t('capacity ≈ 500g total (liver ~90, muscle 15g/kg×27kg)', near(f24.muscleCap, 405, 1) && near(f24.liverCap, 90, 1));
const steady = G.run(Array.from({ length: 6 }, () => day({ carbIn: meals(80) })), body, groups, P({}), 24, false);
t('240g carbs/day: stores full', steady.muscle / steady.muscleCap > 0.97 && steady.liver / steady.liverCap > 0.8);
const low = G.run(Array.from({ length: 7 }, () => day({ carbIn: meals(15) })), body, groups, P({}), 24, false);
t('45g carbs/day for a week: muscle clearly lower (40–70%), liver low', low.muscle / low.muscleCap > 0.4 && low.muscle / low.muscleCap < 0.7 && low.liver / low.liverCap < 0.3);
t('more carbs → monotonically higher stores', (() => { const v = [20, 40, 60, 80].map(g => G.run(Array.from({ length: 5 }, () => day({ carbIn: meals(g) })), body, groups, P({}), 24, false).total); return v.every((x, i) => i === 0 || x >= v[i - 1] - 1e-9); })());
const sess = { hour: 18, sets: { quads: 9, glutes: 5, hams: 3, calves: 2 } };
const lead = Array.from({ length: 4 }, () => day({ carbIn: meals(80) }));
const pre = G.run([...lead, day({ carbIn: meals(80), strength: [sess] })], body, groups, P({}), 18, false), post = G.run([...lead, day({ carbIn: meals(80), strength: [sess] })], body, groups, P({}), 19, false);
const qd = r => r.groups.find(g => g.key === 'quads'), ch = r => r.groups.find(g => g.key === 'chest');
const dep = 1 - qd(post).g / qd(pre).g;
t('leg session (9 effective quad sets) depletes quads 30–50%', dep > 0.30 && dep < 0.50);
t('untrained muscles (chest) are not depleted by the leg session', near(ch(post).g, ch(pre).g, ch(pre).g * 0.01));
const s3 = G.run([...lead, day({ carbIn: meals(80), strength: [{ hour: 18, sets: { quads: 3 } }] })], body, groups, P({}), 19, false), s6 = G.run([...lead, day({ carbIn: meals(80), strength: [{ hour: 18, sets: { quads: 6 } }] })], body, groups, P({}), 19, false);
const d3 = 1 - qd(s3).g / qd(pre).g, d6 = 1 - qd(s6).g / qd(pre).g;
t('Robergs 1991 shape: 3 sets ≈ 20–30%, 6 sets ≈ 33–45%, more sets → more depletion', d3 > 0.20 && d3 < 0.30 && d6 > 0.33 && d6 < 0.45 && d6 > d3);
const rec = G.run([...lead, day({ carbIn: meals(80), strength: [sess] }), day({ carbIn: meals(100) })], body, groups, P({}), 24, false);
t('refills within ~a day on normal-high carbs', qd(rec).g / qd(rec).cap > 0.93);
const recLow = G.run([...lead, day({ carbIn: meals(80), strength: [sess] }), day({ carbIn: meals(10) })], body, groups, P({}), 24, false);
t('refills much less on very low carbs', qd(recLow).g / qd(recLow).cap < qd(rec).g / qd(rec).cap - 0.1);
const run1 = G.run([...lead, day({ carbIn: meals(80), exCho: [{ hour: 18, g: 80, legs: true }] })], body, groups, P({}), 19, false), runPre = G.run([...lead, day({ carbIn: meals(80) })], body, groups, P({}), 18, false);
t('endurance exercise (80g carbs oxidised) lowers muscle glycogen', run1.muscle < runPre.muscle - 30);
t('legs are depleted more than chest by METs-type exercise', (qd(runPre).g - qd(run1).g) / qd(runPre).g > (ch(runPre).g - ch(run1).g) / ch(runPre).g * 2);
t('end hour truncates the simulation', G.run([day({ carbIn: meals(80) })], body, groups, P({}), 6, false).total !== G.run([day({ carbIn: meals(80) })], body, groups, P({}), 24, false).total);
t('stores stay within [0, capacity]', (() => { const r = G.run(Array.from({ length: 5 }, () => day({ carbIn: meals(300) })), body, groups, P({}), 24, true); return r.series.every(s => s.liver >= 0 && s.liver <= r.liverCap + 1e-6 && s.muscle >= 0 && s.muscle <= r.muscleCap + 1e-6); })());
t('choFraction rises with intensity', G.choFractionByMets(2) < G.choFractionByMets(5) && G.choFractionByMets(5) < G.choFractionByMets(8) && G.choFractionByMets(8) < G.choFractionByMets(11));
t('oxidation feedback: depleted stores refill faster than with no feedback', (() => { const d = Array.from({ length: 3 }, () => day({ carbIn: meals(70) })); const a = G.run(d, body, groups, P({ initLiverFill: 0.3, initMuscleFill: 0.4, oxFeedback: 0.5 }), 24, false), b = G.run(d, body, groups, P({ initLiverFill: 0.3, initMuscleFill: 0.4, oxFeedback: 0 }), 24, false); return a.total > b.total; })());
t('overnight fast after a depleting session: little muscle refill until breakfast', (() => { const lead2 = Array.from({ length: 4 }, () => day({ carbIn: meals(80) })); const at = h => G.run([...lead2, day({ carbIn: meals(80), strength: [sess] }), day({ carbIn: meals(80) })], body, groups, P({}), h, false).groups.find(g => g.key === 'quads').g; return at(6) - at(0) < 5; })());
// ── 誤差範囲（Monte Carlo） ──
const est = G.estimate({ days: Array.from({ length: 7 }, () => day({ carbIn: meals(80) })), body, groups, endHour: 14, runs: 100 });
t('range brackets the nominal estimate for total/liver/muscle', ['total', 'liver', 'muscle'].every(k => est.range[k].lo <= est.now[k] + 1e-6 && est.range[k].hi >= est.now[k] - 1e-6));
t('range is a sensible width (total 80% band ≈ 10–45% of nominal)', (est.range.total.hi - est.range.total.lo) / est.now.total > 0.1 && (est.range.total.hi - est.range.total.lo) / est.now.total < 0.45);
t('estimate is deterministic (same seed → same numbers)', JSON.stringify(est.range) === JSON.stringify(G.estimate({ days: Array.from({ length: 7 }, () => day({ carbIn: meals(80) })), body, groups, endHour: 14, runs: 100 }).range));
t('imputed days widen the range (same parameter draws, extra day-to-day intake noise)', (() => { const mk = imp => Array.from({ length: 6 }, () => day({ carbIn: meals(60), imputed: imp })), a = G.estimate({ days: mk(false), body, groups, endHour: 24, runs: 200 }), b = G.estimate({ days: mk(true), body, groups, endHour: 24, runs: 200 }); return (b.range.total.hi - b.range.total.lo) > (a.range.total.hi - a.range.total.lo) + 1; })());
t('time series covers every simulated hour with band ordered lo ≤ total ≤ hi', est.series.length === 6 * 24 + 14 && est.series.every(s => s.lo <= s.total + 1e-6 && s.total <= s.hi + 1e-6));
t('empty input → empty', G.estimate({ days: [], body, groups }).empty === true);

// ── アプリ統合 ──
setTimeout(async () => {
  try {
    const ds = n => ev(`glyAddDays(toDateStr(new Date()), ${n})`);
    t('card renders the insufficient-data message first', /2日以上/.test((w.renderGlycogenEval(), w.document.getElementById('glycogenEval').innerHTML)));
    // 5日分の食事（1日 昼・夕）と、昨日の脚トレ
    ev("profile.weight=66;profile.bf=null;entries=[];exercises=[];strengthLog=[]");
    for (let i = 5; i >= 1; i--) { const d = ds(-i); [['昼食', '12:30', 90], ['夕食', '19:30', 110]].forEach(([m, tm, c], k) => ev(`entries.push({id:${1e6 + i * 10 + k},date:'${d}',meal:'${m}',time:'${tm}',name:'x',amount:100,cal:600,p:30,f:15,c:${c},fiber:5,salt:1})`)); }
    ev(`strengthLog.push({id:1,date:'${ds(-1)}',ex:'squat',name:'スクワット',sets:Array.from({length:6},()=>({kg:100,reps:8,rir:1}))})`);
    const now = new w.Date(ds(0) + 'T14:00:00');
    const r = w.glycogenEstimate(now);
    t('estimate available with 5 logged days; today empty before first meal handled', !r.insufficient && !r.empty && r.inp.loggedDays === 5 && r.inp.days.length === 5 + 1);
    t('available carbs = carbohydrate − fibre (85g and 105g)', near(r.inp.days[1].carbIn[12], 85, 1e-9) && near(r.inp.days[1].carbIn[19], 105, 1e-9));
    t('logged meal time is used (12:30 → hour 12, 19:30 → hour 19)', r.inp.days[1].carbIn[12] > 0 && r.inp.days[1].carbIn[19] > 0 && r.inp.days[1].carbIn[13] === 0);
    t('strength sets are fed into the model as effective sets on the training day', (s => s && s.sets.quads > 5.9 && s.sets.glutes > 2.9)(r.inp.days[4].strength[0]));
    t('range wraps the estimate; liver ≤ ~cap, total ≤ ~cap×1.25', r.range.total.lo <= r.now.total && r.now.total <= r.range.total.hi && r.now.total <= r.caps.total + 1e-6);
    // 脚トレをしていない場合より、昨日の脚トレ後は筋グリコーゲンが低い or 回復済みで同等以下
    const noTr = (ev("strengthLog=[]"), w.glycogenEstimate(new w.Date(ds(0) + 'T14:00:00')));
    t('without the leg session muscle glycogen is not lower', noTr.now.muscle >= r.now.muscle - 1e-6);
    // 未記録日の補完
    ev("entries=entries.filter(e=>e.date!=='" + ds(-3) + "')"); const imp = w.glycogenEstimate(new w.Date(ds(0) + 'T14:00:00'));
    t('an unlogged day in the middle is imputed with the average and flagged', imp.inp.imputedDays === 1 && imp.inp.days.find(d => d.imputed) && near(imp.inp.avgCarb, 190, 1e-6));
    // カード表示
    ev("strengthLog=[]"); w.renderGlycogenEval(); const html = w.document.getElementById('glycogenEval').innerHTML;
    t('card shows grams first with a range ("約…g", "誤差範囲", "〜")', /現在の推定（合計）/.test(html) && /約\d+<\/span><span[^>]*>g/.test(html) && /誤差範囲（80%の幅）\d+〜\d+ g/.test(html));
    t('card shows liver and muscle ranges and the cap', /肝臓/.test(html) && /筋肉/.test(html) && (html.match(/範囲 \d+〜\d+ g/g) || []).length === 2 && /満タン目安 約\d+ g/.test(html));
    t('card contains the trend chart (svg with band + line) and the limitations text', /<svg[^>]*aria-label="グリコーゲン推定の推移"/.test(html) && /<polygon/.test(html) && /<polyline/.test(html) && /統計的な信頼区間ではなく/.test(html));
    t('per-muscle breakdown is listed', /部位別/.test(html) && /大腿四頭筋: 約\d+g（\d+%）/.test(html));
    t('chart is limited to the last 7 days', (html.match(/stroke-dasharray="2,2"/g) || []).length <= 6);
    // 結果キャッシュ
    const a = w.glycogenEstimate(new w.Date(ds(0) + 'T14:00:00')), b = w.glycogenEstimate(new w.Date(ds(0) + 'T14:10:00'));
    t('same inputs → cached result object', a === b);
    t('different hour → recomputed', w.glycogenEstimate(new w.Date(ds(0) + 'T20:00:00')) !== a);
    // 運動(METs)の入力
    ev(`exercises.push({id:77,date:'${ds(-1)}',name:'ランニング',minutes:60,cal:600})`); const rx = w.glycogenInput(ev("toDateStr(new Date())"), 14);
    t('METs exercise becomes carbohydrate use (600kcal in 1h at 66kg ≈ 9 METs → 75% carbs ≈ 110g at 18:00)', (x => x && near(x.g, 600 * 0.75 / 4.1, 1) && x.hour === 18)(rx.days[4].exCho[0]));
    ev(`exercises.push({id:78,date:'${ds(-1)}',name:'筋トレ（セット記録から自動）',minutes:15,cal:50,auto:'strength'})`); const rx2 = w.glycogenInput(ev("toDateStr(new Date())"), 14);
    t('auto strength calories are not double counted as endurance exercise', rx2.days[4].exCho.length === 1);
    // 統計タブ描画から呼ばれる
    t('renderStats includes the glycogen card', /renderGlycogenEval\(\);/.test(require('fs').readFileSync(__dirname + '/../app.js', 'utf8')));
    t('script registered in service worker', /glycogen-model\.js/.test(require('fs').readFileSync(__dirname + '/../sw.js', 'utf8')));
    t.done(errs);
  } catch (x) { console.log('EXC', x); process.exit(1); }
}, 300);
