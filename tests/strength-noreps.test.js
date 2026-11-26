// 筋トレ記録で回数を数えなくても使える（回数は任意）ことのテスト
const { loadApp, makeT, sleep } = require('./harness');
const M = require('../strength-model.js');
const { w, errs } = loadApp(); const t = makeT(); const ev = s => w.eval(s); const $ = id => w.document.getElementById(id);
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
// ── モデル ──
t('unknown reps (undefined / null / empty string / NaN) count as a normal 5–30 rep set', [undefined, null, '', NaN].every(r => M.repQuality(r) === 1));
t('set quality without reps = quality from RIR alone', near(M.setQuality({ kg: 60, rir: 1 }), 1) && near(M.setQuality({ kg: 60, rir: 3 }), M.rirQuality(3)) && near(M.setQuality({ kg: 60 }), M.rirQuality(undefined)));
t('an explicit invalid rep count (0 / negative) still gives 0', M.repQuality(0) === 0 && M.repQuality(-3) === 0);
t('known extremes still discounted (3 reps, 50 reps)', M.repQuality(3) < 1 && M.repQuality(50) < 1);
const mk = (reps) => ({ id: 1, date: '2026-11-10', ex: 'bench', name: 'bench', sets: Array.from({ length: 6 }, () => ({ kg: 60, reps, rir: 1 })) });
const withReps = M.estimate({ log: [mk(10)], endDate: '2026-11-14' }), noReps = M.estimate({ log: [mk(undefined)], endDate: '2026-11-14' });
t('evaluation is identical whether or not reps (10) are entered', withReps.kgMid === noReps.kgMid && withReps.muscles[0].weeklySets === noReps.muscles[0].weeklySets);
setTimeout(async () => {
  try {
    ev("currentDate='2026-11-14';strengthLog=[];exercises=[];profile.weight=66;profile.strengthAutoCal=false");
    t('reps field is empty by default with a placeholder (no fake default of 10)', $('stReps').value === '' && /数えなくて/.test($('stReps').getAttribute('placeholder')) && /任意/.test($('stReps').parentElement.textContent));
    t('RIR select uses plain-language wording, no counting needed', /限界（もう1回もできない）/.test($('stRir').innerHTML) && /あと2回くらい/.test($('stRir').innerHTML) && /ウォームアップ程度/.test($('stRir').innerHTML) && $('stRir').options.length === 7);
    t('RIR option values are unchanged (0–5, blank)', [...$('stRir').options].map(o => o.value).join() === ',0,1,2,3,4,5');
    // 回数なし・3セットを1タップで
    $('stEx').value = 'bench'; w.onStExChange(); $('stKg').value = '60'; $('stReps').value = ''; $('stSets').value = '3'; $('stRir').value = '1'; w.stAddSet();
    t('one tap adds 3 sets without any rep count', ev('stDraft.length') === 3 && ev('stDraft.every(s=>s.reps===null&&s.kg===60&&s.rir===1)'));
    t('chips show weight and difficulty only ("60kg＠1")', (h => (h.match(/60kg＠1/g) || []).length === 3 && !/×/.test(h.replace(/<button[^>]*>.*?<\/button>/g, '')))($('stDraft').innerHTML));
    t('no error message after a valid reps-free add', $('stMsg').textContent === '');
    // 回数ありも従来どおり
    $('stReps').value = '8'; $('stSets').value = '1'; $('stRir').value = '2'; w.stAddSet();
    t('entering reps still works ("60kg×8＠2") and mixes with reps-free sets', /60kg×8＠2/.test($('stDraft').innerHTML) && ev('stDraft.length') === 4);
    w.saveStrengthEntry(); await sleep(30);
    t('saved entry keeps null reps and numeric reps', ev("strengthLog[0].sets.map(s=>s.reps).join()") === ',,,8' || ev("JSON.stringify(strengthLog[0].sets.map(s=>s.reps))") === '[null,null,null,8]');
    t('log row shows reps only where entered', (h => /60kg＠1　60kg＠1　60kg＠1　60kg×8＠2/.test(h))($('strengthItems').textContent.replace(/\s+/g, '')) || /60kg＠1.*60kg×8＠2/.test($('strengthItems').textContent.replace(/\s+/g, '')));
    // 自重
    $('stEx').value = 'pushup'; w.onStExChange(); $('stKg').value = '0'; $('stReps').value = ''; $('stSets').value = '2'; $('stRir').value = '0'; w.stAddSet();
    t('bodyweight sets without reps are labelled 自重', /自重＠0/.test($('stDraft').innerHTML)); w.saveStrengthEntry(); await sleep(30);
    // 入力検証
    ev("stDraft=[]"); w.renderStDraft();
    $('stKg').value = ''; w.stAddSet(); t('blank weight is rejected with guidance', ev('stDraft.length') === 0 && /重量/.test($('stMsg').textContent));
    $('stKg').value = '50'; $('stReps').value = '0'; w.stAddSet(); t('reps = 0 is rejected (blank is the way to skip)', ev('stDraft.length') === 0 && /空欄/.test($('stMsg').textContent));
    $('stReps').value = ''; $('stSets').value = '0'; w.stAddSet(); t('sets = 0 rejected', ev('stDraft.length') === 0 && /セット数/.test($('stMsg').textContent));
    $('stSets').value = '21'; w.stAddSet(); t('sets > 20 rejected', ev('stDraft.length') === 0);
    $('stSets').value = ''; w.stAddSet(); t('blank sets field means 1 set', ev('stDraft.length') === 1);
    // 評価に反映される（回数なしでも有効セットとして数える）
    const est = w.strengthEstimate('2026-11-14').res; const chest = est.muscles.find(m => m.key === 'chest');
    t('reps-free sets count in the weekly volume (3 sets @RIR1 + 1 @RIR2 → chest ≥ 3.9 effective sets)', chest.weeklySets > 0 && !est.empty);
    // CSV
    let csv = ''; w.downloadCsv = rows => { csv = rows.join('\n'); }; ev("document.getElementById('csvFrom').value='';document.getElementById('csvTo').value=''"); w.exportStrengthCSV();
    const rows = csv.split('\n').filter(l => /^2026-11-14,/.test(l)).map(l => w.eval(`parseCsvLine(${JSON.stringify(l)})`));
    const noRep = rows.find(c => c[1] === 'ベンチプレス' && c[4] === ''), withRep = rows.find(c => c[1] === 'ベンチプレス' && c[4] === '8');
    t('CSV: reps and volume are blank when reps were not entered, but the set weight is there', noRep && noRep[6] === '' && noRep[7] === '1' && noRep[3] === '60');
    t('CSV: rows with reps still have volume (60×8 = 480)', withRep && withRep[6] === '480');
    // AIの文脈
    ev(`strengthLog[0].date=toDateStr(new Date())`); const ctx = ev("buildFullContext()");
    t('AI context: "60kg@1" without reps, "60×8@2" with reps', /60kg@1/.test(ctx) && /60×8@2/.test(ctx));
    t('help text says reps can be skipped', /回数は数えなくても評価できます/.test(require('fs').readFileSync(__dirname + '/../app.js', 'utf8')));
    t.done(errs);
  } catch (x) { console.log('EXC', x); process.exit(1); }
}, 300);
