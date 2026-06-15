// ── 正規化（ひらがな→カタカナ、小文字統一）──
function normalize(str) {
  return str
    .toLowerCase()
    .replace(/[\u3041-\u3096]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60))
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
}

// ── 内蔵DB ──
const LOCAL_DB = [
  // 主食
  {name:'白米（炊飯）',    cal:168, p:2.5,  f:0.3,  c:37.1, per:100},
  {name:'玄米（炊飯）',    cal:165, p:2.8,  f:1.0,  c:35.6, per:100},
  {name:'食パン',          cal:248, p:8.9,  f:4.1,  c:44.4, per:100},
  {name:'うどん（茹で）',  cal:105, p:2.6,  f:0.4,  c:21.6, per:100},
  {name:'そば（茹で）',    cal:130, p:4.8,  f:1.0,  c:26.0, per:100},
  {name:'パスタ（茹で）',  cal:149, p:5.8,  f:0.9,  c:29.2, per:100},
  {name:'ご飯（茶碗1杯）', cal:269, p:4.0,  f:0.5,  c:59.4, per:160},
  {name:'オートミール',    cal:380, p:13.7, f:5.7,  c:69.1, per:100},
  // 肉類
  {name:'鶏むね肉（皮なし）', cal:108, p:22.3, f:1.5,  c:0,   per:100},
  {name:'鶏もも肉（皮あり）', cal:190, p:17.3, f:13.0, c:0,   per:100},
  {name:'豚ロース',           cal:263, p:19.3, f:19.2, c:0.2, per:100},
  {name:'豚バラ',             cal:395, p:14.4, f:35.4, c:0.1, per:100},
  {name:'牛もも肉',           cal:182, p:21.2, f:10.2, c:0.4, per:100},
  {name:'牛ひき肉',           cal:272, p:17.1, f:21.1, c:0.3, per:100},
  // 魚介類
  {name:'いわし（マイワシ）', cal:177, p:19.2, f:9.2,  c:0.2, per:100},
  {name:'いわし缶（水煮）',   cal:136, p:20.3, f:5.6,  c:0.1, per:100},
  {name:'さば（マサバ）',     cal:247, p:20.6, f:16.8, c:0.3, per:100},
  {name:'さば缶（水煮）',     cal:174, p:20.9, f:10.7, c:0.2, per:100},
  {name:'さば缶（味噌煮）',   cal:210, p:16.3, f:13.9, c:6.6, per:100},
  {name:'さんま',             cal:318, p:17.4, f:25.6, c:0.1, per:100},
  {name:'あじ（マアジ）',     cal:126, p:20.7, f:4.5,  c:0.1, per:100},
  {name:'サーモン（養殖）',   cal:204, p:20.1, f:12.8, c:0.1, per:100},
  {name:'マグロ（赤身）',     cal:115, p:26.4, f:1.4,  c:0.1, per:100},
  {name:'マグロ（トロ）',     cal:344, p:20.1, f:27.5, c:0.1, per:100},
  {name:'ぶり',               cal:257, p:21.4, f:17.6, c:0.3, per:100},
  {name:'たら（マダラ）',     cal:72,  p:17.6, f:0.2,  c:0.1, per:100},
  {name:'えび',               cal:83,  p:18.4, f:0.3,  c:0.7, per:100},
  {name:'いか',               cal:83,  p:17.9, f:0.8,  c:0.1, per:100},
  {name:'たこ',               cal:76,  p:16.4, f:0.7,  c:0.1, per:100},
  {name:'あさり',             cal:30,  p:6.0,  f:0.3,  c:0.4, per:100},
  {name:'しらす',             cal:76,  p:15.0, f:1.5,  c:0.1, per:100},
  // 卵・乳製品・大豆
  {name:'卵',                 cal:151, p:12.3, f:10.3, c:0.3, per:100},
  {name:'豆腐（木綿）',       cal:72,  p:6.6,  f:4.2,  c:1.6, per:100},
  {name:'豆腐（絹ごし）',     cal:56,  p:4.9,  f:3.0,  c:2.0, per:100},
  {name:'納豆',               cal:200, p:16.5, f:10.0, c:10.7,per:100},
  {name:'大豆（乾燥）',       cal:417, p:35.3, f:19.0, c:28.2,per:100},
  {name:'牛乳',               cal:67,  p:3.3,  f:3.8,  c:4.8, per:100},
  {name:'ヨーグルト（無糖）', cal:62,  p:3.6,  f:3.0,  c:4.9, per:100},
  {name:'チーズ（プロセス）', cal:339, p:22.7, f:26.0, c:1.3, per:100},
  // 野菜・果物
  {name:'バナナ',      cal:86,  p:1.1, f:0.2, c:22.5, per:100},
  {name:'りんご',      cal:61,  p:0.2, f:0.2, c:15.5, per:100},
  {name:'みかん',      cal:46,  p:0.7, f:0.1, c:11.0, per:100},
  {name:'ブロッコリー',cal:33,  p:4.3, f:0.5, c:5.2,  per:100},
  {name:'ほうれん草',  cal:20,  p:2.2, f:0.4, c:3.1,  per:100},
  {name:'じゃがいも',  cal:76,  p:1.6, f:0.1, c:17.6, per:100},
  {name:'さつまいも',  cal:132, p:1.2, f:0.2, c:31.5, per:100},
  {name:'アボカド',    cal:187, p:2.1, f:17.5,c:6.2,  per:100},
  {name:'トマト',      cal:20,  p:0.7, f:0.1, c:4.7,  per:100},
  {name:'キャベツ',    cal:23,  p:1.3, f:0.2, c:5.2,  per:100},
  // ナッツ・その他
  {name:'アーモンド',          cal:608,p:19.6,f:51.8,c:19.7,per:100},
  {name:'くるみ',              cal:674,p:14.6,f:68.8,c:11.7,per:100},
  {name:'プロテイン（1杯）',   cal:120,p:25.0,f:1.5, c:4.0, per:30},
  {name:'コーヒー（ブラック）',cal:4,  p:0.3, f:0,   c:0.7, per:100},
  {name:'オレンジジュース',    cal:45, p:0.7, f:0.1, c:10.4,per:100},
];
LOCAL_DB.forEach(f => { f._key = normalize(f.name); });

