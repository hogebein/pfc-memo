// クラウド同期の取りこぼし対策の回帰テスト（上限超過・圧縮保存・未送信フラグ・読み込み中の編集・ローカル保存失敗）
const zlib = require('zlib');
const { loadApp, makeT, sleep } = require('./harness');
const { w, errs } = loadApp(); const t = makeT(); const ev = s => w.eval(s);
setTimeout(async () => {
  try {
    let stored = null, writes = 0, failNext = null;
    w.__zipApi = { zip: async s => zlib.gzipSync(Buffer.from(s, 'utf8')).toString('base64'), unzip: async b => zlib.gunzipSync(Buffer.from(b, 'base64')).toString('utf8') };
    w.__fsApi = { doc: () => ({}), setDoc: async (r, p) => { writes++; if (failNext) { const e = failNext; failNext = null; throw e; } stored = JSON.parse(JSON.stringify(p)); }, getDoc: async () => ({ exists: () => !!stored, data: () => stored }) };
    ev("fbDb={};fbUser={uid:'u1'};initialSyncDone=true;CLOUD_RETRY_MS=[30,30,30,30]");
    const big = n => Array.from({ length: n }, (_, i) => ({ id: i + 1, date: '2026-06-' + String(1 + (i % 28)).padStart(2, '0'), meal: '昼食', name: '鶏むね肉' + (i % 40), amount: 150, cal: 250, p: 20, f: 8, c: 25, fiber: 3, iron: 1.2, calcium: 40, vitc: 5, salt: 1.1, fa: { sat: 0.28, mufa: 0.4, n3: 0.02, n6: 0.22, trans: 0.01 }, aa: { leu: 0.09, ile: 0.05, val: 0.05, lys: 0.1, met: 0.03, thr: 0.05, trp: 0.01, his: 0.03, score: 1.08 } }));
    // 1) 通常サイズ: そのまま保存（互換）
    w.eval("entries=" + JSON.stringify(big(50))); w.save(); await sleep(60);
    t('small doc stored plain (legacy-compatible)', stored && Array.isArray(stored.entries) && !stored.z && ev('cloudDirty') === false);
    // 2) 1MiBを超える量: 圧縮して保存でき、読み戻して同じ内容になる
    ev("entries=" + JSON.stringify(big(4500))); const rawBytes = JSON.stringify(ev('entries')).length; w.save(); await sleep(250);
    t('raw size really exceeds the 1MiB cap (test is meaningful)', rawBytes > 1000000);
    t('oversize doc is saved compressed instead of failing', stored && stored.z && !stored.entries && ev('cloudDirty') === false && ev('cloudStatus') === 'synced');
    t('compressed doc is far below the cap', stored.z.length < 300000);
    ev("entries=[]"); await w.pullFromCloud(); t('compressed doc restores all 4500 entries on pull', ev('entries.length') === 4500);
    // 3) 圧縮が使えない端末で上限超過 → エラー表示が「同期中」で上書きされず、ログに残る
    const saveZip = w.__zipApi; w.__zipApi = { zip: async () => null, unzip: saveZip.unzip }; stored = null; ev("entries=" + JSON.stringify(big(4500))); w.save(); await sleep(120);
    t('oversize without compression: status stays "error" (not overwritten by syncing)', ev('cloudStatus') === 'error' && /大きすぎ/.test(ev('_cloudLastError')));
    t('oversize failure is in the error log', /大きすぎ/.test(ev("JSON.stringify(errorLog)")));
    w.__zipApi = saveZip; ev("entries=" + JSON.stringify(big(10))); w.save(); await sleep(120);
    t('recovers once data fits again', ev('cloudStatus') === 'synced' && ev('cloudDirty') === false);
    // 4) 送信中に入力中の変更（デバウンス待ち）があっても、未送信フラグを消さない
    ev("entries=" + JSON.stringify(big(10))); stored = null;
    const slow = w.__fsApi.setDoc; let release; w.__fsApi.setDoc = (r, p) => new Promise(res => { release = () => { stored = JSON.parse(JSON.stringify(p)); res(); }; });
    w.save(); await sleep(20); ev("entries.push({id:777,date:'2026-11-14',meal:'朝食',name:'追加',amount:1,cal:1,p:0,f:0,c:0})"); w.saveDebounced();
    release(); await sleep(30);
    t('edit pending in debounce stays dirty when an in-flight save finishes', ev('cloudDirty') === true && ev("cloudStatus") !== 'synced');
    w.__fsApi.setDoc = slow; await sleep(1000);
    t('the pending edit is then uploaded', stored && (stored.entries || []).some(e => e.id === 777) && ev('cloudDirty') === false);
    // 5) 一時的な失敗は再試行され、最終的に上がる
    ev("entries.push({id:888,date:'2026-11-14',meal:'昼食',name:'再試行',amount:1,cal:1,p:0,f:0,c:0})"); failNext = Object.assign(new Error('unavailable'), { code: 'unavailable' }); w.save(); await sleep(300);
    t('transient failure retried and uploaded', stored.entries.some(e => e.id === 888) && ev('cloudDirty') === false);
    // 6) 読み込み中に端末で変更があった → 黙って消さず通知とログを残す
    stored = { entries: [{ id: 1, date: '2026-11-14', meal: '朝食', name: '他端末', amount: 1, cal: 1, p: 0, f: 0, c: 0 }], updatedAt: 'x1' };
    w.__fsApi.getDoc = async () => { await sleep(40); return { exists: () => true, data: () => stored }; };
    ev("fbSyncing=false"); const pull = w.pullFromCloud(); await sleep(10); ev("entries.push({id:999,date:'2026-11-14',meal:'朝食',name:'読み込み中に追加',amount:1,cal:1,p:0,f:0,c:0})"); w.save(); await pull; await sleep(60);
    t('edit made during an initial pull is not silently lost', ev("entries.some(e=>e.id===999)") || /読み込み中/.test(ev("JSON.stringify(errorLog)")));
    // 7) ローカル保存の失敗（容量超過）をエラーログに残す
    const orig = w.Storage.prototype.setItem; w.Storage.prototype.setItem = function () { throw new w.DOMException('quota', 'QuotaExceededError'); };
    w.saveLocal(); w.Storage.prototype.setItem = orig;
    t('localStorage quota failure is logged (not swallowed)', /ローカル保存/.test(ev("JSON.stringify(errorLog)")));
    t.done(errs);
  } catch (x) { console.log('EXC', x); process.exit(1); }
}, 300);
