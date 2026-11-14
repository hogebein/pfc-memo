// 筋トレ機能（計算モデル・記録UI・保存・クラウド同期・自動kcal）の回帰テスト。実行: npm install --no-save jsdom && node tests/strength.test.js
const { loadApp, makeT, sleep } = require('./harness');
const M = require('../strength-model.js');
const { w, errs } = loadApp(); const t = makeT(); const ev = s => w.eval(s); const $ = id => w.document.getElementById(id);
const near = (a, b, e) => Math.abs(a - b) <= e;
const mk = (date, ex, n, rir = 1, reps = 10) => ({ id: Math.random(), date, ex, name: ex, sets: Array.from({ length: n }, () => ({ kg: 50, reps, rir })) });

// ── 純粋モデル ──
t('RIR weight: 0-1 full, falls with distance', M.rirQuality(0) === 1 && M.rirQuality(1) === 1 && M.rirQuality(3) < M.rirQuality(2) && M.rirQuality(6) < 0.25);
t('RIR missing defaults to 2', M.rirQuality(undefined) === M.rirQuality(2));
t('rep weight: 5-30 full, 1-4 and 40+ discounted', M.repQuality(8) === 1 && M.repQuality(30) === 1 && M.repQuality(3) < 1 && M.repQuality(50) < M.repQuality(35));
const bw = M.muscleWeights({ ex: 'bench' }); t('fractional sets: bench = chest 1, triceps 0.5, front delt 0.5', bw.chest === 1 && bw.triceps === 0.5 && bw.delt_front === 0.5);
t('custom exercise counts direct only', JSON.stringify(M.muscleWeights({ custom: ['calves'] })) === '{"calves":1}');
t('energy factor: balance/surplus 1, −500 → 0, beyond → 0', M.energyFactor(100) === 1 && M.energyFactor(0) === 1 && M.energyFactor(-500) === 0 && M.energyFactor(-600) === 0);
t('mild deficit is convex (gentler than the linear line): −100 ≈ .91, −250 ≈ .65', near(M.energyFactor(-100), 1 - Math.pow(0.2, 1.5), 1e-9) && M.energyFactor(-100) > 0.9 && M.energyFactor(-250) > 0.5 && M.energyFactor(-250) < 0.7);
t('energy factor monotonic in deficit', [0, -50, -100, -200, -300, -400, -500].every((d, i, a) => i === 0 || M.energyFactor(d) < M.energyFactor(a[i - 1])));
t('body fat relief: higher fat share → higher factor, no bf → no relief', M.energyFactor(-300, 0.08, 1) > M.energyFactor(-300, 0.08, 0.5) && M.energyFactor(-300, 0.08, 0.5) > M.energyFactor(-300, 0.08, 0) && M.energyFactor(-300, 0.08, undefined) === M.energyFactor(-300, 0.08, 0));
t('fatShareOf: male 12→0, 18.5→.5, 25+→1; female shifted; missing → 0', M.fatShareOf(12, 'male') === 0 && near(M.fatShareOf(18.5, 'male'), 0.5, 1e-9) && M.fatShareOf(30, 'male') === 1 && M.fatShareOf(20, 'female') === 0 && M.fatShareOf(33, 'female') === 1 && M.fatShareOf(null, 'male') === 0 && M.fatShareOf(0, 'male') === 0);
t('protein factor: 1.6g/kg = 1, low < 1, never below .85', M.proteinFactor(1.6) === 1 && M.proteinFactor(2.5) === 1 && M.proteinFactor(0.2) === 0.85);
t('experience factor decays with cumulative sets', M.experienceFactor(0) === 1 && near(M.experienceFactor(620), 0.5, 0.1) && M.experienceFactor(3100) < 0.15 && M.experienceFactor(1e6) >= 0.08);
t('empty log → empty', M.estimate({ log: [], endDate: '2026-11-14' }).empty === true);
// 週12セット（胸のベンチ）を4週間
const dstr = back => { const d = new Date(Date.UTC(2026, 10, 14 - back)); return d.toISOString().slice(0, 10); };
const log = []; for (let wk = 0; wk < 4; wk++) for (const d of [1, 4]) log.push(mk(dstr(wk * 7 + d), 'bench', 6)); // 直近28日に週2回×6セット
const e = M.estimate({ log, endDate: '2026-11-14', smm: 28 }), chest = e.muscles.find(m => m.key === 'chest'), tri = e.muscles.find(m => m.key === 'triceps'), legs = e.muscles.find(m => m.key === 'quads');
t('window = days since first log (26d), weekly chest sets = 48/26*7', e.windowDays === 26 && near(chest.weeklySets, 48 / 26 * 7, 0.1));
t('triceps gets half (indirect)', near(tri.weeklySets, 24 / 26 * 7, 0.1)); t('untrained muscle = 0 sets/score 0', legs.weeklySets === 0 && legs.score === 0 && legs.gainMid === 0);
t('sqrt diminishing returns: 4x sets → 2x gain', (() => { const a = M.estimate({ log: [mk('2026-11-10', 'bench', 5)], endDate: '2026-11-14' }).muscles[0], b = M.estimate({ log: [mk('2026-11-10', 'bench', 20)], endDate: '2026-11-14' }).muscles[0]; return near(b.gainMid / a.gainMid, 2, 0.05); })());
t('range brackets mid', chest.gainLow < chest.gainMid && chest.gainMid < chest.gainHigh);
const far = M.estimate({ log: log.map(l => ({ ...l, sets: l.sets.map(s => ({ ...s, rir: 5 })) })), endDate: '2026-11-14' }).muscles[0];
t('sets far from failure are worth less', far.gainMid < chest.gainMid * 0.7 && far.weeklySets < chest.weeklySets * 0.5);
const hungry = M.estimate({ log, endDate: '2026-11-14', deltaKcal: -500, seedSets: 5000 }); t('experienced lifter at −500kcal/day: predicted gain 0 (paper regression line)', hungry.muscles[0].gainMid === 0 && hungry.kgMid === 0);
const hungryNovice = M.estimate({ log, endDate: '2026-11-14', deltaKcal: -500 }); t('novice at −500kcal/day still predicted to gain, but less than at balance', hungryNovice.muscles[0].gainMid > 0 && hungryNovice.muscles[0].gainMid < chest.gainMid * 0.7);
t('deficit tolerance rises with novice-ness, never above 1, never below 0', M.energyFactor(-500, 1) > M.energyFactor(-500, 0.2) && M.energyFactor(-2000, 1) === 0 && M.energyFactor(-300, 1) < 1);
t('weekStart is Monday (2026-11-14 Sat → 2026-11-09)', M.weekStart('2026-11-14') === '2026-11-09' && M.weekStart('2026-11-09') === '2026-11-09' && M.weekStart('2026-11-15') === '2026-11-09');
t('weeklyEffectiveSets sums per week × muscle', (r => r.find(x => x.key === 'chest' && x.week === '2026-11-09').sets === 12 && r.find(x => x.key === 'triceps' && x.week === '2026-11-09').sets === 6)(M.weeklyEffectiveSets([mk('2026-11-09', 'bench', 6), mk('2026-11-13', 'bench', 6)])));
const leanDef = M.estimate({ log, endDate: '2026-11-14', deltaKcal: -300, seedSets: 5000, bodyFatPct: 12, sex: 'male' }).muscles[0], fatDef = M.estimate({ log, endDate: '2026-11-14', deltaKcal: -300, seedSets: 5000, bodyFatPct: 28, sex: 'male' }).muscles[0];
t('same deficit: higher body fat predicts more muscle gain than lean', fatDef.gainMid > leanDef.gainMid && leanDef.gainMid > 0);
const rc = M.estimate({ log, endDate: '2026-11-14', deltaKcal: 0, seedSets: 0 }); t('recomp at maintenance: muscle gain predicted AND fat decreases', rc.kgMid > 0 && rc.fatKg.mid < 0);
const rc2 = M.estimate({ log, endDate: '2026-11-14', deltaKcal: -250, seedSets: 0 }); t('mild deficit still predicts muscle gain (not zero) for a newer lifter, and more fat loss than maintenance', rc2.kgMid > 0 && rc2.fatKg.mid < rc.fatKg.mid);
t('fat change math: surplus +300/day, no muscle → +1.17kg; unknown balance → null', near(M.estimate({ log: [mk('2026-11-10', 'bench', 6)], endDate: '2026-11-14', deltaKcal: 300 }).fatKg.mid, (300 * 28 - M.estimate({ log: [mk('2026-11-10', 'bench', 6)], endDate: '2026-11-14', deltaKcal: 300 }).kgMid * 4500) / 7200, 0.01) && M.estimate({ log, endDate: '2026-11-14' }).fatKg === null);
t('fat range is ordered low ≤ mid ≤ high', rc.fatKg.low <= rc.fatKg.mid && rc.fatKg.mid <= rc.fatKg.high);
const vet = M.estimate({ log, endDate: '2026-11-14', seedSets: 1560 }).muscles[0]; t('prior experience (seed) lowers gain', vet.gainMid < chest.gainMid * 0.5);
t('seed does not change weekly sets', vet.weeklySets === chest.weeklySets);
t('short history uses ≥7 day window', M.estimate({ log: [mk('2026-11-14', 'bench', 6)], endDate: '2026-11-14' }).windowDays === 7);
t('log after endDate is ignored', M.estimate({ log: [mk('2026-11-20', 'bench', 6)], endDate: '2026-11-14' }).empty === true);