// ── State ──
let entries = [];
let garminToken = null;
let garminData = {}; // { date: { steps, calories, bmr } }
try { entries = JSON.parse(localStorage.getItem('pfcEntries') || '[]'); } catch(e) {}
try { garminToken = localStorage.getItem('garminToken') || null; } catch(e) {}
try { garminData = JSON.parse(localStorage.getItem('garminData') || '{}'); } catch(e) {}

let currentDate = toDateStr(new Date());
let searchTimer = null;
let baseNutrition = null;
let calChart = null, pfcChart = null;
let deferredPrompt = null;

// ── Helpers ──
function toDateStr(d) { return d.toISOString().split('T')[0]; }
function fmtDate(s) {
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('ja-JP', {month:'long', day:'numeric', weekday:'short'});
}
function r1(n) { return Math.round(n * 10) / 10; }
function ri(n) { return Math.round(n); }
function save() { try { localStorage.setItem('pfcEntries', JSON.stringify(entries)); } catch(e) {} }
function saveGarmin() {
  try { localStorage.setItem('garminData', JSON.stringify(garminData)); } catch(e) {}
}

// ── Header date ──
function updateHeader() {
  const d = new Date();
  document.getElementById('headerDate').textContent =
    d.toLocaleDateString('ja-JP', {month:'long', day:'numeric', weekday:'long'});
}
updateHeader();

// ── PWA Install ──
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('install-banner').style.display = 'flex';
});
document.getElementById('install-btn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  document.getElementById('install-banner').style.display = 'none';
});

