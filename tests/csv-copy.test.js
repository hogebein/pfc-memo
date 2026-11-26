// CSV出力をクリップボードにコピーする機能のテスト
const { loadApp, makeT, sleep } = require('./harness');
const { w, errs } = loadApp(); const t = makeT(); const ev = s => w.eval(s); const $ = id => w.document.getElementById(id);
setTimeout(async () => {
  try {
    const today = ev("toDateStr(new Date())");
    ev(`entries=[{id:1,date:'${today}',meal:'朝食',time:'07:00',name:'カンマ,入り"食品"',amount:100,cal:200,p:10,f:5,c:30,fiber:2,salt:1.2},{id:2,date:'${today}',meal:'昼食',time:'12:00',name:'ごはん',amount:150,cal:250,p:4,f:0.5,c:55,fiber:0.5,salt:0}];
      strengthLog=[{id:3,date:'${today}',ex:'squat',name:'スクワット',sets:[{kg:100,reps:5,rir:1}]}]`);
    ev("document.getElementById('csvFrom').value='';document.getElementById('csvTo').value=''");
    // クリップボード API をスタブ
    let copied = null, blobs = 0; const toasts = [];
    Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: async tx => { copied = tx; } } });
    w.URL.createObjectURL = () => { blobs++; return 'blob:x'; }; w.URL.revokeObjectURL = () => {};
    const origToast = w.showToast; w.showToast = m => { toasts.push(m); };
    // 1) 通常のダウンロードは従来どおり（ファイル、BOMつき）
    w.HTMLAnchorElement.prototype.click = function () { this._clicked = true; };   // jsdomはダウンロードのナビゲーションを実装していない
    let blobText = ''; w.Blob = class { constructor(parts) { blobText = parts.join(''); } };
    w.exportCSV(); await sleep(10);
    t('download mode still creates a file (with BOM) and does not touch the clipboard', blobs === 1 && blobText.charCodeAt(0) === 0xFEFF && copied === null);
    // 2) コピー
    w.exportCSV('copy'); await sleep(20);
    t('copy mode: CSV text reaches the clipboard, no file is created', typeof copied === 'string' && blobs === 1);
    t('copied text has no BOM and starts with the header row', copied.charCodeAt(0) !== 0xFEFF && /^date,meal,name,/.test(copied));
    t('copied text has the same body as the file (minus BOM)', copied === blobText.slice(1));
    t('quotes/commas inside names stay escaped in the copied CSV', copied.includes('"カンマ,入り""食品"""'));
    t('copied text contains both entries', /ごはん/.test(copied) && copied.split('\n').filter(l => /,朝食,|,昼食,/.test(l)).length === 2);
    t('success toast shows rows and size', toasts.some(m => /CSVをコピーしました（\d+行・約\d+KB）/.test(m)));
    t('manual-copy area stays hidden on success', $('csvCopyArea').style.display === 'none');
    // 3) 日別・筋トレも
    copied = null; w.exportDailyCSV('copy'); await sleep(20); t('daily CSV can be copied', /^date,bmr_kcal/.test(copied || '') && /intake_net_carb_g/.test(copied));
    copied = null; w.exportStrengthCSV('copy'); await sleep(20); t('strength CSV can be copied (sets + weekly table)', /^date,exercise,set,kg,reps,rir/.test(copied || '') && /week_start,muscle,effective_sets/.test(copied));
    // 4) clipboard API が使えない → execCommand にフォールバック
    Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: undefined });
    let execCalled = 0, execText = ''; w.document.execCommand = cmd => { execCalled++; execText = (w.document.querySelector('textarea[readonly][style*="fixed"]') || {}).value || ''; return cmd === 'copy'; };
    toasts.length = 0; w.exportCSV('copy'); await sleep(20);
    t('no Clipboard API: falls back to execCommand("copy") with the CSV in a temporary textarea', execCalled === 1 && /^date,meal,name,/.test(execText) && toasts.some(m => /コピーしました/.test(m)));
    t('temporary textarea is removed afterwards', !w.document.querySelector('textarea[readonly][style*="fixed"]'));
    // 5) 両方失敗 → 手動コピー用の欄に表示
    w.document.execCommand = () => false; toasts.length = 0; w.exportCSV('copy'); await sleep(20);
    t('both fail: CSV is shown in the manual-copy textarea and the user is told', $('csvCopyArea').style.display === 'block' && /^date,meal,name,/.test($('csvCopyArea').value) && toasts.some(m => /自動でコピーできませんでした/.test(m)));
    // clipboard API が reject しても フォールバックに進む
    Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } });
    let ex2 = 0; w.document.execCommand = () => { ex2++; return true; }; w.exportCSV('copy'); await sleep(20);
    t('Clipboard API rejection falls back to execCommand and hides the manual area', ex2 === 1 && $('csvCopyArea').style.display === 'none');
    // 6) 範囲外 → コピーもしない（筋トレは空なら何も出ない）
    Object.defineProperty(w.navigator, 'clipboard', { configurable: true, value: { writeText: async tx => { copied = tx; } } });
    ev("document.getElementById('csvFrom').value='2099-01-01'"); copied = null; w.exportStrengthCSV('copy'); await sleep(20);
    t('strength CSV with nothing in range copies nothing', copied === null);
    // 7) ボタン
    const btns = [...w.document.querySelectorAll('.csv-out button')].map(b => b.getAttribute('onclick'));
    t('three export rows each have a download and a copy button', btns.length === 6 && btns.filter(x => /'copy'/.test(x)).length === 3);
    t.done(errs);
  } catch (x) { console.log('EXC', x); process.exit(1); }
}, 300);