// ── アプリ統合 ──
setTimeout(async () => {
  try {
    t('StrengthModel loaded in app + exercise select populated', typeof w.StrengthModel === 'object' && $('stEx').options.length > 20);
    ev("fbDb={};fbUser={uid:'u1'};initialSyncDone=true"); let cloud = null; w.__fsApi = { doc: () => ({}), setDoc: async (r, p) => { cloud = JSON.parse(JSON.stringify(p)); }, getDoc: async () => ({ exists: () => !!cloud, data: () => cloud }) };
    ev("profile.weight=66;currentDate='2026-11-14'");
    $('stEx').value = 'bench'; w.onStExChange(); $('stKg').value = '60'; $('stReps').value = '8'; $('stRir').value = '2';
    w.stAddSet(); w.stAddSet(); w.stAddSet(); t('draft shows 3 sets, save enabled', ev('stDraft.length') === 3 && !$('stSaveBtn').disabled);
    w.stRemoveDraftSet(2); t('draft set removable', ev('stDraft.length') === 2);
    w.saveStrengthEntry(); await sleep(30);
    t('entry saved (2 sets, rir kept)', ev('strengthLog.length') === 1 && ev('strengthLog[0].sets.length') === 2 && ev('strengthLog[0].sets[0].rir') === 2);
    t('persisted to localStorage', JSON.parse(w.localStorage.getItem('pfcStrength')).length === 1);
    t('uploaded to cloud payload', !!cloud && cloud.strengthLog && cloud.strengthLog.length === 1);
    t('auto kcal logged as one exercise entry (2 sets × 2.5min × 4.5METs × 66kg)', (a => a.length === 1 && a[0].minutes === 5 && near(a[0].cal, 4.5 * 66 * 5 / 60, 0.1))(ev("exercises.filter(x=>x.auto==='strength')")));
    t('list renders set summary', /60kg×8＠2/.test($('strengthItems').innerHTML));
    // 同じ日に2種目 → 自動kcalは1件のまま合算
    $('stEx').value = '__custom'; w.onStExChange(); $('stCustomName').value = 'ふくらはぎプレス'; $('stCustomMuscle').value = 'calves'; $('stKg').value = '80'; $('stReps').value = '15'; w.stAddSet(); w.saveStrengthEntry();
    t('custom exercise saved with muscle', ev("strengthLog.find(e=>e.ex==='custom').custom[0]") === 'calves');
    t('still one auto entry, minutes cover all 3 sets', (a => a.length === 1 && a[0].minutes === 8)(ev("exercises.filter(x=>x.auto==='strength')")));
    // 評価カード
    w.renderStrengthEval(); const html = $('strengthEval').innerHTML; t('eval card shows trained muscles + range', /大胸筋/.test(html) && /下腿三頭筋/.test(html) && /4週で筋サイズ/.test(html));
    t('eval card escapes nothing dangerous', !/<script/i.test(html));
    // 自動kcal OFF
    w.setStrengthAutoCal(false); t('auto kcal OFF removes auto entries', ev("exercises.filter(x=>x.auto==='strength').length") === 0); w.setStrengthAutoCal(true);
    t('auto kcal ON restores', ev("exercises.filter(x=>x.auto==='strength').length") === 1);
    // 食事の補正
    ev("entries=[]"); for (let i = 0; i < 5; i++) ev(`entries.push({id:${9000 + i},date:'2026-11-${10 + i}',meal:'朝食',name:'x',amount:100,cal:1000,p:40,f:10,c:100})`);
    const ctx = w.strengthDietContext('2026-11-14'); t('diet context: 5 days, big deficit, protein/kg computed', ctx.days === 5 && ctx.deltaKcal < -500 && near(ctx.proteinPerKg, 40 / 66, 0.01));
    ev("profile.bf=null"); w.renderStrengthEval(); t('deficit shown in card note, with fat tile and no-bf caveat', /エネルギー収支/.test($('strengthEval').innerHTML) && /脂肪の変化\(推定\)/.test($('strengthEval').innerHTML) && /体脂肪率が未入力/.test($('strengthEval').innerHTML));
    ev("profile.bf=25"); w.renderStrengthEval(); t('with body fat set, caveat disappears', !/体脂肪率が未入力/.test($('strengthEval').innerHTML)); ev("profile.bf=null");
    // 削除 + 元に戻す
    const id = ev("strengthLog[0].id"); w.deleteStrengthEntry(id); t('delete removes entry and recalculates auto kcal', ev('strengthLog.length') === 1 && ev("exercises.filter(x=>x.auto==='strength')[0].minutes") === 3);
    // 日付コピー
    ev("currentDate='2026-11-15'"); ev("document.getElementById('copyFromDate')||0"); 
    const before = ev('strengthLog.length'); w.eval("(function(){var i=document.getElementById('copyFromDate');i.value='2026-11-14';var c=document.getElementById('copyExercise');c.checked=true;})()"); w.executeCopyDay(); await sleep(30);
    t('copy-day copies strength sets and re-syncs auto kcal', ev('strengthLog.length') === before + 1 && ev("exercises.filter(x=>x.auto==='strength'&&x.date==='2026-11-15').length") === 1);
    // 筋トレCSV
    let csv = ''; w.downloadCsv = (rows, name) => { csv = rows.join('\n'); w.__csvName = name; };
    ev("document.getElementById('csvFrom').value='';document.getElementById('csvTo').value=''"); w.exportStrengthCSV();
    t('strength CSV: header + one row per set', /^date,exercise,set,kg,reps,rir,volume_kg,set_weight,direct_muscles,indirect_muscles/.test(csv) && /"スクワット"|"ベンチプレス"|"ふくらはぎプレス"/.test(csv) && /pfc_strength_/.test(w.__csvName));
    t('strength CSV: custom exercise row has calves as direct', /"ふくらはぎプレス",1,80,15,2,1200,/.test(csv) && /"下腿三頭筋",""/.test(csv));
    t('strength CSV: weekly table present', /week_start,muscle,effective_sets/.test(csv) && /,"下腿三頭筋",/.test(csv.split("week_start")[1] || ""));
    ev("document.getElementById('csvFrom').value='2099-01-01'"); csv = ''; w.exportStrengthCSV(); t('strength CSV: nothing in range → no file', csv === ''); ev("document.getElementById('csvFrom').value=''");
    // クラウドから復元
    ev("strengthLog=[]"); w.applyCloudData({ strengthLog: [{ id: 1, date: '2026-11-01', ex: 'squat', name: 'スクワット', sets: [{ kg: 100, reps: 5, rir: 1 }] }] }); t('applyCloudData restores strengthLog', ev('strengthLog.length') === 1);
    ev("strengthLog=[{id:5,date:toDateStr(new Date()),ex:'squat',name:'スクワット',sets:[{kg:100,reps:5,rir:1}]}]"); t('AI context includes strength log', /スクワット 100×5@1/.test(ev('buildFullContext()')));
    t.done(errs);
  } catch (x) { console.log('EXC', x); process.exit(1); }
}, 300);