// ── Service Worker ──
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ── Tab switching ──
function switchTab(t) {
  ['record','today','history','graph','garmin'].forEach(id => {
    document.getElementById('panel-' + id).classList.toggle('active', id === t);
    document.getElementById('nav-' + id).classList.toggle('active', id === t);
  });
  if (t === 'today')   renderToday();
  if (t === 'history') renderHistory();
  if (t === 'graph')   renderGraphs();
  if (t === 'garmin')  renderGarminStatus();
}

// ── Search ──
function fuzzyScore(key, q) {
  if (key.includes(q)) return 2;
  let qi = 0;
  for (let i = 0; i < key.length && qi < q.length; i++)
    if (key[i] === q[qi]) qi++;
  return qi === q.length ? 1 : 0;
}
function localSearch(q) {
  const nq = normalize(q);
  return LOCAL_DB
    .map(f => ({ ...f, score: fuzzyScore(f._key, nq) }))
    .filter(f => f.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

let apiAbort = null;
async function apiSearch(q) {
  if (apiAbort) apiAbort.abort();
  apiAbort = new AbortController();
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&fields=product_name,product_name_ja,nutriments&page_size=6&lc=ja,en`;
    const res = await fetch(url, { signal: apiAbort.signal });
    const data = await res.json();
    return (data.products || [])
      .filter(p => (p.product_name || p.product_name_ja) && (p.nutriments || {})['energy-kcal_100g'] != null)
      .map(p => {
        const n = p.nutriments || {};
        return { name: p.product_name_ja || p.product_name || '不明', cal:r1(n['energy-kcal_100g']||0), p:r1(n['proteins_100g']||0), f:r1(n['fat_100g']||0), c:r1(n['carbohydrates_100g']||0), per:100, source:'api' };
      });
  } catch(e) {
    return e.name === 'AbortError' ? null : [];
  }
}

function showSpinner(on) {
  document.getElementById('searchIcon').style.display = on ? 'none' : 'block';
  document.getElementById('searchSpinner').style.display = on ? 'block' : 'none';
}

function onSearch(q) {
  clearTimeout(searchTimer);
  const box = document.getElementById('resultsBox');
  if (!q.trim()) { box.style.display = 'none'; return; }
  renderResults(localSearch(q), [], true);
  showSpinner(true);
  searchTimer = setTimeout(async () => {
    const api = await apiSearch(q);
    showSpinner(false);
    if (api !== null) renderResults(localSearch(q), api, false);
  }, 600);
}

function renderResults(local, api, loading) {
  const box = document.getElementById('resultsBox');
  let html = '';
  if (local.length) {
    html += `<div class="rs-label">内蔵データベース</div>`;
    html += local.map((f, i) => `<div class="ri" onclick="selectResult(${i},'local')">
      <div><div class="ri-name">${f.name}<span class="badge badge-local">内蔵</span></div>
      <div class="ri-sub">${f.per}gあたり P${f.p}g F${f.f}g C${f.c}g</div></div>
      <div class="ri-cal">${f.cal}kcal</div></div>`).join('');
  }
  if (loading) {
    html += `<div class="rs-label">Open Food Facts — 検索中…</div><div class="no-result"><div class="spinner" style="display:inline-block"></div></div>`;
  } else if (api && api.length) {
    html += `<div class="rs-label">Open Food Facts</div>`;
    html += api.map((f, i) => `<div class="ri" onclick="selectResult(${i},'api')">
      <div><div class="ri-name">${f.name.length > 24 ? f.name.slice(0,24)+'…' : f.name}<span class="badge badge-api">外部</span></div>
      <div class="ri-sub">100gあたり P${f.p}g F${f.f}g C${f.c}g</div></div>
      <div class="ri-cal">${f.cal}kcal</div></div>`).join('');
  } else if (!loading && !local.length) {
    html += `<div class="no-result">見つかりませんでした</div>`;
  }
  box.innerHTML = html;
  box._local = local; box._api = api;
  box.style.display = 'block';
}

function selectResult(i, src) {
  const box = document.getElementById('resultsBox');
  const f = src === 'local' ? box._local[i] : box._api[i];
  if (!f) return;
  baseNutrition = { ...f };
  document.getElementById('foodName').value = f.name;
  document.getElementById('foodAmount').value = f.per;
  fillMacros(f, f.per);
  box.style.display = 'none';
  document.getElementById('searchInput').value = '';
  showSpinner(false);
  document.getElementById('foodName').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function fillMacros(f, amt) {
  const r = amt / f.per;
  document.getElementById('foodCal').value = r1(f.cal * r);
  document.getElementById('foodP').value   = r1(f.p   * r);
  document.getElementById('foodF').value   = r1(f.f   * r);
  document.getElementById('foodC').value   = r1(f.c   * r);
}
function recalcManual() {
  if (!baseNutrition) return;
  const amt = parseFloat(document.getElementById('foodAmount').value) || 0;
  if (amt > 0) fillMacros(baseNutrition, amt);
}

// ── Add entry ──
function addEntry() {
  const name = document.getElementById('foodName').value.trim();
  const cal  = parseFloat(document.getElementById('foodCal').value)    || 0;
  const p    = parseFloat(document.getElementById('foodP').value)      || 0;
  const f    = parseFloat(document.getElementById('foodF').value)      || 0;
  const c    = parseFloat(document.getElementById('foodC').value)      || 0;
  const amt  = parseFloat(document.getElementById('foodAmount').value) || 100;
  const meal = document.getElementById('mealTime').value;
  const msg  = document.getElementById('statusMsg');
  if (!name) { msg.className = 'status-msg status-err'; msg.textContent = '食品名を入力してください'; return; }
  entries.push({ id: Date.now(), date: currentDate, name, cal, p, f, c, amount: amt, meal });
  save();
  msg.className = 'status-msg status-ok';
  msg.textContent = `「${name}」を追加しました ✓`;
  ['foodName','foodCal','foodP','foodF','foodC'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('foodAmount').value = '100';
  baseNutrition = null;
  setTimeout(() => { msg.textContent = ''; }, 2500);
}

// ── Today ──
function sumEntries(list) {
  return list.reduce((a, e) => ({ cal:a.cal+e.cal, p:a.p+e.p, f:a.f+e.f, c:a.c+e.c }), {cal:0,p:0,f:0,c:0});
}
function getDayEntries(d) { return entries.filter(e => e.date === d); }
function changeDate(d) {
  const dt = new Date(currentDate + 'T00:00:00');
  dt.setDate(dt.getDate() + d);
  currentDate = toDateStr(dt);
  renderToday();
}

function renderToday() {
  document.getElementById('displayDate').textContent = fmtDate(currentDate);
  const list = getDayEntries(currentDate);
  const s = sumEntries(list);

  // Garminデータ
  const gd = garminData[currentDate];
  const garminArea = document.getElementById('garminDataArea');
  if (gd && garminToken) {
    garminArea.style.display = 'block';
    document.getElementById('g-steps').textContent   = gd.steps ? gd.steps.toLocaleString() : '—';
    document.getElementById('g-calories').textContent = gd.activeCalories || '—';
    document.getElementById('g-bmr').textContent      = gd.bmr || '—';
  } else {
    garminArea.style.display = 'none';
  }

  // カロリー計算（摂取 - 消費活動カロリー）
  const activeCalBurn = (gd && garminToken) ? (gd.activeCalories || 0) : 0;
  const netCal = ri(s.cal) - activeCalBurn;

  document.getElementById('todayMetrics').innerHTML = `
    <div class="mc highlight"><div class="mc-label">摂取</div><div class="mc-value">${ri(s.cal)}</div><div class="mc-unit">kcal</div></div>
    <div class="mc"><div class="mc-label">タンパク質</div><div class="mc-value">${r1(s.p)}</div><div class="mc-unit">g</div></div>
    <div class="mc"><div class="mc-label">脂質</div><div class="mc-value">${r1(s.f)}</div><div class="mc-unit">g</div></div>
    <div class="mc"><div class="mc-label">炭水化物</div><div class="mc-value">${r1(s.c)}</div><div class="mc-unit">g</div></div>
    ${activeCalBurn ? `<div class="mc" style="grid-column:1/-1;background:#fff8e1;border-color:#ffe082"><div class="mc-label">収支（摂取 − 活動消費）</div><div class="mc-value" style="color:${netCal>0?'#c0392b':'#2e7d32'}">${netCal > 0 ? '+' : ''}${netCal}</div><div class="mc-unit">kcal</div></div>` : ''}
  `;

  const pcal = s.p*4, fcal = s.f*9, ccal = s.c*4, tot = pcal+fcal+ccal || 1;
  document.getElementById('barP').style.width = (pcal/tot*100) + '%';
  document.getElementById('barF').style.width = (fcal/tot*100) + '%';
  document.getElementById('barC').style.width = (ccal/tot*100) + '%';

  const cont = document.getElementById('todayContent');
  if (!list.length) {
    cont.innerHTML = `<div class="empty-state">📝<br>まだ記録がありません<br>「記録」タブから追加できます</div>`;
    return;
  }
  const grouped = {朝食:[],昼食:[],夕食:[],間食:[]};
  list.forEach(e => { (grouped[e.meal] || grouped['間食']).push(e); });
  let html = '';
  Object.entries(grouped).forEach(([meal, items]) => {
    if (!items.length) return;
    const ms = sumEntries(items);
    html += `<div class="meal-group"><div class="meal-header"><span>${meal}</span><span>${ri(ms.cal)} kcal / P${r1(ms.p)} F${r1(ms.f)} C${r1(ms.c)}</span></div>`;
    items.forEach(e => {
      html += `<div class="log-item">
        <div><div class="li-name">${e.name}</div><div class="li-detail">${e.amount}g｜P${r1(e.p)} F${r1(e.f)} C${r1(e.c)}</div></div>
        <div class="li-right"><div class="li-cal">${ri(e.cal)}<span style="font-size:10px;font-weight:400">kcal</span></div>
        <button class="btn btn-sm btn-danger" onclick="deleteEntry(${e.id})">✕</button></div>
      </div>`;
    });
    html += '</div>';
  });
  cont.innerHTML = html;
}

function deleteEntry(id) {
  entries = entries.filter(e => e.id !== id);
  save(); renderToday();
}

// ── History ──
function renderHistory() {
  const days = [...new Set(entries.map(e => e.date))].sort((a,b) => b.localeCompare(a));
  const cont = document.getElementById('historyContent');
  if (!days.length) { cont.innerHTML = `<div class="empty-state">📅<br>記録がありません</div>`; return; }
  cont.innerHTML = days.map(d => {
    const s = sumEntries(getDayEntries(d));
    return `<div class="history-item" onclick="jumpToDate('${d}')">
      <div><div class="hi-date">${fmtDate(d)}</div><div class="hi-pfc">P ${r1(s.p)}g｜F ${r1(s.f)}g｜C ${r1(s.c)}g</div></div>
      <div class="hi-cal">${ri(s.cal)} kcal</div></div>`;
  }).join('');
}
function jumpToDate(d) { currentDate = d; switchTab('today'); }

// ── Graphs ──
function getLast7() {
  return Array.from({length:7}, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i)); return toDateStr(d);
  });
}
function renderGraphs() {
  const days = getLast7();
  const labels = days.map(d => { const dt = new Date(d+'T00:00:00'); return `${dt.getMonth()+1}/${dt.getDate()}`; });
  const calData = days.map(d => ri(sumEntries(getDayEntries(d)).cal));
  const pData   = days.map(d => r1(sumEntries(getDayEntries(d)).p));
  const fData   = days.map(d => r1(sumEntries(getDayEntries(d)).f));
  const cData   = days.map(d => r1(sumEntries(getDayEntries(d)).c));
  const opts = { responsive:true, maintainAspectRatio:false };
  if (calChart) calChart.destroy();
  calChart = new Chart(document.getElementById('calChart'), {
    type:'bar',
    data:{labels, datasets:[{label:'kcal', data:calData, backgroundColor:'#3266ad', borderRadius:4}]},
    options:{...opts, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true,ticks:{callback:v=>v+'',font:{size:10}},grid:{color:'rgba(0,0,0,.06)'}},x:{ticks:{font:{size:10}}}}}
  });
  if (pfcChart) pfcChart.destroy();
  pfcChart = new Chart(document.getElementById('pfcChart'), {
    type:'line',
    data:{labels, datasets:[
      {label:'タンパク質', data:pData, borderColor:'#3266ad', backgroundColor:'transparent', tension:.3, pointRadius:3, borderWidth:2},
      {label:'脂質',       data:fData, borderColor:'#e8a838', backgroundColor:'transparent', tension:.3, pointRadius:3, borderWidth:2, borderDash:[5,3]},
      {label:'炭水化物',   data:cData, borderColor:'#4caf50', backgroundColor:'transparent', tension:.3, pointRadius:3, borderWidth:2, borderDash:[2,2]},
    ]},
    options:{...opts, plugins:{legend:{position:'bottom',labels:{font:{size:10},boxWidth:10,padding:10}}}, scales:{y:{beginAtZero:true,ticks:{font:{size:10}},grid:{color:'rgba(0,0,0,.06)'}},x:{ticks:{font:{size:10}}}}}
  });
}

// ── Garmin OAuth ──
// NOTE: CLIENT_ID・CLIENT_SECRETはNetlify環境変数に設定してください
async function connectGarmin() {
  // Garmin OAuth 1.0a の開始 → Netlify Function経由でリクエストトークン取得
  try {
    const res = await fetch('/.netlify/functions/garmin-auth-start');
    const { authUrl } = await res.json();
    window.location.href = authUrl; // Garminログイン画面へ
  } catch(e) {
    alert('Garmin連携の開始に失敗しました。サーバー設定を確認してください。');
  }
}

// コールバック後のトークン保存（URLパラメータから）
(function checkGarminCallback() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('garmin_token');
  if (token) {
    garminToken = token;
    localStorage.setItem('garminToken', token);
    history.replaceState({}, '', window.location.pathname);
    renderGarminStatus();
    syncGarmin();
  }
})();

async function syncGarmin() {
  if (!garminToken) return;
  const dateStr = currentDate;
  try {
    const res = await fetch(`/.netlify/functions/garmin-daily?date=${dateStr}&token=${garminToken}`);
    if (!res.ok) throw new Error('sync failed');
    const data = await res.json();
    garminData[dateStr] = data;
    saveGarmin();
    renderToday();
    document.getElementById('garminSyncBtn').style.display = 'flex';
  } catch(e) {
    console.warn('Garmin sync error:', e);
  }
}

function renderGarminStatus() {
  const btn = document.getElementById('garminConnectBtn');
  const status = document.getElementById('garminStatus');
  if (garminToken) {
    btn.textContent = '再接続';
    status.innerHTML = `<span style="color:var(--green);font-weight:600">✓ 接続済み</span><br><span style="font-size:11px;margin-top:4px;display:block">データは今日タブで確認できます</span>`;
    document.getElementById('garminSyncBtn').style.display = 'flex';
  } else {
    btn.textContent = '連携する';
    status.textContent = '未接続';
  }
}

// ── Close results on outside click ──
document.addEventListener('click', e => {
  const box = document.getElementById('resultsBox');
  if (!box.contains(e.target) && e.target.id !== 'searchInput') box.style.display = 'none';
});

// ── Init ──
document.getElementById('displayDate').textContent = fmtDate(currentDate);
renderGarminStatus();
