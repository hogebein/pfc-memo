// クラウドデータの容量カード（内訳・圧縮状況・上限までの日数）のテスト
const zlib = require('zlib');
const { loadApp, makeT, sleep } = require('./harness');
const { w, errs } = loadApp(); const t = makeT(); const ev = s => w.eval(s); const $ = id => w.document.getElementById(id);
setTimeout(async () => {
  try {
    const dayStr = n => ev(`glyAddDays(toDateStr(new Date()), ${-n})`);
    const mk = (n, perDay) => Array.from({ length: n }, (_, i) => ({ id: i + 1, date: dayStr(Math.floor(i / perDay)), meal: '昼食', time: '12:00', name: '鶏むね肉' + (i % 40), amount: 150, cal: 250, p: 20, f: 8, c: 25, fiber: 3, iron: 1.2, calcium: 40, salt: 1.1, fa: { sat: 0.28, mufa: 0.4, n3: 0.02, n6: 0.22, trans: 0.01 }, aa: { leu: 0.09, ile: 0.05, val: 0.05, lys: 0.1, met: 0.03, thr: 0.05, trp: 0.01, his: 0.03, score: 1.08 } }));
    ev("exercises=[];strengthLog=[];customFoods=[];comboFoods=[]");
    // 小さいデータ
    ev("entries=" + JSON.stringify(mk(50, 10))); let r = await w.cloudSizeReport();
    t('small data: not compressed, stored = raw', !r.compressed && r.stored === r.total && r.total < 100000);
    w.showCloudSizeInfo(); await sleep(20); t('small data message: not compressed yet, with breakdown and a growth rate', /まだ小さいので圧縮していません/.test($('cloudSizeInfo').innerHTML) && /食事記録（50件）/.test($('cloudSizeInfo').innerHTML) && /増加ペース/.test($('cloudSizeInfo').innerHTML));
    // 大きいデータ（~830KBの未圧縮相当）: 圧縮が効く
    w.__zipApi = { zip: async s => zlib.gzipSync(Buffer.from(s, 'utf8')).toString('base64'), unzip: async b => zlib.gunzipSync(Buffer.from(b, 'base64')).toString('utf8') };
    ev("entries=" + JSON.stringify(mk(2600, 14))); r = await w.cloudSizeReport();
    t('big data (>400KB): compressed form is far smaller', r.total > 700000 && r.compressed && r.stored < r.total / 4);
    t('growth rate is estimated from the last 30 days (≈14 entries/day × ~0.45KB raw, scaled by the compression ratio)', (raw => raw > 4000 && raw < 9000)(r.perDay / (r.stored / r.total)) && r.perDay < r.perDay / (r.stored / r.total));
    t('days left is finite and positive for a growing log, large when compressed', r.daysLeft > 100 && isFinite(r.daysLeft));
    w.showCloudSizeInfo(); await sleep(60); const h = $('cloudSizeInfo').innerHTML;
    t('card shows stored size vs limit and the compression ratio', /クラウドに保存される大きさ: \d+KB \/ 上限977KB/.test(h) && /圧縮して保存しています（約\d+分の1）/.test(h));
    t('card lists breakdown sorted with 食事記録 first and a percentage', /食事記録（2600件）<\/span><span>\d+KB（9\d%）/.test(h));
    // 圧縮が使えない端末: 警告と案内
    w.__zipApi = { zip: async () => null, unzip: async () => '' }; r = await w.cloudSizeReport();
    t('no compression support: stored = raw and flagged', !r.compressed && r.stored === r.total);
    ev("window.__zipApi=undefined"); const hadCS = typeof w.CompressionStream; w.showCloudSizeInfo(); await sleep(60);
    t('uncompressed big data warns and tells the user what to do', /圧縮されていません（元のデータ \d+KB）/.test($('cloudSizeInfo').innerHTML) && /(最新版に更新|圧縮に未対応)/.test($('cloudSizeInfo').innerHTML));
    // 増えていないデータ
    ev("entries=" + JSON.stringify(mk(40, 40).map(e => ({ ...e, date: '2020-01-01' })))); r = await w.cloudSizeReport(); t('old, non-growing log → growth 0 and "ほぼ増えません"', r.perDay === 0 && (w.showCloudSizeInfo(), await sleep(30), /ほぼ増えません/.test($('cloudSizeInfo').innerHTML)));
    t('card and button exist in settings', !!w.document.querySelector('button[onclick="showCloudSizeInfo()"]'));
    t.done(errs);
  } catch (x) { console.log('EXC', x); process.exit(1); }
}, 300);
