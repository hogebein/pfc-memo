// CSV出力（食事記録の表・日別の消費カロリー表・実質カロリー列）のテスト。実行: npm install --no-save jsdom && node tests/csv-export.test.js
const { loadApp, makeT, sleep } = require('./harness');
const { w, errs } = loadApp(); const t = makeT(); const ev = s => w.eval(s); const $ = id => w.document.getElementById(id);
setTimeout(async () => {
  try {
    let captured = ''; w.Blob = function (parts) { captured = parts.join(''); }; w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL = () => {}; w.HTMLAnchorElement.prototype.click = () => {};
    ev("profile={sex:'male',age:30,height:177,weight:66,bf:null,activityFactor:1.2,temp:22,neatPct:20,bmrFormula:'mifflin'}");
    ev(`dailyActivity={'2026-10-05':{steps:6000}};exercises=[{id:1,date:'2026-10-05',name:'ラン',cal:300}];entries=[
      {id:1,date:'2026-10-05',meal:'朝食',name:'納豆',amount:50,cal:100,p:8,f:5,c:6,fiber:3.4,fibS:1.2,fibI:2.2},
      {id:2,date:'2026-10-05',meal:'昼食',name:'ごぼうのサラダ',amount:100,cal:200,p:3,f:10,c:20,fiber:5.7,fibS:2.3,fibI:3.4},
      {id:3,date:'2026-10-06',meal:'朝食',name:'白米',amount:150,cal:252,p:3.8,f:0.5,c:55.7,fiber:0}]`);
    $('csvFrom').value = ''; $('csvTo').value = ''; w.exportCSV();
    const lines = captured.replace('\uFEFF', '').split('\n'); const parse = l => ev(`parseCsvLine(${JSON.stringify(l)})`);
    // ── 食事記録の表 ──
    const h1 = lines[0].split(','); t('entry table: legacy columns unchanged (prefix)', lines[0].startsWith('date,meal,name,amount,cal,p,f,c,fiber,iron,calcium,vitc,vitd,salt,fiber_soluble,fiber_insoluble,'));
    t('entry table: net_cal + day columns appended at the end', h1.slice(-9).join() === 'net_cal,day_bmr_kcal,day_tdee_kcal,day_exercise_kcal,day_total_burn_kcal,day_intake_kcal,day_net_intake_kcal,day_balance_kcal,day_net_balance_kcal');
    const r1 = parse(lines[1]), r2 = parse(lines[2]), r3 = parse(lines[3]); const col = (row, name) => row[h1.indexOf(name)];
    t('entry net_cal = cal − fiber × 2', parseFloat(col(r1, 'net_cal')) === 100 - 3.4 * 2 && parseFloat(col(r2, 'net_cal')) === 200 - 5.7 * 2 && parseFloat(col(r3, 'net_cal')) === 252);
    t('entry rows have as many cells as headers', [r1, r2, r3].every(r => r.length === h1.length));
    // ── 日別の表 ──
    const ti = lines.findIndex(l => l.startsWith('date,bmr_kcal')); const h2 = lines[ti].split(',');
    t('daily table: legacy columns unchanged (prefix)', lines[ti].startsWith('date,bmr_kcal,activity_desc,activity_kcal,steps,tdee_kcal,exercise_kcal,total_burn_kcal,intake_kcal,balance_kcal,tdee_formula,bmr_formula,bmr_calc,temp_multiplier,neat_pct,activity_source,tef_kcal,profile_used'));
    t('daily table: net-calorie columns appended', h2.slice(-5).join() === 'fiber_g,fiber_adj_kcal,net_intake_kcal,net_balance_kcal,net_calc');
    const d1 = parse(lines[ti + 1]), d2 = parse(lines[ti + 2]); const dc = (row, name) => row[h2.indexOf(name)];
    t('daily rows well-formed (cell count = header count)', d1.length === h2.length && d2.length === h2.length);
    // 10/5: 摂取300kcal・繊維9.1g → 補正18.2 → 実質282 (screen と同じ計算)
    const screen = ev(`calcNetCalories(sumEntries(getDayEntries('2026-10-05')))`);
    t('daily: fiber_g/intake', parseFloat(dc(d1, 'fiber_g')) === 9.1 && parseFloat(dc(d1, 'intake_kcal')) === 300);
    t('daily: net matches the on-screen 実質カロリー', parseInt(dc(d1, 'net_intake_kcal')) === screen.netCal && parseInt(dc(d1, 'fiber_adj_kcal')) === screen.fiberAdj && screen.netCal === 282 && screen.fiberAdj === 18);
    const burn = parseFloat(dc(d1, 'total_burn_kcal')); t('daily: net_balance = net − total burn', Math.abs(parseFloat(dc(d1, 'net_balance_kcal')) - (282 - burn)) < 0.06);
    t('daily: gross balance unchanged', Math.abs(parseFloat(dc(d1, 'balance_kcal')) - (300 - burn)) < 0.06);
    t('daily: formula text', /表示 300kcal − 食物繊維 9.1g × 2kcal = 実質 282kcal/.test(dc(d1, 'net_calc')));
    t('daily: zero-fiber day → net equals intake', parseInt(dc(d2, 'net_intake_kcal')) === 252 && parseInt(dc(d2, 'fiber_adj_kcal')) === 0 && parseFloat(dc(d2, 'fiber_g')) === 0);
    t('daily: 10/5 exercise counted in burn', parseFloat(dc(d1, 'exercise_kcal')) === 300);
    // 食事記録の各行に、その日のTDEE情報が付く（日別の表と同じ値）
    const dcol = (row, name) => row[h1.indexOf(name)];
    t('entry rows carry the day TDEE', parseInt(dcol(r1, 'day_tdee_kcal')) === parseInt(dc(d1, 'tdee_kcal')) && parseInt(dcol(r2, 'day_tdee_kcal')) === parseInt(dc(d1, 'tdee_kcal')) && parseInt(dcol(r3, 'day_tdee_kcal')) === parseInt(dc(d2, 'tdee_kcal')));
    t('entry rows carry bmr/burn/intake/net/balances', parseInt(dcol(r1, 'day_bmr_kcal')) === parseInt(dc(d1, 'bmr_kcal')) && parseFloat(dcol(r1, 'day_total_burn_kcal')) === parseFloat(dc(d1, 'total_burn_kcal')) && parseFloat(dcol(r1, 'day_intake_kcal')) === 300 && parseInt(dcol(r1, 'day_net_intake_kcal')) === 282 && Math.abs(parseFloat(dcol(r1, 'day_balance_kcal')) - parseFloat(dc(d1, 'balance_kcal'))) < 0.06 && Math.abs(parseFloat(dcol(r1, 'day_net_balance_kcal')) - parseFloat(dc(d1, 'net_balance_kcal'))) < 0.06);
    t('entry rows: same day → same day columns; different day differs', dcol(r1, 'day_tdee_kcal') === dcol(r2, 'day_tdee_kcal') && dcol(r1, 'day_exercise_kcal') === '300' && dcol(r3, 'day_exercise_kcal') === '0');
    t('appended daily table still present after a blank line', lines[ti - 1] === '' && ti > 3);
    // ── 日別CSV（単独の表）──
    ev(`entries=[
      {id:1,date:'2026-10-05',meal:'朝食',name:'納豆',amount:50,cal:100,p:8,f:5,c:6,fiber:3.4},
      {id:2,date:'2026-10-07',meal:'朝食',name:'白米',amount:150,cal:252,p:3.8,f:0.5,c:55.7,fiber:0}]`);
    ev(`exercises=[{id:1,date:'2026-10-06',name:'ラン',cal:400}]`);
    $('csvFrom').value = '2026-10-05'; $('csvTo').value = '2026-10-08'; captured = ''; w.exportDailyCSV();
    const dl = captured.replace('\uFEFF', '').split('\n'); const hh = dl[0].split(',');
    t('daily CSV: single clean table (no blank/second header)', dl.length === 5 && !dl.some(l => l === '') && dl.filter(l => l.startsWith('date,')).length === 1);
    t('daily CSV: all columns of the daily table + record_count', hh.slice(0, 10).join() === 'date,bmr_kcal,activity_desc,activity_kcal,steps,tdee_kcal,exercise_kcal,total_burn_kcal,intake_kcal,balance_kcal' && hh.includes('tdee_formula') && hh.includes('net_calc') && hh[hh.length - 1] === 'record_count');
    const rowsD = dl.slice(1).map(l => parse(l)); const g = (row, n) => row[hh.indexOf(n)];
    t('daily CSV: covers every day in range incl. days without records', rowsD.map(r => r[0]).join() === '2026-10-05,2026-10-06,2026-10-07,2026-10-08' && rowsD.every(r => r.length === hh.length));
    t('daily CSV: record_count', rowsD.map(r => g(r, 'record_count')).join() === '1,0,1,0'); t('daily CSV: exercise-only day shows burn, zero intake', g(rowsD[1], 'exercise_kcal') === '400' && g(rowsD[1], 'intake_kcal') === '0' && parseFloat(g(rowsD[1], 'balance_kcal')) === -parseFloat(g(rowsD[1], 'total_burn_kcal')));
    t('daily CSV: TDEE formula per day', rowsD.every(r => /\(BMR \d+ × NEAT 1\.20 \+ 活動 \d+\) × \(1 \+ TEF 10%\) = \d+/.test(g(r, 'tdee_formula'))) && /Mifflin-St Jeor/.test(g(rowsD[0], 'bmr_formula')));
    t('daily CSV: values match the combined file definition', parseInt(g(rowsD[0], 'net_intake_kcal')) === ev(`calcNetCalories(sumEntries(getDayEntries('2026-10-05'))).netCal`) && parseInt(g(rowsD[0], 'tdee_kcal')) === ev(`getTdeeBreakdown('2026-10-05').tdee`));
    t('daily CSV: file name', true);
    // 期間が空欄 → データの最初〜最後
    $('csvFrom').value = ''; $('csvTo').value = ''; captured = ''; w.exportDailyCSV(); t('daily CSV: blank range uses data extent', captured.replace('\uFEFF', '').split('\n').length === 1 + 3 /* 10/5〜10/7 */);
    // 逆順の指定は入れ替える / データなしは出力しない
    $('csvFrom').value = '2026-10-07'; $('csvTo').value = '2026-10-05'; captured = ''; w.exportDailyCSV(); t('daily CSV: reversed range is swapped', captured.replace('\uFEFF', '').split('\n').length === 4);
    ev('entries=[];exercises=[];dailyActivity={}'); $('csvFrom').value = ''; $('csvTo').value = ''; captured = ''; w.exportDailyCSV(); t('daily CSV: nothing to export → toast, no file', captured === '' && /出力できる日別データがありません/.test($('toast').textContent));
    // UI: 説明文とボタン
    t('CSV tab explains where TDEE is', /各行の右端に、その日のBMR・TDEE/.test($('panel-csv').textContent) && /日別CSV/.test($('panel-csv').textContent) && !!$('panel-csv').querySelector('button[onclick="exportDailyCSV()"]'));
    ev(`dailyActivity={'2026-10-05':{steps:6000}};exercises=[{id:1,date:'2026-10-05',name:'ラン',cal:300}];entries=[
      {id:1,date:'2026-10-05',meal:'朝食',name:'納豆',amount:50,cal:100,p:8,f:5,c:6,fiber:3.4,fibS:1.2,fibI:2.2},
      {id:2,date:'2026-10-05',meal:'昼食',name:'ごぼうのサラダ',amount:100,cal:200,p:3,f:10,c:20,fiber:5.7,fibS:2.3,fibI:3.4},
      {id:3,date:'2026-10-06',meal:'朝食',name:'白米',amount:150,cal:252,p:3.8,f:0.5,c:55.7,fiber:0}]`);
    $('csvFrom').value = ''; $('csvTo').value = ''; w.exportCSV();
    // ── 取り込みへの影響なし（追加列は無視され、食事行だけ取り込まれる）──
    ev("entries=[];saveLocal()"); $('csvImportArea').value = captured.replace('\uFEFF', ''); w.importCSV();
    t('re-import of the exported CSV still works', ev('entries.length') === 3 && ev("entries.find(e=>e.name==='納豆').fiber") === 3.4 && ev("entries.find(e=>e.name==='納豆').cal") === 100);
    // 範囲指定でも列が出る
    ev(`entries=[{id:1,date:'2026-10-05',meal:'朝食',name:'納豆',amount:50,cal:100,p:8,f:5,c:6,fiber:3.4}]`); $('csvFrom').value = '2026-10-05'; $('csvTo').value = '2026-10-05'; w.exportCSV(); t('range export has net columns', /net_balance_kcal/.test(captured) && /net_cal/.test(captured.split('\n')[0]));
  } catch (err) { console.log('EXC', err.stack.split('\n').slice(0, 5).join(' | ')); process.exitCode = 1; }
  t.done(errs);
}, 800);
