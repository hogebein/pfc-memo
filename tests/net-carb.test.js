// 糖質（炭水化物−食物繊維）の表示・集計・CSVのテスト
const { loadApp, makeT, sleep } = require('./harness');
const { w, errs } = loadApp(); const t = makeT(); const ev = s => w.eval(s); const $ = id => w.document.getElementById(id);
const near = (a, b, e = 0.011) => Math.abs(a - b) <= e;
setTimeout(async () => {
  try {
    const today = ev("toDateStr(new Date())");
    ev(`currentDate='${today}';entries=[
      {id:1,date:'${today}',meal:'朝食',name:'オートミール',amount:50,cal:190,p:6.9,f:2.8,c:34.2,fiber:4.7,salt:0},
      {id:2,date:'${today}',meal:'昼食',name:'白米',amount:150,cal:252,p:3.8,f:0.5,c:55.7,fiber:0.5,salt:0},
      {id:3,date:'${today}',meal:'昼食',name:'繊維多めの食品',amount:100,cal:100,p:5,f:1,c:3,fiber:5,salt:0}]`);
    t('netCarbOf = carbs − fibre, never below 0 (fibre > carbs → 0)', near(ev("netCarbOf({c:34.2,fiber:4.7})"), 29.5) && ev("netCarbOf({c:3,fiber:5})") === 0 && ev("netCarbOf({c:10})") === 10 && ev("netCarbOf({})") === 0);
    t('sumNetCarb sums per entry (29.5 + 55.2 + 0 = 84.7)', near(ev("sumNetCarb(entries)"), 84.7));
    w.renderRecord();
    const m = $('recMetrics').innerHTML;
    t('record tab: carbohydrate card shows 糖質 (84.7g) alongside 炭水化物 (92.9g)', />92\.9</.test(m) && /糖質 84\.7g/.test(m));
    const e = $('energyBreakdown').innerHTML;
    t('record tab: carbohydrate panel shows 糖質 and 食物繊維 totals', /糖質 84\.7g/.test(e) && /食物繊維 10\.2g/.test(e));
    t('record tab: other cards unchanged (PFC still present)', /タンパク質/.test(m) && /脂質/.test(m) && /カロリー/.test(m));
    // 他の日は空 → 0
    ev("currentDate='2000-01-01'"); w.renderRecord(); t('empty day shows 糖質 0g without errors', /糖質 0g/.test($('recMetrics').innerHTML)); ev(`currentDate='${today}'`);
    // 統計
    ev("statsPeriod='7d'"); const avg = w.getAvg('7d');
    t('getAvg exposes the average net carbs per logged day', avg && near(avg.net, 84.7));
    w.renderStats(); t('stats tab shows the 糖質 line under the carbohydrate bar', /うち糖質（炭水化物−食物繊維）\s*<b[^>]*>84\.7g<\/b>／食物繊維 10\.2g/.test($('goalBars').innerHTML));
    // CSV
    let csv = ''; w.downloadCsv = rows => { csv = rows.join('\n'); };
    ev("document.getElementById('csvFrom').value='';document.getElementById('csvTo').value=''"); w.exportCSV();
    const lines = csv.split('\n'), head = lines[0].split(','), idx = head.indexOf('net_carb');
    t('entries CSV has a net_carb column between fiber_insoluble and net_cal', idx > 0 && head[idx - 1] === 'fiber_insoluble' && head[idx + 1] === 'net_cal');
    const cells = r => w.eval(`parseCsvLine(${JSON.stringify(r)})`);
    const r1c = lines.slice(1).map(cells).find(c => c[2] === 'オートミール');
    t('entries CSV row: net_carb = 29.5 and every row has as many cells as headers', r1c && near(parseFloat(r1c[idx]), 29.5) && lines.slice(1, 4).every(l => cells(l).length === head.length));
    csv = ''; w.exportDailyCSV(); const dl = csv.split('\n'), dh = dl[0].split(',');
    t('daily CSV ends with record_count, intake_net_carb_g', dh[dh.length - 2] === 'record_count' && dh[dh.length - 1] === 'intake_net_carb_g');
    const todayRow = dl.slice(1).find(l => l.startsWith(today)); const tc = cells(todayRow);
    t('daily CSV: today net carbs 84.7 with 3 records; row length matches header', tc.length === dh.length && near(parseFloat(tc[tc.length - 1]), 84.7) && tc[tc.length - 2] === '3');
    // CSVインポート: 新しい列があっても既存の取り込みが壊れない（ヘッダー名で読む）
    ev("entries=[]"); $('csvImportArea').value = lines.slice(0, 4).join('\n'); w.importCSV(); t('CSV re-import still works with the new column', ev('entries.length') === 3);
    // グリコーゲンは同じ定義を使う
    t('glycogen input uses the same net-carb definition', ev("glyAvailCarb({c:34.2,fiber:4.7})") === ev("netCarbOf({c:34.2,fiber:4.7})"));
    t.done(errs);
  } catch (x) { console.log('EXC', x); process.exit(1); }
}, 300);
