// ── 正規化 ──
function normalize(s) {
  return s.toLowerCase()
    .replace(/[\u3041-\u3096]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60))
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
}

// ── ミクロ栄養素目標 ──
// goal: 推奨量/目安量（RDA/AI）　ul: 耐容上限量（日本人の食事摂取基準 2020年版、成人の目安値）
// ビタミンKはUL未設定（高摂取での健康被害の報告が無いため、日本人の食事摂取基準でも上限は定められていない）
const MICRO_GOALS = {
  fiber:   { label:'食物繊維', unit:'g',  goal:21,   color:'#8bc34a' },
  iron:    { label:'鉄',       unit:'mg', goal:7,    color:'#e91e63' },
  calcium: { label:'Ca',       unit:'mg', goal:700,  color:'#03a9f4' },
  vitc:    { label:'VitC',     unit:'mg', goal:100,  color:'#ff9800' },
  vitd:    { label:'VitD',     unit:'μg', goal:8.5,  color:'#ffd600', ul:100 },
  vita:    { label:'VitA',     unit:'μg', goal:850,  color:'#ff7043', ul:2700 },
  vite:    { label:'VitE',     unit:'mg', goal:6.5,  color:'#ab47bc', ul:800 },
  vitk:    { label:'VitK',     unit:'μg', goal:150,  color:'#26a69a' },
  iodine:  { label:'ヨウ素',   unit:'μg', goal:130,  color:'#5c6bc0', ul:3000 },
  salt:    { label:'塩分',     unit:'g',  goal:7.5,  color:'#9e9e9e', reverse:true },
};
const MICRO_KEYS = Object.keys(MICRO_GOALS);

const MEAL_META = {
  朝食:{ icon:'🌅', bg:'#fff8e6' },
  昼食:{ icon:'☀️', bg:'#e6f1fb' },
  夕食:{ icon:'🌙', bg:'#ede9ff' },
  間食:{ icon:'🍎', bg:'#e8f5e9' },
};
const MEALS_ORDER = ['朝食','昼食','夕食','間食'];

// ── タンパク質吸収率 ──
// ① 食品カテゴリ別の消化率（真の消化率に近い値。豆類は十分な加熱・水さらし等で
//    トリプシンインヒビター等の抗栄養素がほぼ失活している前提で高めの値を採用）
const DIGEST_ANIMAL = 0.97; // 肉・魚・卵・乳（消化性が最も高い）
const DIGEST_LEGUME = 0.90; // 豆類・大豆製品（十分に加熱・下処理された前提）
const DIGEST_GRAIN  = 0.87; // 穀物
const DIGEST_NUT    = 0.80; // ナッツ・種子（脂質・食物繊維に囲まれ消化率がやや低め）
const DIGEST_OTHER  = 0.78; // 野菜など、上記に当てはまらないもの

const P_ABS_ANIMAL_PATTERN = /鶏|豚|牛|羊|合いびき|ひき肉|ベーコン|ハム|ソーセージ|ウインナー|サラミ|いわし|さば|さんま|あじ|さけ|鮭|サーモン|まぐろ|マグロ|ツナ|えび|いか|ほたて|あさり|カニ|かに|ぶり|たい|鯛|たら|タラ|さわら|しじみ|ホッケ|ホタルイカ|卵|たまご|タマゴ|ゆで卵|目玉焼き|スクランブル|ささみ|チキン|ポーク|ビーフ|シーフード|チーズ|ヨーグルト|牛乳|ミルク|ホエイ|プロテイン|seafood|chicken|pork|beef|fish|salmon|tuna|egg|shrimp|whey|cheese|milk|yogurt/i;
const P_ABS_LEGUME_PATTERN = /豆腐|納豆|豆乳|大豆|えだまめ|枝豆|きな粉|小豆|ひよこ豆|レンズ豆|黒豆|そら豆|いんげん豆|インゲン豆|ミックスビーンズ|油揚げ|厚揚げ|がんもどき|湯葉|テンペ|白和え|けんちん|えんどう豆プロテイン/i;
const P_ABS_GRAIN_PATTERN  = /米|ごはん|ご飯|パン|うどん|パスタ|そば|ラーメン|マカロニ|ビーフン|そうめん|ひやむぎ|中華麺|オートミール|小麦粉|とうもろこし|コーン|キヌア|もち|シリアル|ミューズリー|グラノーラ|白玉粉|上新粉/i;
const P_ABS_NUT_PATTERN    = /アーモンド|くるみ|カシューナッツ|ピーナッツ|ナッツ|ごま|松の実|ひまわりの種|かぼちゃの種|フラックスシード|チアシード|ピーナッツバター/i;

function foodDigestibility(e) {
  if (P_ABS_ANIMAL_PATTERN.test(e.name)) return DIGEST_ANIMAL;
  if (P_ABS_LEGUME_PATTERN.test(e.name)) return DIGEST_LEGUME;
  if (P_ABS_GRAIN_PATTERN.test(e.name))  return DIGEST_GRAIN;
  if (P_ABS_NUT_PATTERN.test(e.name))    return DIGEST_NUT;
  return DIGEST_OTHER;
}

// ② WHO/FAO/UNU(2007) 成人必須アミノ酸参照パターン（gアミノ酸 / gたんぱく質）
//    食事全体で消化されたアミノ酸をプールし、このパターンと比較して制限アミノ酸を判定する
const AA_REFERENCE = { his:0.015, ile:0.030, leu:0.059, lys:0.045, met:0.022, thr:0.023, trp:0.006, val:0.039 };

// ③ 食事（同じmeal区分）単位でアミノ酸を合算し、食べ合わせによる補完効果を反映する
//    例: 白米（リジンが制限）＋ 豆類（メチオニンが制限だがリジンは豊富）を同じ食事で摂ると、
//        単品ごとのスコアより食事全体のスコアが上がる（アミノ酸補完効果）
function calcAbsorbedProtein(list) {
  const meals = {};
  list.forEach(e => { (meals[e.meal || '_'] = meals[e.meal || '_'] || []).push(e); });

  let totalAbsorbed = 0;
  Object.values(meals).forEach(mealList => {
    let digestedProtein = 0;
    let hasAaData = false;
    const aaSum = { his:0, ile:0, leu:0, lys:0, met:0, thr:0, trp:0, val:0 };

    mealList.forEach(e => {
      const p = e.p || 0;
      if (p <= 0) return;
      const digestedP = p * foodDigestibility(e);
      digestedProtein += digestedP;
      if (e.aa) {
        hasAaData = true;
        Object.keys(aaSum).forEach(k => { aaSum[k] += (e.aa[k] || 0) * digestedP; });
      }
    });

    if (digestedProtein <= 0) return;

    if (hasAaData) {
      // 消化後アミノ酸プールを参照パターンと比較し、食事全体の制限アミノ酸スコアを算出
      let mealScore = 1.0;
      Object.keys(AA_REFERENCE).forEach(k => {
        const supplyRatio = (aaSum[k] / digestedProtein) / AA_REFERENCE[k];
        mealScore = Math.min(mealScore, supplyRatio);
      });
      totalAbsorbed += digestedProtein * Math.min(mealScore, 1.0);
    } else {
      // アミノ酸データが無い食品のみの食事は消化率のみ反映
      totalAbsorbed += digestedProtein;
    }
  });

  return totalAbsorbed;
}

// ── 内蔵DB ──
// 食品データ本体は foods-db.js に分離（index.htmlでこのファイルより先に読み込む）
LOCAL_DB.forEach(f => {
  f._search = normalize(f.name)+' '+normalize(f.yomi||'')+' '+normalize(f.tags||'')+' '+(f.en||'').toLowerCase();
  f._src = 'local';
});

// ── State ──
let entries = [], customFoods = [], comboFoods = [], exercises = [];
let userWeight = 65, statsPeriod = 'today', chartMode = 'raw';
let calChart = null, pfcChart = null, vitdStockChart = null;
let searchTimer = null, comboTimer = null, apiAbort = null;
let comboIngredients = [], editingId = null, activeAddMeal = null, exPanelOpen = false;
let calViewYear = new Date().getFullYear(), calViewMonth = new Date().getMonth();
let currentDate = toDateStr(new Date());
let ghToken = null, ghData = {}; // Google Health API
let dailyActivity = {}; // Garmin/Google Health未連携ユーザー向け：日別の手動歩数入力
let deferredPrompt = null;
let profile = { sex:'male', age:30, height:170, weight:65, bf:null, activityFactor:1.2, temp:22, neatTier:'mid' };

// Firebase state
let fbUser = null;   // 現在ログイン中のユーザー
let fbDb  = null;    // Firestore インスタンス
let fbAuth = null;   // Auth インスタンス
let fbSyncing = false;

// localStorage からローカルキャッシュ読み込み（オフライン時のフォールバック）
try { entries     = JSON.parse(localStorage.getItem('pfcEntries')    || '[]'); } catch(e) {}
try { customFoods = JSON.parse(localStorage.getItem('pfcCustomFoods')|| '[]'); } catch(e) {}
try { comboFoods  = JSON.parse(localStorage.getItem('pfcComboFoods') || '[]'); } catch(e) {}
try { exercises   = JSON.parse(localStorage.getItem('pfcExercises')  || '[]'); } catch(e) {}
try { userWeight  = parseFloat(localStorage.getItem('pfcWeight') || '65'); } catch(e) {}
try { ghToken     = localStorage.getItem('ghToken') || null; } catch(e) {}
try { ghData      = JSON.parse(localStorage.getItem('ghData') || '{}'); } catch(e) {}
try { dailyActivity = JSON.parse(localStorage.getItem('pfcDailyActivity') || '{}'); } catch(e) {}
try { const p = JSON.parse(localStorage.getItem('pfcProfile') || 'null'); if(p) profile = {...profile, ...p}; } catch(e) {}

