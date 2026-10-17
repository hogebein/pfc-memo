// 主要機能の回帰テスト（DB整合・AIコマンドの保存・クラウド同期・食品登録タブ・TDEE）。
// 実行: npm install --no-save jsdom && node tests/core.test.js
const { loadApp, makeT, sleep } = require('./harness');
const { w, errs } = loadApp({ beforeParse(w) { w.localStorage.setItem('ghData', JSON.stringify({ '2026-10-01': { date: '2026-10-01', steps: 5000, updatedToken: 'SECRET' } })); } });
const t = makeT(); const ev = s => w.eval(s); const $ = id => w.document.getElementById(id);
// 疑似Firestore
let calls = [], mode = 'ok', cloudDoc = null, getCalls = 0;
w.__fsApi = { doc: () => ({}), setDoc: async (ref, p) => { calls.push(JSON.parse(JSON.stringify(p))); if (mode === 'fail') throw Object.assign(new Error('x'), { code: 'unavailable' }); cloudDoc = JSON.parse(JSON.stringify(p)); },
  getDoc: async () => { getCalls++; return { exists: () => !!cloudDoc, data: () => JSON.parse(JSON.stringify(cloudDoc)) }; } };
const reset = () => { calls = []; mode = 'ok'; getCalls = 0; ev("cloudDirty=false;_cloudInFlight=false;_cloudRequeue=false;_cloudRetryCount=0;_lastForegroundPull=0;fbSyncing=false;clearTimeout(_cloudRetryTimer);clearTimeout(_cloudSaveTimer);_cloudSaveTimer=null;_cloudLastLogged={msg:'',t:0};errorLog.length=0"); };
const E = (id, meal, name) => `{id:${id},date:currentDate,meal:'${meal}',name:'${name}',amount:100,cal:100,p:1,f:1,c:1}`;
setTimeout(async () => {
  try {
    // ── 内蔵DB ──
    const db = ev('LOCAL_DB'); t('DB: 806 foods', db.length === 806);
    t('DB: fibS+fibI = fiber for every food with a split', db.every(f => f.fibS === undefined || Math.abs(f.fibS + f.fibI - f.fiber) <= 0.011));
    t('DB: measured values present (オートミール 3.2/6.2)', (f => f && f.fibS === 3.2 && f.fibI === 6.2 && !f.fibEst)(db.find(x => x.name === 'オートミール')));
    t('startup strips stored Google token', !/SECRET/.test(w.localStorage.getItem('ghData')));
    ev("fbDb={};fbUser={uid:'u1'};initialSyncDone=true;CLOUD_RETRY_MS=[30,30,60]");
    // ── AIコマンドで記録を変更 → 端末とクラウドの両方へ保存 ──
    reset(); ev(`entries=[${E(1, '朝食', 'A')},${E(2, '昼食', 'B')}];saveLocal()`);
    w.executeAiCommands([{ type: 'delete_by_id', ids: [1] }], 't'); await sleep(20);
    t('AI delete persists locally', JSON.parse(w.localStorage.getItem('pfcEntries')).length === 1); t('AI delete uploads', calls.length >= 1 && calls[calls.length - 1].entries.length === 1);
    reset(); w.executeAiCommands([{ type: 'add', dates: [ev('currentDate')], meal: '夕食', items: [{ name: 'C', amount: 100, cal: 100, p: 1, f: 1, c: 1 }] }], 't'); await sleep(20);
    t('AI add persists + uploads', JSON.parse(w.localStorage.getItem('pfcEntries')).length === 2 && calls.length >= 1);
    // ── クラウド保存: 失敗→ログ→再試行→回復 / 直列化 ──
    reset(); mode = 'fail'; ev('save()'); await sleep(15);
    t('cloud failure logged + status', ev("errorLog.some(e=>e.context==='クラウド保存')") && ev('cloudStatus') === 'error' && ev('cloudDirty') === true);
    const n1 = calls.length; await sleep(120); t('cloud retries automatically', calls.length > n1); mode = 'ok'; await sleep(200); t('cloud recovers', ev('cloudDirty') === false && ev('cloudStatus') === 'synced');
    reset(); ev(`entries=[${E(1, '朝食', 'S1')}]`); w.__fsApi.setDoc = async (r, p) => { calls.push(JSON.parse(JSON.stringify(p))); await sleep(50); cloudDoc = JSON.parse(JSON.stringify(p)); };
    ev('save()'); await sleep(5); ev(`entries.push(${E(2, '朝食', 'S2')})`); ev('save()'); ev(`entries.push(${E(3, '朝食', 'S3')})`); ev('save()'); await sleep(250);
    t('cloud writes serialized, last has latest', calls.length === 2 && calls[1].entries.length === 3);
    // ── 前面復帰で他端末の更新を反映 / 手元の変更を守る ──
    w.__fsApi.setDoc = async (r, p) => { calls.push(JSON.parse(JSON.stringify(p))); cloudDoc = JSON.parse(JSON.stringify(p)); };
    reset(); ev("dailyActivity={};ghData={}"); cloudDoc = { entries: [JSON.parse(ev(`JSON.stringify(${E(1, '朝食', '他端末')})`))], exercises: [], customFoods: [], comboFoods: [], quickSeasonings: [], profile: {}, dailyActivity: {}, ghData: {}, updatedAt: '2099-01-01T00:00:00.000Z' };
    ev("_lastCloudStamp='2000-01-01'"); Object.defineProperty(w.document, 'visibilityState', { value: 'visible', configurable: true }); w.document.dispatchEvent(new w.Event('visibilitychange')); await sleep(40);
    t('foreground pull applies other device changes', ev('entries.length') === 1 && ev('entries[0].name') === '他端末');
    reset(); ev("cloudDirty=true;_lastCloudStamp='old'"); w.document.dispatchEvent(new w.Event('visibilitychange')); await sleep(30); t('foreground pull skipped while local changes are unsent', getCalls === 0); ev('cloudDirty=false');
    // ── 歩数/Google Healthの同期（トークンなし）──
    reset(); ev("ghData={'2026-10-08':{date:'2026-10-08',steps:6000,updatedToken:'TOK'}};dailyActivity={'2026-10-09':{steps:8000}}"); ev('saveDailyActivity()'); await sleep(900);
    t('steps/ghData synced without token', calls.length === 1 && calls[0].dailyActivity['2026-10-09'].steps === 8000 && calls[0].ghData['2026-10-08'].steps === 6000 && !JSON.stringify(calls[0]).includes('TOK'));
    // ── 食品登録タブ（検索・ソート・カテゴリ・複製・目安量）──
    ev(`customFoods=[{id:1,name:'ゆで卵',category:'主菜',cal:70,per:50,p:6,f:5,c:0.3},{id:2,name:'鶏むねスモーク',cal:150,per:100,p:30,f:2,c:0},{id:3,name:'オートミール粥',yomi:'オートミールガユ',category:'主食',cal:120,per:100,p:3,f:1,c:25}];comboFoods=[]`); w.renderCustomFoodList();
    const names = () => [...$('customFoodList').querySelectorAll('.custom-item')].map(e => e.querySelector('div div').textContent.trim().split(' ')[0]);
    t('food tab: default newest first', names().join() === 'オートミール粥,鶏むねスモーク,ゆで卵'); w.onFoodDbSort('custom', 'p'); t('food tab: sort by protein', names()[0] === '鶏むねスモーク');
    w.onFoodDbSearch('custom', 'おーとみーる'); t('food tab: kana search via yomi', names().join() === 'オートミール粥'); w.onFoodDbSearch('custom', ''); w.onFoodDbCat('custom', '主菜'); t('food tab: category filter', names().join() === 'ゆで卵'); w.onFoodDbCat('custom', 'all');
    w.duplicateCustomFood(1); t('food tab: duplicate opens edit with unique name', ev('customFoods.some(f=>f.name==="ゆで卵のコピー")') && !!w.document.querySelector('[id^=ecfName]')); w.cancelEditCustomFood();
    w.toggleFoodServingMode('custom'); const inp = [...$('customFoodList').querySelectorAll('.custom-item')].find(r => r.textContent.includes('鶏むねスモーク')).querySelector('.fd-sv input'); inp.value = '80'; inp.dispatchEvent(new w.Event('change'));
    t('food tab: serving editor saves', ev('customFoods.find(f=>f.id===2).serving') === 80); w.toggleFoodServingMode('custom');
    // ── AIの食品登録（カテゴリ付与・値なしは自動再依頼の対象）──
    w.executeAiCommands([{ type: 'add_custom_food', foods: [{ name: 'AI登録テスト牛乳', per: 100, cal: 67, p: 3.3, f: 3.8, c: 4.8, fiber: 0 }] }], 't'); t('AI custom food gets category', ev('customFoods.find(f=>f.name==="AI登録テスト牛乳").category') === '乳製品');
    // ── TDEE ──
    ev("profile={sex:'male',age:30,height:177,weight:66,bf:null,activityFactor:1.2,temp:22,neatPct:20,bmrFormula:'mifflin'};dailyActivity={}"); const tb = ev("getTdeeBreakdown('2026-10-20')");
    t('TDEE: NEAT + default steps + TEF ≈ 2358', Math.abs(tb.tdee - 2358) <= 3 && tb.assumed === 'default_steps' && tb.tef > 200);
    ev("profile.activityFactor=1.55"); t('TDEE: explicit simple factor keeps legacy method', ev("getTdeeBreakdown('2026-10-20').simple") === true);
  } catch (err) { console.log('EXC', err.stack.split('\n').slice(0, 5).join(' | ')); process.exitCode = 1; }
  t.done(errs);
}, 800);