function toDateStr(d) {
  // ローカルの年月日で組み立てる（toISOString()はUTC変換されるため、
  // 日本のような正のUTCオフセットのタイムゾーンでは日付が1日ずれるバグの原因になっていた）
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function fmtDate(s) { const d = new Date(s+'T00:00:00'); return d.toLocaleDateString('ja-JP',{month:'long',day:'numeric',weekday:'short'}); }
function isToday(s) { return s === toDateStr(new Date()); }
function r1(n) { return Math.round(n*10)/10; }
function r2(n) { return Math.round(n*100)/100; }
function ri(n) { return Math.round(n); }

// ローカル保存（常に実行 — オフライン時のキャッシュ）
function saveLocal() {
  try { localStorage.setItem('pfcEntries',     JSON.stringify(entries));     } catch(e) {}
  try { localStorage.setItem('pfcExercises',   JSON.stringify(exercises));   } catch(e) {}
  try { localStorage.setItem('pfcCustomFoods', JSON.stringify(customFoods)); } catch(e) {}
  try { localStorage.setItem('pfcComboFoods',  JSON.stringify(comboFoods));  } catch(e) {}
}

// Firestore への保存（ログイン済みの場合）
// 全データを1ドキュメントにまとめて保存（シンプル設計）
async function saveToCloud() {
  if (!fbDb || !fbUser) return;
  try {
    const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    await setDoc(doc(fbDb, 'users', fbUser.uid), {
      entries,
      exercises,
      customFoods,
      comboFoods,
      profile,
      updatedAt: new Date().toISOString(),
    });
  } catch(e) { console.warn('Cloud save failed:', e); }
}

// ── 初回クラウド同期ゲート ──
// 起動直後、ローカルキャッシュがクラウドの最新状態を反映しているとは限らない
// （別デバイスでの変更が未反映の可能性がある）。この確認が終わるまでは
// クラウドへの保存を行わない（＝古いローカル状態でクラウドを上書きしてしまう事故を防ぐ）。
let initialSyncDone = false;
let pendingCloudSave = false;
function queueCloudSave() {
  if (!initialSyncDone) { pendingCloudSave = true; return; }
  saveToCloud();
}
function markInitialSyncDone() {
  if (initialSyncDone) return;
  initialSyncDone = true;
  const gate = document.getElementById('syncGate');
  if (gate) gate.style.display = 'none';
  if (pendingCloudSave) { pendingCloudSave = false; saveToCloud(); }
}
// 万一 onAuthStateChanged が発火しない等の異常時でも、画面が固まったままにならないための保険
setTimeout(() => { if (!initialSyncDone) { console.warn('Sync gate timeout — releasing'); markInitialSyncDone(); } }, 8000);

// ローカル＋クラウドへ同時保存
function save() { saveLocal(); queueCloudSave(); }
// 入力中の連続オートセーブ用：ローカルは即時、クラウドは間引いて送信
let _cloudSaveTimer = null;
function saveDebounced() {
  saveLocal();
  clearTimeout(_cloudSaveTimer);
  _cloudSaveTimer = setTimeout(queueCloudSave, 800);
}
function saveCustom() { saveLocal(); queueCloudSave(); }
function saveExercises() { saveLocal(); queueCloudSave(); }
function saveGhData() { try { localStorage.setItem('ghData', JSON.stringify(ghData)); } catch(e) {} }
function saveDailyActivity() { try { localStorage.setItem('pfcDailyActivity', JSON.stringify(dailyActivity)); } catch(e) {} }
function saveProfile() {
  profile.sex    = document.getElementById('pSex').value;
  profile.age    = parseInt(document.getElementById('pAge').value)    || 30;
  profile.height = parseFloat(document.getElementById('pHeight').value) || 170;
  profile.weight = parseFloat(document.getElementById('pWeight').value) || 65;
  const bf = parseFloat(document.getElementById('pBF').value);
  profile.bf   = isNaN(bf) ? null : bf;
  profile.temp = parseFloat(document.getElementById('pTemp').value) || 22;
  try { localStorage.setItem('pfcProfile', JSON.stringify(profile)); } catch(e) {}
  queueCloudSave();
  renderBmrPreview();
}
function setGoalMode(mode) {
  profile.goalMode = mode;
  document.querySelectorAll('.goal-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  const customPanel = document.getElementById('customGoalPanel');
  if (customPanel) customPanel.style.display = mode === 'custom' ? 'block' : 'none';
  if (mode !== 'custom') {
    // プリセット時は自動計算値でプレビュー更新
    const g = goals();
    ['Cal','P','F','C'].forEach(k => {
      const el = document.getElementById('pGoal'+k);
      if (el) el.value = g[k.toLowerCase()];
    });
  }
  saveGoalSettings();
  renderBmrPreview();
}
function saveGoalSettings() {
  const mode = profile.goalMode || 'normal';
  if (mode === 'custom') {
    profile.customGoal = {
      cal: parseFloat(document.getElementById('pGoalCal').value) || calcTDEE(),
      p:   parseFloat(document.getElementById('pGoalP').value)   || 100,
      f:   parseFloat(document.getElementById('pGoalF').value)   || 60,
      c:   parseFloat(document.getElementById('pGoalC').value)   || 200,
    };
  }
  try { localStorage.setItem('pfcProfile', JSON.stringify(profile)); } catch(e) {}
  queueCloudSave();
  renderBmrPreview();
}
function setActivity(el) {
  document.querySelectorAll('#activityToggle .toggle-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  profile.activityFactor = parseFloat(el.dataset.val);
  saveProfile();
}
function setNeatTier(el) {
  document.querySelectorAll('#neatToggle .toggle-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  profile.neatTier = el.dataset.neat;
  saveProfile();
}

function initGoalUI() {
  const mode = profile.goalMode || 'normal';
  document.querySelectorAll('.goal-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  const customPanel = document.getElementById('customGoalPanel');
  if (customPanel) customPanel.style.display = mode === 'custom' ? 'block' : 'none';
  const g = goals();
  ['Cal','P','F','C'].forEach(k => {
    const el = document.getElementById('pGoal'+k);
    if (el) el.value = (profile.customGoal && mode === 'custom') ? profile.customGoal[k.toLowerCase()] : g[k.toLowerCase()];
  });
  updateGoalModeDesc(mode);
  updateGoalPreview();
}
function updateGoalModeDesc(mode) {
  ['normal','recomp','custom'].forEach(m => {
    const el = document.querySelector('.goal-desc-'+m);
    if (el) el.style.display = m === mode ? '' : 'none';
  });
}
function updateGoalPreview() {
  const g = goals();
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('goalPreviewCal', g.cal);
  setEl('goalPreviewP',   g.p);
  setEl('goalPreviewF',   g.f);
  setEl('goalPreviewC',   g.c);
}
function initProfile() {
  const set = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
  set('pSex',    profile.sex);
  set('pAge',    profile.age);
  set('pHeight', profile.height);
  set('pWeight', profile.weight);
  set('pBF',     profile.bf ?? '');
  set('pTemp',   profile.temp);
  document.querySelectorAll('#activityToggle .toggle-btn[data-val]').forEach(b => {
    b.classList.toggle('active', parseFloat(b.dataset.val) === profile.activityFactor);
  });
  document.querySelectorAll('#neatToggle .toggle-btn[data-neat]').forEach(b => {
    b.classList.toggle('active', b.dataset.neat === (profile.neatTier || 'mid'));
  });
  renderBmrPreview();
}
function renderBmrPreview() {
  const el = document.getElementById('bmrPreview');
  if (!el) return;
  const tdee = calcTDEE();
  const bmr  = Math.round(calcBMR());
  const g    = goals();
  const modeLabel = { normal:'通常', recomp:'低脂質リコンプ', custom:'カスタム' }[profile.goalMode || 'normal'];
  const detail = getDetailedActivity(currentDate);
  const modeDesc = detail
    ? `${detail.source === 'google_health' ? 'Google Health実測' : '手入力歩数'}（${(detail.steps||0).toLocaleString()}歩・活動 ${detail.activeCal}kcal）＋NEAT「${(NEAT_TIERS[profile.neatTier]||NEAT_TIERS.mid).label}」＋DIT（本日の実際の食事構成から算出）`
    : `活動係数 ${profile.activityFactor || 1.2}（ざっくり設定・DITは本日の食事構成に応じて補正）`;
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;margin-bottom:6px">
      <div style="background:var(--bg);border-radius:8px;padding:8px 10px">
        <div style="color:var(--text-sub);font-size:10px">基礎代謝 (BMR)</div>
        <div style="font-weight:700;font-size:16px">${bmr} <span style="font-size:10px;font-weight:400">kcal</span></div>
      </div>
      <div style="background:var(--bg);border-radius:8px;padding:8px 10px">
        <div style="color:var(--text-sub);font-size:10px">推定TDEE（本日）</div>
        <div style="font-weight:700;font-size:16px">${tdee} <span style="font-size:10px;font-weight:400">kcal</span></div>
      </div>
    </div>
    <div style="font-size:10px;color:var(--text-sub);margin-bottom:10px">今日の算出方法: ${modeDesc}</div>
    <div style="font-size:11px;color:var(--text-sub);margin-bottom:4px">現在の目標（${modeLabel}プリセット）</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;text-align:center;font-size:11px">
      <div style="background:var(--bg);border-radius:6px;padding:5px 2px"><div style="color:var(--text-sub);font-size:9px">kcal</div><div style="font-weight:600">${g.cal}</div></div>
      <div style="background:#e3f0ff;border-radius:6px;padding:5px 2px"><div style="color:#3266ad;font-size:9px">P(g)</div><div style="font-weight:600;color:#1a1d23">${g.p}</div></div>
      <div style="background:#fff3e0;border-radius:6px;padding:5px 2px"><div style="color:#a06a1a;font-size:9px">F(g)</div><div style="font-weight:600;color:#1a1d23">${g.f}</div></div>
      <div style="background:#e8f5e9;border-radius:6px;padding:5px 2px"><div style="color:#2f7d3a;font-size:9px">C(g)</div><div style="font-weight:600;color:#1a1d23">${g.c}</div></div>
    </div>`;
  updateGoalPreview();
}

// ── PWA ──
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredPrompt = e;
  document.getElementById('install-banner').style.display = 'flex';
});
document.getElementById('install-btn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  document.getElementById('install-banner').style.display = 'none';
});
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ── Header ──
function updateHeader() {
  const d = new Date();
  document.getElementById('headerDate').textContent = d.toLocaleDateString('ja-JP',{month:'long',day:'numeric',weekday:'long'});
}
updateHeader();

// ── Helpers ──
function getAllFoods() {
  return [
    ...LOCAL_DB,
    ...customFoods.map(f => ({...f, _search: normalize(f.name), _src:'custom'})),
    ...comboFoods.map(f => ({...f, _search: normalize(f.name), _src:'combo'})),
  ];
}
// ── 活動量の精緻化：NEAT（運動以外の日常活動）レベル ──
// 職種・生活スタイルによる基礎的な活動量の差をBMRへの倍率として表現
const NEAT_TIERS = {
  low:  { label: '座り仕事中心', mult: 1.10 },
  mid:  { label: '立ち仕事が多い', mult: 1.20 },
  high: { label: '肉体労働・重作業', mult: 1.30 },
};
// 歩数→消費カロリー推定（体重比例、約35kcal/1000歩@70kgが目安）
function stepsToCal(steps, weightKg) {
  return Math.round((steps || 0) * (weightKg || 65) * 0.0005);
}
// 指定日の「実測 or 手入力による活動カロリー」を解決する
// ① Google Health連携で実測値が取れていればそれを最優先
// ② 手動入力した歩数があればそこから推定
// ③ どちらも無ければnullを返し、呼び出し側で従来の活動係数にフォールバックする
function getDetailedActivity(date) {
  const gh = ghData[date];
  if (gh && gh.activeCalories > 0) {
    return { activeCal: gh.activeCalories, steps: gh.steps || 0, source: 'google_health' };
  }
  const manual = dailyActivity[date];
  if (manual && manual.steps > 0) {
    const w = profile.weight || userWeight || 65;
    return { activeCal: stepsToCal(manual.steps, w), steps: manual.steps, source: 'manual_steps' };
  }
  return null;
}
function calcBMR() {
  const w = profile.weight || userWeight || 65;
  const h = profile.height || 170;
  const age = profile.age || 30;
  const isMale = profile.sex !== 'female';
  let bmr = isMale
    ? 10*w + 6.25*h - 5*age + 5
    : 10*w + 6.25*h - 5*age - 161;
  const temp = profile.temp ?? 22;
  if (temp < 10) bmr *= 1.06;
  else if (temp >= 30) bmr *= 1.025;
  return bmr;
}
// DIT（食事誘発性熱産生）の基準率。活動係数（ざっくり設定）・詳細モードのどちらも
// 「標準的な食事構成であればこの程度のDIT率」という前提を置いている。
// 実際の食事のタンパク質比率が高い、あるいはアルコールを摂っている等でこの前提から
// ズレる場合は、その差分だけをTDEEに加減算して補正する。
// ※ 基準率は下のcalcActualDitと同じ加重式（P27%/C7%/F3%）を、
//   「標準的な食事構成」の目安であるPFCバランス(P15%/F30%/C55%)に適用して算出したもの。
//   ハードコードした固定値だと式を変えた時にズレるため、必ずこの式から導出する。
const STANDARD_MACRO_SHARE = { p: 0.15, f: 0.30, c: 0.55 }; // カロリー構成比の目安
const DIT_RATE = STANDARD_MACRO_SHARE.p * 0.27 + STANDARD_MACRO_SHARE.c * 0.07 + STANDARD_MACRO_SHARE.f * 0.03;
// → 0.15×0.27 + 0.55×0.07 + 0.30×0.03 = 0.088（8.8%）

// その日実際に記録された食事から、真のDIT（kcal）と基準からの差分を算出する
// ※ タンパク質27% / 炭水化物7% / 脂質3%の消費率で計算し、P/F/C(4/9/4kcal換算)で
//    説明しきれない残差カロリー（主にアルコール）にも15%のDITを見込む
function calcActualDit(s) {
  if (!s || !s.cal || s.cal <= 0) return null; // まだ何も記録が無い日は算出不可
  const macroCal = (s.p||0)*4 + (s.f||0)*9 + (s.c||0)*4;
  const ditFromMacro = (s.p||0)*4*0.27 + (s.c||0)*4*0.07 + (s.f||0)*9*0.03;
  const residualRaw  = s.cal - macroCal;
  const residualCal  = residualRaw > 5 ? residualRaw : 0; // 丸め誤差のノイズは無視
  const ditFromResidual = residualCal * 0.15; // アルコール等、文献上10〜30%程度の中間値
  return { kcal: ditFromMacro + ditFromResidual, residualCal };
}

// ── DITの時間経過モデル（Erlang-2 / Gamma(k=2, θ=1h)分布）──
// 食後のDITは「消化・吸収」→「それに伴う代謝反応の亢進」という2段階の律速過程を経るため、
// 単純な指数減衰ではなく、食後1時間前後にピークを迎えてから緩やかに減衰する形になる
// （指数分布を2つ直列につないだ形＝Erlang-2は、この2段階過程の素朴なモデルとして
//  薬物動態のBateman関数などでも使われる標準的な形）。
//   PDF:      f(t) = t・e^(-t/θ) / θ²   （モード＝θ、θ=1hならピークは食後1時間）
//   生存関数: S(t) = e^(-t/θ)・(1 + t/θ)  （時刻tの時点で"まだ発生していない"AUCの割合）
// 5時間でAUCの約96%が完了し、指標熱量測定で一般的なDIT観測時間（5〜6時間）と整合する。
const DIT_THETA_HOURS = 1;
function ditSurvivalFraction(hoursElapsed) {
  const t = Math.max(0, hoursElapsed);
  return Math.exp(-t / DIT_THETA_HOURS) * (1 + t / DIT_THETA_HOURS);
}
function parseTimeToMinutes(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return null;
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10), min = parseInt(m[2], 10);
  if (isNaN(h) || isNaN(min) || h > 24 || min > 59) return null;
  return h * 60 + min;
}
// 食事時刻をもとに、「その日（0:00〜24:00）の会計区切りの中でまだ発生し終えていない」
// DIT AUCの分を求める。これは睡眠がDITを抑制するという生理学的な主張ではなく、
// アプリが全ての指標を日付単位で集計している以上、深夜に近い時間に食べた食事ほど
// その日のうちに発生しきる分が少なくなる、という会計上の整理。
// 就寝時刻は記録項目として保持するが、根拠が確立していないためこの補正には使用しない。
// 時刻が未記録のエントリ（過去データ・後方互換）は対象外とし、常に全量をその日のDITとして計上する。
function calcMealTimingUnrealized(list) {
  let unrealized = 0;
  list.forEach(e => {
    const eatMinutes = parseTimeToMinutes(e.time);
    if (eatMinutes == null) return;
    const p = e.p || 0, f = e.f || 0, c = e.c || 0, cal = e.cal || 0;
    const macroCal = p*4 + f*9 + c*4;
    const entryDit = p*4*0.27 + c*4*0.07 + f*9*0.03;
    const residual = Math.max(0, cal - macroCal);
    const entryDitTotal = entryDit + residual*0.15;
    if (entryDitTotal <= 0) return;
    const hoursToMidnight = (24*60 - eatMinutes) / 60;
    unrealized += entryDitTotal * ditSurvivalFraction(hoursToMidnight);
  });
  return unrealized;
}

function getTdeeBreakdown() {
  const bmr = calcBMR();

  // その日の歩数（Garmin/Google Health実測 または 手動入力）が分かれば、
  // NEATレベルで補正したBMR＋実際の活動カロリーで精緻に算出する
  const detail = getDetailedActivity(currentDate);
  const base = detail
    ? bmr * (NEAT_TIERS[profile.neatTier] || NEAT_TIERS.mid).mult + detail.activeCal
    : bmr * (profile.activityFactor || 1.2);

  // その日実際に記録された食事構成から、基準DIT率とのズレを補正する
  const list = getDayEntries(currentDate);
  const s = sumEntries(list);
  const actualDit = calcActualDit(s);
  // 基準DITは「実際に食べた総カロリー(s.cal)」に対して標準的な食事構成なら生じるはずの量で比較する。
  // baseを基準にすると「摂取量がbase(推定TDEE)からどれだけ多い/少ないか」まで混ざってしまい、
  // 標準的な食事構成の人でも摂取量がbaseとズレているだけで補正がかかってしまうため、
  // 必ず同じ母数(s.cal)で比較する。
  const baselineDitKcal = actualDit ? s.cal * DIT_RATE : 0;
  // 食事時刻が記録されていれば、日をまたいで発生しきらない分をさらに差し引く。
  // ※ ただし上限を「基準DITの20%」に制限する。これは生理学的な根拠に基づく値ではなく、
  //   深夜ギリギリに大きな食事を記録した場合に暦日の境界だけでTDEEが大きく変動してしまう
  //   （数式上は正しくても実用上避けたい）モデル上の過大な変動を抑えるための実装上の安全弁。
  const TIMING_CAP_RATE = 0.20;
  const timingUnrealizedRaw = actualDit ? calcMealTimingUnrealized(list) : 0;
  const timingCapKcal = actualDit ? baselineDitKcal * TIMING_CAP_RATE : 0;
  const timingUnrealized = Math.min(timingUnrealizedRaw, timingCapKcal);
  const ditDelta = actualDit ? (actualDit.kcal - baselineDitKcal - timingUnrealized) : 0;
  const tdee = actualDit ? Math.round(base + ditDelta) : Math.round(base * (1 + DIT_RATE));

  return { bmr, detail, base, actualDit, baselineDitKcal, timingUnrealized, timingUnrealizedRaw, ditDelta, tdee };
}
function calcTDEE() {
  return getTdeeBreakdown().tdee;
}
function goals() {
  // カスタム目標が有効な場合はそちらを優先
  if (profile.goalMode === 'custom' && profile.customGoal) {
    return { ...profile.customGoal };
  }
  const tdee = calcTDEE();
  const w = profile.weight || userWeight || 65;
  if (profile.goalMode === 'recomp') {
    // 低脂質リコンププリセット: 通常タンパク・低脂質・カロリー維持
    const p = r1(w * 1.6);
    const f = r1(tdee * 0.15 / 9);
    const c = r1((tdee - p*4 - f*9) / 4);
    return { cal: tdee, p, f, c };
  }
  // 通常プリセット (デフォルト)
  const p = r1(w * 1.6);
  const f = r1(tdee * 0.25 / 9);
  const c = r1((tdee - p*4 - f*9) / 4);
  return { cal: tdee, p, f, c };
}
function sumEntries(list) {
  return list.reduce((a,e) => ({
    cal:a.cal+e.cal, p:a.p+e.p, f:a.f+e.f, c:a.c+e.c,
    fiber:a.fiber+(e.fiber||0), iron:a.iron+(e.iron||0), calcium:a.calcium+(e.calcium||0),
    vitc:a.vitc+(e.vitc||0), vitd:a.vitd+(e.vitd||0), salt:a.salt+(e.salt||0),
    vita:a.vita+(e.vita||0), vite:a.vite+(e.vite||0), vitk:a.vitk+(e.vitk||0), iodine:a.iodine+(e.iodine||0),
  }), {cal:0,p:0,f:0,c:0,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0,vita:0,vite:0,vitk:0,iodine:0});
}
function getDayEntries(d) { return entries.filter(e => e.date === d); }

// ── Date ──
function updateDateHeader() {
  document.getElementById('dateLabel').textContent = fmtDate(currentDate);
  const tod = isToday(currentDate);
  document.getElementById('todayBadge').style.display = tod ? 'inline' : 'none';
  document.getElementById('todayBtn').style.display = tod ? 'none' : 'block';
}
function changeDate(d) {
  const dt = new Date(currentDate+'T00:00:00'); dt.setDate(dt.getDate()+d);
  currentDate = toDateStr(dt); activeAddMeal = null; editingId = null; exPanelOpen = false;
  const panel = document.getElementById('exerciseAddPanel'); if(panel) panel.style.display='none';
  const btn   = document.getElementById('exAddBtn');          if(btn)   btn.textContent='＋ 追加';
  updateDateHeader(); renderRecord(); renderCalendar();
}
function goToday() {
  currentDate = toDateStr(new Date()); calViewYear = new Date().getFullYear(); calViewMonth = new Date().getMonth();
  activeAddMeal = null; editingId = null; exPanelOpen = false;
  const panel = document.getElementById('exerciseAddPanel'); if(panel) panel.style.display='none';
  const btn   = document.getElementById('exAddBtn');          if(btn)   btn.textContent='＋ 追加';
  updateDateHeader(); renderRecord(); renderCalendar();
}
function jumpToDate(d) {
  currentDate = d; calViewYear = parseInt(d.split('-')[0]); calViewMonth = parseInt(d.split('-')[1])-1;
  activeAddMeal = null; editingId = null; updateDateHeader(); renderRecord(); closeCalendar();
}

// ── Calendar ──
function toggleCalendar(e) {
  e.stopPropagation();
  const ol = document.getElementById('calOverlay');
  if (ol.classList.contains('open')) { closeCalendar(); return; }
  const rect = document.getElementById('dateDisplay').getBoundingClientRect();
  const popup = document.getElementById('calPopup');
  popup.style.top = (rect.bottom+4)+'px';
  popup.style.left = Math.max(4, rect.left)+'px';
  calViewYear = parseInt(currentDate.split('-')[0]); calViewMonth = parseInt(currentDate.split('-')[1])-1;
  renderCalendar(); ol.classList.add('open');
}
function closeCalendar() { document.getElementById('calOverlay').classList.remove('open'); }
function closeCalIfOutside(e) { if (e.target === document.getElementById('calOverlay')) closeCalendar(); }
function calPrev() { calViewMonth--; if (calViewMonth<0){calViewMonth=11;calViewYear--;} renderCalendar(); }
function calNext() { calViewMonth++; if (calViewMonth>11){calViewMonth=0;calViewYear++;} renderCalendar(); }
const CAL_MEALS = ['朝食','昼食','夕食'];
function renderCalendar() {
  const y=calViewYear, m=calViewMonth, fd=new Date(y,m,1).getDay(), dim=new Date(y,m+1,0).getDate(), tod=toDateStr(new Date());
  document.getElementById('calMonth').textContent = `${y}年${m+1}月`;
  let html = '';
  ['日','月','火','水','木','金','土'].forEach(d => { html += `<div class="cal-dow">${d}</div>`; });
  for (let i=0; i<fd; i++) { const dd=new Date(y,m,-(fd-1-i)); html += `<div class="cal-day other-month"><div class="cal-num">${dd.getDate()}</div></div>`; }
  for (let d=1; d<=dim; d++) {
    const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const de=getDayEntries(ds), ms=CAL_MEALS.map(m=>de.some(e=>e.meal===m)), cnt=ms.filter(Boolean).length;
    const sel=ds===currentDate, t=ds===tod;
    const fill=cnt>0?`<div class="cal-fill" style="height:${Math.round(cnt/3*100)}%;background:#3266ad;opacity:.2"></div>`:'';
    const dots=`<div class="cal-dots">${ms.map((f,i)=>`<div class="cal-dot${f?' filled':''}" title="${CAL_MEALS[i]}"></div>`).join('')}</div>`;
    html += `<div class="cal-day${sel?' selected':''}${t?' today-day':''}" onclick="jumpToDate('${ds}')">${fill}<div class="cal-num">${d}</div>${dots}</div>`;
  }
  document.getElementById('calGrid').innerHTML = html;
}

// ── 実質栄養価計算 ──
// DIT（食事誘発性熱産生）: P=25-30%, C=6-8%, F=2-4%、アルコール等の残差分は別途補正
// 食物繊維NET補正: 食物繊維は消化吸収されないため実質カロリー = fiber * 2kcal/g（大腸発酵分）として扱い
//                  通常計算されている炭水化物 * 4kcal から fiber * 4kcal を引いて fiber * 2kcal を足す
//                  → 実質 fiber * 2kcal の節約
function calcNetCalories(s) {
  // 食物繊維NETカロリー補正
  // 食物繊維は不溶性は0kcal、可溶性は約2kcal/gで大腸で発酵
  // 標準成分表では炭水化物に含めて4kcal/gで計算されているため差分を補正
  const fiberAdj = (s.fiber || 0) * 2; // 4kcal→2kcalへの補正分（差引き2kcal節約/g）

  const grossCal  = s.cal;
  const netCal    = Math.round(grossCal - fiberAdj);
  const reduction = Math.round(fiberAdj);

  return {
    grossCal,
    netCal,
    fiberAdj: Math.round(fiberAdj),
    reduction,
  };
}

function renderNetCard(s) {
  const badge = document.getElementById('netCalBadge');
  const card  = document.getElementById('netCard');
  if (!card) return;

  if (s.cal <= 0) {
    if (badge) badge.textContent = '';
    card.innerHTML = '';
    return;
  }

  const n = calcNetCalories(s);
  if (badge) badge.textContent = `→ 実質 ${n.netCal} kcal`;

  card.innerHTML = `
    <div class="card" style="padding:10px 12px;font-size:12px">
      <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px;flex-wrap:wrap">
        <span style="color:var(--text-sub)">表示カロリー</span>
        <span style="font-size:16px;font-weight:700">${n.grossCal}</span>
        <span style="color:var(--text-sub)">kcal</span>
        <span style="color:var(--text-sub)">→</span>
        <span style="color:var(--text-sub)">実質カロリー</span>
        <span style="font-size:20px;font-weight:700;color:var(--accent)">${n.netCal}</span>
        <span style="color:var(--text-sub)">kcal</span>
        <span style="background:#e8f5e9;color:#2e7d32;border-radius:6px;padding:2px 7px;font-size:11px;font-weight:600">▼ ${n.reduction} kcal 節約</span>
      </div>
      <div style="background:var(--bg);border-radius:8px;padding:7px 10px;margin-bottom:8px;max-width:220px">
        <div style="color:var(--text-sub);font-size:10px;margin-bottom:3px">食物繊維NET補正</div>
        <div style="font-weight:700;font-size:14px">▼ ${n.fiberAdj} kcal</div>
        <div style="font-size:10px;color:var(--text-sub);margin-top:3px;line-height:1.6">
          繊維 ${r1(s.fiber||0)}g × 2 kcal節約/g
        </div>
      </div>
      <div style="font-size:10px;color:var(--text-sub);line-height:1.6;border-top:1px solid var(--border);padding-top:6px">
        食物繊維は腸内発酵で約2kcal/g（表示値4kcal/gとの差を補正）。DIT（食事誘発性熱産生）は摂取側からの控除ではなく、本日のTDEE（推定消費カロリー）側に加算する形で反映しています。あくまで推定値です。
      </div>
    </div>`;
}


// ── Toast & Ripple ──
function showToast(msg, duration = 2000) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.classList.remove('toast-action');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), duration);
}
// 削除操作など、取り消し可能にしたい通知用（「元に戻す」ボタン付き）
function showUndoToast(msg, onUndo, duration = 5000) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  clearTimeout(el._timer);
  el.innerHTML = `<span>${msg}</span><button type="button" class="toast-undo-btn">元に戻す</button>`;
  el.classList.add('show', 'toast-action');
  const btn = el.querySelector('.toast-undo-btn');
  const finish = () => { el.classList.remove('show', 'toast-action'); };
  btn.onclick = (ev) => { ev.stopPropagation(); clearTimeout(el._timer); finish(); onUndo(); };
  el._timer = setTimeout(finish, duration);
}
document.addEventListener('click', e => {
  const btn = e.target.closest('.btn, .meal-add-btn, .nav-btn, .seasoning-btn, .toggle-btn, .period-tab, .chart-tab, .ri');
  if (!btn) return;
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2;
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX-rect.left-size/2}px;top:${e.clientY-rect.top-size/2}px`;
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
}, true);

// ── Record ──
// ── 記録の異常値チェック（1日を見返す際にまとめて表示） ──
function levenshtein(a, b) {
  const dp = [];
  for (let i = 0; i <= a.length; i++) dp.push([i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j-1], dp[i-1][j], dp[i][j-1]);
    }
  }
  return dp[a.length][b.length];
}

function detectAnomalies(date) {
  const list = getDayEntries(date);
  const issues = [];

  list.forEach(e => {
    const amt = e.amount || 0;
    const cal = e.cal || 0;
    if (amt <= 0) {
      issues.push({ sev: 'high', msg: `「${e.name}」の量が0以下になっています` });
      return;
    }
    // 物理的に不可能なカロリー密度（純脂質でも約9kcal/g）
    const density = cal / amt;
    if (density > 9.5) {
      issues.push({ sev: 'high', msg: `「${e.name}」: ${r1(amt)}gで${ri(cal)}kcalは密度が高すぎます（${density.toFixed(1)}kcal/g）。桁や単位の入力ミスの可能性があります` });
    }
    // カロリーとPFCから逆算した値の整合性
    // ※ P/F/Cだけで説明しきれない分（記録カロリー > 計算値）はアルコール・糖アルコール・
    //    有機酸など正当な理由がありうるため許容する。逆に計算値が記録カロリーを大きく超える
    //    のは物理的にありえない（入力ミスの可能性が高い）ため、その方向のみ検出する。
    // ※ 野菜など低カロリー食品は、成分表の丸め等による数kcalの差でも%では大きく出てしまうため、
    //    相対的な閾値（15%超）に加えて絶対値の閾値（20kcal超）も満たす場合のみ検出する。
    const calcCal = (e.p||0)*4 + (e.f||0)*9 + (e.c||0)*4;
    if (cal > 50 && calcCal > cal * 1.15 && (calcCal - cal) > 20) {
      issues.push({ sev: 'mid', msg: `「${e.name}」: P・F・Cから計算した値(${ri(calcCal)}kcal)が記録カロリー(${ri(cal)}kcal)を超えています。数値の入力ミスの可能性があります` });
    }
    // 単品として極端な量
    if (cal > 2500) issues.push({ sev: 'mid', msg: `「${e.name}」が${ri(cal)}kcalと、1品にしては非常に多い量です` });
    if ((e.p||0) > 150) issues.push({ sev: 'mid', msg: `「${e.name}」のタンパク質が${r1(e.p)}gと非常に多い量です` });
    if ((e.salt||0) > 15) issues.push({ sev: 'mid', msg: `「${e.name}」の食塩相当量が${r1(e.salt)}gと非常に多い量です` });
  });

  // 同じ食事内で、名前が酷似した別記録（合算されなかった重複の可能性）
  const mealGroups = {};
  list.forEach(e => { (mealGroups[e.meal] = mealGroups[e.meal] || []).push(e); });
  Object.values(mealGroups).forEach(group => {
    for (let i = 0; i < group.length; i++) {
      for (let j = i+1; j < group.length; j++) {
        const a = normFoodName(group[i].name), b = normFoodName(group[j].name);
        if (!a || !b || a === b) continue;
        const longer = Math.max(a.length, b.length);
        if (longer < 3) continue;
        const similarity = 1 - levenshtein(a, b) / longer;
        const isSubstr = a.includes(b) || b.includes(a);
        if (similarity > 0.7 || isSubstr) {
          issues.push({ sev: 'low', msg: `「${group[i].name}」と「${group[j].name}」は似た名前で別々に記録されています（重複の可能性）` });
        }
      }
    }
  });

  return issues;
}

function renderAnomalyCard(date) {
  const el = document.getElementById('anomalyCard');
  if (!el) return;
  const issues = detectAnomalies(date);
  if (!issues.length) { el.innerHTML = ''; return; }
  const sevOrder = { high: 0, mid: 1, low: 2 };
  issues.sort((a, b) => sevOrder[a.sev] - sevOrder[b.sev]);
  const sevIcon = { high: '🔴', mid: '🟠', low: '🟡' };
  el.innerHTML = `
    <div class="card" style="padding:11px 13px;margin-bottom:8px;border:1.5px solid #f0ad4e55;background:linear-gradient(135deg,#fff8ec,#fffdf9)">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;font-weight:700;font-size:13px;color:#a06a1a">
        ⚠️ 記録の確認事項（${issues.length}件）
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${issues.map(i => `
          <div style="display:flex;gap:6px;align-items:flex-start;font-size:12px;line-height:1.5;color:#4b3a1a">
            <span>${sevIcon[i.sev]}</span><span style="flex:1">${i.msg}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

function setDailySteps(date, val) {
  const steps = parseFloat(val) || 0;
  dailyActivity[date] = { ...(dailyActivity[date]||{}), steps };
  saveDailyActivity();
  renderRecord();
  renderBmrPreview();
}
function setDailyBedtime(date, val) {
  dailyActivity[date] = { ...(dailyActivity[date]||{}), bedtime: val || null };
  saveDailyActivity();
  renderRecord();
  renderBmrPreview();
}
let activityCardExpanded = false;
function toggleActivityCard() {
  activityCardExpanded = !activityCardExpanded;
  renderActivityCard();
}
function renderActivityCard() {
  const el = document.getElementById('activityCard');
  if (!el) return;
  const gh = ghData[currentDate];
  const neatLabel = (NEAT_TIERS[profile.neatTier] || NEAT_TIERS.mid).label;
  const bedtimeVal = (dailyActivity[currentDate] && dailyActivity[currentDate].bedtime) || '';
  const manualSteps = (dailyActivity[currentDate] && dailyActivity[currentDate].steps) || '';

  const summaryParts = [];
  if (gh && gh.activeCalories > 0) summaryParts.push(`Google Health実測 ${(gh.steps||0).toLocaleString()}歩`);
  else if (manualSteps) summaryParts.push(`歩数 ${manualSteps}歩`);
  else summaryParts.push('歩数未入力');
  if (bedtimeVal) summaryParts.push(`就寝${bedtimeVal}`);

  const headerRow = `
    <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="toggleActivityCard()">
      <div style="font-size:12px;font-weight:700">🚶 本日の活動量</div>
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:10px;color:var(--text-sub)">${summaryParts.join(' ・ ')}</span>
        <span style="font-size:11px;color:var(--text-sub)">${activityCardExpanded ? '▲' : '▼'}</span>
      </div>
    </div>`;

  if (!activityCardExpanded) {
    el.innerHTML = `<div class="card" style="padding:9px 13px;margin-bottom:8px">${headerRow}</div>`;
    return;
  }

  const bedtimeRow = `
    <div class="row" style="align-items:flex-end;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
      <div class="field" style="flex:1"><label>🛏 就寝時刻</label><input type="time" value="${bedtimeVal}" onchange="setDailyBedtime('${currentDate}', this.value)"></div>
      <div style="font-size:10px;color:var(--text-sub);padding-bottom:9px;flex:1.6">記録用の項目です（睡眠がDITを抑制するという根拠が十分でないため、現時点ではTDEE計算には使用していません）</div>
    </div>`;

  if (gh && gh.activeCalories > 0) {
    // Garmin/Google Health連携で実測データがある日はそちらを優先表示（編集不可）
    el.innerHTML = `
      <div class="card" style="padding:10px 13px;margin-bottom:8px">
        ${headerRow}
        <div style="display:flex;justify-content:flex-end;margin-top:2px">
          <span style="font-size:10px;color:var(--green);font-weight:600">✓ 連携中</span>
        </div>
        <div style="font-size:11px;color:var(--text-sub);margin-top:4px">
          歩数 ${(gh.steps||0).toLocaleString()}歩　活動カロリー ${gh.activeCalories}kcal　NEAT「${neatLabel}」を適用
        </div>
        ${bedtimeRow}
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="card" style="padding:10px 13px;margin-bottom:8px">
      ${headerRow}
      <div class="row" style="align-items:flex-end;gap:8px;margin-top:8px">
        <div class="field" style="flex:1"><label>歩数</label><input type="number" min="0" step="100" placeholder="例: 8000" value="${manualSteps}" onchange="setDailySteps('${currentDate}', this.value)"></div>
        <div style="font-size:10px;color:var(--text-sub);padding-bottom:9px;flex:1.4">NEAT「${neatLabel}」で計算（設定タブで変更可）</div>
      </div>
      <div style="font-size:10px;color:var(--text-sub);margin-top:6px">
        Garmin/Google Health連携が無い日でも、歩数を入れるだけでその日のTDEEがより正確になります。未入力の場合は活動係数（ざっくり設定）が使われます。
      </div>
      ${bedtimeRow}
    </div>`;
}

function renderRecord() {
  const list = getDayEntries(currentDate);
  const s = sumEntries(list);
  const g = goals();
  const exToday = exercises.filter(e => e.date === currentDate);
  const exCal = exToday.reduce((a, e) => a + (e.cal || 0), 0);
  const remain = g.cal - s.cal + exCal;
  const remainColor = remain >= 0 ? 'var(--accent)' : '#c0392b';

  // ── タンパク質吸収補正 ──
  const absP = r1(calcAbsorbedProtein(list));

  // ── 活動量（歩数・NEAT） ──
  renderActivityCard();

  // ── 異常値チェック ──
  renderAnomalyCard(currentDate);

  // ── 実質栄養価 ──
  renderNetCard(s);
  // ── 脂肪酸プロファイル ──
  renderFattyAcidPanel(list);

  // ── エネルギー収支カード ──
  document.getElementById('balanceCard').innerHTML = `
    <div class="card" style="padding:10px 12px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:0;margin-bottom:7px">
        <div style="flex:1;min-width:0">
          <div style="font-size:10px;color:var(--text-sub)">摂取</div>
          <div style="font-size:20px;font-weight:700;letter-spacing:-.5px">${ri(s.cal)}<span style="font-size:11px;font-weight:400;color:var(--text-sub);margin-left:2px">kcal</span></div>
        </div>
        ${exCal > 0 ? `<div style="font-size:11px;color:var(--text-sub);padding:0 6px">+🏃${ri(exCal)}</div>` : ''}
        <div style="font-size:18px;color:var(--text-sub);padding:0 6px">/</div>
        <div style="flex:1;min-width:0;text-align:right">
          <div style="font-size:10px;color:var(--text-sub)">目標</div>
          <div style="font-size:20px;font-weight:700;letter-spacing:-.5px">${ri(g.cal)}<span style="font-size:11px;font-weight:400;color:var(--text-sub);margin-left:2px">kcal</span></div>
        </div>
        <div style="padding-left:10px;text-align:right;min-width:64px">
          <div style="font-size:10px;color:var(--text-sub)">${remain >= 0 ? 'あと' : '超過'}</div>
          <div style="font-size:18px;font-weight:700;color:${remainColor};letter-spacing:-.5px">${ri(Math.abs(remain))}<span style="font-size:10px;font-weight:400;margin-left:1px">kcal</span></div>
        </div>
      </div>
      <div style="height:6px;border-radius:3px;background:var(--border);overflow:hidden">
        <div style="height:100%;border-radius:3px;background:${s.cal > g.cal ? 'var(--red)' : 'var(--accent)'};width:${Math.min((s.cal+exCal)/g.cal*100,100).toFixed(1)}%;transition:width .4s cubic-bezier(.4,0,.2,1)"></div>
      </div>
    </div>`;

  // ── エネルギー内訳 ──
  const tb = getTdeeBreakdown();
  const bmr_disp = ri(tb.bmr);
  const actDetail = tb.detail;
  const ditDesc = tb.actualDit
    ? `DIT ${tb.ditDelta >= 0 ? '+' : ''}${ri(tb.ditDelta)}kcal（本日の食事構成${tb.timingUnrealized >= 1 ? '・摂取時刻' : ''}から算出）`
    : `DIT基準${Math.round(DIT_RATE*100)}%見込み（まだ記録なし）`;
  const actDesc = actDetail
    ? `× NEAT「${(NEAT_TIERS[profile.neatTier]||NEAT_TIERS.mid).label}」+ 活動 ${actDetail.activeCal}kcal（${actDetail.source==='google_health'?'Google Health実測':'歩数入力'} ${(actDetail.steps||0).toLocaleString()}歩）+ ${ditDesc}`
    : `× 活動係数 ${profile.activityFactor || 1.2} + ${ditDesc}`;
  const pCalPct = s.cal > 0 ? ri(s.p*4/s.cal*100) : 0;
  const fCalPct = s.cal > 0 ? ri(s.f*9/s.cal*100) : 0;
  const cCalPct = s.cal > 0 ? ri(s.c*4/s.cal*100) : 0;
  document.getElementById('energyBreakdown').innerHTML = `
    <div style="font-size:11px;color:var(--text-sub);margin-bottom:6px">
      推定TDEE ${ri(g.cal)} kcal（BMR ${bmr_disp} kcal ${actDesc}）
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;text-align:center">
      <div style="background:#e3f0ff;border-radius:8px;padding:7px 4px">
        <div style="font-size:10px;color:#3266ad;font-weight:600">タンパク質</div>
        <div style="font-weight:700;color:#1a1d23">${r1(s.p)}g</div>
        <div style="font-size:10px;color:#2a6f4f;font-weight:600">吸収量 ${absP}g</div>
        <div style="font-size:10px;color:#4b5568">${ri(s.p*4)} kcal (${pCalPct}%)</div>
        <div style="font-size:10px;color:#4b5568">目標 ${g.p}g</div>
      </div>
      <div style="background:#fff3e0;border-radius:8px;padding:7px 4px">
        <div style="font-size:10px;color:#a06a1a;font-weight:600">脂質</div>
        <div style="font-weight:700;color:#1a1d23">${r1(s.f)}g</div>
        <div style="font-size:10px;color:#4b5568">${ri(s.f*9)} kcal (${fCalPct}%)</div>
        <div style="font-size:10px;color:#4b5568">目標 ${g.f}g</div>
      </div>
      <div style="background:#e8f5e9;border-radius:8px;padding:7px 4px">
        <div style="font-size:10px;color:#2f7d3a;font-weight:600">炭水化物</div>
        <div style="font-weight:700;color:#1a1d23">${r1(s.c)}g</div>
        <div style="font-size:10px;color:#4b5568">${ri(s.c*4)} kcal (${cCalPct}%)</div>
        <div style="font-size:10px;color:#4b5568">目標 ${g.c}g</div>
      </div>
    </div>`;

  document.getElementById('recMetrics').innerHTML = `
    <div class="mc"><div class="mc-label">カロリー</div><div class="mc-value">${ri(s.cal)}</div><div class="mc-unit">kcal</div></div>
    <div class="mc" style="position:relative"><div class="mc-label">タンパク質</div><div class="mc-value">${r1(s.p)}</div><div class="mc-unit">g</div><div style="font-size:9px;color:var(--accent);font-weight:600;margin-top:1px">吸収 ${absP}g</div></div>
    <div class="mc"><div class="mc-label">脂質</div><div class="mc-value">${r1(s.f)}</div><div class="mc-unit">g</div></div>
    <div class="mc"><div class="mc-label">炭水化物</div><div class="mc-value">${r1(s.c)}</div><div class="mc-unit">g</div></div>`;
  const pcal=s.p*4, fcal=s.f*9, ccal=s.c*4, tot=pcal+fcal+ccal||1;
  document.getElementById('recBarP').style.width=(pcal/tot*100)+'%';
  document.getElementById('recBarF').style.width=(fcal/tot*100)+'%';
  document.getElementById('recBarC').style.width=(ccal/tot*100)+'%';

  let microHtml = '';
  MICRO_KEYS.forEach(k => {
    const g=MICRO_GOALS[k], val=r1(s[k]||0);
    const pct=Math.min(val/g.goal*100,100);
    const over=!g.reverse&&val>g.goal;
    const color=g.reverse?(val>g.goal?'#c0392b':g.color):(over?'#c0392b':g.color);
    microHtml += `<div class="micro-item"><div class="micro-label">${g.label}</div>
      <div class="micro-bar-track"><div class="micro-bar-fill" style="width:${pct}%;background:${color}"></div></div>
      <div class="micro-val">${val}<span class="micro-unit"> ${g.unit}/${g.goal}</span></div></div>`;
  });
  document.getElementById('microGrid').innerHTML = microHtml;

  const grouped = {}; MEALS_ORDER.forEach(m=>{grouped[m]=[]});
  list.forEach(e=>{(grouped[e.meal]||grouped['間食']).push(e)});
  let html = '';
  MEALS_ORDER.forEach(meal => {
    const items=grouped[meal]||[], ms=sumEntries(items), meta=MEAL_META[meal], isAdding=activeAddMeal===meal;
    html += `<div class="meal-block"><div class="meal-block-header">
      <div class="meal-block-left">
        <div class="meal-icon" style="background:${meta.bg}">${meta.icon}</div>
        <div><div class="meal-name">${meal}</div><div class="meal-sub">${items.length?ri(ms.cal)+' kcal / P'+r1(ms.p)+' F'+r1(ms.f)+' C'+r1(ms.c):'未記録'}</div></div>
      </div>
      <button class="meal-add-btn${isAdding?' active-add':''}" onclick="toggleAddPanel('${meal}')">${isAdding?'✕ 閉じる':'＋ 追加'}</button>
    </div>`;
    if (items.length) {
      html += `<div style="display:flex;align-items:center;gap:6px;padding:0 12px 8px;font-size:11px">
        <span style="color:var(--text-sub)">⏱ 摂取時刻を一括設定</span>
        <input type="time" id="mealTimeSet_${meal}" style="padding:3px 6px;font-size:11px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text)">
        <button type="button" class="btn btn-sm" style="padding:3px 10px;font-size:11px" onclick="setMealTime('${meal}', document.getElementById('mealTimeSet_${meal}').value)">反映</button>
      </div>`;
      html += `<div class="meal-items">`;
      items.forEach(e => {
        if (editingId === e.id) {
          // 編集フォーム用に100g基準値をstoreする
          window._editBase = window._editBase || {};
          window._editBase[e.id] = {cal:e.cal,p:e.p,f:e.f,c:e.c,fiber:e.fiber||0,iron:e.iron||0,calcium:e.calcium||0,vitc:e.vitc||0,vitd:e.vitd||0,salt:e.salt||0,per:e.amount};
          html += `<div class="edit-form" id="editForm_${e.id}">
            <div class="row" style="margin-bottom:5px"><div class="field" style="flex:3"><label>食品名</label><input type="text" id="en${e.id}" value="${e.name}" onchange="autoSaveEdit(${e.id})"></div><div class="field" style="flex:1.2"><label>量(g)</label><input type="number" id="ea${e.id}" value="${e.amount}" min="1" oninput="recalcEdit(${e.id})"></div></div>
            <div class="row" style="margin-bottom:2px;gap:8px;align-items:center"><input type="range" id="easlider${e.id}" min="0" max="${Math.max(200, r1(e.amount*3))}" step="5" value="${e.amount}" style="flex:1" oninput="syncAmountFromSlider(${e.id}, this.value)"></div>
            <div class="row" style="margin-bottom:5px;gap:4px">${[-50,-10,10,50].map(d=>`<button type="button" class="btn btn-sm" style="flex:1;padding:4px 0;font-size:11px" onclick="nudgeEditAmount(${e.id},${d})">${d>0?'+':''}${d}g</button>`).join('')}</div>
            <div class="row" style="margin-bottom:5px"><div class="field"><label>kcal</label><input type="number" id="ec${e.id}" value="${r1(e.cal)}" step="0.1" onchange="autoSaveEdit(${e.id})"></div><div class="field"><label>P</label><input type="number" id="ep${e.id}" value="${r1(e.p)}" step="0.1" onchange="autoSaveEdit(${e.id})"></div><div class="field"><label>F</label><input type="number" id="ef${e.id}" value="${r1(e.f)}" step="0.1" onchange="autoSaveEdit(${e.id})"></div><div class="field"><label>C</label><input type="number" id="ecc${e.id}" value="${r1(e.c)}" step="0.1" onchange="autoSaveEdit(${e.id})"></div></div>
            <div class="row" style="margin-bottom:5px"><div class="field"><label>食物繊維</label><input type="number" id="efib${e.id}" value="${r1(e.fiber||0)}" step="0.1" onchange="autoSaveEdit(${e.id})"></div><div class="field"><label>鉄(mg)</label><input type="number" id="efe${e.id}" value="${r1(e.iron||0)}" step="0.1" onchange="autoSaveEdit(${e.id})"></div><div class="field"><label>Ca(mg)</label><input type="number" id="eca${e.id}" value="${r1(e.calcium||0)}" step="0.1" onchange="autoSaveEdit(${e.id})"></div></div>
            <div class="row" style="margin-bottom:5px"><div class="field"><label>VitC</label><input type="number" id="evc${e.id}" value="${r1(e.vitc||0)}" step="0.1" onchange="autoSaveEdit(${e.id})"></div><div class="field"><label>VitD</label><input type="number" id="evd${e.id}" value="${r1(e.vitd||0)}" step="0.1" onchange="autoSaveEdit(${e.id})"></div><div class="field"><label>塩分</label><input type="number" id="esl${e.id}" value="${r2(e.salt||0)}" step="0.01" onchange="autoSaveEdit(${e.id})"></div></div>
            <div class="row" style="margin-bottom:0"><div class="field"><label>タイミング</label><select id="em${e.id}" onchange="autoSaveEdit(${e.id})">${MEALS_ORDER.map(m=>`<option${e.meal===m?' selected':''}>${m}</option>`).join('')}</select></div><div class="field" style="flex:1"><label>摂取時刻</label><input type="time" id="et${e.id}" value="${e.time||''}" onchange="autoSaveEdit(${e.id})"></div>
            <button class="btn btn-primary btn-sm" onclick="saveEdit(${e.id})" style="height:32px;margin-top:auto">保存</button>
            <button class="btn btn-sm" onclick="cancelEdit(${e.id})" style="height:32px;margin-top:auto">取消</button></div>
          </div>`;
        } else {
          html += `<div class="log-item"><div><div class="li-name">${e.name}</div><div class="li-detail">${e.amount}g｜P${r1(e.p)} F${r1(e.f)} C${r1(e.c)}${e.fiber?'｜繊'+r1(e.fiber):''}${e.vitd?'｜D'+r1(e.vitd)+'μg':''}</div></div>
          <div class="li-right"><div class="li-cal">${ri(e.cal)}</div>
          <button class="btn btn-sm btn-ghost" onclick="startEdit(${e.id})" style="padding:2px 6px">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteEntry(${e.id})" style="padding:6px 10px">✕</button></div></div>`;
        }
      });
      html += `</div>`;
    }
    if (isAdding) {
      html += `<div class="add-panel" id="addPanel_${meal}">
        <div style="display:flex;gap:6px;align-items:flex-start;margin-bottom:9px">
          <div class="search-wrap" style="flex:1;margin-bottom:0">
            <input type="text" id="addSearch_${meal}" placeholder="いわし、chicken, egg…" oninput="onAddSearch(this.value,'${meal}')" autocomplete="off">
            <div class="search-icon-box" id="addSearchIcon_${meal}"><svg viewBox="0 0 16 16"><circle cx="6.5" cy="6.5" r="4"/><line x1="10" y1="10" x2="14" y2="14"/></svg></div>
            <div class="spin-box" id="addSpinner_${meal}"><div class="spinner"></div></div>
          </div>
          <button type="button" class="btn btn-sm" onclick="toggleAddPanel('${meal}')" aria-label="閉じる" style="height:38px;padding:0 13px;flex-shrink:0">✕</button>
        </div>
        <div class="results-box" id="addResultsBox_${meal}"></div>
        <details style="margin-top:2px">
          <summary style="font-size:12px;color:var(--text-sub);cursor:pointer;padding:4px 0">見つからない場合は手入力で追加</summary>
          <div style="padding-top:8px">
            <div class="row" style="margin-bottom:6px"><div class="field" style="flex:3"><label>食品名（手入力）</label><input type="text" id="addName_${meal}" placeholder="食品名"></div><div class="field" style="flex:1.4"><label style="display:flex;align-items:center;justify-content:space-between">量 <span style="display:flex;gap:2px" id="unitToggle_${meal}"><button type="button" onclick="setAmtUnit('${meal}','g')" id="unitG_${meal}" style="font-size:9px;padding:1px 5px;border-radius:3px;border:1px solid var(--accent);background:var(--accent);color:#fff;cursor:pointer">g</button><button type="button" onclick="setAmtUnit('${meal}','serving')" id="unitS_${meal}" style="font-size:9px;padding:1px 5px;border-radius:3px;border:1px solid var(--border);background:var(--bg);color:var(--text-sub);cursor:pointer">人前</button></span></label><input type="number" id="addAmt_${meal}" value="100" min="0.1" step="0.1" oninput="recalcAdd('${meal}')" style="width:100%"></div></div>
            <div id="amtQuickPick_${meal}" style="display:none;flex-wrap:wrap;gap:4px;margin-bottom:6px"></div>
            <div class="macro-row">
              <div class="field"><label>kcal</label><input type="number" id="addCal_${meal}" placeholder="0" step="0.1"></div>
              <div class="field"><label>P(g)</label><input type="number" id="addP_${meal}" placeholder="0" step="0.1"></div>
              <div class="field"><label>F(g)</label><input type="number" id="addF_${meal}" placeholder="0" step="0.1"></div>
              <div class="field"><label>C(g)</label><input type="number" id="addC_${meal}" placeholder="0" step="0.1"></div>
            </div>
            <div class="macro-row">
              <div class="field"><label>食物繊維(g)</label><input type="number" id="addFib_${meal}" placeholder="0" step="0.1"></div>
              <div class="field"><label>鉄(mg)</label><input type="number" id="addFe_${meal}" placeholder="0" step="0.1"></div>
              <div class="field"><label>Ca(mg)</label><input type="number" id="addCa_${meal}" placeholder="0" step="0.1"></div>
              <div class="field"><label>VitC(mg)</label><input type="number" id="addVc_${meal}" placeholder="0" step="0.1"></div>
              <div class="field"><label>VitD(μg)</label><input type="number" id="addVd_${meal}" placeholder="0" step="0.1"></div>
              <div class="field"><label>塩分(g)</label><input type="number" id="addSalt_${meal}" placeholder="0" step="0.01"></div>
            </div>
            <button class="btn btn-primary btn-block" onclick="addEntry('${meal}')">追加する</button>
            <div id="addMsg_${meal}" class="status-msg"></div>
          </div>
        </details>
      </div>`;
    }
    html += `</div>`;
  });
  document.getElementById('mealBlocks').innerHTML = html;
  if (activeAddMeal) setTimeout(() => { const el = document.getElementById('addSearch_'+activeAddMeal); if(el) el.focus(); }, 30);
  renderExerciseItems();
}

// ── Search ──
function searchScore(food, query) {
  const q=query.toLowerCase().trim(); if(!q) return 0;
  const s=food._search||'', nameNorm=normalize(food.name), qNorm=normalize(q);
  if (nameNorm===qNorm||s.startsWith(qNorm)) return 100;
  if (nameNorm.includes(qNorm)) return 90;
  if (s.includes(qNorm)) return 70;
  const en=(food.en||'').toLowerCase();
  if (en===q) return 85; if (en.startsWith(q)) return 80; if (en.includes(q)) return 65;
  let qi=0; for(let i=0;i<s.length&&qi<qNorm.length;i++) if(s[i]===qNorm[qi]) qi++;
  if (qi===qNorm.length) return 30;
  return 0;
}
function localSearch(q) {
  if (!q.trim()) return [];
  return getAllFoods().map(f=>({...f,_score:searchScore(f,q)})).filter(f=>f._score>0).sort((a,b)=>b._score-a._score).slice(0,9);
}
async function apiSearch(q) {
  if (apiAbort) apiAbort.abort(); apiAbort = new AbortController();
  try {
    const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&fields=product_name,product_name_ja,nutriments&page_size=5&lc=ja,en`,{signal:apiAbort.signal});
    const data = await res.json();
    return (data.products||[]).filter(p=>(p.product_name||p.product_name_ja)&&(p.nutriments||{})['energy-kcal_100g']!=null).map(p=>{
      const n=p.nutriments||{};
      const entry = {name:p.product_name_ja||p.product_name||'不明',cal:r1(n['energy-kcal_100g']||0),p:r1(n['proteins_100g']||0),f:r1(n['fat_100g']||0),c:r1(n['carbohydrates_100g']||0),per:100,
        fiber:r1(n['fiber_100g']||0),iron:r1(n['iron_100g']!=null?n['iron_100g']*1000:0),calcium:r1(n['calcium_100g']!=null?n['calcium_100g']*1000:0),
        vitc:r1(n['vitamin-c_100g']!=null?n['vitamin-c_100g']*1000:0),vitd:r1(n['vitamin-d_100g']!=null?n['vitamin-d_100g']*1000000:0),salt:r1(n['salt_100g']||0),_src:'api'};
      return enrichFoodProfile(entry);
    });
  } catch(e) { return e.name==='AbortError'?null:[]; }
}

const SRC_LABEL = {local:'内蔵',custom:'カスタム',combo:'複合',api:'外部'};
function showSp(spId, iconId, on) {
  const sp=document.getElementById(spId), ic=document.getElementById(iconId);
  if(sp) sp.style.display=on?'flex':'none'; if(ic) ic.style.display=on?'none':'flex';
}
function renderResultsFor(local, api, loading, meal) {
  const box=document.getElementById('addResultsBox_'+meal); if(!box) return;
  let html='';
  if(local.length){html+=`<div class="rs-label">内蔵・カスタムDB</div>`;html+=local.map((f,i)=>`<div class="ri" onclick="selectAddResult(${i},'local','${meal}')"><div><div class="ri-name">${f.name}<span class="badge badge-${f._src||'local'}">${SRC_LABEL[f._src||'local']}</span></div><div class="ri-sub">${f.per}gあたり P${f.p} F${f.f} C${f.c}${f.fiber?' 繊'+f.fiber:''}</div></div><div class="ri-cal">${f.cal}kcal</div></div>`).join('')}
  if(loading){html+=`<div class="rs-label">Open Food Facts 検索中…</div><div class="no-result"><div class="spinner" style="display:inline-block"></div></div>`}
  else if(api&&api.length){html+=`<div class="rs-label">Open Food Facts</div>`;html+=api.map((f,i)=>`<div class="ri" onclick="selectAddResult(${i},'api','${meal}')"><div><div class="ri-name">${f.name.length>26?f.name.slice(0,26)+'…':f.name}<span class="badge badge-api">外部</span></div><div class="ri-sub">100gあたり P${f.p} F${f.f} C${f.c}${f.fiber?' 繊'+f.fiber:''}</div></div><div class="ri-cal">${f.cal}kcal</div></div>`).join('')}
  else if(!loading&&!local.length){html+=`<div class="no-result">見つかりませんでした</div>`}
  box.innerHTML=html; box._local=local; box._api=api; box.style.display='block';
}
if (!window._addBase) window._addBase = {};
function onAddSearch(q, meal) {
  clearTimeout(searchTimer); const box=document.getElementById('addResultsBox_'+meal);
  if(!q.trim()){if(box)box.style.display='none';return}
  renderResultsFor(localSearch(q),[],true,meal); showSp('addSpinner_'+meal,'addSearchIcon_'+meal,true);
  searchTimer=setTimeout(async()=>{const api=await apiSearch(q);showSp('addSpinner_'+meal,'addSearchIcon_'+meal,false);if(api!==null)renderResultsFor(localSearch(q),api,false,meal)},600);
}
function selectAddResult(i, src, meal) {
  const box=document.getElementById('addResultsBox_'+meal); if(!box) return;
  const f=src==='local'?box._local[i]:box._api[i]; if(!f) return;
  window._addBase[meal]={...f};

  // ── 検索結果タップ＝即登録。量やその他の栄養素はあとで記録欄のインライン編集で調整する ──
  const per = f.per || 100;
  const amt = f.serving || per;
  const r   = amt / per;
  const newEntry = {
    id: Date.now() + Math.random(),
    date: currentDate,
    meal,
    time:    nowTimeStr(),
    name:    f.name,
    amount:  amt,
    cal:     r1((f.cal||0)*r),
    p:       r1((f.p||0)*r),
    f:       r1((f.f||0)*r),
    c:       r1((f.c||0)*r),
    fiber:   r1((f.fiber||0)*r),
    iron:    r2((f.iron||0)*r),
    calcium: r1((f.calcium||0)*r),
    vitc:    r1((f.vitc||0)*r),
    vitd:    r2((f.vitd||0)*r),
    vita:    r1((f.vita||0)*r),
    vite:    r2((f.vite||0)*r),
    vitk:    r1((f.vitk||0)*r),
    iodine:  r1((f.iodine||0)*r),
    salt:    r2((f.salt||0)*r),
    fa:      f.fa || null,
    aa:      f.aa || null,
  };
  if (!newEntry.fa || !newEntry.aa) enrichFoodProfile(newEntry);
  const { merged } = addOrMergeEntry(newEntry);
  save();

  box.style.display='none';
  document.getElementById('addSearch_'+meal).value='';
  const cont = document.getElementById('amtQuickPick_'+meal);
  if (cont) cont.style.display = 'none';

  renderRecord();
  renderCalendar();
  showToast(merged ? `✅「${f.name}」は既存の記録に合算しました` : `✅「${f.name}」を登録しました`);
}
// ── 調味料クイック登録 ──
// 小さじ1 = 約5ml（油類・液体）/調味料によって重量が異なる
const SEASONING_MASTER = {
  '醤油（濃口）小さじ1':   { name:'醤油（濃口）',      amount:6,  cal:4,   p:0.5, f:0,   c:0.6, fiber:0,   iron:0.1, calcium:2,  vitc:0,   vitd:0, salt:0.9 },
  '味噌（米みそ）小さじ1': { name:'味噌（米みそ）',    amount:6,  cal:12,  p:0.7, f:0.4, c:1.3, fiber:0.3, iron:0.2, calcium:8,  vitc:0,   vitd:0, salt:0.7 },
  '鶏ガラスープの素小さじ1':{ name:'鶏ガラスープの素',  amount:3,  cal:7,   p:0.6, f:0.2, c:0.8, fiber:0,   iron:0.1, calcium:3,  vitc:0,   vitd:0, salt:1.3 },
  '米油小さじ1':           { name:'米油',              amount:4,  cal:37,  p:0,   f:4.0, c:0,   fiber:0,   iron:0,   calcium:0,  vitc:0,   vitd:0, salt:0   },
  'みりん小さじ1':         { name:'みりん',            amount:6,  cal:14,  p:0,   f:0,   c:3.1, fiber:0,   iron:0,   calcium:0,  vitc:0,   vitd:0, salt:0   },
  'にんにく小さじ1':       { name:'にんにく',          amount:5,  cal:7,   p:0.3, f:0,   c:1.4, fiber:0.3, iron:0,   calcium:1,  vitc:0.6, vitd:0, salt:0   },
  '白だし小さじ1':         { name:'白だし',            amount:6,  cal:7,   p:0.4, f:0,   c:1.4, fiber:0,   iron:0.1, calcium:3,  vitc:0,   vitd:0, salt:1.0 },
  'カレー粉小さじ1':       { name:'カレー粉',          amount:2,  cal:7,   p:0.3, f:0.3, c:1.0, fiber:0.6, iron:0.3, calcium:5,  vitc:0,   vitd:0, salt:0   },
  '酢小さじ1':             { name:'酢（穀物酢）',       amount:5,  cal:1,   p:0,   f:0,   c:0.1, fiber:0,   iron:0,   calcium:0,  vitc:0,   vitd:0, salt:0   },
  '砂糖小さじ1':           { name:'砂糖（上白糖）',     amount:3,  cal:12,  p:0,   f:0,   c:3.0, fiber:0,   iron:0,   calcium:0,  vitc:0,   vitd:0, salt:0   },
  'ウスターソース小さじ1': { name:'ウスターソース',    amount:6,  cal:7,   p:0.1, f:0,   c:1.6, fiber:0,   iron:0.1, calcium:4,  vitc:0,   vitd:0, salt:0.5 },
  'ケチャップ小さじ1':     { name:'ケチャップ',         amount:5,  cal:6,   p:0.1, f:0,   c:1.4, fiber:0.1, iron:0,   calcium:1,  vitc:0.5, vitd:0, salt:0.2 },
};

let _seasoningMsgTimer = null;
function addSeasoning(key) {
  const s = SEASONING_MASTER[key];
  if (!s) return;
  const meal = document.getElementById('seasoningMeal')?.value || '昼食';
  const { merged } = addOrMergeEntry({
    id: Date.now() + Math.random(),
    date: currentDate,
    meal,
    time:    nowTimeStr(),
    name:    s.name,
    amount:  s.amount,
    cal:     s.cal,
    p:       s.p,
    f:       s.f,
    c:       s.c,
    fiber:   s.fiber,
    iron:    s.iron,
    calcium: s.calcium,
    vitc:    s.vitc,
    vitd:    s.vitd,
    salt:    s.salt,
  });
  save();
  renderRecord();
  showToast(merged ? `✅ ${s.name}（${s.amount}g）を${meal}に合算しました` : `✅ ${s.name}（小さじ1・${s.amount}g）を${meal}に追加`);
}


function openCopyDayModal() {
  const modal = document.getElementById('copyDayModal');
  if (!modal) return;
  // タブをデフォルト（1日まるごと）にリセット
  document.querySelectorAll('#copyTabToggle .toggle-btn').forEach(b => b.classList.remove('active'));
  const dayTabBtn = document.querySelector('#copyTabToggle .toggle-btn[data-copytab="day"]');
  if (dayTabBtn) dayTabBtn.classList.add('active');
  const dayDiv = document.getElementById('copyTabDay'), mealDiv = document.getElementById('copyTabMeal');
  if (dayDiv) dayDiv.style.display = '';
  if (mealDiv) mealDiv.style.display = 'none';
  // デフォルト: 昨日
  const yesterday = new Date(currentDate + 'T00:00:00');
  yesterday.setDate(yesterday.getDate() - 1);
  const input = document.getElementById('copyFromDate');
  if (input) input.value = toDateStr(yesterday);
  const destLabel = document.getElementById('copyDestLabel');
  if (destLabel) destLabel.textContent = dateLabel(currentDate);
  modal.style.display = 'flex';
  updateCopyDayPreview();
}
function switchCopyTab(tab, el) {
  document.querySelectorAll('#copyTabToggle .toggle-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  const dayDiv = document.getElementById('copyTabDay'), mealDiv = document.getElementById('copyTabMeal');
  if (dayDiv) dayDiv.style.display = tab === 'day' ? '' : 'none';
  if (mealDiv) mealDiv.style.display = tab === 'meal' ? '' : 'none';
  if (tab === 'meal') renderCopyPanel();
}
function closeCopyDayModal() {
  const modal = document.getElementById('copyDayModal');
  if (modal) modal.style.display = 'none';
  const msg = document.getElementById('copyDayMsg');
  if (msg) msg.textContent = '';
}
function updateCopyDayPreview() {
  const input = document.getElementById('copyFromDate');
  const preview = document.getElementById('copyDayPreview');
  if (!input || !preview) return;
  const fromDate = input.value;
  if (!fromDate) { preview.textContent = '日付を選択してください'; return; }
  const fromEntries = entries.filter(e => e.date === fromDate);
  const fromEx      = exercises.filter(e => e.date === fromDate);
  if (!fromEntries.length && !fromEx.length) {
    preview.textContent = `${dateLabel(fromDate)} の記録はありません`;
    return;
  }
  const s = sumEntries(fromEntries);
  const mealCounts = MEALS_ORDER.map(m => {
    const cnt = fromEntries.filter(e => e.meal === m).length;
    return cnt ? `${m}${cnt}品` : null;
  }).filter(Boolean).join(' / ');
  preview.innerHTML = `
    <div style="font-weight:600;margin-bottom:3px">${dateLabel(fromDate)}</div>
    <div>${mealCounts || '食事なし'}　合計 ${ri(s.cal)} kcal</div>
    ${fromEx.length ? `<div>運動: ${fromEx.map(e=>e.name).join('、')} (消費${ri(fromEx.reduce((a,e)=>a+(e.cal||0),0))}kcal)</div>` : ''}
  `;
}
function executeCopyDay() {
  const input     = document.getElementById('copyFromDate');
  const overwrite = document.getElementById('copyOverwrite')?.checked;
  const copyEx    = document.getElementById('copyExercise')?.checked;
  const msg       = document.getElementById('copyDayMsg');
  const fromDate  = input?.value;
  if (!fromDate) { if(msg){msg.className='status-msg status-err';msg.textContent='コピー元の日付を選んでください';} return; }
  if (fromDate === currentDate) { if(msg){msg.className='status-msg status-err';msg.textContent='コピー元とコピー先が同じ日付です';} return; }

  const fromEntries = entries.filter(e => e.date === fromDate);
  const fromEx      = exercises.filter(e => e.date === fromDate);
  if (!fromEntries.length && !fromEx.length) {
    if(msg){msg.className='status-msg status-err';msg.textContent='コピー元に記録がありません';}
    return;
  }

  // バックアップ
  takeAiBackup(`${dateLabel(fromDate)}→${dateLabel(currentDate)}コピー前`);

  // 食事コピー
  if (overwrite) entries = entries.filter(e => e.date !== currentDate);
  const now = Date.now();
  fromEntries.forEach((e, i) => {
    entries.push({ ...e, id: now + i, date: currentDate });
  });

  // 運動コピー
  if (copyEx) {
    if (overwrite) exercises = exercises.filter(e => e.date !== currentDate);
    fromEx.forEach((e, i) => {
      exercises.push({ ...e, id: now + 10000 + i, date: currentDate });
    });
  }

  save();
  saveExercises();
  renderRecord();
  renderCalendar();
  renderExerciseItems();

  const copied = fromEntries.length + (copyEx ? fromEx.length : 0);
  if(msg){msg.className='status-msg status-ok';msg.textContent=`✅ ${copied}件をコピーしました`;}
  setTimeout(() => closeCopyDayModal(), 1200);
}

// ── 食品登録 量クイック選択 ──
// 単位モード管理 (g / serving)
if (!window._amtUnit) window._amtUnit = {};

function setAmtUnit(meal, unit) {
  window._amtUnit[meal] = unit;
  const base = window._addBase?.[meal];
  const serving = base?.serving || base?.per || 100;

  // ボタンスタイル切り替え
  const gBtn = document.getElementById('unitG_'+meal);
  const sBtn = document.getElementById('unitS_'+meal);
  if (gBtn) {
    gBtn.style.background = unit === 'g' ? 'var(--accent)' : 'var(--bg)';
    gBtn.style.color      = unit === 'g' ? '#fff' : 'var(--text-sub)';
    gBtn.style.borderColor= unit === 'g' ? 'var(--accent)' : 'var(--border)';
  }
  if (sBtn) {
    sBtn.style.background = unit === 'serving' ? 'var(--accent)' : 'var(--bg)';
    sBtn.style.color      = unit === 'serving' ? '#fff' : 'var(--text-sub)';
    sBtn.style.borderColor= unit === 'serving' ? 'var(--accent)' : 'var(--border)';
  }

  const inp = document.getElementById('addAmt_'+meal);
  if (!inp) return;

  if (unit === 'serving') {
    inp.step = '0.5';
    inp.min  = '0.1';
    inp.value = '1';
    inp.placeholder = '人前';
  } else {
    inp.step = '1';
    inp.min  = '1';
    inp.value = serving;
    inp.placeholder = 'g';
  }
  recalcAdd(meal);
  // クイックピッカーも更新
  showAmtQuickPicker(meal, false);
}

function showAmtQuickPicker(meal, toggle = true) {
  const base    = window._addBase?.[meal];
  const cont    = document.getElementById('amtQuickPick_'+meal);
  if (!cont) return;

  const unit    = window._amtUnit?.[meal] || 'g';
  const serving = base?.serving || base?.per || 100;
  const per     = base?.per || 100;

  let buttons = [];
  if (unit === 'serving' && base?.serving) {
    // 人前モード: 0.5/1/1.5/2/3人前
    [0.5, 1, 1.5, 2, 3].forEach(n => {
      const gVal = Math.round(serving * n * 10) / 10;
      const label = n === Math.floor(n) ? `${n}人前` : `${n}人前`;
      buttons.push(`<button onclick="setAddAmtServing('${meal}',${n})"
        style="font-size:11px;padding:3px 9px;border:1px solid var(--border);border-radius:6px;
        background:${n===1?'var(--accent)':'var(--bg)'};color:${n===1?'#fff':'var(--text)'};cursor:pointer;white-space:nowrap">
        ${label}<span style="font-size:9px;opacity:.7;margin-left:3px">${gVal}g</span></button>`);
    });
  } else {
    // gモード: per値軸の選択肢
    const candidates = new Set([per]);
    [50, 100, 150, 200, 250, 300].forEach(v => candidates.add(v));
    if (serving && serving !== per) candidates.add(serving);
    if (per !== 100) [Math.round(per*0.5), Math.round(per*2)].forEach(v => v>0 && candidates.add(v));
    [...candidates].filter(v=>v>0).sort((a,b)=>a-b).forEach(v => {
      const isStar = v === (serving || per);
      buttons.push(`<button onclick="setAddAmt('${meal}',${v})"
        style="font-size:11px;padding:3px 8px;border:1px solid var(--border);border-radius:6px;
        background:${isStar?'var(--accent)':'var(--bg)'};color:${isStar?'#fff':'var(--text)'};cursor:pointer;white-space:nowrap">
        ${v}g${isStar?' ★':''}</button>`);
    });
  }

  cont.innerHTML = buttons.join('');
  if (toggle) {
    cont.style.display = cont.style.display === 'none' ? 'flex' : 'none';
  } else {
    if (cont.style.display !== 'none') cont.style.display = 'flex';
  }
}

function setAddAmtServing(meal, servings) {
  const base    = window._addBase?.[meal];
  const serving = base?.serving || base?.per || 100;
  const gVal    = Math.round(serving * servings * 10) / 10;
  const inp     = document.getElementById('addAmt_'+meal);
  if (inp) { inp.value = servings; }
  recalcAdd(meal);
}

function setAddAmt(meal, val) {
  const el = document.getElementById('addAmt_'+meal);
  if (el) { el.value = val; recalcAdd(meal); }
  const cont = document.getElementById('amtQuickPick_'+meal);
  if (cont) cont.style.display = 'none';
}


function fillAddMacros(f, amt, meal) {
  const r=amt/(f.per||100);
  const set=(id,val)=>{const el=document.getElementById(id+'_'+meal);if(el)el.value=r1(val*r)};
  set('addCal',f.cal);set('addP',f.p);set('addF',f.f);set('addC',f.c);
  set('addFib',f.fiber||0);set('addFe',f.iron||0);set('addCa',f.calcium||0);set('addVc',f.vitc||0);set('addVd',f.vitd||0);
  const se=document.getElementById('addSalt_'+meal); if(se) se.value=r2((f.salt||0)*r);
}
function recalcAdd(meal) {
  const bn = window._addBase && window._addBase[meal]; if(!bn) return;
  const unit    = window._amtUnit?.[meal] || 'g';
  const rawVal  = parseFloat(document.getElementById('addAmt_'+meal)?.value) || 0;
  if (rawVal <= 0) return;
  const serving = bn.serving || bn.per || 100;
  const amtG    = unit === 'serving' ? rawVal * serving : rawVal;
  fillAddMacros(bn, amtG, meal);
}
// ── 重複食品のマージ登録 ──
// 同じ日付・食事区分・食品名（トリム＋大小文字無視）の記録が既にある場合は
// 新規エントリを追加せず、既存エントリへ数量・栄養価を加算する。
function normFoodName(n) { return (n || '').trim().toLowerCase().replace(/\s+/g, ''); }
function findDuplicateEntry(date, meal, name, excludeId) {
  const key = normFoodName(name);
  if (!key) return null;
  return entries.find(e =>
    e.date === date && e.meal === meal &&
    normFoodName(e.name) === key &&
    (excludeId == null || e.id !== excludeId)
  ) || null;
}
function addOrMergeEntry(newEntry, excludeId) {
  const dup = findDuplicateEntry(newEntry.date, newEntry.meal, newEntry.name, excludeId);
  if (dup) {
    dup.amount  = r1((dup.amount  || 0) + (newEntry.amount  || 0));
    dup.cal     = r1((dup.cal     || 0) + (newEntry.cal     || 0));
    dup.p       = r1((dup.p       || 0) + (newEntry.p       || 0));
    dup.f       = r1((dup.f       || 0) + (newEntry.f       || 0));
    dup.c       = r1((dup.c       || 0) + (newEntry.c       || 0));
    dup.fiber   = r1((dup.fiber   || 0) + (newEntry.fiber   || 0));
    dup.iron    = r2((dup.iron    || 0) + (newEntry.iron    || 0));
    dup.calcium = r1((dup.calcium || 0) + (newEntry.calcium || 0));
    dup.vitc    = r1((dup.vitc    || 0) + (newEntry.vitc    || 0));
    dup.vitd    = r2((dup.vitd    || 0) + (newEntry.vitd    || 0));
    dup.salt    = r2((dup.salt    || 0) + (newEntry.salt    || 0));
    if (!dup.fa && newEntry.fa) dup.fa = newEntry.fa;
    if (!dup.aa && newEntry.aa) dup.aa = newEntry.aa;
    if (!dup._fa && newEntry._fa) dup._fa = newEntry._fa;
    return { entry: dup, merged: true };
  }
  entries.push(newEntry);
  return { entry: newEntry, merged: false };
}

function setMealTime(meal, timeVal) {
  if (!timeVal) { showToast('時刻を選択してください'); return; }
  const list = getDayEntries(currentDate).filter(e => e.meal === meal);
  if (!list.length) return;
  list.forEach(e => { e.time = timeVal; });
  save();
  renderRecord();
  showToast(`✅ ${meal}（${list.length}件）の摂取時刻を${timeVal}に設定しました`);
}
function nowTimeStr() {
  const d = new Date();
  return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}
function gv(id) { return parseFloat(document.getElementById(id).value)||0; }
function addEntry(meal) {
  const nameEl=document.getElementById('addName_'+meal);
  const name=nameEl?nameEl.value.trim():'';
  const msg=document.getElementById('addMsg_'+meal);
  if(!name){
    if(msg){
      const searchVal = document.getElementById('addSearch_'+meal)?.value.trim();
      msg.className='status-msg status-err';
      msg.textContent = searchVal
        ? '検索結果からタップして選ぶか、下の「食品名」欄に手入力してください'
        : '食品名を入力してください';
    }
    return;
  }
  const newEntry = {id:Date.now(),date:currentDate,name,meal,time:nowTimeStr(),
    cal:gv('addCal_'+meal),p:gv('addP_'+meal),f:gv('addF_'+meal),c:gv('addC_'+meal),
    amount: (() => {
      const unit = window._amtUnit?.[meal] || 'g';
      const raw  = parseFloat(document.getElementById('addAmt_'+meal)?.value) || 1;
      const base = window._addBase?.[meal];
      if (unit === 'serving' && base?.serving) return Math.round(raw * base.serving * 10) / 10;
      return raw || 100;
    })(),
    fiber:gv('addFib_'+meal),iron:gv('addFe_'+meal),calcium:gv('addCa_'+meal),vitc:gv('addVc_'+meal),vitd:gv('addVd_'+meal),salt:gv('addSalt_'+meal),
    fa: window._addBase?.[meal]?.fa || null,
    aa: window._addBase?.[meal]?.aa || null,
    _fa: window._addBase?.[meal]?.fa || null,
  };
  // faもaaも未設定なら名前から推定
  if (!newEntry.fa || !newEntry.aa) enrichFoodProfile(newEntry);
  const { merged } = addOrMergeEntry(newEntry);
  save(); renderRecord(); renderCalendar();
  setTimeout(()=>{const m=document.getElementById('addMsg_'+meal);if(m){m.className='status-msg status-ok';m.textContent=merged?`「${name}」は既に記録済みのため数量を合算しました`:`「${name}」を追加しました`;setTimeout(()=>{if(m)m.textContent=''},2200)}},30);
}
function toggleAddPanel(meal) {
  const wasOpen = activeAddMeal === meal;
  if (wasOpen) {
    // 閉じる: 履歴を積んであればback()で消費し、実際のクローズ処理はpopstateハンドラに任せる
    // （activeAddMealをここで先にnullにしてしまうと、popstateハンドラの判定が
    //  常にfalseになり再描画が起きなくなるため、状態変更は必ず描画とセットで行う）
    if (window.history.state && window.history.state.pfcOverlay === 'addPanel') {
      try { history.back(); return; } catch(e) {}
    }
    activeAddMeal = null;
    editingId = null;
    renderRecord();
    return;
  }
  // 開く
  activeAddMeal = meal;
  editingId = null;
  // 端末の「戻る」操作（スワイプ／戻るボタン）でこのパネルを閉じられるよう履歴を1つ積む
  try { history.pushState({ pfcOverlay: 'addPanel' }, ''); } catch(e) {}
  renderRecord();
}
// 検索パネルを開いている状態で端末の「戻る」操作をした場合、アプリ自体を閉じずにパネルだけ閉じる
window.addEventListener('popstate', () => {
  if (activeAddMeal) {
    activeAddMeal = null;
    renderRecord();
  }
});
function startEdit(id){
  editingId=id;
  activeAddMeal=null; // 検索・食品追加パネルが開いていれば閉じる（同時に開かない）
  window._editOriginal = window._editOriginal || {};
  const src = entries.find(e => e.id === id);
  if (src) window._editOriginal[id] = {...src};
  renderRecord();
}
function syncAmountFromSlider(id, val) {
  const amtEl = document.getElementById('ea'+id);
  if (!amtEl) return;
  amtEl.value = val;
  recalcEdit(id);
}
function nudgeEditAmount(id, delta) {
  const amtEl = document.getElementById('ea'+id);
  if (!amtEl) return;
  const cur = parseFloat(amtEl.value) || 0;
  amtEl.value = Math.max(1, r1(cur + delta));
  recalcEdit(id);
}
function recalcEdit(id) {
  const base = window._editBase && window._editBase[id];
  if (!base) return;
  const amt = parseFloat(document.getElementById('ea'+id).value) || 0;
  if (amt <= 0) return;
  const sliderEl = document.getElementById('easlider'+id);
  if (sliderEl) {
    if (amt > parseFloat(sliderEl.max)) sliderEl.max = amt; // 大きい値を直接入力された場合はスライダーの上限を追従させる
    sliderEl.value = amt;
  }
  const r = amt / (base.per || 100);
  const set = (elId, val, dec) => {
    const el = document.getElementById(elId+id);
    if (el) el.value = dec === 2 ? r2(val*r) : r1(val*r);
  };
  set('ec', base.cal);
  set('ep', base.p);
  set('ef', base.f);
  set('ecc', base.c);
  set('efib', base.fiber);
  set('efe', base.iron);
  set('eca', base.calcium);
  set('evc', base.vitc);
  set('evd', base.vitd);
  set('esl', base.salt, 2);
  autoSaveEdit(id);
}
// 保存ボタンを押さなくても、編集中の内容を都度バックグラウンドで確定させる
// （画面の再描画はしない＝入力中のフォーカスやカーソル位置を崩さないため）
function autoSaveEdit(id) {
  const idx = entries.findIndex(e => e.id === id);
  if (idx === -1) return;
  const nameEl = document.getElementById('en'+id);
  const amtEl  = document.getElementById('ea'+id);
  if (!nameEl || !amtEl) return;
  entries[idx] = {
    ...entries[idx],
    name:    nameEl.value.trim() || entries[idx].name,
    amount:  parseFloat(amtEl.value) || entries[idx].amount,
    cal:     parseFloat(document.getElementById('ec'+id).value) || 0,
    p:       parseFloat(document.getElementById('ep'+id).value) || 0,
    f:       parseFloat(document.getElementById('ef'+id).value) || 0,
    c:       parseFloat(document.getElementById('ecc'+id).value) || 0,
    fiber:   parseFloat(document.getElementById('efib'+id).value) || 0,
    iron:    parseFloat(document.getElementById('efe'+id).value) || 0,
    calcium: parseFloat(document.getElementById('eca'+id).value) || 0,
    vitc:    parseFloat(document.getElementById('evc'+id).value) || 0,
    vitd:    parseFloat(document.getElementById('evd'+id).value) || 0,
    salt:    parseFloat(document.getElementById('esl'+id).value) || 0,
    meal:    document.getElementById('em'+id).value,
    time:    document.getElementById('et'+id)?.value || entries[idx].time,
  };
  saveDebounced();
}
function cancelEdit(id){
  // オートセーブ済みの変更を、編集開始前の状態に戻す
  if (id != null && window._editOriginal && window._editOriginal[id]) {
    const idx = entries.findIndex(e => e.id === id);
    if (idx !== -1) entries[idx] = window._editOriginal[id];
    save();
  }
  if (window._editBase) window._editBase = {};
  if (window._editOriginal && id != null) delete window._editOriginal[id];
  editingId = null;
  renderRecord();
}
function saveEdit(id) {
  autoSaveEdit(id);
  if (window._editOriginal) delete window._editOriginal[id];
  save(); editingId=null; renderRecord(); renderCalendar();
}
function deleteEntry(id){
  const idx = entries.findIndex(e=>e.id===id);
  if (idx === -1) return;
  const removed = entries[idx];
  entries.splice(idx,1);
  if(editingId===id)editingId=null;
  save();renderRecord();renderCalendar();
  showUndoToast(`「${removed.name}」を削除しました`, () => {
    entries.splice(Math.min(idx, entries.length), 0, removed);
    save(); renderRecord(); renderCalendar();
  });
}

// ── Exercise ──
const EXERCISE_TYPES = {
  '3.5': 'ウォーキング',
  '7.0': 'ジョギング',
  '8.0': 'ランニング',
  '6.0': 'サイクリング',
  '8.0s': '水泳',
  '4.5': '筋トレ',
  '3.0': 'ヨガ・ストレッチ',
  '6.0b': 'バドミントン',
  '7.0t': 'テニス',
  '0': 'その他',
};

function toggleExercisePanel() {
  exPanelOpen = !exPanelOpen;
  const panel = document.getElementById('exerciseAddPanel');
  const btn   = document.getElementById('exAddBtn');
  if (panel) panel.style.display = exPanelOpen ? 'block' : 'none';
  if (btn)   btn.textContent      = exPanelOpen ? '✕ 閉じる' : '＋ 追加';
  if (exPanelOpen) onExTypeChange();
}

function onExTypeChange() {
  const sel = document.getElementById('exType');
  const manualRow = document.getElementById('exManualRow');
  if (!sel || !manualRow) return;
  manualRow.style.display = sel.value === '0' ? 'flex' : 'none';
}

function addExercise() {
  const sel  = document.getElementById('exType');
  const mins = parseFloat(document.getElementById('exMinutes').value) || 0;
  const msg  = document.getElementById('exMsg');

  if (!sel) return;
  const mets = parseFloat(sel.value);
  const isManual = sel.value === '0';

  let burnedCal = 0;
  let exName    = '';

  if (isManual) {
    burnedCal = parseFloat(document.getElementById('exManualCal').value) || 0;
    exName    = (document.getElementById('exManualName').value || '').trim() || 'その他';
  } else {
    if (mins <= 0) {
      if (msg) { msg.className='status-msg status-err'; msg.textContent='時間を入力してください'; }
      return;
    }
    // 消費カロリー = METs × 体重(kg) × 時間(h)
    const weight = profile.weight || userWeight || 65;
    burnedCal = r1(mets * weight * (mins / 60));
    // select の表示テキストから種目名を取得
    exName = sel.options[sel.selectedIndex].text.replace(/（.*）/, '').trim();
  }

  if (burnedCal <= 0) {
    if (msg) { msg.className='status-msg status-err'; msg.textContent='消費カロリーを入力してください'; }
    return;
  }

  exercises.push({
    id: Date.now(),
    date: currentDate,
    name: exName,
    minutes: mins,
    cal: burnedCal,
  });
  saveExercises();
  renderExerciseItems();

  // フォームリセット
  document.getElementById('exMinutes').value = '30';
  const manualCal  = document.getElementById('exManualCal');
  const manualName = document.getElementById('exManualName');
  if (manualCal)  manualCal.value  = '';
  if (manualName) manualName.value = '';

  if (msg) {
    msg.className = 'status-msg status-ok';
    msg.textContent = `「${exName}」を追加しました（${burnedCal} kcal）`;
    setTimeout(() => { if (msg) msg.textContent = ''; }, 2000);
  }
}

function deleteExercise(id) {
  const idx = exercises.findIndex(e => e.id === id);
  if (idx === -1) return;
  const removed = exercises[idx];
  exercises.splice(idx, 1);
  saveExercises();
  renderExerciseItems();
  showUndoToast(`「${removed.name}」を削除しました`, () => {
    exercises.splice(Math.min(idx, exercises.length), 0, removed);
    saveExercises(); renderExerciseItems();
  });
}

function renderExerciseItems() {
  const dayEx  = exercises.filter(e => e.date === currentDate);
  const items  = document.getElementById('exerciseItems');
  const sub    = document.getElementById('exerciseSub');
  const totalCal = dayEx.reduce((a, e) => a + (e.cal || 0), 0);

  if (sub) sub.textContent = dayEx.length ? `${ri(totalCal)} kcal 消費` : '未記録';

  if (!items) return;
  if (!dayEx.length) { items.innerHTML = ''; return; }

  items.innerHTML = `<div class="meal-items">${
    dayEx.map(e =>
      `<div class="log-item">
        <div>
          <div class="li-name">${e.name}</div>
          <div class="li-detail">${e.minutes ? e.minutes + '分' : ''}　消費 ${ri(e.cal)} kcal</div>
        </div>
        <div class="li-right">
          <div class="li-cal" style="color:#e91e63">${ri(e.cal)}</div>
          <button class="btn btn-sm btn-danger" onclick="deleteExercise(${e.id})" style="padding:6px 10px">✕</button>
        </div>
      </div>`
    ).join('')
  }</div>`;
}

// ── Copy ──
function renderCopyPanel() {
  const filter=document.getElementById('copyFilter').value;
  const days=[...new Set(entries.map(e=>e.date))].filter(d=>d!==currentDate).sort((a,b)=>b.localeCompare(a)).slice(0,14);
  const cont=document.getElementById('copyPanel');
  if(!days.length){cont.innerHTML=`<div style="font-size:12px;color:var(--text-sub);padding:8px 0">記録がありません</div>`;return}
  let html='';
  days.forEach(d=>{
    const grouped={};MEALS_ORDER.forEach(m=>{grouped[m]=[]});
    getDayEntries(d).filter(e=>!filter||e.meal===filter).forEach(e=>{(grouped[e.meal]||grouped['間食']).push(e)});
    MEALS_ORDER.forEach(meal=>{
      const mitems=grouped[meal];if(!mitems||!mitems.length||(filter&&meal!==filter))return;
      const ms=sumEntries(mitems);
      html+=`<div class="copy-item"><div class="ci-header"><span class="ci-title">${fmtDate(d)} — ${meal}（${ri(ms.cal)}kcal）</span><button class="btn btn-sm btn-primary" onclick="copyMeal('${d}','${meal}')">コピー</button></div>${mitems.map(e=>`<div class="ci-food">${e.name}（${e.amount}g）${ri(e.cal)}kcal</div>`).join('')}</div>`;
    });
  });
  cont.innerHTML=html||`<div style="font-size:12px;color:var(--text-sub);padding:8px 0">該当なし</div>`;
}
function copyMeal(date, meal) {
  const target=document.getElementById('copyTarget').value;
  getDayEntries(date).filter(e=>e.meal===meal).forEach(e=>entries.push({...e,id:Date.now()+Math.random(),date:currentDate,meal:target}));
  save(); renderRecord(); renderCalendar();
}

// ── Stats ──
// ── 食品プロファイル自動付与 ──
// 外部API・AI・手動登録食品に fa/aa を自動推定して付与する
const AA_PROFILES_MAP = {
  whey:    {leu:.11,ile:.07,val:.06,lys:.10,met:.02,thr:.07,trp:.02,his:.02,score:1.09},
  egg:     {leu:.09,ile:.06,val:.07,lys:.09,met:.03,thr:.06,trp:.02,his:.03,score:1.13},
  chicken: {leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08},
  beef:    {leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00},
  pork:    {leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:0.98},
  fish:    {leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},
  milk:    {leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22},
  casein:  {leu:.09,ile:.06,val:.06,lys:.08,met:.03,thr:.04,trp:.01,his:.03,score:1.07},
  soy:     {leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.91},
  wheat:   {leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},
  rice:    {leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59},
  legume:  {leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.72},
  nut:     {leu:.07,ile:.04,val:.05,lys:.03,met:.02,thr:.03,trp:.01,his:.03,score:0.40},
  mixed:   {leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},
};
const AA_PAT_MAP = [
  [/ホエイ|whey|WPC|WPI/i,                                          'whey'],
  [/カゼイン|casein/i,                                               'casein'],
  [/卵|たまご|タマゴ|目玉焼き|ゆで卵|スクランブル|玉子|オムレツ/i,  'egg'],
  [/鶏|チキン|ささみ|焼き鳥|唐揚げ|から揚げ|ファミチキ/i,           'chicken'],
  [/牛|ビーフ|ハンバーグ|牛丼|ワッパー/i,                           'beef'],
  [/豚|ポーク|とんかつ|メンチ|ウインナー|ソーセージ|ベーコン|ハム|餃子|シュウマイ/i, 'pork'],
  [/さば|さんま|いわし|まぐろ|マグロ|ツナ|鮭|サーモン|あじ|ぶり|えび|いか|ほたて|あさり|カニ|シーフード/i, 'fish'],
  [/牛乳|ミルク|ヨーグルト|チーズ|乳/i,                             'milk'],
  [/豆腐|納豆|豆乳|大豆|えだまめ|きな粉/i,                          'soy'],
  [/ご飯|白米|玄米|おにぎり|寿司|チャーハン/i,                      'rice'],
  [/パン|うどん|パスタ|スパゲッティ|ラーメン|そば|麺|ピザ|クッキー/i,'wheat'],
  [/レンズ豆|ひよこ豆|黒豆|インゲン|あずき/i,                       'legume'],
  [/アーモンド|くるみ|ピーナッツ|ナッツ|ごま/i,                     'nut'],
];
const FA_PAT_MAP = [
  [/米油/i,                    {sat:.17,mufa:.42,n3:.01,n6:.35,trans:.01}],
  [/オリーブ/i,                {sat:.14,mufa:.74,n3:.01,n6:.10,trans:.00}],
  [/ごま油/i,                  {sat:.15,mufa:.39,n3:.00,n6:.43,trans:.00}],
  [/えごま|亜麻仁/i,           {sat:.09,mufa:.19,n3:.57,n6:.14,trans:.00}],
  [/バター/i,                  {sat:.63,mufa:.27,n3:.01,n6:.03,trans:.04}],
  [/マーガリン/i,              {sat:.22,mufa:.44,n3:.06,n6:.24,trans:.04}],
  [/マヨネーズ/i,              {sat:.12,mufa:.35,n3:.06,n6:.44,trans:.01}],
  [/サラダ油|キャノーラ|菜種/i,{sat:.15,mufa:.29,n3:.07,n6:.47,trans:.00}],
  [/さば|鯖/i,                 {sat:.25,mufa:.29,n3:.31,n6:.04,trans:.00}],
  [/さんま/i,                  {sat:.22,mufa:.42,n3:.22,n6:.03,trans:.00}],
  [/いわし|オイルサーディン/i, {sat:.25,mufa:.27,n3:.31,n6:.05,trans:.00}],
  [/まぐろ|マグロ|ツナ/i,      {sat:.28,mufa:.18,n3:.38,n6:.05,trans:.00}],
  [/鮭|サーモン/i,             {sat:.22,mufa:.32,n3:.32,n6:.08,trans:.00}],
  [/ぶり/i,                    {sat:.24,mufa:.39,n3:.21,n6:.06,trans:.00}],
  [/えび|いか/i,               {sat:.30,mufa:.18,n3:.28,n6:.10,trans:.00}],
  [/ほたて|あさり|カニ/i,      {sat:.28,mufa:.24,n3:.24,n6:.08,trans:.00}],
  [/鶏もも|唐揚げ|から揚げ|焼き鳥/i,{sat:.31,mufa:.44,n3:.03,n6:.18,trans:.01}],
  [/鶏むね|ささみ|サラダチキン/i,    {sat:.28,mufa:.40,n3:.02,n6:.22,trans:.01}],
  [/豚|ポーク|とんかつ|ベーコン|ハム|ウインナー|ソーセージ|餃子/i, {sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01}],
  [/牛|ビーフ|ハンバーグ/i,    {sat:.47,mufa:.43,n3:.01,n6:.05,trans:.02}],
  [/卵|たまご|目玉焼き|ゆで卵|スクランブル/i, {sat:.30,mufa:.42,n3:.03,n6:.19,trans:.01}],
  [/牛乳|ミルク/i,             {sat:.62,mufa:.28,n3:.01,n6:.02,trans:.03}],
  [/チーズ/i,                  {sat:.63,mufa:.27,n3:.01,n6:.02,trans:.03}],
  [/ヨーグルト/i,              {sat:.60,mufa:.30,n3:.01,n6:.03,trans:.02}],
  [/豆腐|納豆|豆乳|大豆/i,     {sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00}],
  [/くるみ/i,                  {sat:.08,mufa:.15,n3:.13,n6:.58,trans:.00}],
  [/アーモンド/i,              {sat:.08,mufa:.66,n3:.00,n6:.22,trans:.00}],
  [/ピーナッツ/i,              {sat:.17,mufa:.46,n3:.00,n6:.32,trans:.00}],
  [/ごま（炒り）/i,            {sat:.15,mufa:.38,n3:.00,n6:.42,trans:.00}],
  [/プロテイン/i,              {sat:.20,mufa:.28,n3:.04,n6:.16,trans:.01}],
  [/天ぷら|フライ|揚げ|コロッケ|たこ焼き/i, {sat:.20,mufa:.32,n3:.05,n6:.38,trans:.01}],
  [/バーガー|マクドナルド|KFC|ポテト/i,      {sat:.32,mufa:.38,n3:.03,n6:.22,trans:.02}],
  [/ピザ/i,                    {sat:.35,mufa:.35,n3:.02,n6:.20,trans:.02}],
  [/カレー/i,                  {sat:.30,mufa:.35,n3:.03,n6:.25,trans:.01}],
  [/ラーメン|パスタ|うどん|そば|焼きそば/i, {sat:.25,mufa:.30,n3:.04,n6:.30,trans:.01}],
];

// 食品名から fa/aa を推定して付与
function enrichFoodProfile(entry) {
  const name = entry.name || '';
  // fa 推定
  if (!entry.fa && (entry.f || 0) >= 0.5) {
    for (const [pat, prof] of FA_PAT_MAP) {
      if (pat.test(name)) { entry.fa = prof; break; }
    }
  }
  // aa 推定（タンパク質1g以上）
  if (!entry.aa && (entry.p || 0) >= 1.0) {
    let aaKey = 'mixed';
    for (const [pat, key] of AA_PAT_MAP) {
      if (pat.test(name)) { aaKey = key; break; }
    }
    entry.aa = AA_PROFILES_MAP[aaKey];
  }
  return entry;
}


// 各カテゴリの脂肪酸比率（脂質g全体に対する割合）
// sat=飽和, mufa=一価不飽和(ω9主体), pufa_n3=ω3, pufa_n6=ω6, pufa_n9=ω9(リノレイン酸以外の一価)
// 参考: 日本食品標準成分表2020 脂肪酸組成
const FATTY_ACID_PROFILES = [
  // ── 油脂類 ──
  { pat:/米油|こめあぶら/i,          label:'米油',         sat:.17, mufa:.42, n3:.01, n6:.35, n9:.04, trans:.01 },
  { pat:/オリーブ|olive/i,           label:'オリーブ油',   sat:.14, mufa:.74, n3:.01, n6:.10, n9:.00, trans:.00 },
  { pat:/ごま油|セサミ|sesame/i,     label:'ごま油',       sat:.15, mufa:.39, n3:.00, n6:.43, n9:.02, trans:.00 },
  { pat:/サラダ油|大豆油|キャノーラ|菜種/i, label:'サラダ油', sat:.15, mufa:.29, n3:.07, n6:.47, n9:.02, trans:.00 },
  { pat:/バター|butter/i,            label:'バター',       sat:.63, mufa:.27, n3:.01, n6:.03, n9:.01, trans:.04 },
  { pat:/マーガリン|margarine/i,     label:'マーガリン',   sat:.22, mufa:.44, n3:.06, n6:.24, n9:.00, trans:.04 },
  { pat:/ラード|豚脂/i,              label:'ラード',       sat:.39, mufa:.45, n3:.00, n6:.11, n9:.05, trans:.00 },
  { pat:/ヘット|牛脂/i,              label:'牛脂',         sat:.51, mufa:.43, n3:.01, n6:.03, n9:.01, trans:.01 },
  { pat:/ココナッツ|coconut/i,       label:'ココナッツ油', sat:.88, mufa:.06, n3:.00, n6:.02, n9:.04, trans:.00 },
  { pat:/えごま|亜麻|フラックス|linseed|flax/i, label:'えごま油', sat:.09, mufa:.19, n3:.57, n6:.14, n9:.01, trans:.00 },
  { pat:/くるみ|ウォールナッツ|walnut/i, label:'くるみ',  sat:.08, mufa:.15, n3:.13, n6:.58, n9:.06, trans:.00 },
  { pat:/アーモンド|almond/i,        label:'アーモンド',   sat:.08, mufa:.66, n3:.00, n6:.22, n9:.04, trans:.00 },
  // ── 魚類（EPA/DHA豊富 → ω3高） ──
  { pat:/さば|鯖|mackerel/i,         label:'さば',         sat:.25, mufa:.29, n3:.31, n6:.04, n9:.09, trans:.00 },
  { pat:/さんま|秋刀魚/i,            label:'さんま',       sat:.22, mufa:.42, n3:.22, n6:.03, n9:.09, trans:.00 },
  { pat:/いわし|鰯|sardine/i,        label:'いわし',       sat:.25, mufa:.27, n3:.31, n6:.05, n9:.10, trans:.00 },
  { pat:/まぐろ|マグロ|ツナ|tuna/i,  label:'まぐろ',       sat:.28, mufa:.18, n3:.38, n6:.05, n9:.08, trans:.00 },
  { pat:/鮭|さけ|サーモン|salmon/i,  label:'鮭',           sat:.22, mufa:.32, n3:.32, n6:.08, n9:.04, trans:.00 },
  { pat:/ぶり|鰤|yellowtail/i,       label:'ぶり',         sat:.24, mufa:.39, n3:.21, n6:.06, n9:.08, trans:.00 },
  { pat:/えび|海老|shrimp/i,         label:'えび',         sat:.30, mufa:.18, n3:.28, n6:.10, n9:.12, trans:.00 },
  { pat:/いか|烏賊|squid/i,          label:'いか',         sat:.31, mufa:.22, n3:.26, n6:.07, n9:.12, trans:.00 },
  // ── 肉類 ──
  { pat:/鶏もも|鶏モモ/i,            label:'鶏もも',       sat:.31, mufa:.44, n3:.03, n6:.18, n9:.03, trans:.01 },
  { pat:/鶏むね|鶏胸|ささみ|チキン|chicken/i, label:'鶏むね', sat:.28, mufa:.40, n3:.02, n6:.22, n9:.06, trans:.01 },
  { pat:/豚ロース|豚バラ|豚ひき|ポーク|pork/i, label:'豚肉', sat:.38, mufa:.46, n3:.01, n6:.12, n9:.02, trans:.01 },
  { pat:/牛ロース|牛バラ|牛ひき|ビーフ|beef/i, label:'牛肉', sat:.47, mufa:.43, n3:.01, n6:.05, n9:.02, trans:.02 },
  { pat:/ベーコン|ハム|ソーセージ|ウインナー/i, label:'加工肉', sat:.36, mufa:.44, n3:.01, n6:.12, n9:.03, trans:.02 },
  // ── 卵・乳製品 ──
  { pat:/卵|たまご|タマゴ|egg/i,      label:'卵',           sat:.30, mufa:.42, n3:.03, n6:.19, n9:.04, trans:.01 },
  { pat:/牛乳|ミルク|milk/i,          label:'牛乳',         sat:.62, mufa:.28, n3:.01, n6:.02, n9:.05, trans:.03 },
  { pat:/チーズ|cheese/i,             label:'チーズ',       sat:.63, mufa:.27, n3:.01, n6:.02, n9:.03, trans:.03 },
  { pat:/ヨーグルト|yogurt/i,         label:'ヨーグルト',   sat:.60, mufa:.30, n3:.01, n6:.03, n9:.04, trans:.02 },
  // ── 大豆・ナッツ ──
  { pat:/豆腐|とうふ|大豆|soy|tofu/i, label:'大豆製品',    sat:.14, mufa:.24, n3:.07, n6:.52, n9:.03, trans:.00 },
  { pat:/納豆/i,                       label:'納豆',         sat:.13, mufa:.22, n3:.07, n6:.54, n9:.04, trans:.00 },
  // ── デフォルト（分類不明） ──
];
// デフォルト（日本の食事平均的な脂肪酸比率）
const FA_DEFAULT = { sat:.30, mufa:.35, n3:.04, n6:.26, n9:.04, trans:.01 };

const FA_GOALS = {
  sat:  { label:'飽和脂肪酸',    short:'飽和',   color:'#e57373', ideal:'〜30%', goodFn: v => v <= 30 },
  mufa: { label:'一価不飽和(ω9)',short:'ω9/MUFA',color:'#81c784', ideal:'35〜45%', goodFn: v => v >= 30 && v <= 50 },
  n3:   { label:'多価不飽和 ω3', short:'ω3',     color:'#64b5f6', ideal:'5〜10%', goodFn: v => v >= 3 && v <= 15 },
  n6:   { label:'多価不飽和 ω6', short:'ω6',     color:'#ffb74d', ideal:'25〜40%', goodFn: v => v >= 15 && v <= 45 },
  trans:{ label:'トランス脂肪酸',short:'トランス',color:'#ef9a9a', ideal:'〜1%',  goodFn: v => v <= 1 },
};

function classifyFattyAcid(name) {
  for (const prof of FATTY_ACID_PROFILES) {
    if (prof.pat.test(name)) return prof;
  }
  return null;
}

function calcFattyAcids(list) {
  const totals = { sat:0, mufa:0, n3:0, n6:0, trans:0 };
  let totalFat = 0;

  list.forEach(e => {
    const fatG = e.f || 0;
    if (fatG < 0.5) return; // 脂質0.5g未満スキップ
    totalFat += fatG;

    // ① エントリに直接faフィールドがある場合（LOCAL_DB紐付き）優先
    let prof = e._fa || null;

    // ② パターンマッチ（手動入力・カスタム食品）
    if (!prof) {
      for (const p of FATTY_ACID_PROFILES) {
        if (p.pat.test(e.name)) { prof = p; break; }
      }
    }
    if (!prof) prof = FA_DEFAULT;

    totals.sat   += fatG * (prof.sat   || 0);
    totals.mufa  += fatG * (prof.mufa  || 0);
    totals.n3    += fatG * (prof.n3    || 0);
    totals.n6    += fatG * (prof.n6    || 0);
    totals.trans += fatG * (prof.trans || 0);
  });

  if (totalFat < 0.5) return null;

  const pct = {};
  Object.keys(totals).forEach(k => { pct[k] = r1(totals[k] / totalFat * 100); });
  const n3n6ratio = totals.n6 > 0 ? r1(totals.n3 / totals.n6) : 0;
  const abs = {};
  return { pct, abs, totalFat: r1(totalFat), n3n6ratio };
}

function renderFattyAcidPanel(list) {
  const el = document.getElementById('fattyAcidPanel');
  if (!el) return;

  // 脂質0.5g未満の食品をスキップ理由として記録
  const skipped = list.filter(e => (e.f || 0) < 0.5).map(e => e.name);
  const data = calcFattyAcids(list);

  if (!data || data.totalFat < 0.5) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text-sub);padding:4px 0">脂質の記録が少ないため推定できません（目安: 5g以上）</div>';
    return;
  }

  const { pct, abs, totalFat, n3n6ratio } = data;

  // DB紐付き件数 / パターンマッチ件数 / デフォルト件数をカウント
  let dbCount = 0, patCount = 0, defCount = 0;
  list.forEach(e => {
    if ((e.f || 0) < 0.5) return;
    if (e._fa) dbCount++;
    else {
      let matched = false;
      for (const p of FATTY_ACID_PROFILES) { if (p.pat.test(e.name)) { matched = true; break; } }
      if (matched) patCount++; else defCount++;
    }
  });

  const bars = ['sat','mufa','n3','n6','trans'].map(k => {
    const g    = FA_GOALS[k];
    const v    = pct[k];
    const good = g.goodFn(v);
    const barW = Math.min(v, 80);
    return `
      <div style="margin-bottom:7px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px">
          <span style="font-size:11px;font-weight:600">${g.label}</span>
          <span style="display:flex;align-items:baseline;gap:5px">
            <span style="font-size:13px;font-weight:700;color:${good ? 'var(--green)' : 'var(--amber)'}">${v}%</span>
            <span style="font-size:10px;color:var(--text-sub)">${abs[k]}g</span>
            <span style="font-size:9px;color:var(--text-sub)">目標${g.ideal}</span>
            <span style="font-size:11px">${good ? '✓' : '△'}</span>
          </span>
        </div>
        <div style="height:8px;border-radius:4px;background:var(--border);overflow:hidden">
          <div style="height:100%;border-radius:4px;width:${barW}%;background:${g.color};transition:width .5s cubic-bezier(.4,0,.2,1)"></div>
        </div>
      </div>`;
  }).join('');

  const ratioColor   = n3n6ratio >= 0.2 ? 'var(--green)' : n3n6ratio >= 0.1 ? 'var(--amber)' : 'var(--red)';
  const ratioComment = n3n6ratio >= 0.25
    ? '理想的なバランスです'
    : n3n6ratio >= 0.1
    ? 'ω3をもう少し増やすと◎（青魚・えごま油など）'
    : 'ω6過多です。ω3源（青魚・亜麻仁・くるみ）を意識して摂りましょう';

  // 精度インジケーター
  const total = dbCount + patCount + defCount || 1;
  const accuracy = Math.round((dbCount + patCount) / total * 100);
  const accColor = accuracy >= 80 ? 'var(--green)' : accuracy >= 50 ? 'var(--amber)' : 'var(--red)';

  el.innerHTML = `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:11px 12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:4px">
        <div style="font-size:10px;color:var(--text-sub)">脂質総量 ${totalFat}g を分析</div>
        <div style="display:flex;gap:4px;font-size:9px;flex-wrap:wrap">
          ${dbCount > 0 ? `<span style="background:var(--green-light);color:var(--green);border-radius:4px;padding:1px 5px;font-weight:600">DB紐付き ${dbCount}品</span>` : ''}
          ${patCount > 0 ? `<span style="background:var(--accent-light);color:var(--accent);border-radius:4px;padding:1px 5px;font-weight:600">パターン ${patCount}品</span>` : ''}
          ${defCount > 0 ? `<span style="background:var(--amber-light);color:#c67c00;border-radius:4px;padding:1px 5px;font-weight:600">推定平均 ${defCount}品</span>` : ''}
          <span style="background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:1px 5px;color:${accColor};font-weight:600">精度 ${accuracy}%</span>
        </div>
      </div>
      ${bars}
      <div style="margin-top:10px;padding:9px 11px;background:var(--surface);border-radius:8px;border:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:11px;font-weight:600">ω3 : ω6 比率</span>
          <span style="font-size:15px;font-weight:700;color:${ratioColor}">1 : ${n3n6ratio > 0 ? r1(1/n3n6ratio) : '∞'}</span>
        </div>
        <div style="font-size:11px;color:var(--text-sub)">${ratioComment}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px">理想比率: ω3:ω6 = 1:4〜1:5 程度</div>
      </div>
      ${skipped.length ? `<div style="font-size:10px;color:var(--text-muted);margin-top:6px">脂質0.5g未満のためスキップ: ${skipped.slice(0,5).join('、')}${skipped.length > 5 ? '…他' : ''}</div>` : ''}
      <div style="font-size:10px;color:var(--text-sub);margin-top:8px;line-height:1.6;padding-top:6px;border-top:1px solid var(--border)">
        ⚠ 食品名・DB紐付きからの推定値です。調理法・産地・ブランドにより実際の比率は異なります。
      </div>
    </div>`;
}



let metaCompMode = 'fat'; // fat / mixed / custom

function toggleMetaHelp() {
  const el = document.getElementById('metaHelp');
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function setMetaCompMode(mode, el) {
  metaCompMode = mode;
  document.querySelectorAll('.meta-comp-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  const customPanel = document.getElementById('metaCustomComp');
  if (customPanel) customPanel.style.display = mode === 'custom' ? 'block' : 'none';
  calcMetabolism();
}

function initMetaInputs() {
  // デフォルト: 直近30日
  const to   = new Date(currentDate + 'T00:00:00');
  const from = new Date(to); from.setDate(from.getDate() - 29);
  const toEl   = document.getElementById('metaTo');
  const fromEl = document.getElementById('metaFrom');
  if (toEl   && !toEl.value)   toEl.value   = toDateStr(to);
  if (fromEl && !fromEl.value) fromEl.value  = toDateStr(from);
  // 体重はプロフィールからプリセット
  const wFrom = document.getElementById('metaWFrom');
  const wTo   = document.getElementById('metaWTo');
  if (wFrom && !wFrom.value) wFrom.value = profile.weight || '';
  if (wTo   && !wTo.value)   wTo.value   = profile.weight || '';
}

function calcMetabolism() {
  const fromStr = document.getElementById('metaFrom')?.value;
  const toStr   = document.getElementById('metaTo')?.value;
  const wFrom   = parseFloat(document.getElementById('metaWFrom')?.value);
  const wTo     = parseFloat(document.getElementById('metaWTo')?.value);
  const result  = document.getElementById('metaResult');
  if (!result) return;

  if (!fromStr || !toStr || isNaN(wFrom) || isNaN(wTo)) {
    result.innerHTML = '<div style="font-size:12px;color:var(--text-sub);padding:8px 0">すべての項目を入力してください</div>';
    return;
  }
  if (fromStr >= toStr) {
    result.innerHTML = '<div style="font-size:12px;color:var(--red)">終了日は開始日より後にしてください</div>';
    return;
  }

  // 期間内の記録を集計
  const fromD = new Date(fromStr + 'T00:00:00');
  const toD   = new Date(toStr   + 'T00:00:00');
  const days  = Math.round((toD - fromD) / 86400000) + 1;

  // 記録のある日のみカウント（記録がない日は除外してTDEE計算を歪めない）
  const recordedDates = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(fromD); d.setDate(d.getDate() + i);
    const ds = toDateStr(d);
    if (entries.some(e => e.date === ds)) recordedDates.push(ds);
  }
  const recordedDays = recordedDates.length;

  if (recordedDays === 0) {
    result.innerHTML = '<div style="font-size:12px;color:var(--text-sub);padding:8px 0">この期間に食事記録がありません</div>';
    return;
  }

  const totalCal = recordedDates.reduce((sum, ds) => sum + sumEntries(getDayEntries(ds)).cal, 0);
  const avgCal   = totalCal / recordedDays;

  // 体重変化 → kcal換算
  const weightDelta = wTo - wFrom; // 増加なら正
  // 体組成モードで1kgあたりのkcalを決定
  let kcalPerKg;
  if (metaCompMode === 'fat') {
    kcalPerKg = 7200;
  } else if (metaCompMode === 'mixed') {
    kcalPerKg = (7200 + 4500) / 2; // 5850
  } else {
    const fatRatio = (parseInt(document.getElementById('metaFatRatio')?.value) || 100) / 100;
    kcalPerKg = 7200 * fatRatio + 4500 * (1 - fatRatio);
  }

  // 実績TDEE = (摂取合計 - 体重変化によるエネルギー変動) / 記録日数
  // 体重増加 → 余剰カロリーがあった → 実TDEEは低い
  const actualTDEE = (totalCal - weightDelta * kcalPerKg) / recordedDays;
  const settingTDEE = calcTDEE();
  const delta = actualTDEE - settingTDEE;
  const deltaAbs = Math.abs(Math.round(delta));

  // 代謝変動の方向
  const isUp   = delta > 50;
  const isDown = delta < -50;
  const isNeut = !isUp && !isDown;
  const deltaColor = isUp ? 'var(--green)' : isDown ? 'var(--red)' : 'var(--text-sub)';
  const deltaLabel = isUp ? '⬆ 代謝亢進' : isDown ? '⬇ 代謝低下' : '→ ほぼ変化なし';
  const deltaDesc  = isUp
    ? `計算値より約${deltaAbs}kcal/日多く消費しています。運動習慣・筋肉量増加・NEAT増加などが考えられます。`
    : isDown
    ? `計算値より約${deltaAbs}kcal/日少ない消費です。食事制限による代謝適応・活動量低下などが考えられます。`
    : `計算値とほぼ一致しています（誤差${deltaAbs}kcal以内）。`;

  // 信頼度（記録日数・期間に基づく）
  const confidence = recordedDays >= 21 ? '高' : recordedDays >= 10 ? '中' : '低';
  const confColor  = recordedDays >= 21 ? 'var(--green)' : recordedDays >= 10 ? 'var(--amber)' : 'var(--red)';

  result.innerHTML = `
    <!-- 主要結果 -->
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;margin-bottom:10px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
        <div style="text-align:center;padding:8px;background:var(--surface);border-radius:8px;border:1px solid var(--border)">
          <div style="font-size:10px;color:var(--text-sub)">実績TDEE（推定）</div>
          <div style="font-size:22px;font-weight:700;letter-spacing:-.5px">${Math.round(actualTDEE)}</div>
          <div style="font-size:10px;color:var(--text-sub)">kcal/日</div>
        </div>
        <div style="text-align:center;padding:8px;background:var(--surface);border-radius:8px;border:1px solid var(--border)">
          <div style="font-size:10px;color:var(--text-sub)">設定TDEE（計算値）</div>
          <div style="font-size:22px;font-weight:700;letter-spacing:-.5px">${settingTDEE}</div>
          <div style="font-size:10px;color:var(--text-sub)">kcal/日</div>
        </div>
      </div>
      <div style="text-align:center;padding:10px;background:var(--surface);border-radius:8px;border:1px solid var(--border)">
        <div style="font-size:12px;color:var(--text-sub);margin-bottom:4px">代謝変動</div>
        <div style="font-size:26px;font-weight:700;color:${deltaColor};letter-spacing:-.5px">
          ${isNeut ? '±0' : (isUp ? '+' : '−') + deltaAbs}
          <span style="font-size:13px;font-weight:400">kcal/日</span>
        </div>
        <div style="font-size:12px;font-weight:600;color:${deltaColor};margin-top:2px">${deltaLabel}</div>
      </div>
    </div>

    <!-- 詳細 -->
    <div style="font-size:11px;color:var(--text-sub);line-height:1.7;margin-bottom:10px;background:var(--surface2);border-radius:8px;padding:10px;border:1px solid var(--border)">
      ${deltaDesc}
    </div>

    <!-- 内訳 -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;font-size:11px;margin-bottom:8px">
      <div style="background:var(--surface2);border-radius:8px;padding:7px;text-align:center;border:1px solid var(--border)">
        <div style="color:var(--text-sub);font-size:9px">記録日数</div>
        <div style="font-weight:700;font-size:15px">${recordedDays}<span style="font-size:9px;font-weight:400">日</span></div>
        <div style="color:var(--text-sub);font-size:9px">/ ${days}日間</div>
      </div>
      <div style="background:var(--surface2);border-radius:8px;padding:7px;text-align:center;border:1px solid var(--border)">
        <div style="color:var(--text-sub);font-size:9px">平均摂取</div>
        <div style="font-weight:700;font-size:15px">${Math.round(avgCal)}<span style="font-size:9px;font-weight:400">kcal</span></div>
        <div style="color:var(--text-sub);font-size:9px">/ 日</div>
      </div>
      <div style="background:var(--surface2);border-radius:8px;padding:7px;text-align:center;border:1px solid var(--border)">
        <div style="color:var(--text-sub);font-size:9px">体重変化</div>
        <div style="font-weight:700;font-size:15px;color:${weightDelta < 0 ? 'var(--green)' : weightDelta > 0 ? 'var(--red)' : 'var(--text-sub)'}">${weightDelta >= 0 ? '+' : ''}${r1(weightDelta)}<span style="font-size:9px;font-weight:400">kg</span></div>
        <div style="color:var(--text-sub);font-size:9px">≈ ${Math.round(Math.abs(weightDelta)*kcalPerKg)}kcal</div>
      </div>
    </div>

    <!-- 信頼度 -->
    <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-sub)">
      <span>推定信頼度：</span>
      <span style="font-weight:700;color:${confColor}">${confidence}</span>
      <span>（${recordedDays}日分の記録）</span>
      ${recordedDays < 10 ? '<span style="color:var(--amber)">⚠ 10日以上の記録で精度が上がります</span>' : ''}
    </div>`;
}

function renderMetabolismSection() {
  initMetaInputs();
  calcMetabolism();
}


// 食品カテゴリ別パラメータ
const AMINO_PARAMS = {
  // 動物性（肉・魚・卵）: 速い吸収、高ロイシン
  animal:  { absRate: 9,  leucineRatio: 0.09, peakMin: 60,  halfLife: 110 },
  // 乳製品（チーズ・ヨーグルト・牛乳）: 中速、中ロイシン
  dairy:   { absRate: 6,  leucineRatio: 0.10, peakMin: 90,  halfLife: 150 },
  // 大豆・豆類: やや遅い
  soy:     { absRate: 5,  leucineRatio: 0.08, peakMin: 90,  halfLife: 130 },
  // その他植物性: 遅い、低ロイシン
  plant:   { absRate: 4,  leucineRatio: 0.06, peakMin: 120, halfLife: 140 },
  // プロテインパウダー（ホエイ相当）
  whey:    { absRate: 10, leucineRatio: 0.11, peakMin: 45,  halfLife: 90  },
};

const ANIMAL_PAT  = /鶏|豚|牛|羊|ささみ|チキン|ポーク|ビーフ|ラム|ひき肉|合いびき|ベーコン|ハム|ソーセージ|ウインナー|いわし|さば|さんま|あじ|さけ|鮭|サーモン|まぐろ|マグロ|ツナ|えび|いか|ほたて|あさり|カニ|ぶり|たい|鯛|たら|焼き鳥|唐揚げ|から揚げ|ハンバーグ|卵|たまご|タマゴ|ゆで卵|目玉焼き|スクランブル|チキン|プロテイン.*動物|animal|chicken|pork|beef|fish|salmon|tuna|egg/i;
const DAIRY_PAT   = /牛乳|ミルク|チーズ|ヨーグルト|ホエイ|カゼイン|プロテイン(?!.*大豆)|milk|cheese|yogurt|whey|casein/i;
const SOY_PAT     = /大豆|豆腐|納豆|豆乳|枝豆|おから|テンペ|soy|tofu|natto/i;
const WHEY_PAT    = /ホエイ|ウェイ|WPC|WPI|whey/i;

function classifyProteinSource(name) {
  if (WHEY_PAT.test(name))  return 'whey';
  if (DAIRY_PAT.test(name)) return 'dairy';
  if (ANIMAL_PAT.test(name)) return 'animal';
  if (SOY_PAT.test(name))   return 'soy';
  return 'plant';
}

// 食事1回分のアミノ酸時系列を生成（minutesOffset=食事時刻の0時からの分数）
// 返値: 分→相対濃度 のMap（0〜1440分）
function calcAminoTimeSeries(entries, minutesOffset) {
  // 食品ごとに分類してタンパク質量と吸収パラメータを集計
  const groups = { animal:0, dairy:0, soy:0, plant:0, whey:0 };
  entries.forEach(e => {
    const src = classifyProteinSource(e.name);
    groups[src] += (e.p || 0);
  });

  const RESOLUTION = 5; // 5分刻み
  const totalMinutes = 1440;
  const curve = new Array(Math.ceil(totalMinutes / RESOLUTION)).fill(0);

  Object.entries(groups).forEach(([src, protein]) => {
    if (protein <= 0) return;
    const p = AMINO_PARAMS[src];
    // 吸収時間 = protein / absRate (時間) → 分
    const absorptionDuration = (protein / p.absRate) * 60;
    // ピーク時刻（食事時刻 + peakMin）
    const peakMinOffset = minutesOffset + p.peakMin;
    // ピーク濃度 = protein * leucineRatio（ロイシン量g）をそのまま使う
    const peakLeucine = protein * p.leucineRatio;

    // 上昇フェーズ: 食事時刻 → ピーク
    // 減衰フェーズ: ピーク → halfLifeに従って指数減衰
    for (let i = 0; i < curve.length; i++) {
      const t = i * RESOLUTION; // 現在の分
      const dt = t - minutesOffset; // 食事後経過分
      if (dt < 0) continue;

      let conc = 0;
      if (dt <= p.peakMin) {
        // 上昇: 線形
        conc = peakLeucine * (dt / p.peakMin);
      } else {
        // 減衰: 指数
        const decayT = dt - p.peakMin;
        conc = peakLeucine * Math.exp(-Math.log(2) * decayT / p.halfLife);
      }
      curve[i] += conc;
    }
  });

  return curve;
}

// 食事時刻の保存キー
function aminoTimeKey(date) { return 'aminoTimes_' + date; }
function loadAminoTimes(date) {
  try { return JSON.parse(localStorage.getItem(aminoTimeKey(date)) || '{}'); } catch { return {}; }
}
function saveAminoTimes(date, times) {
  try { localStorage.setItem(aminoTimeKey(date), JSON.stringify(times)); } catch {}
}

let aminoChartInstance = null;

function toggleAminoHelp() {
  const el = document.getElementById('aminoHelp');
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function renderAminoInputs() {
  const cont = document.getElementById('aminoTimeInputs');
  if (!cont) return;
  const times = loadAminoTimes(currentDate);
  const meals = ['朝食','昼食','夕食','間食'];
  cont.innerHTML = meals.map(meal => {
    const mealEntries = getDayEntries(currentDate).filter(e => e.meal === meal);
    if (!mealEntries.length) return '';
    const totalP = r1(mealEntries.reduce((a,e) => a + (e.p||0), 0));
    const leucineApprox = r1(mealEntries.reduce((a,e) => {
      const src = classifyProteinSource(e.name);
      return a + (e.p||0) * AMINO_PARAMS[src].leucineRatio;
    }, 0));
    return `<div style="display:flex;align-items:center;gap:8px;background:var(--surface2);border:1px solid var(--border);border-radius:9px;padding:8px 11px">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600">${meal}</div>
        <div style="font-size:10px;color:var(--text-sub)">P ${totalP}g　ロイシン約 ${leucineApprox}g</div>
      </div>
      <input type="time" value="${times[meal]||''}" onchange="onAminoTimeChange('${meal}',this.value)"
        style="font-size:13px;padding:5px 8px;border:1.5px solid var(--border);border-radius:7px;background:var(--surface);color:var(--text);width:100px">
    </div>`;
  }).filter(Boolean).join('');
  if (!cont.innerHTML) cont.innerHTML = '<div style="font-size:12px;color:var(--text-sub);padding:6px 0">今日の食事記録がありません</div>';
}

function onAminoTimeChange(meal, value) {
  const times = loadAminoTimes(currentDate);
  if (value) times[meal] = value; else delete times[meal];
  saveAminoTimes(currentDate, times);
  renderAminoChart();
}

function renderAminoChart() {
  const canvas = document.getElementById('aminoChart');
  const summary = document.getElementById('aminoSummary');
  if (!canvas) return;

  const times = loadAminoTimes(currentDate);
  const RESOLUTION = 5;
  const points = Math.ceil(1440 / RESOLUTION);
  const combined = new Array(points).fill(0);

  const MPS_THRESHOLD = 2.5; // ロイシン2.5g以上でMPS促進

  let hasData = false;
  Object.entries(times).forEach(([meal, timeStr]) => {
    if (!timeStr) return;
    const [h, m] = timeStr.split(':').map(Number);
    const minutesOffset = h * 60 + m;
    const mealEntries = getDayEntries(currentDate).filter(e => e.meal === meal);
    if (!mealEntries.length) return;
    hasData = true;
    const curve = calcAminoTimeSeries(mealEntries, minutesOffset);
    curve.forEach((v, i) => { combined[i] += v; });
  });

  // ラベル（1時間刻み表示）
  const labels = Array.from({length: points}, (_, i) => {
    const totalMin = i * RESOLUTION;
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    return m === 0 ? `${h}:00` : '';
  });

  // MPS閾値ライン、バックグラウンドレベル（ベースライン = 0.3g相当）
  const baseline = 0.3;
  const data = combined.map(v => r1(Math.max(v + baseline, baseline)));

  // Chart描画
  if (aminoChartInstance) { aminoChartInstance.destroy(); aminoChartInstance = null; }
  const ctx = canvas.getContext('2d');
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#3266ad';

  // グラデーション
  const grad = ctx.createLinearGradient(0, 0, 0, 180);
  grad.addColorStop(0, 'rgba(50,102,173,.35)');
  grad.addColorStop(1, 'rgba(50,102,173,.02)');

  aminoChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '血中アミノ酸（ロイシン換算g）',
          data,
          borderColor: '#3266ad',
          backgroundColor: grad,
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        {
          label: `MPS促進閾値 (${MPS_THRESHOLD}g)`,
          data: new Array(points).fill(MPS_THRESHOLD),
          borderColor: '#e91e63',
          borderWidth: 1.5,
          borderDash: [5, 4],
          pointRadius: 0,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 600 },
      plugins: {
        legend: { display: true, labels: { font: { size: 10 }, boxWidth: 14, padding: 8 } },
        tooltip: {
          callbacks: {
            title: items => {
              const idx = items[0].dataIndex;
              const totalMin = idx * RESOLUTION;
              const h = Math.floor(totalMin / 60) % 24;
              const m = String(totalMin % 60).padStart(2,'0');
              return `${h}:${m}`;
            },
            label: item => item.datasetIndex === 0
              ? `ロイシン換算: ${item.raw}g`
              : `閾値: ${item.raw}g`,
          },
        },
      },
      scales: {
        x: {
          ticks: { font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12, color: '#6b7280' },
          grid: { color: 'rgba(0,0,0,.05)' },
        },
        y: {
          min: 0,
          ticks: { font: { size: 9 }, color: '#6b7280', callback: v => v + 'g' },
          grid: { color: 'rgba(0,0,0,.05)' },
          title: { display: true, text: 'ロイシン換算 (g)', font: { size: 9 }, color: '#6b7280' },
        },
      },
    },
  });

  // サマリー計算
  if (!summary) return;
  if (!hasData) {
    summary.innerHTML = '<div style="font-size:12px;color:var(--text-sub);grid-column:span 2;padding:4px 0">食事時刻を入力するとサマリーが表示されます</div>';
    return;
  }
  const peak = Math.max(...data);
  // MPS閾値を超えている時間（分）
  const mpsMinutes = data.filter(v => v >= MPS_THRESHOLD).length * RESOLUTION;
  // 今この瞬間の濃度
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowIdx = Math.floor(nowMin / RESOLUTION);
  const nowVal = data[Math.min(nowIdx, data.length-1)] || 0;
  // 総ロイシン（各食事の推定量）
  const totalLeucine = r1(getDayEntries(currentDate).reduce((a,e) => {
    const src = classifyProteinSource(e.name);
    return a + (e.p||0) * AMINO_PARAMS[src].leucineRatio;
  }, 0));

  const card = (label, val, unit, sub, color='var(--accent)') => `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:9px;padding:9px 11px">
      <div style="font-size:10px;color:var(--text-sub);margin-bottom:2px">${label}</div>
      <div style="font-size:18px;font-weight:700;color:${color}">${val}<span style="font-size:11px;font-weight:400;color:var(--text-sub);margin-left:2px">${unit}</span></div>
      <div style="font-size:10px;color:var(--text-sub);margin-top:2px">${sub}</div>
    </div>`;

  summary.innerHTML =
    card('ピーク濃度', r1(peak), 'g', 'ロイシン換算') +
    card('現在の推定値', r1(nowVal), 'g', now.getHours()+':'+String(now.getMinutes()).padStart(2,'0')+'時点', nowVal >= MPS_THRESHOLD ? 'var(--green)' : 'var(--text-sub)') +
    card('MPS促進時間', mpsMinutes, '分', `閾値${MPS_THRESHOLD}g以上の時間`, mpsMinutes > 0 ? 'var(--green)' : 'var(--text-sub)') +
    card('1日ロイシン合計', totalLeucine, 'g', '推定値（食品別係数による）');
}

function renderAminoSection() {
  renderAminoInputs();
  renderAminoChart();
}


// ── 耐容上限量（UL）超過チェック ──
// 期間平均ではなく「その期間内に1日でも上限を超えた日があったか」を見る。
// 平均で見ると、例えば1日だけ大量に摂取した日があっても他の日で薄まってしまい
// 見逃してしまうため、ULは日ごとの安全域の指標として日単位でチェックする。
function checkUlExceedances(period) {
  const today = new Date(); today.setHours(0,0,0,0);
  const days = period==='today' ? [toDateStr(new Date())]
    : Array.from({length:period==='7d'?7:period==='30d'?30:90}, (_,i) => { const d=new Date(today); d.setDate(d.getDate()-i); return toDateStr(d); });

  const results = [];
  Object.keys(MICRO_GOALS).forEach(key => {
    const g = MICRO_GOALS[key];
    if (!g.ul) return; // ULが設定されていない栄養素（ビタミンK等）はチェック対象外
    const overDays = [];
    days.forEach(d => {
      const list = getDayEntries(d);
      if (!list.length) return;
      const val = sumEntries(list)[key] || 0;
      if (val > g.ul) overDays.push({ date: d, val: r1(val) });
    });
    if (overDays.length) {
      results.push({ key, label: g.label, unit: g.unit, ul: g.ul, overDays, maxVal: Math.max(...overDays.map(o=>o.val)) });
    }
  });
  return results;
}
function renderUlWarning() {
  const el = document.getElementById('ulWarning');
  if (!el) return;
  const issues = checkUlExceedances(statsPeriod);
  if (!issues.length) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="card" style="padding:11px 13px;margin-bottom:12px;border:1.5px solid #f0ad4e55;background:linear-gradient(135deg,#fff8ec,#fffdf9)">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;font-weight:700;font-size:13px;color:#a06a1a">
        ⚠️ 耐容上限量を超えた日があります
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${issues.map(i => `
          <div style="font-size:12px;line-height:1.6;color:#4b3a1a">
            <b>${i.label}</b>: ${i.overDays.length}日間で上限（${i.ul}${i.unit}）を超過（最大 ${i.maxVal}${i.unit}）
            <div style="font-size:10px;color:#6b5638">${i.overDays.map(o=>o.date.slice(5)).join('、')}</div>
          </div>`).join('')}
      </div>
      <div style="font-size:10px;color:#6b5638;margin-top:8px;border-top:1px solid #f0ad4e33;padding-top:6px">
        耐容上限量は日本人の食事摂取基準(2020年版)の成人目安値です。サプリメントの重複摂取や、海藻類（ヨウ素）の多量摂取などが主な原因になりやすい項目です。
      </div>
    </div>`;
}
function getAvg(period) {
  const today=new Date(); today.setHours(0,0,0,0);
  const days=period==='today'?[toDateStr(new Date())]:Array.from({length:period==='7d'?7:period==='30d'?30:90},(_,i)=>{const d=new Date(today);d.setDate(d.getDate()-i);return toDateStr(d)});
  const wd=days.filter(d=>getDayEntries(d).length>0); if(!wd.length) return null;
  const tot=wd.map(d=>sumEntries(getDayEntries(d))); const n=wd.length;
  const avg={days:n};
  ['cal','p','f','c','fiber','iron','calcium','vitc','vitd','vita','vite','vitk','iodine','salt'].forEach(k=>{avg[k]=r1(tot.reduce((a,t)=>a+(t[k]||0),0)/n)});
  return avg;
}
function goalBar(label, actual, target, unit, color, reverse=false) {
  const pct=Math.min(actual/target*100,100), over=actual>target;
  const col=reverse?(over?'#c0392b':color):(over?'#c0392b':color);
  return `<div class="goal-bar-wrap"><div class="goal-bar-label"><span>${label}</span><span style="font-weight:500;color:${over&&!reverse?'#c0392b':'var(--text)'}">${actual}${unit}<span style="font-weight:400;color:var(--text-sub)"> / ${target}${unit}</span></span></div><div class="goal-bar-track"><div class="goal-bar-fill" style="width:${pct}%;background:${col}"></div></div><div style="font-size:10px;text-align:right;margin-top:2px;color:${over&&!reverse?'#c0392b':'var(--text-sub)'}"> ${over?`+${r1(actual-target)}${unit} オーバー`:`あと ${r1(target-actual)}${unit}`}</div></div>`;
}
function setPeriod(period, el) {
  statsPeriod = period;
  document.querySelectorAll('.period-tab').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  renderStats();
}
function renderStats() {
  renderUlWarning();
  const g=goals(), avg=getAvg(statsPeriod), s=avg||{cal:0,p:0,f:0,c:0,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,vita:0,vite:0,vitk:0,iodine:0,salt:0};
  // 統計期間の吸収タンパク質（平均）
  const statsDays = (() => {
    const now = new Date(); const days = statsPeriod==='today'?1:statsPeriod==='7d'?7:statsPeriod==='30d'?30:90;
    const dates = Array.from({length:days},(_,i)=>{const d=new Date(now);d.setDate(d.getDate()-i);return toDateStr(d);});
    return dates;
  })();
  const statsAbsP = statsDays.length > 0
    ? r1(statsDays.reduce((sum,date) => {
        const dayList = entries.filter(e=>e.date===date);
        return sum + calcAbsorbedProtein(dayList);
      }, 0) / (avg?.days || 1))
    : 0;
  const lbl=statsPeriod==='today'?'今日':statsPeriod==='7d'?`週平均(${avg?avg.days:'0'}日)`:statsPeriod==='30d'?`月平均(${avg?avg.days:'0'}日)`:`3ヶ月平均(${avg?avg.days:'0'}日)`;
  const score=avg?Math.round(Math.min(s.cal/g.cal,1)*25+Math.min(statsAbsP/g.p,1)*35+Math.min(s.f/g.f,1)*20+Math.min(s.c/g.c,1)*20):0;
  document.getElementById('goalBars').innerHTML = avg ? `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <span style="font-size:11px;color:var(--text-sub)">${lbl}</span>
      <span style="font-size:26px;font-weight:600;color:${score>=80?'#2e7d32':score>=60?'#e8a838':'#c0392b'}">${score}<span style="font-size:12px;color:var(--text-sub)">/100</span></span>
    </div>
    <div style="margin-bottom:10px;font-size:11px;color:var(--text-sub)">体重 <input type="number" value="${userWeight}" min="30" max="200" step="0.5" oninput="userWeight=parseFloat(this.value)||65;localStorage.setItem('pfcWeight',userWeight);renderStats()" style="width:50px;font-size:12px;padding:2px 5px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text)"> kg → タンパク質目標 ${g.p}g</div>
    <div style="font-size:11px;font-weight:600;color:var(--text-sub);margin-bottom:8px">PFC・カロリー</div>
    ${goalBar('カロリー',ri(s.cal),g.cal,'kcal','#3266ad')}${goalBar('タンパク質（摂取）',r1(s.p),g.p,'g','#3266ad')}${goalBar('タンパク質（吸収補正）',statsAbsP,g.p,'g','#3266ad')}${goalBar('脂質',r1(s.f),g.f,'g','#e8a838')}${goalBar('炭水化物',r1(s.c),g.c,'g','#4caf50')}
    <div style="font-size:11px;font-weight:600;color:var(--text-sub);margin:12px 0 8px">ビタミン・ミネラル・食物繊維</div>
    ${goalBar('食物繊維',r1(s.fiber),21,'g','#8bc34a')}${goalBar('鉄',r1(s.iron),7,'mg','#e91e63')}${goalBar('カルシウム',ri(s.calcium),700,'mg','#03a9f4')}${goalBar('ビタミンC',ri(s.vitc),100,'mg','#ff9800')}${goalBar('ビタミンD',r1(s.vitd),8.5,'μg','#ffd600')}${goalBar('ビタミンA',ri(s.vita),850,'μg','#ff7043')}${goalBar('ビタミンE',r1(s.vite),6.5,'mg','#ab47bc')}${goalBar('ビタミンK',ri(s.vitk),150,'μg','#26a69a')}${goalBar('ヨウ素',ri(s.iodine),130,'μg','#5c6bc0')}${goalBar('塩分',r1(s.salt),7.5,'g','#9e9e9e',true)}
  ` : `<div style="text-align:center;padding:2rem;color:var(--text-sub);font-size:13px">この期間の記録がありません</div>`;
  renderCharts();
  renderVitDStock();
}
// ── ビタミンD ストック（体内蓄積）推定 ──
// 血中の主要な貯蔵型である25(OH)Dの半減期（文献上おおよそ3週間/21日）に基づく
// 単一コンパートメントの指数減衰モデル。
//   Stock(day) = Stock(day-1) × 減衰率 + その日の摂取量
// 減衰率は半減期21日から算出（e^(-ln2/21) ≈ 0.9675、1日あたり約3.25%減少）。
//
// 重要な限界（UIにも明記する）:
//   ・日照による皮膚合成を一切考慮していない（ビタミンDの主要な供給源は
//     食事より日光であることが多く、屋外活動が多い人はここでの推定より
//     実際の体内量は多いはずである）
//   ・絶対的な血中濃度ではなく、記録開始日を「目安量を続けていた場合の
//     定常状態」とみなした相対的な蓄積トレンドである（採血の代替にはならない）
const VITD_HALFLIFE_DAYS = 21;
const VITD_DECAY = Math.pow(0.5, 1 / VITD_HALFLIFE_DAYS);
function calcVitDStockSeries() {
  const allDates = [...new Set(entries.map(e => e.date))].sort();
  if (!allDates.length) return [];
  const startDate = allDates[0];
  const endDate = toDateStr(new Date());
  // 開始日の前提在庫: 目安量(8.5μg/日)を継続摂取した場合の定常状態を初期値とする
  const rdaSteady = MICRO_GOALS.vitd.goal / (1 - VITD_DECAY);

  let stock = rdaSteady;
  const series = [];
  const d = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  while (d <= end) {
    const ds = toDateStr(d);
    const intake = sumEntries(getDayEntries(ds)).vitd || 0;
    stock = stock * VITD_DECAY + intake;
    series.push({ date: ds, stock: r1(stock) });
    d.setDate(d.getDate() + 1);
  }
  return series;
}
function renderVitDStock() {
  const wrap = document.getElementById('vitdStockWrap');
  if (!wrap) return;
  const series = calcVitDStockSeries();
  if (series.length < 2) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';

  const rdaSteady = MICRO_GOALS.vitd.goal / (1 - VITD_DECAY);
  const latest = series[series.length - 1].stock;
  const pct = Math.round(latest / rdaSteady * 100);

  document.getElementById('vitdStockSummary').innerHTML =
    `現在の推定ストック: <b style="font-size:15px">${latest}</b> <span style="color:var(--text-sub)">(目安量継続時を100%とすると ${pct}%)</span>`;

  // 表示範囲は直近90日まで（それより前は折りたたむ）
  const shown = series.slice(-90);
  const labels = shown.map(s => { const dt = new Date(s.date + 'T00:00:00'); return `${dt.getMonth()+1}/${dt.getDate()}`; });
  const skip = shown.length > 30 ? Math.ceil(shown.length / 12) : 1;

  if (vitdStockChart) vitdStockChart.destroy();
  vitdStockChart = new Chart(document.getElementById('vitdStockChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'ストック推定', data: shown.map(s => s.stock), borderColor: '#ffd600', backgroundColor: 'rgba(255,214,0,.12)', tension: .3, pointRadius: 0, borderWidth: 2, fill: true },
        { label: '定常状態(目安量継続時)', data: shown.map(() => r1(rdaSteady)), borderColor: 'rgba(128,128,128,.4)', borderDash: [4,3], borderWidth: 1, pointRadius: 0, fill: false },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 8, padding: 8 } } },
      scales: {
        y: { beginAtZero: true, ticks: { font: { size: 10 } }, grid: { color: 'rgba(128,128,128,.1)' } },
        x: { ticks: { font: { size: 10 }, callback: (_, i) => i % skip === 0 ? labels[i] : '' } },
      },
    },
  });
}
function getLast(n) { return Array.from({length:n},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(n-1-i));return toDateStr(d)}); }
function renderCharts() {
  const n=statsPeriod==='90d'?90:statsPeriod==='30d'?30:7;
  const days=getLast(n);
  const labels=days.map(d=>{const dt=new Date(d+'T00:00:00');return`${dt.getMonth()+1}/${dt.getDate()}`});
  const skip=n>30?Math.ceil(n/12):1;
  const g=goals();
  const baseOpts={responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{font:{size:10}},grid:{color:'rgba(128,128,128,.1)'}},x:{ticks:{font:{size:10},callback:(_,i)=>i%skip===0?labels[i]:''}}}};
  if(calChart) calChart.destroy();
  calChart=new Chart(document.getElementById('calChart'),{type:'bar',data:{labels,datasets:[{label:'摂取',data:days.map(d=>ri(sumEntries(getDayEntries(d)).cal)),backgroundColor:'#3266ad',borderRadius:2},{type:'line',label:'目標',data:days.map(()=>g.cal),borderColor:'#c0392b',borderDash:[4,3],borderWidth:1.5,pointRadius:0,fill:false}]},options:{...baseOpts,plugins:{legend:{display:false}}}});
  if(pfcChart) pfcChart.destroy();
  pfcChart=new Chart(document.getElementById('pfcChart'),{type:'line',data:{labels,datasets:[
    {label:'P',data:days.map(d=>r1(sumEntries(getDayEntries(d)).p)),borderColor:'#3266ad',backgroundColor:'transparent',tension:.3,pointRadius:0,borderWidth:2},
    {label:'F',data:days.map(d=>r1(sumEntries(getDayEntries(d)).f)),borderColor:'#e8a838',backgroundColor:'transparent',tension:.3,pointRadius:0,borderWidth:2,borderDash:[5,3]},
    {label:'C',data:days.map(d=>r1(sumEntries(getDayEntries(d)).c)),borderColor:'#4caf50',backgroundColor:'transparent',tension:.3,pointRadius:0,borderWidth:2,borderDash:[2,2]},
    {label:'P目標',data:days.map(()=>g.p),borderColor:'rgba(50,102,173,.3)',borderDash:[3,3],borderWidth:1,pointRadius:0,fill:false},
  ]},options:{...baseOpts,plugins:{legend:{position:'bottom',labels:{font:{size:10},boxWidth:8,padding:8}}}}});
  renderAminoSection();
  renderMetabolismSection();
}

// ── CSV ──
const CSV_HEADERS = ['date','meal','name','amount','cal','p','f','c','fiber','iron','calcium','vitc','vitd','salt'];
function exportCSV() {
  const from=document.getElementById('csvFrom').value, to=document.getElementById('csvTo').value;
  let data=[...entries];
  if(from) data=data.filter(e=>e.date>=from);
  if(to) data=data.filter(e=>e.date<=to);
  data=data.sort((a,b)=>a.date.localeCompare(b.date)||MEALS_ORDER.indexOf(a.meal)-MEALS_ORDER.indexOf(b.meal));
  const rows=[CSV_HEADERS.join(','),...data.map(e=>[e.date,e.meal,`"${(e.name||'').replace(/"/g,'""')}"`,e.amount||0,r1(e.cal||0),r1(e.p||0),r1(e.f||0),r1(e.c||0),r1(e.fiber||0),r1(e.iron||0),ri(e.calcium||0),ri(e.vitc||0),r1(e.vitd||0),r2(e.salt||0)].join(','))];
  const blob=new Blob(['\uFEFF'+rows.join('\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`pfc_export_${toDateStr(new Date())}.csv`; a.click(); URL.revokeObjectURL(url);
}
function importCSV() {
  const text=document.getElementById('csvImportArea').value.trim();
  const msg=document.getElementById('csvImportMsg');
  if(!text){msg.className='status-msg status-err';msg.textContent='CSVデータを入力してください';return}
  const lines=text.split('\n').map(l=>l.trim()).filter(Boolean);
  const header=lines[0].toLowerCase().split(',').map(h=>h.trim().replace(/^"|"$/g,''));
  const idxOf=k=>header.indexOf(k);
  let count=0, skip=0;
  for(let i=1;i<lines.length;i++){
    try{
      const cols=parseCsvLine(lines[i]);
      const date=(cols[idxOf('date')]||'').trim().replace(/^"|"$/g,'');
      const meal=(cols[idxOf('meal')]||'').trim().replace(/^"|"$/g,'');
      const name=(cols[idxOf('name')]||'').trim().replace(/^"|"$/g,'');
      if(!date||!name||!MEALS_ORDER.includes(meal)){skip++;continue}
      const entry={id:Date.now()+i+Math.random(),date,meal,name,
        amount:parseFloat(cols[idxOf('amount')])||100, cal:parseFloat(cols[idxOf('cal')])||0, p:parseFloat(cols[idxOf('p')])||0,
        f:parseFloat(cols[idxOf('f')])||0, c:parseFloat(cols[idxOf('c')])||0,
        fiber:parseFloat(cols[idxOf('fiber')])||0, iron:parseFloat(cols[idxOf('iron')])||0,
        calcium:parseFloat(cols[idxOf('calcium')])||0, vitc:parseFloat(cols[idxOf('vitc')])||0,
        vitd:parseFloat(cols[idxOf('vitd')])||0, salt:parseFloat(cols[idxOf('salt')])||0};
      const dup=entries.some(e=>e.date===entry.date&&e.meal===entry.meal&&e.name===entry.name&&e.amount===entry.amount);
      if(!dup){entries.push(entry);count++}else skip++;
    }catch(err){skip++}
  }
  save();
  if(count>0){msg.className='status-msg status-ok';msg.textContent=`${count}件をインポートしました（スキップ: ${skip}件）`}
  else{msg.className='status-msg status-err';msg.textContent=`インポートできませんでした（スキップ: ${skip}件）`}
  renderRecord(); renderCalendar();
}
function parseCsvLine(line) {
  const result=[]; let cur='', inQ=false;
  for(let i=0;i<line.length;i++){
    if(line[i]==='"'){if(inQ&&line[i+1]==='"'){cur+='"';i++}else inQ=!inQ}
    else if(line[i]===','&&!inQ){result.push(cur);cur=''}
    else cur+=line[i];
  }
  result.push(cur); return result;
}

// ── Custom foods ──
function setCustomMode(mode) {
  document.getElementById('csSinglePanel').style.display=mode==='single'?'block':'none';
  document.getElementById('csComboPanel').style.display=mode==='combo'?'block':'none';
  document.getElementById('csTabSingle').className='btn'+(mode==='single'?' btn-primary':'');
  document.getElementById('csTabCombo').className='btn'+(mode==='combo'?' btn-success':'');
  if(mode==='single') renderCustomFoodList(); else renderComboFoodList();
}
function saveCustomFood() {
  const name=document.getElementById('csFoodName').value.trim(); const msg=document.getElementById('csSaveMsg');
  if(!name){msg.className='status-msg status-err';msg.textContent='食品名を入力してください';return}
  customFoods.push({id:Date.now(),name,cal:gv('csCal'),p:gv('csP'),f:gv('csF'),c:gv('csC'),per:gv('csPer')||100,
    fiber:gv('csFib'),iron:gv('csFe'),calcium:gv('csCa'),vitc:gv('csVc'),vitd:gv('csVd'),salt:gv('csSalt')});
  saveCustom(); msg.className='status-msg status-ok'; msg.textContent=`「${name}」を登録しました`;
  ['csFoodName','csCal','csP','csF','csC','csFib','csFe','csCa','csVc','csVd','csSalt'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('csPer').value='100'; renderCustomFoodList(); setTimeout(()=>{msg.textContent=''},2500);
}
function deleteCustomFood(id){
  const idx = customFoods.findIndex(f=>f.id===id);
  if (idx === -1) return;
  const removed = customFoods[idx];
  customFoods.splice(idx,1);
  if (editingCustomFoodId === id) editingCustomFoodId = null;
  saveCustom();renderCustomFoodList();
  showUndoToast(`「${removed.name}」をDBから削除しました`, () => {
    customFoods.splice(Math.min(idx, customFoods.length), 0, removed);
    saveCustom(); renderCustomFoodList();
  });
}
let editingCustomFoodId = null;
function startEditCustomFood(id) {
  editingCustomFoodId = id;
  renderCustomFoodList();
}
function cancelEditCustomFood() {
  editingCustomFoodId = null;
  renderCustomFoodList();
}
function saveEditCustomFood(id) {
  const idx = customFoods.findIndex(f => f.id === id);
  if (idx === -1) return;
  const gvSuf = (suf) => { const el = document.getElementById('ecf'+suf+id); return el ? (parseFloat(el.value) || 0) : 0; };
  const nameEl = document.getElementById('ecfName'+id);
  const name = nameEl ? nameEl.value.trim() : '';
  const msg = document.getElementById('csSaveMsg');
  if (!name) {
    if (msg) { msg.className = 'status-msg status-err'; msg.textContent = '食品名を入力してください'; }
    return;
  }
  if (customFoods.some((f,i) => i !== idx && normFoodName(f.name) === normFoodName(name))) {
    if (msg) { msg.className = 'status-msg status-err'; msg.textContent = `「${name}」は既に別のカスタム食品で使われています`; }
    return;
  }
  customFoods[idx] = {
    ...customFoods[idx],
    name,
    per:     gvSuf('Per') || 100,
    cal:     gvSuf('Cal'), p: gvSuf('P'), f: gvSuf('F'), c: gvSuf('C'),
    fiber:   gvSuf('Fib'), iron: gvSuf('Fe'), calcium: gvSuf('Ca'),
    vitc:    gvSuf('Vc'),  vitd: gvSuf('Vd'), salt: gvSuf('Salt'),
  };
  saveCustom();
  editingCustomFoodId = null;
  renderCustomFoodList();
  showToast(`「${name}」を更新しました`);
}
function renderCustomFoodList() {
  const cont=document.getElementById('customFoodList');
  if(!customFoods.length){cont.innerHTML=`<div style="font-size:12px;color:var(--text-sub);padding:8px 0">まだ登録がありません</div>`;return}
  cont.innerHTML=customFoods.map(f=>{
    if (editingCustomFoodId === f.id) {
      return `<div class="custom-item" style="flex-direction:column;align-items:stretch;gap:6px;padding:10px">
        <div class="row" style="margin-bottom:0"><div class="field" style="flex:3"><label>食品名</label><input type="text" id="ecfName${f.id}" value="${f.name}"></div><div class="field" style="flex:1"><label>基準量(g)</label><input type="number" id="ecfPer${f.id}" value="${f.per}"></div></div>
        <div class="row" style="margin-bottom:0"><div class="field"><label>kcal</label><input type="number" id="ecfCal${f.id}" value="${f.cal}" step="0.1"></div><div class="field"><label>P</label><input type="number" id="ecfP${f.id}" value="${f.p}" step="0.1"></div><div class="field"><label>F</label><input type="number" id="ecfF${f.id}" value="${f.f}" step="0.1"></div><div class="field"><label>C</label><input type="number" id="ecfC${f.id}" value="${f.c}" step="0.1"></div></div>
        <div class="row" style="margin-bottom:0"><div class="field"><label>食物繊維</label><input type="number" id="ecfFib${f.id}" value="${f.fiber||0}" step="0.1"></div><div class="field"><label>鉄(mg)</label><input type="number" id="ecfFe${f.id}" value="${f.iron||0}" step="0.1"></div><div class="field"><label>Ca(mg)</label><input type="number" id="ecfCa${f.id}" value="${f.calcium||0}" step="0.1"></div></div>
        <div class="row" style="margin-bottom:0"><div class="field"><label>VitC</label><input type="number" id="ecfVc${f.id}" value="${f.vitc||0}" step="0.1"></div><div class="field"><label>VitD</label><input type="number" id="ecfVd${f.id}" value="${f.vitd||0}" step="0.1"></div><div class="field"><label>塩分</label><input type="number" id="ecfSalt${f.id}" value="${f.salt||0}" step="0.01"></div></div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-primary btn-sm" style="flex:1" onclick="saveEditCustomFood(${f.id})">保存</button>
          <button class="btn btn-sm" style="flex:1" onclick="cancelEditCustomFood()">取消</button>
        </div>
      </div>`;
    }
    return `<div class="custom-item"><div><div style="font-weight:500">${f.name}</div><div style="font-size:10px;color:var(--text-sub)">${f.per}gあたり ${f.cal}kcal P${f.p} F${f.f} C${f.c}${f.fiber?' 繊'+f.fiber:''}</div></div><div style="display:flex;gap:4px"><button class="btn btn-sm" onclick="startEditCustomFood(${f.id})">✏️</button><button class="btn btn-sm btn-danger" onclick="deleteCustomFood(${f.id})">✕</button></div></div>`;
  }).join('');
}

// ── Combo foods ──
function onComboSearch(q) {
  clearTimeout(comboTimer); const box=document.getElementById('comboResultsBox');
  if(!q.trim()){box.style.display='none';return}
  const local=localSearch(q); renderComboResults(local,[],true); showSp('comboSpinner','comboSearchIcon',true);
  comboTimer=setTimeout(async()=>{const api=await apiSearch(q);showSp('comboSpinner','comboSearchIcon',false);if(api!==null)renderComboResults(local,api,false)},600);
}
function renderComboResults(local, api, loading) {
  const box=document.getElementById('comboResultsBox'); let html='';
  if(local.length){html+=`<div class="rs-label">内蔵・カスタムDB</div>`;html+=local.map((f,i)=>`<div class="ri" onclick="addComboIngredient(${i},'local')"><div><div class="ri-name">${f.name}<span class="badge badge-${f._src||'local'}">${SRC_LABEL[f._src||'local']}</span></div><div class="ri-sub">${f.per}gあたり P${f.p} F${f.f} C${f.c}</div></div><div class="ri-cal">${f.cal}kcal</div></div>`).join('')}
  if(loading){html+=`<div class="rs-label">Open Food Facts 検索中…</div><div class="no-result"><div class="spinner" style="display:inline-block"></div></div>`}
  else if(api&&api.length){html+=`<div class="rs-label">Open Food Facts</div>`;html+=api.map((f,i)=>`<div class="ri" onclick="addComboIngredient(${i},'api')"><div><div class="ri-name">${f.name.length>26?f.name.slice(0,26)+'…':f.name}<span class="badge badge-api">外部</span></div><div class="ri-sub">100gあたり P${f.p} F${f.f} C${f.c}</div></div><div class="ri-cal">${f.cal}kcal</div></div>`).join('')}
  else if(!loading&&!local.length){html+=`<div class="no-result">見つかりませんでした</div>`}
  box.innerHTML=html; box._local=local; box._api=api; box.style.display='block';
}
function addComboIngredient(i, src) {
  const box=document.getElementById('comboResultsBox'); const f=src==='local'?box._local[i]:box._api[i]; if(!f) return;
  const r=100/(f.per||100);
  comboIngredients.push({...f,amount:100,_cal:r1(f.cal*r),_p:r1(f.p*r),_f:r1(f.f*r),_c:r1(f.c*r),
    _fiber:r1((f.fiber||0)*r),_iron:r1((f.iron||0)*r),_calcium:r1((f.calcium||0)*r),
    _vitc:r1((f.vitc||0)*r),_vitd:r1((f.vitd||0)*r),_salt:r2((f.salt||0)*r)});
  box.style.display='none'; document.getElementById('comboSearch').value=''; showSp('comboSpinner','comboSearchIcon',false); renderComboIngredients();
}
function updateComboAmt(i, val) {
  const f=comboIngredients[i], amt=parseFloat(val)||100, r=amt/(f.per||100);
  comboIngredients[i]={...f,amount:amt,_cal:r1(f.cal*r),_p:r1(f.p*r),_f:r1(f.f*r),_c:r1(f.c*r),
    _fiber:r1((f.fiber||0)*r),_iron:r1((f.iron||0)*r),_calcium:r1((f.calcium||0)*r),
    _vitc:r1((f.vitc||0)*r),_vitd:r1((f.vitd||0)*r),_salt:r2((f.salt||0)*r)};
  renderComboIngredients();
}
function removeComboIngredient(i){comboIngredients.splice(i,1);renderComboIngredients()}
function renderComboIngredients() {
  const cont=document.getElementById('comboIngredients');
  if(!comboIngredients.length){cont.innerHTML=`<div style="font-size:12px;color:var(--text-sub);padding:4px 0">食材を検索して追加してください</div>`;document.getElementById('comboTotal').textContent='';return}
  cont.innerHTML=comboIngredients.map((f,i)=>`<div class="combo-ingredient"><span style="font-weight:500;flex:1">${f.name}</span><input type="number" value="${f.amount}" min="1" style="width:50px;font-size:12px;padding:2px 5px;border:1px solid var(--border);border-radius:7px;background:var(--surface);color:var(--text);margin:0 6px" oninput="updateComboAmt(${i},this.value)"><span style="font-size:10px;color:var(--text-sub);margin-right:5px">g</span><button class="btn btn-sm btn-danger" onclick="removeComboIngredient(${i})">✕</button></div>`).join('');
  const tot=comboIngredients.reduce((a,f)=>({cal:a.cal+f._cal,p:a.p+f._p,f:a.f+f._f,c:a.c+f._c,fiber:a.fiber+f._fiber,iron:a.iron+f._iron,calcium:a.calcium+f._calcium}),{cal:0,p:0,f:0,c:0,fiber:0,iron:0,calcium:0});
  document.getElementById('comboTotal').textContent=`合計 ${ri(tot.cal)}kcal P${r1(tot.p)} F${r1(tot.f)} C${r1(tot.c)} 繊${r1(tot.fiber)}g`;
}
function editComboFood(id) {
  const f = comboFoods.find(f => f.id === id);
  if (!f) return;
  // 編集対象をフォームに展開
  document.getElementById('comboName').value = f.name;
  // 食材リストを復元
  comboIngredients = (f.ingredients || []).map(ing => {
    const r = 100 / (ing.per || 100);
    return {
      ...ing,
      per: ing.per || 100,
      amount: ing.amount,
      _cal:     r1((ing.cal     || 0) * r),
      _p:       r1((ing.p       || 0) * r),
      _f:       r1((ing.f       || 0) * r),
      _c:       r1((ing.c       || 0) * r),
      _fiber:   r1((ing.fiber   || 0) * r),
      _iron:    r1((ing.iron    || 0) * r),
      _calcium: r1((ing.calcium || 0) * r),
      _vitc:    r1((ing.vitc    || 0) * r),
      _vitd:    r1((ing.vitd    || 0) * r),
      _salt:    r2((ing.salt    || 0) * r),
    };
  });
  renderComboIngredients();
  // 保存ボタンを「更新」モードにする
  const btn = document.getElementById('comboSaveBtn');
  const msg = document.getElementById('comboSaveMsg');
  btn.textContent = '更新';
  btn.dataset.editId = id;
  msg.textContent = `「${f.name}」を編集中`;
  msg.className = 'status-msg status-ok';
  // フォームまでスクロール
  document.getElementById('csComboPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function saveComboFood() {
  const name = document.getElementById('comboName').value.trim();
  const msg  = document.getElementById('comboSaveMsg');
  const btn  = document.getElementById('comboSaveBtn');
  if (!name) { msg.className='status-msg status-err'; msg.textContent='複合食品名を入力してください'; return }
  if (!comboIngredients.length) { msg.className='status-msg status-err'; msg.textContent='食材を追加してください'; return }

  const tot = comboIngredients.reduce((a,f) => ({
    cal: a.cal+f._cal, p: a.p+f._p, f: a.f+f._f, c: a.c+f._c,
    fiber: a.fiber+f._fiber, iron: a.iron+f._iron, calcium: a.calcium+f._calcium,
    vitc: a.vitc+(f._vitc||0), vitd: a.vitd+(f._vitd||0), salt: a.salt+(f._salt||0),
  }), {cal:0,p:0,f:0,c:0,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0});
  const totalAmt = comboIngredients.reduce((a,f) => a + f.amount, 0);
  const sc = v => r1(v / totalAmt * 100);

  const editId = btn.dataset.editId ? Number(btn.dataset.editId) : null;

  const foodData = {
    id: editId || Date.now(),
    name, per: 100,
    cal: sc(tot.cal), p: sc(tot.p), f: sc(tot.f), c: sc(tot.c),
    fiber: sc(tot.fiber), iron: sc(tot.iron), calcium: sc(tot.calcium),
    vitc: sc(tot.vitc), vitd: sc(tot.vitd), salt: r2(tot.salt / totalAmt * 100),
    ingredients: comboIngredients.map(f => ({
      name: f.name, amount: f.amount,
      per: f.per || 100, cal: f.cal, p: f.p, f: f.f, c: f.c,
      fiber: f.fiber||0, iron: f.iron||0, calcium: f.calcium||0,
      vitc: f.vitc||0, vitd: f.vitd||0, salt: f.salt||0,
    })),
    _src: 'combo',
  };

  if (editId) {
    comboFoods = comboFoods.map(f => f.id === editId ? foodData : f);
    msg.textContent = `「${name}」を更新しました`;
  } else {
    comboFoods.push(foodData);
    msg.textContent = `「${name}」を登録しました`;
  }

  // フォームリセット
  btn.textContent = '登録';
  delete btn.dataset.editId;
  comboIngredients = [];
  document.getElementById('comboName').value = '';
  renderComboIngredients();
  saveCustom();
  msg.className = 'status-msg status-ok';
  renderComboFoodList();
  setTimeout(() => { msg.textContent = ''; }, 2500);
}

function renderComboFoodList() {
  const cont = document.getElementById('comboFoodList');
  if (!comboFoods.length) {
    cont.innerHTML = `<div style="font-size:12px;color:var(--text-sub);padding:8px 0">まだ登録がありません</div>`;
    return;
  }
  cont.innerHTML = comboFoods.map(f =>
    `<div class="custom-item">
      <div style="flex:1;min-width:0">
        <div style="font-weight:500">${f.name}</div>
        <div style="font-size:10px;color:var(--text-sub)">100gあたり ${f.cal}kcal P${f.p} F${f.f} C${f.c}${f.fiber?' 繊'+f.fiber:''}</div>
        <div style="font-size:10px;color:var(--text-sub)">${(f.ingredients||[]).map(i=>`${i.name}(${i.amount}g)`).join('、')}</div>
      </div>
      <button class="btn btn-sm" onclick="editComboFood(${f.id})"
        style="background:#e8f0fe;color:#3266ad;border:none;margin-right:4px;padding:3px 8px">編集</button>
      <button class="btn btn-sm btn-danger" onclick="deleteComboFood(${f.id})">✕</button>
    </div>`
  ).join('');
}

// ── Google Health API ──
// REST API (health.googleapis.com/v4/) + OAuth 2.0
// スコープ: activity_and_fitness, health_metrics_and_measurements, sleep
// 取得: 歩数・消費カロリー・安静時心拍数・体重

async function connectGoogleHealth() {
  try {
    const res = await fetch('/.netlify/functions/google-health-auth-start');
    if (!res.ok) throw new Error('auth start failed');
    const { authUrl } = await res.json();
    window.location.href = authUrl;
  } catch(e) {
    alert('Google Health連携の開始に失敗しました。\nNetlifyの環境変数（GOOGLE_HEALTH_CLIENT_ID）を確認してください。');
  }
}

(function checkGoogleHealthCallback() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('gh_token');
  const err   = params.get('gh_error');
  if (err) {
    console.warn('Google Health auth error:', err);
    history.replaceState({}, '', window.location.pathname);
    return;
  }
  if (token) {
    ghToken = token;
    localStorage.setItem('ghToken', token);
    history.replaceState({}, '', window.location.pathname);
    renderGhStatus();
    syncGoogleHealth();
  }
})();

async function syncGoogleHealth() {
  if (!ghToken) return;
  try {
    const res = await fetch(
      `/.netlify/functions/google-health-daily?date=${currentDate}&token=${encodeURIComponent(ghToken)}`
    );
    if (!res.ok) throw new Error('sync failed');
    const data = await res.json();
    if (data.updatedToken && data.updatedToken !== ghToken) {
      ghToken = data.updatedToken;
      localStorage.setItem('ghToken', ghToken);
    }
    ghData[currentDate] = data;
    saveGhData();
    document.getElementById('garminSyncBtn').style.display = 'flex';
    renderRecord();
  } catch(e) { console.warn('Google Health sync:', e); }
}

function renderGhStatus() {
  const btn    = document.getElementById('garminConnectBtn');
  const status = document.getElementById('garminStatus');
  if (ghToken) {
    btn.textContent = '再接続';
    const lastDate = Object.keys(ghData).sort().pop();
    const d = lastDate ? ghData[lastDate] : null;
    status.innerHTML =
      `<span style="color:var(--green);font-weight:600">✓ 接続済み</span>` +
      (d ? `<br><span style="font-size:11px;margin-top:4px;display:block">
        最終同期: ${lastDate}　歩数: ${(d.steps||0).toLocaleString()}歩　
        消費: ${d.activeCalories||0} kcal
        ${d.restingHeartRate ? `　心拍: ${d.restingHeartRate} bpm` : ''}
        ${d.weight ? `　体重: ${d.weight} kg` : ''}
      </span>` : '');
    document.getElementById('garminSyncBtn').style.display = 'flex';
  } else {
    btn.textContent = '連携する';
    status.textContent = '未接続';
  }
}

// ── Firebase 初期化・認証・同期 ──
// Firebase設定は index.html の <script> で window.FIREBASE_CONFIG として注入
async function initFirebase() {
  try {
    const cfg = window.FIREBASE_CONFIG;
    if (!cfg || !cfg.apiKey) { markInitialSyncDone(); return; } // 未設定時はローカルのみ

    const { initializeApp }    = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
                                = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    const { getFirestore }     = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    const app = initializeApp(cfg);
    fbAuth = getAuth(app);
    fbDb   = getFirestore(app);

    // 認証状態の監視
    onAuthStateChanged(fbAuth, async user => {
      fbUser = user;
      renderAuthUI();
      if (user) {
        await pullFromCloud(); // ログイン時にクラウドからデータを取得
        renderRecord();
        renderCalendar();
      }
      markInitialSyncDone(); // ここでゲート解除（未ログインなら即解除、ログイン時はpull完了後に解除）
    });

    // Googleログインボタン
    window._fbSignIn = async () => {
      try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(fbAuth, provider);
      } catch(e) {
        console.error('Sign in failed:', e);
        if (e.code === 'auth/unauthorized-domain') {
          alert(
            'ログインエラー: このドメインがFirebaseに承認されていません。\n\n' +
            '【解決方法】\n' +
            'Firebase Console > Authentication > Settings >\n' +
            '「承認済みドメイン」に以下を追加してください：\n\n' +
            window.location.hostname
          );
        } else if (e.code === 'auth/popup-blocked') {
          alert('ポップアップがブロックされました。ブラウザのポップアップ許可設定を確認してください。');
        } else {
          alert('ログインに失敗しました: ' + (e.message || e.code));
        }
      }
    };

    // ログアウトボタン
    window._fbSignOut = async () => {
      await signOut(fbAuth);
      renderAuthUI();
    };

  } catch(e) {
    console.warn('Firebase init failed:', e);
    markInitialSyncDone();
  }
}

// Firestoreからデータを取得してローカルにマージ
async function pullFromCloud() {
  if (!fbDb || !fbUser || fbSyncing) return;
  fbSyncing = true;
  try {
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const snap = await getDoc(doc(fbDb, 'users', fbUser.uid));
    if (snap.exists()) {
      const data = snap.data();
      // クラウドデータで上書き（最新が優先）
      if (data.entries)     { entries     = data.entries;     saveLocal(); }
      if (data.exercises)   { exercises   = data.exercises;   saveLocal(); }
      if (data.customFoods) { customFoods = data.customFoods; saveLocal(); }
      if (data.comboFoods)  { comboFoods  = data.comboFoods;  saveLocal(); }
      if (data.profile)     { profile = { ...profile, ...data.profile }; localStorage.setItem('pfcProfile', JSON.stringify(profile)); }
    } else {
      // 初回ログイン：ローカルデータをクラウドにアップロード
      await saveToCloud();
    }
  } catch(e) {
    console.warn('Cloud pull failed:', e);
  } finally {
    fbSyncing = false;
  }
}

// 認証UIを描画（ヘッダーのユーザー情報 & ログインボタン）
function renderAuthUI() {
  const el = document.getElementById('authArea');
  if (!el) return;
  if (fbUser) {
    const photo = fbUser.photoURL
      ? `<img src="${fbUser.photoURL}" style="width:28px;height:28px;border-radius:50%;border:2px solid rgba(255,255,255,.5)" alt="">`
      : `<span style="font-size:18px">👤</span>`;
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px">
        ${photo}
        <div>
          <div style="font-size:11px;font-weight:600;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${fbUser.displayName||fbUser.email}</div>
          <div style="font-size:9px;opacity:.7">クラウド同期中</div>
        </div>
        <button onclick="_fbSignOut()" style="background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:6px;padding:4px 8px;font-size:10px;cursor:pointer">ログアウト</button>
      </div>`;
  } else if (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey) {
    el.innerHTML = `
      <button onclick="_fbSignIn()" style="display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.9);border:none;color:#333;border-radius:8px;padding:6px 10px;font-size:11px;cursor:pointer;font-weight:500">
        <svg width="14" height="14" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Googleでログイン
      </button>`;
  } else {
    el.innerHTML = `<span style="font-size:10px;opacity:.6">ローカル保存モード</span>`;
  }
}

// ── Tab switch ──
function switchTab(t) {
  ['record','stats','custom','csv','profile','garmin','ai'].forEach(id => {
    document.getElementById('panel-'+id).classList.toggle('active', id===t);
    document.getElementById('nav-'+id).classList.toggle('active', id===t);
  });
  if (t==='record') { renderRecord(); renderCalendar(); }
  if (t==='stats') renderStats();
  if (t==='custom') setCustomMode('single');
  if (t==='csv') {
    const today=toDateStr(new Date()), month=today.slice(0,7)+'-01';
    document.getElementById('csvFrom').value=month;
    document.getElementById('csvTo').value=today;
  }
  if (t==='profile') { initProfile(); initGoalUI(); }
  if (t==='garmin')  renderGhStatus();
  if (t==='ai') initAiChat();
}

// ── AI Chat ──
let aiHistory = [];
let aiInitDone = false;

// ── AI バックアップ（最大10世代） ──
const AI_BACKUP_MAX = 10;
let aiBackups = []; // [{label, entries, timestamp}, ...]

function takeAiBackup(label) {
  aiBackups.push({
    label,
    entries: JSON.parse(JSON.stringify(entries)),
    customFoods: JSON.parse(JSON.stringify(customFoods)),
    timestamp: new Date().toISOString(),
  });
  if (aiBackups.length > AI_BACKUP_MAX) aiBackups.shift();
  renderAiBackupList();
}

function restoreAiBackup(idx) {
  const bk = aiBackups[idx];
  if (!bk) return;
  entries = JSON.parse(JSON.stringify(bk.entries));
  if (bk.customFoods) customFoods = JSON.parse(JSON.stringify(bk.customFoods));
  save(); saveCustom(); renderRecord(); renderCalendar();
  if (typeof renderCustomFoodList === 'function') renderCustomFoodList();
  appendAiMessage('ai', `♻️ バックアップを復元しました\n「${bk.label}」（${fmtBackupTime(bk.timestamp)}）`);
  renderAiBackupList();
}

function deleteAiBackup(idx) {
  aiBackups.splice(idx, 1);
  renderAiBackupList();
}

function fmtBackupTime(iso) {
  const d = new Date(iso);
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function renderAiBackupList() {
  const cont = document.getElementById('aiBackupList');
  if (!cont) return;
  if (!aiBackups.length) {
    cont.innerHTML = '<div style="font-size:11px;color:var(--text-sub);padding:6px 0">バックアップはまだありません</div>';
    return;
  }
  cont.innerHTML = [...aiBackups].reverse().map((bk, ri) => {
    const idx = aiBackups.length - 1 - ri;
    return `<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid var(--border)">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${bk.label}</div>
        <div style="font-size:10px;color:var(--text-sub)">${fmtBackupTime(bk.timestamp)}　${bk.entries.length}件</div>
      </div>
      <button onclick="restoreAiBackup(${idx})" style="background:#e8f0fe;color:#3266ad;border:none;border-radius:7px;padding:4px 9px;font-size:11px;cursor:pointer;white-space:nowrap">復元</button>
      <button onclick="deleteAiBackup(${idx})" style="background:none;border:none;color:var(--text-sub);font-size:14px;cursor:pointer;padding:2px 4px">✕</button>
    </div>`;
  }).join('');
}

function handleAiKey(e) {
  if (e.key !== 'Enter') return;
  // スマホ（ソフトキーボード）判定: pointerの細かさ or maxTouchPoints
  const isMobile = navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches;
  if (isMobile) {
    // スマホ: Enterは常に改行（送信はボタンのみ）
    return;
  }
  // PC: Shift+Enterで改行、Enterで送信
  if (!e.shiftKey) {
    e.preventDefault();
    sendAiMessage();
  }
}

function resetAiChat() {
  aiHistory = [];
  const box = document.getElementById('aiChatBox');
  if (box) box.innerHTML = '';
  appendAiMessage('ai', '会話をリセットしました。新たな質問や操作をどうぞ。');
}
function initAiChat() {
  if (aiInitDone) return;
  aiInitDone = true;
  renderAiBackupList();
  appendAiMessage('ai',
    'こんにちは！食事記録のアシスタントです🍽️\n\n' +
    '【できること】\n' +
    '・「朝食に卵とご飯を食べた」→ 自動で栄養計算＆登録\n' +
    '・「今週の昼食を全部サラダチキンで登録して」→ 複数日まとめて操作\n' +
    '・「昨日の夕食を削除して」→ 記録の削除\n' +
    '・「今週の記録を教えて」→ 記録の読み取り＆集計\n\n' +
    '操作前に自動でバックアップを保存します。\n' +
    '誤操作した場合は下のバックアップ一覧から復元できます。\n\n' +
    '⚠️ 栄養データはAI推定値です。目安としてご利用ください。'
  );
}

function appendAiMessage(role, text) {
  const box = document.getElementById('aiChatBox');
  if (!box) return;
  const isAi = role === 'ai';
  const div = document.createElement('div');
  div.style.cssText = `
    max-width: 88%;
    align-self: ${isAi ? 'flex-start' : 'flex-end'};
    background: ${isAi ? 'var(--surface)' : 'var(--accent)'};
    color: ${isAi ? 'var(--text)' : '#fff'};
    border-radius: ${isAi ? '4px 14px 14px 14px' : '14px 4px 14px 14px'};
    padding: 9px 12px;
    font-size: 13px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
    border: ${isAi ? '1px solid var(--border)' : 'none'};
  `;
  div.textContent = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  return div;
}

function appendAiThinking() {
  const box = document.getElementById('aiChatBox');
  if (!box) return null;
  const div = document.createElement('div');
  div.style.cssText = `
    align-self: flex-start;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px 14px 14px 14px;
    padding: 9px 14px;
    font-size: 18px;
    letter-spacing: 4px;
  `;
  div.textContent = '●○○';
  let frame = 0;
  div._timer = setInterval(() => {
    const dots = ['●○○','●●○','●●●','○●●','○○●','○○○'];
    div.textContent = dots[frame++ % dots.length];
  }, 300);
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  return div;
}

// 日付ユーティリティ
function getWeekDates(baseDate) {
  // baseDate の週（月〜日）の日付リストを返す
  const d = new Date(baseDate + 'T00:00:00');
  const day = d.getDay(); // 0=日
  const monday = new Date(d); monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({length: 7}, (_, i) => {
    const dd = new Date(monday); dd.setDate(monday.getDate() + i); return toDateStr(dd);
  });
}
function getLastNDates(n, base) {
  const ref = new Date((base || currentDate) + 'T00:00:00');
  return Array.from({length: n}, (_, i) => {
    const d = new Date(ref); d.setDate(ref.getDate() - (n - 1 - i)); return toDateStr(d);
  });
}
function dateLabel(ds) {
  const d = new Date(ds + 'T00:00:00');
  const dow = ['日','月','火','水','木','金','土'][d.getDay()];
  return `${d.getMonth()+1}/${d.getDate()}(${dow})`;
}

// 全記録のサマリーをAIに渡す文字列を生成
function buildFullContext() {
  const lines = [];
  const TODAY = currentDate;
  const RECENT_DAYS = 14; // 詳細表示する直近日数

  // ── プロフィール ──
  const sexLabel = profile.sex === 'male' ? '男性' : '女性';
  const actLabel = ({1.2:'座位中心',1.375:'軽い運動',1.55:'中程度',1.725:'激しい運動',1.9:'非常に激しい'})[String(profile.activityFactor)] || String(profile.activityFactor);
  const todayDetail = getDetailedActivity(TODAY);
  const actDesc = todayDetail
    ? `詳細モード(NEAT:${(NEAT_TIERS[profile.neatTier]||NEAT_TIERS.mid).label}, 本日${(todayDetail.steps||0)}歩/活動${todayDetail.activeCal}kcal, ${todayDetail.source==='google_health'?'Google Health実測':'歩数手入力'})`
    : `活動係数:${actLabel}（ざっくり設定）`;
  lines.push('【プロフィール】');
  lines.push(`性別:${sexLabel} 年齢:${profile.age} 身長:${profile.height}cm 体重:${profile.weight}kg 活動:${actDesc}`);

  // ── 目標値 ──
  const g = goals();
  lines.push(`【目標】cal:${g.cal} P:${g.p} F:${g.f} C:${g.c}`);

  // ── カスタム食品DB（名前のみ・トークン節約） ──
  if (customFoods.length) {
    lines.push('【カスタム食品】' + customFoods.map(f => f.name).join('、'));
  }

  // ── 食事記録 ──
  // 直近14日：食品レベルの詳細（id付き）
  // それ以前：日次サマリーのみ
  const recentCutoff = (() => {
    const d = new Date(TODAY + 'T00:00:00');
    d.setDate(d.getDate() - RECENT_DAYS + 1);
    return toDateStr(d);
  })();

  const grouped = {};
  entries.forEach(e => {
    if (!grouped[e.date]) grouped[e.date] = {};
    if (!grouped[e.date][e.meal]) grouped[e.date][e.meal] = [];
    grouped[e.date][e.meal].push(e);
  });

  const allDates = Object.keys(grouped).sort();
  const recentDates = allDates.filter(d => d >= recentCutoff);
  const oldDates    = allDates.filter(d => d <  recentCutoff);

  if (recentDates.length) {
    lines.push(`【食事記録 直近${RECENT_DAYS}日（詳細）】`);
    recentDates.forEach(date => {
      const dayEntries = entries.filter(e => e.date === date);
      const s = sumEntries(dayEntries);
      lines.push(`${dateLabel(date)} [${Math.round(s.cal)}kcal P${r1(s.p)} F${r1(s.f)} C${r1(s.c)}]`);
      Object.entries(grouped[date]).forEach(([meal, foods]) => {
        lines.push(`  ${meal}: ${foods.map(e => `${e.name}(${e.amount}g,${Math.round(e.cal)}kcal,id:${e.id})`).join('、')}`);
      });
    });
  }

  if (oldDates.length) {
    lines.push('【食事記録 過去分（日次サマリー）】');
    oldDates.forEach(date => {
      const dayEntries = entries.filter(e => e.date === date);
      const s = sumEntries(dayEntries);
      lines.push(`${date} ${Math.round(s.cal)}kcal P${r1(s.p)} F${r1(s.f)} C${r1(s.c)}`);
    });
  }

  if (!entries.length) lines.push('【食事記録】なし');

  // ── 運動記録 ──
  if (exercises.length) {
    const recentEx = exercises.filter(e => e.date >= recentCutoff);
    const oldEx    = exercises.filter(e => e.date <  recentCutoff);
    if (recentEx.length) {
      lines.push('【運動記録 直近】');
      const exGrouped = {};
      recentEx.forEach(e => { (exGrouped[e.date] = exGrouped[e.date]||[]).push(e); });
      Object.entries(exGrouped).sort().forEach(([d, exs]) => {
        lines.push(`${dateLabel(d)}: ${exs.map(e=>`${e.name}(${e.minutes||'?'}分,消費${Math.round(e.cal)}kcal,id:${e.id})`).join('、')}`);
      });
    }
    if (oldEx.length) {
      const totalOldCal = Math.round(oldEx.reduce((a,e)=>a+(e.cal||0),0));
      lines.push(`【運動記録 過去分】${oldEx.length}件 合計消費${totalOldCal}kcal`);
    }
  }

  return lines.join('\n');
}

// コマンド実行エンジン
function executeAiCommands(commands, backupLabel) {
  // 変更前にバックアップを保存
  takeAiBackup(backupLabel || 'AI操作');
  const log = [];
  let changed = false;

  commands.forEach(cmd => {
    // ── ADD ──
    if (cmd.type === 'add') {
      const dates = cmd.dates || [cmd.date || currentDate];
      const meal  = ['朝食','昼食','夕食','間食'].includes(cmd.meal) ? cmd.meal : '間食';
      dates.forEach(date => {
        (cmd.items || [cmd]).forEach(item => {
          if (!item.name) return;
          const aiEntry = {
            id: Date.now() + Math.random(),
            date, meal,
            time:    item.time || nowTimeStr(),
            name:    item.name,
            amount:  parseFloat(item.amount)  || 100,
            cal:     parseFloat(item.cal)     || 0,
            p:       parseFloat(item.p)       || 0,
            f:       parseFloat(item.f)       || 0,
            c:       parseFloat(item.c)       || 0,
            fiber:   parseFloat(item.fiber)   || 0,
            iron:    parseFloat(item.iron)    || 0,
            calcium: parseFloat(item.calcium) || 0,
            vitc:    parseFloat(item.vitc)    || 0,
            vitd:    parseFloat(item.vitd)    || 0,
            vita:    parseFloat(item.vita)    || 0,
            vite:    parseFloat(item.vite)    || 0,
            vitk:    parseFloat(item.vitk)    || 0,
            iodine:  parseFloat(item.iodine)  || 0,
            salt:    parseFloat(item.salt)    || 0,
          };
          enrichFoodProfile(aiEntry);
          addOrMergeEntry(aiEntry);
        });
        log.push(`✅ ${dateLabel(date)} ${meal}に登録`);
      });
      changed = true;
    }

    // ── DELETE_BY_ID ──
    else if (cmd.type === 'delete_by_id') {
      const ids = Array.isArray(cmd.ids) ? cmd.ids : [cmd.id];
      const before = entries.length;
      entries = entries.filter(e => !ids.includes(e.id));
      log.push(`🗑️ ${before - entries.length}件削除`);
      changed = true;
    }

    // ── DELETE_BY_DATE_MEAL ──
    else if (cmd.type === 'delete_by_date_meal') {
      const dates = cmd.dates || [cmd.date];
      const meal  = cmd.meal || null;
      const before = entries.length;
      entries = entries.filter(e => {
        if (!dates.includes(e.date)) return true;
        if (meal && e.meal !== meal) return true;
        return false;
      });
      log.push(`🗑️ ${before - entries.length}件削除（${dates.map(dateLabel).join('、')} ${meal||'全食事'}）`);
      changed = true;
    }

    // ── REPLACE ──（指定日時のmealを全削除→新規追加）
    else if (cmd.type === 'replace') {
      const dates = cmd.dates || [cmd.date || currentDate];
      const meal  = ['朝食','昼食','夕食','間食'].includes(cmd.meal) ? cmd.meal : '間食';
      dates.forEach(date => {
        const before = entries.length;
        entries = entries.filter(e => !(e.date === date && e.meal === meal));
        const removed = before - entries.length;
        (cmd.items || []).forEach(item => {
          if (!item.name) return;
          const aiEntry = {
            id: Date.now() + Math.random(),
            date, meal,
            time:    item.time || nowTimeStr(),
            name:    item.name,
            amount:  parseFloat(item.amount)  || 100,
            cal:     parseFloat(item.cal)     || 0,
            p:       parseFloat(item.p)       || 0,
            f:       parseFloat(item.f)       || 0,
            c:       parseFloat(item.c)       || 0,
            fiber:   parseFloat(item.fiber)   || 0,
            iron:    parseFloat(item.iron)    || 0,
            calcium: parseFloat(item.calcium) || 0,
            vitc:    parseFloat(item.vitc)    || 0,
            vitd:    parseFloat(item.vitd)    || 0,
            vita:    parseFloat(item.vita)    || 0,
            vite:    parseFloat(item.vite)    || 0,
            vitk:    parseFloat(item.vitk)    || 0,
            iodine:  parseFloat(item.iodine)  || 0,
            salt:    parseFloat(item.salt)    || 0,
          };
          enrichFoodProfile(aiEntry);
          addOrMergeEntry(aiEntry);
        });
        log.push(`🔄 ${dateLabel(date)} ${meal}を置き換え（旧${removed}件→新${cmd.items.length}件）`);
      });
      changed = true;
    }
    // ── ADD_CUSTOM_FOOD ──（カスタム食品DBへの登録）
    else if (cmd.type === 'add_custom_food') {
      const foods = Array.isArray(cmd.foods) ? cmd.foods : [cmd];
      foods.forEach(food => {
        if (!food.name) return;
        const per = parseFloat(food.per) || 100;
        customFoods.push({
          id:      Date.now() + Math.random(),
          name:    food.name,
          per,
          cal:     parseFloat(food.cal)     || 0,
          p:       parseFloat(food.p)       || 0,
          f:       parseFloat(food.f)       || 0,
          c:       parseFloat(food.c)       || 0,
          fiber:   parseFloat(food.fiber)   || 0,
          iron:    parseFloat(food.iron)    || 0,
          calcium: parseFloat(food.calcium) || 0,
          vitc:    parseFloat(food.vitc)    || 0,
          vitd:    parseFloat(food.vitd)    || 0,
          salt:    parseFloat(food.salt)    || 0,
          _src:    'ai',
        });
        log.push(`📦 カスタム食品「${food.name}」を登録（${per}gあたり ${Math.round(food.cal)}kcal）`);
      });
      saveCustom();
      changed = true;
    }

    // ── REGISTER_LOGGED_FOOD ──（既に記録済みの食事エントリを、その記録値そのままカスタム食品DBに登録）
    else if (cmd.type === 'register_logged_food') {
      const items = Array.isArray(cmd.items) ? cmd.items
        : (cmd.entry_ids || cmd.ids || []).map(id => ({ entry_id: id }));
      items.forEach(item => {
        const entryId = item.entry_id ?? item.id;
        const src = entries.find(e => e.id === entryId);
        if (!src) { log.push(`⚠️ id:${entryId} の記録が見つかりません`); return; }
        const name = (item.as_name || src.name || '').trim();
        if (!name) return;
        // 既に同名のカスタム食品があれば重複登録しない
        if (customFoods.some(f => normFoodName(f.name) === normFoodName(name))) {
          log.push(`ℹ️ 「${name}」は既にカスタム食品DBに登録済みです`);
          return;
        }
        const scale = 100 / (src.amount || 100);
        customFoods.push({
          id:      Date.now() + Math.random(),
          name,
          per:     100,
          cal:     r1((src.cal     || 0) * scale),
          p:       r1((src.p       || 0) * scale),
          f:       r1((src.f       || 0) * scale),
          c:       r1((src.c       || 0) * scale),
          fiber:   r1((src.fiber   || 0) * scale),
          iron:    r2((src.iron    || 0) * scale),
          calcium: r1((src.calcium || 0) * scale),
          vitc:    r1((src.vitc    || 0) * scale),
          vitd:    r2((src.vitd    || 0) * scale),
          salt:    r2((src.salt    || 0) * scale),
          fa:      src.fa || null,
          aa:      src.aa || null,
          _src:    'log',
        });
        log.push(`📦 「${name}」を記録済みデータ(100gあたり ${r1((src.cal||0)*scale)}kcal)からDBに登録`);
      });
      saveCustom();
      changed = true;
    }

    // ── REGISTER_COMBO_FROM_LOG ──（複数の記録済みエントリを合算して1つのカスタム食品として登録）
    // 例:「今日の夕食のお好み焼きの材料をまとめてカスタム食品登録して」のような、
    //     どのエントリが対象かをAI自身の食品知識で判断する曖昧な依頼に対応する。
    else if (cmd.type === 'register_combo_from_log') {
      const ids = Array.isArray(cmd.entry_ids) ? cmd.entry_ids : (Array.isArray(cmd.ids) ? cmd.ids : []);
      const name = (cmd.name || '').trim();
      if (!name) { log.push('⚠️ カスタム食品名が指定されていません'); }
      else if (customFoods.some(f => normFoodName(f.name) === normFoodName(name))) {
        log.push(`ℹ️ 「${name}」は既にカスタム食品DBに登録済みです。別の名前を指定してください`);
      } else {
        const srcs = ids.map(id => entries.find(e => e.id === id)).filter(Boolean);
        const totalAmount = srcs.reduce((a, e) => a + Math.max(0, e.amount || 0), 0);
        if (!srcs.length || totalAmount <= 0) {
          log.push('⚠️ 対象の記録が見つからないため、合算登録できませんでした');
        } else {
          const sum = { cal:0, p:0, f:0, c:0, fiber:0, iron:0, calcium:0, vitc:0, vitd:0, vita:0, vite:0, vitk:0, iodine:0, salt:0 };
          srcs.forEach(e => { Object.keys(sum).forEach(k => { sum[k] += Math.max(0, e[k] || 0); }); });
          const scale = 100 / totalAmount;
          customFoods.push({
            id:      Date.now() + Math.random(),
            name,
            per:     100,
            cal:     r1(sum.cal*scale),     p:       r1(sum.p*scale),
            f:       r1(sum.f*scale),       c:       r1(sum.c*scale),
            fiber:   r1(sum.fiber*scale),   iron:    r2(sum.iron*scale),
            calcium: r1(sum.calcium*scale), vitc:    r1(sum.vitc*scale),
            vitd:    r2(sum.vitd*scale),    vita:    r1(sum.vita*scale),
            vite:    r2(sum.vite*scale),    vitk:    r1(sum.vitk*scale),
            iodine:  r1(sum.iodine*scale),  salt:    r2(sum.salt*scale),
            _src:    'combo_log',
          });
          log.push(`📦 「${name}」を${srcs.length}件の記録（合計${r1(totalAmount)}g）から合算してDBに登録`);
        }
      }
      saveCustom();
      changed = true;
    }

    // ── DELETE_CUSTOM_FOOD ──（カスタム食品DBからの削除）
    else if (cmd.type === 'delete_custom_food') {
      const names = Array.isArray(cmd.names) ? cmd.names : [cmd.name];
      const before = customFoods.length;
      customFoods = customFoods.filter(f => !names.includes(f.name));
      saveCustom();
      log.push(`🗑️ カスタム食品 ${before - customFoods.length}件削除`);
      changed = true;
    }

    // ── EDIT_CUSTOM_FOOD ──（カスタム食品DBの既存項目を編集）
    else if (cmd.type === 'edit_custom_food') {
      const targetName = (cmd.name || '').trim();
      const idx = customFoods.findIndex(f => normFoodName(f.name) === normFoodName(targetName));
      if (idx === -1) {
        log.push(`⚠️ 「${targetName}」がカスタム食品DBに見つかりません`);
      } else {
        const updates = cmd.updates || {};
        const newName = updates.name != null ? String(updates.name).trim() : '';
        const nameCollides = newName && normFoodName(newName) !== normFoodName(customFoods[idx].name) &&
          customFoods.some((f, i) => i !== idx && normFoodName(f.name) === normFoodName(newName));
        if (nameCollides) {
          log.push(`⚠️ 「${newName}」という名前は既に別のカスタム食品で使われています`);
        } else {
          const numericKeys = ['per','cal','p','f','c','fiber','iron','calcium','vitc','vitd','vita','vite','vitk','iodine','salt'];
          numericKeys.forEach(k => {
            if (updates[k] === undefined || updates[k] === null || updates[k] === '') return;
            const v = parseFloat(updates[k]);
            if (!isNaN(v)) customFoods[idx][k] = Math.max(0, v);
          });
          if (newName) customFoods[idx].name = newName;
          saveCustom();
          log.push(`✏️ 「${customFoods[idx].name}」を更新しました`);
        }
      }
      changed = true;
    }
  });
  return log;
}

async function sendAiMessage() {
  const inp = document.getElementById('aiInput');
  const btn = document.getElementById('aiSendBtn');
  const text = inp ? inp.value.trim() : '';
  if (!text) return;

  inp.value = '';
  inp.disabled = true;
  btn.disabled = true;

  appendAiMessage('user', text);
  aiHistory.push({ role: 'user', content: text });

  const thinking = appendAiThinking();

  // コンテキスト構築（送信のたびに最新データを全件渡す）
  const today = currentDate;
  const weekDates = getWeekDates(today);
  const dbSample  = LOCAL_DB.slice(0, 60).map(f => f.name).join('、');
  const fullCtx = buildFullContext();

  const systemPrompt = `あなたは日本語の栄養管理アプリの操作AIです。
ユーザーの指示を解釈し、必要に応じて記録の追加・削除・置き換えを行います。
以下は送信時点の最新内部データです。質問・操作・アドバイスの判断に必ず活用してください。

【現在日時】今日: ${today}（${dateLabel(today)}）
【今週の日付】${weekDates.map(d => `${dateLabel(d)} ${d}`).join(' / ')}

${fullCtx}

【標準食品DB例】${dbSample} など

【食事タイミング】朝食 / 昼食 / 夕食 / 間食

━━━━━━━━━━━━━━━━━━━━━━
【操作コマンド仕様】
操作が必要な場合は必ず末尾に \`\`\`json ブロックを出力してください。
JSONブロックは必ず \`\`\`json で始め \`\`\` で終わること。他の形式は使用不可。

コマンド種別:

1. add — 今日または指定日の食事記録に食品を追加
{
  "commands": [{
    "type": "add",
    "dates": ["${today}"],
    "meal": "昼食",
    "items": [{"name": "食品名", "amount": 100, "cal": 168, "p": 2.5, "f": 0.3, "c": 37.1, "fiber": 0.3, "iron": 0.1, "calcium": 3, "vitc": 0, "vitd": 0, "salt": 0}]
  }],
  "backup_label": "朝食追加",
  "message": "ユーザーへの返答"
}

2. delete_by_id — IDを指定して削除（コンテキストのidフィールドを使用）
{
  "commands": [{"type": "delete_by_id", "ids": [1234567890]}],
  "backup_label": "夕食削除",
  "message": "削除しました"
}

3. delete_by_date_meal — 日付×食事タイミングで一括削除
{
  "commands": [{"type": "delete_by_date_meal", "dates": ["${today}"], "meal": "昼食"}],
  "backup_label": "昼食一括削除",
  "message": "削除しました"
}

4. replace — 指定日時の既存記録を全削除して新内容で置き換え
{
  "commands": [{"type": "replace", "dates": ["${today}"], "meal": "昼食", "items": [...]}],
  "backup_label": "昼食を置き換え",
  "message": "置き換えました"
}

5. add_custom_food — カスタム食品DBに食品を登録（食事記録への追加とは別・検索DBに保存。栄養成分は推定または表示値を使用）
{
  "commands": [{
    "type": "add_custom_food",
    "foods": [{
      "name": "サントリー角ハイボール缶350ml",
      "per": 350,
      "cal": 154, "p": 0, "f": 0, "c": 10.5,
      "fiber": 0, "iron": 0, "calcium": 0, "vitc": 0, "vitd": 0, "salt": 0
    }]
  }],
  "backup_label": "カスタム食品登録",
  "message": "カスタム食品DBに登録しました。次回から食品検索で見つかります。"
}

6. register_logged_food — 【現在日時】以下のコンテキストに既にある食事記録（id付き）を、その記録済みの栄養値そのまま100gあたりに換算してカスタム食品DBに登録（栄養値を推定し直さない・改めてお願いされた食品名と一致するidをコンテキストから探して使う）
{
  "commands": [{
    "type": "register_logged_food",
    "items": [{"entry_id": 1234567890, "as_name": "省略可・DB登録名を変えたい場合のみ指定"}]
  }],
  "backup_label": "記録済み食品をDB登録",
  "message": "登録しました"
}

7. register_combo_from_log — 複数の記録済みエントリを合算して1つのカスタム食品として登録する。
   「〇〇（料理名）の材料をまとめてカスタム食品登録して」のように、対象が個別に指定されず
   曖昧な依頼の場合、コンテキストの食事記録一覧から対象となる品目をあなたの食品知識で判断し、
   その entry_id を全て entry_ids に列挙する。name は既存のカスタム食品と重複しない、
   内容が一目でわかる名前を自分で考えて付ける（コンテキストの【カスタム食品】一覧を必ず確認すること）。
{
  "commands": [{
    "type": "register_combo_from_log",
    "entry_ids": [1234567890, 1234567891, 1234567892],
    "name": "お好み焼き（自家製・キャベツ豚玉）"
  }],
  "backup_label": "合算カスタム食品登録",
  "message": "3件の記録を合算して登録しました"
}

8. edit_custom_food — カスタム食品DBの既存項目の値を修正する（栄養価の間違い修正、名前変更など）。
   name で対象を特定し、updates に変更したいフィールドだけを指定する（指定しなかったフィールドは変更されない）。
   updates.name を指定すると名前も変更できる（他の既存カスタム食品と重複する名前には変更できない）。
{
  "commands": [{
    "type": "edit_custom_food",
    "name": "対象の既存カスタム食品名（コンテキストの【カスタム食品】一覧から一致するものを探す）",
    "updates": {"cal": 250, "p": 12, "f": 8, "c": 30}
  }],
  "backup_label": "カスタム食品編集",
  "message": "更新しました"
}

9. delete_custom_food — カスタム食品DBから削除
{
  "commands": [{"type": "delete_custom_food", "names": ["食品名"]}],
  "backup_label": "カスタム食品削除",
  "message": "削除しました"
}

【コマンド選択の判断基準（重要）】
- 「〇〇を食べた」「〇〇を追加して」→ add（食事記録に追加）
- 「（今日/昨日/〇月〇日の）朝食/昼食/夕食の〇〇を食品DBに登録して」「さっき記録した〇〇を保存して」など、既に記録済みの食品を指す依頼 → register_logged_food（コンテキストの食事記録からid付きで該当項目を探し、その id を entry_id に使う。栄養値は絶対に自分で計算し直さない）
- 「〇〇（料理名）の材料をまとめて登録して」など、複数の記録済み品目をひとまとめにしたい・
  かつどの品目が対象か曖昧な依頼 → register_combo_from_log（対象の特定はあなたの食品知識で行い、
  該当しそうにない品目まで巻き込まない。判断に自信が持てない場合は無理に実行せず、
  message で対象候補を確認する質問を返す）
- まだ記録されていない食品を新しくDBに登録したい依頼（「〇〇という商品をDBに登録して」等）→ add_custom_food（栄養値を推定して入力）
- 「〇〇を削除して」→ 対象がid特定できれば delete_by_id、できなければ delete_by_date_meal
- 「カスタム食品の〇〇のカロリーを△△に直して」「〇〇の名前を△△に変更して」など、既存のカスタム食品の内容を修正したい依頼 → edit_custom_food（updatesには変更したいフィールドだけを入れる。対象がコンテキストの【カスタム食品】一覧に見当たらない場合は無理に実行せず確認する）
- 「〇〇に変えて」「〇〇で置き換えて」→ replace
- 「今週の〇〇を全部〇〇にして」→ replace を dates に全日付列挙して1コマンドで

【必須ルール・よくある誤りの防止】
- 1回の応答で出力するJSONが非常に大きくなりそうな場合（一度に大量の日付・大量の品目を扱う依頼など）は、無理に1回で全て出力しようとせず、まず一部だけを実行してmessageで「残りは分けて実行しましょうか？」と提案する。出力途中で切れて壊れたJSONを返すより、確実に完了する範囲に絞ること
- dates は必ず配列で指定。「今日」でも ["${today}"] と明示する
- meal は必ず「朝食」「昼食」「夕食」「間食」のいずれか。省略・空文字・null 禁止
- items の栄養素（cal/p/f/c）は必ず推定値を入れる。全て0はNG
- amount は必ず正の数値。単位はg（人前ではなくg換算で記入）
- 複数の食品を同じ meal に追加する場合は items 配列を使い、コマンドは1つにまとめる
- add と add_custom_food を混同しない。食べた記録は add、DBへの保存は add_custom_food
- register_logged_food / register_combo_from_log の entry_id は必ずコンテキストの食事記録に実在する id を使う。id が見つからない・該当日が直近14日の詳細範囲外の場合は無理に実行せず、message で「id特定できないため対応できません」と案内する
- register_combo_from_log の name は必ずコンテキストの【カスタム食品】一覧と重複しないこと。似た名前になりそうな場合は「（自家製）」「（〇月〇日）」等を付けて区別する
- カスタム食品DBへの登録・編集・削除系コマンド（add_custom_food / register_logged_food / register_combo_from_log / edit_custom_food / delete_custom_food）は、ユーザーの明示的な依頼がある場合のみ実行する。他の会話の流れから先回りして実行しない
- "今週" は ${weekDates[0]}〜${weekDates[6]}（${weekDates.length}日間）
- "昨日" は ${getLastNDates(2)[0]}、"一昨日" は ${getLastNDates(3)[0]}
- 記録の読み取り・質問・雑談のみの場合は commands 不要、message だけ返す
- 未来の日付には操作しない（予定記録はユーザーに確認する）

【backup_labelルール】
- 操作内容を10文字以内で端的に表す日本語ラベルを必ず付ける
- 例）「朝食に卵追加」「昨日夕食削除」「今週昼食を置換」

【対応範囲外の操作について】
以下はこのアプリで対応できない操作です。該当する場合は操作を行わず、
できない理由と代替手段をmessageのみで返してください（JSONブロック不要）:
- 体重・プロフィール情報の変更（→「設定」タブで手動変更を案内）
- グラフや統計の操作（表示のみで変更不可）
- 15日以上前の記録（コンテキスト外のため参照・操作不可）
- 運動記録の追加・削除（→「記録」タブの運動ブロックで手動操作を案内）
- アプリの設定変更・外部サービス連携操作

【カスタム食品登録のルール】
- 既に記録した食事から登録したい場合は register_logged_food（記録値そのまま使う・最も正確）
- 複数の記録済み品目を1つにまとめたい場合は register_combo_from_log（対象の判断はあなたの食品知識で行う）
- まだ記録していない新しい商品を登録したい場合は add_custom_food（per は商品1個・1食分・100g など最も使いやすい単位を選ぶ。栄養成分表示がある場合はその数値を使用、なければ標準的な値を推定）
- 登録後は「記録タブの食品検索から追加できます」と案内する
━━━━━━━━━━━━━━━━━━━━━━`;

  try {
    const res = await fetch('/.netlify/functions/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: systemPrompt,
        messages: aiHistory,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `サーバーエラー (${res.status})`);
    }
    const rawText = (data.content || []).map(b => b.text || '').join('');

    // JSONブロック抽出（Geminiは```json以外の形式でも返すことがある）
    let parsed      = null;
    let displayText = rawText;

    // 複数のパターンを試みる
    const jsonPatterns = [
      /```json\s*([\s\S]*?)```/,   // 標準: ```json ... ```
      /```\s*(\{[\s\S]*?\})\s*```/, // ``` { ... } ```
      /(\{[\s\S]*"commands"[\s\S]*?\})\s*$/m, // 末尾のJSONオブジェクト
      /(\{[\s\S]*"items"[\s\S]*?\})\s*$/m,    // itemsキーを含むJSON
    ];

    for (const pat of jsonPatterns) {
      const m = rawText.match(pat);
      if (m) {
        try {
          parsed = JSON.parse(m[1].trim());
          displayText = parsed.message || rawText.replace(pat, '').trim();
          break;
        } catch(e) { /* 次のパターンを試す */ }
      }
    }

    // 旧形式（items配列）のフォールバック対応
    if (parsed && !parsed.commands && Array.isArray(parsed.items)) {
      // 旧itemsフォーマットをcommands形式に変換
      parsed = {
        commands: [{
          type: 'add',
          dates: [currentDate],
          meal: parsed.items[0]?.meal || '昼食',
          items: parsed.items,
        }],
        message: parsed.message || '',
        backup_label: '食品追加',
      };
    }

    if (thinking) { clearInterval(thinking._timer); thinking.remove(); }
    const historyContent = rawText.replace(/```json[\s\S]*?```/g, '[操作コマンド実行済み]').trim();
    aiHistory.push({ role: 'assistant', content: historyContent });
    if (aiHistory.length > 20) aiHistory = aiHistory.slice(aiHistory.length - 20);

    // コマンド実行
    if (parsed && Array.isArray(parsed.commands) && parsed.commands.length > 0) {
      const backupLabel = parsed.backup_label || 'AI操作';
      const opLog = executeAiCommands(parsed.commands, backupLabel);
      const replyText = (displayText ? displayText + '\n\n' : '') + opLog.join('\n');
      appendAiMessage('ai', replyText);
    } else {
      appendAiMessage('ai', displayText || '応答を取得できませんでした。');
    }

  } catch(err) {
    if (thinking) { clearInterval(thinking._timer); thinking.remove(); }
    const msg = err.message || String(err);
    const hint = msg.includes('GEMINI_API_KEY')
      ? msg
      : `通信エラーが発生しました。\n${msg}`;
    appendAiMessage('ai', hint);
    aiHistory.pop();
  }

  inp.disabled = false;
  btn.disabled = false;
  inp.focus();
}

document.addEventListener('click', e => {
  const cb = document.getElementById('comboResultsBox');
  if (cb && !cb.contains(e.target) && e.target !== document.getElementById('comboSearch')) cb.style.display = 'none';
  MEALS_ORDER.forEach(meal => {
    const box=document.getElementById('addResultsBox_'+meal);
    const inp=document.getElementById('addSearch_'+meal);
    if (box && !box.contains(e.target) && e.target !== inp) box.style.display = 'none';
  });
});

// ── Init ──
updateDateHeader();
renderCalendar();
renderRecord();
renderExerciseItems();
renderAuthUI();
initFirebase(); // Firebase設定がある場合に認証・同期を開始
