// 【アーカイブ】単体では実行できない断片です。当時の app.js（2026-11-03時点・数量シート版）から抜き出したものです。
// 再利用するときは README.md の「戻し方」を参照してください。

// ═══ ① 設定（確認する／すぐ記録）═══
const AMOUNT_MODE_KEY = 'pfcAmountSheet', AMOUNT_MAX = 5000;
function getAmountSheetMode() { try { return localStorage.getItem(AMOUNT_MODE_KEY) === 'instant' ? 'instant' : 'ask'; } catch (e) { return 'ask'; } }
function setAmountSheetMode(m) { try { localStorage.setItem(AMOUNT_MODE_KEY, m === 'instant' ? 'instant' : 'ask'); } catch (e) {} }

// ═══ ② 記録の量の変更（シートの「編集モード」で確定したときに呼ぶ）═══
// 既存の記録の量を変更する（単品は値を比例配分、材料を持つ記録は材料の量を同じ比率で変える）
function applyEntryAmount(id, amt) {
  const e = entries.find(x => x.id === id); if (!e || !(amt > 0)) return;
  const snap = JSON.parse(JSON.stringify(entries)), old = e.amount || amt, k = amt / old;
  if (Array.isArray(e.ingredients) && e.ingredients.length) {
    e.ingredients.forEach(ing => { ing.amount = Math.round(ing.amount * k * 10) / 10; });
    recomputeEntryFromIngredients(e);
  } else {
    e.cal = r1(e.cal * k); e.p = r1(e.p * k); e.f = r1(e.f * k); e.c = r1(e.c * k);
    MICRO_KEYS.forEach(key => { if (e[key]) e[key] = microRound(key, e[key] * k); });
    e.amount = Math.round(amt * 10) / 10;
  }
  save(); renderRecord(); renderCalendar();
  showUndoToast(`「${fdEsc(e.name)}」の量を${fmtAmt(old)}g → ${fmtAmt(e.amount)}gに変更しました`, () => { entries = snap; save(); renderRecord(); renderCalendar(); });
}

// ═══ ③ 数量シート本体（状態・開く/閉じる・描画・更新・倍率・＋/−（長押しで連続）・数字キー・確定・警告）═══
// ── 数量シート（画面下から出る量の指定画面）──
const AS = { open: false, mode: 'add', f: null, meal: null, entryId: null, name: '', ref: null, base: 100, amount: 100, units: [], unit: null, count: 1, keypad: false, buf: '', fresh: true, warnAck: false, recent: [], timer: null };
const amountStep = a => a < 20 ? 1 : a < 100 ? 5 : 10;   // 量が大きいほど刻みを大きく（ボタンは＋/−の2つだけ）
function asRef(o, refAmt) { return { refAmt: refAmt || 1, cal: o.cal || 0, p: o.p || 0, f: o.f || 0, c: o.c || 0, fiber: o.fiber || 0 }; }
function openAmountSheetForFood(f, meal, initial) {
  const base = defaultAmountFor(f);
  Object.assign(AS, { open: true, mode: 'add', f, meal, entryId: null, name: f.name, ref: asRef(f, f.per || 100), base, amount: initial > 0 ? initial : base, units: allUnitsFor(f), unit: null, count: 1, keypad: false, buf: '', fresh: true, warnAck: false, recent: recentAmountsFor(f.name) });
  showAmountSheet();
}
function openAmountSheetForEntry(id) {
  const e = entries.find(x => x.id === id); if (!e) return;
  const food = getAllFoods().find(x => normFoodName(x.name) === normFoodName(e.name));
  Object.assign(AS, { open: true, mode: 'edit', f: food || null, meal: e.meal, entryId: id, name: e.name, ref: asRef(e, e.amount), base: e.amount, amount: e.amount, units: food ? allUnitsFor(food) : genericUnitsFor({ name: e.name }), unit: null, count: 1, keypad: false, buf: '', fresh: true, warnAck: false, recent: recentAmountsFor(e.name) });
  showAmountSheet();
}
function asPreview() { const r = AS.ref, k = r.refAmt > 0 ? AS.amount / r.refAmt : 0; return { cal: r.cal * k, p: r.p * k, f: r.f * k, c: r.c * k, fiber: r.fiber * k }; }
function asWarning() {   // 打ち間違い（小数点の位置など）に気づけるよう、極端な量を知らせる
  const pv = asPreview(), ratio = AS.base > 0 ? AS.amount / AS.base : 1;
  if (!(AS.amount > 0)) return { block: true, text: '量を入力してください' };
  if (AS.amount >= AMOUNT_MAX) return { text: `${AMOUNT_MAX.toLocaleString()}gが上限です` };
  if (ratio >= 5 && AS.amount >= 50) return { text: `いつもの量（${fmtAmt(AS.base)}g）の${fmtAmt(ratio)}倍です` };
  if (pv.cal >= 1500) return { text: `${ri(pv.cal)}kcalは1品としては多めです` };
  return null;
}
function showAmountSheet() { const root = document.getElementById('amountSheet'); if (!root) return; root.style.display = 'block'; document.body.style.overflow = 'hidden'; renderAmountSheet(); }
function closeAmountSheet() { asStopHold(); AS.open = false; const root = document.getElementById('amountSheet'); if (root) root.style.display = 'none'; document.body.style.overflow = ''; }
function renderAmountSheet() {
  const panel = document.getElementById('asPanel'); if (!panel) return;
  const chip = (cls, attrs, label) => `<button type="button" class="as-chip ${cls}" ${attrs}>${label}</button>`;
  const mults = [[0.5, '½'], [0.75, '¾'], [1, '1×'], [1.5, '1.5×'], [2, '2×'], [3, '3×']];
  const keypad = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', '⌫'].map(k => `<button type="button" class="as-key" onclick="asKey('${k}')">${k}</button>`).join('');
  const rows = AS.keypad
    ? `<div class="as-keypad">${keypad}</div><div class="as-hint">${AS.unit ? AS.unit.label + 'の数' : 'グラム'}を入力（最初の1桁で入れ替わります）</div>`
    : `<div class="as-label">いつもの量 ${fmtAmt(AS.base)}g を基準に</div><div class="as-chips">${mults.map(([m, l]) => chip('as-m', `data-m="${m}" onclick="asMultiply(${m})"`, l)).join('')}</div>`
      + (AS.recent.length ? `<div class="as-label">よく使う量</div><div class="as-chips">${AS.recent.map(a => chip('as-r', `data-a="${a}" onclick="asSetGrams(${a})"`, fmtAmt(a) + 'g')).join('')}</div>` : '')
      + `<div class="as-label">単位</div><div class="as-chips">${chip('as-g', 'data-g="1" onclick="asGramMode()"', 'g')}${AS.units.map((u, i) => chip('as-u' + (u.generic ? ' as-gen' : ''), `data-u="${i}" onclick="asPickUnit(${i})"`, `${fdEsc(u.label)} <small>${fmtAmt(u.g)}g</small>`)).join('')}</div>`
      + `<div class="as-stepper"><button type="button" class="as-step" data-step="-1" aria-label="減らす">−</button><button type="button" class="as-step" data-step="1" aria-label="増やす">＋</button></div>`;
  panel.innerHTML = `<div class="as-grab"></div>
    <div class="as-head"><div class="as-title">${fdEsc(AS.name)}<span class="as-sub">${AS.mode === 'add' ? fdEsc(AS.meal || '') + 'に記録' : '量の変更'}</span></div><button type="button" class="as-x" onclick="closeAmountSheet()" aria-label="閉じる">✕</button></div>
    <div class="as-display" onclick="asToggleKeypad()" role="button" aria-label="数字キーで入力"><span id="asNum" class="as-num"></span><span id="asUnit" class="as-unit"></span><span class="as-kp">${AS.keypad ? '▾' : '⌨'}</span></div>
    <div id="asSub" class="as-subline"></div><div id="asPv" class="as-pv"></div><div id="asWarn" class="as-warn" style="display:none"></div>
    ${rows}
    <button type="button" id="asConfirm" class="btn btn-primary as-confirm" onclick="confirmAmountSheet()"></button>
    <label class="as-toggle"><input type="checkbox" id="asInstant" ${getAmountSheetMode() === 'instant' ? 'checked' : ''} onchange="setAmountSheetMode(this.checked?'instant':'ask')">次回から確認せず、すぐ記録する（記録後の通知から量を変更できます）</label>`;
  panel.querySelectorAll('[data-step]').forEach(btn => {   // ＋/−は長押しで連続して変わる
    const dir = Number(btn.dataset.step);
    btn.addEventListener('pointerdown', ev => { ev.preventDefault(); asStep(dir); asStopHold(); AS.timer = setTimeout(function tick() { asStep(dir); AS.timer = setTimeout(tick, 90); }, 450); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => btn.addEventListener(t, asStopHold));
  });
  updateAmountDisplay();
}
function asStopHold() { clearTimeout(AS.timer); AS.timer = null; }
function updateAmountDisplay() {   // 量が変わったときの更新（押している＋/−ボタンを作り直さないよう、変わる部分だけ書き換える）
  const $ = id => document.getElementById(id); if (!$('asNum')) return;
  const pv = asPreview(), w = asWarning();
  $('asNum').textContent = AS.keypad && !AS.fresh ? (AS.buf || '0') : fmtAmt(AS.unit ? AS.count : AS.amount);
  $('asUnit').textContent = AS.unit ? AS.unit.label : 'g';
  $('asSub').textContent = AS.unit ? `＝ ${fmtAmt(AS.amount)}g` : (AS.base > 0 ? `いつもの量の ${fmtAmt(AS.amount / AS.base)} 倍` : '');
  $('asPv').textContent = `${ri(pv.cal)}kcal　P${r1(pv.p)}　F${r1(pv.f)}　C${r1(pv.c)}${pv.fiber ? '　繊' + r1(pv.fiber) : ''}`;
  const we = $('asWarn'); if (w && !w.block) { we.style.display = 'block'; we.textContent = '⚠ ' + w.text; } else we.style.display = 'none';
  const cb = $('asConfirm'), label = AS.mode === 'add' ? `${AS.meal || ''}に記録する` : '量を変更する';
  cb.textContent = (w && !w.block && AS.warnAck) ? `それでも ${fmtAmt(AS.amount)}g で${AS.mode === 'add' ? '記録する' : '変更する'}` : `${label}　${fmtAmt(AS.amount)}g`;
  cb.disabled = !!(w && w.block); cb.classList.toggle('as-warnbtn', !!(w && !w.block && AS.warnAck));
  document.querySelectorAll('#asPanel .as-m').forEach(b => b.classList.toggle('on', !AS.unit && Math.round(AS.base * Number(b.dataset.m) * 10) / 10 === AS.amount));
  document.querySelectorAll('#asPanel .as-r').forEach(b => b.classList.toggle('on', !AS.unit && Number(b.dataset.a) === AS.amount));
  document.querySelectorAll('#asPanel .as-u').forEach(b => b.classList.toggle('on', AS.unit === AS.units[Number(b.dataset.u)]));
  document.querySelectorAll('#asPanel .as-g').forEach(b => b.classList.toggle('on', !AS.unit));
}
function asClamp(v) { return Math.min(AMOUNT_MAX, Math.max(0, Math.round(v * 10) / 10)); }
function asSetGrams(v) { AS.unit = null; AS.amount = asClamp(v); AS.fresh = true; AS.buf = ''; AS.warnAck = false; updateAmountDisplay(); }
function asGramMode() { AS.unit = null; AS.warnAck = false; updateAmountDisplay(); }
function asMultiply(m) { asSetGrams(AS.base * m); }
function asPickUnit(i) { const u = AS.units[i]; if (!u) return; AS.unit = u; AS.count = 1; AS.amount = asClamp(u.g); AS.warnAck = false; updateAmountDisplay(); }
function asStep(dir) {
  const EPS = 1e-9;
  if (AS.unit) {   // 単位モード: 5未満は0.5刻み、それ以上は1刻み（上下で対称）
    const st = (dir > 0 ? AS.count : AS.count - 0.01) < 5 ? 0.5 : 1;
    const next = dir > 0 ? Math.floor(AS.count / st + EPS) * st + st : Math.ceil(AS.count / st - EPS) * st - st;
    AS.count = Math.min(99, Math.max(0.5, next)); AS.amount = asClamp(AS.count * AS.unit.g);
  } else {         // グラム: 量が大きいほど刻みを大きくし、次のきりのよい値（5の倍数・10の倍数）へ進む
    const a = AS.amount, st = amountStep(dir > 0 ? a : Math.max(a - 0.1, 0));
    const next = dir > 0 ? Math.floor(a / st + EPS) * st + st : Math.ceil(a / st - EPS) * st - st;
    AS.amount = asClamp(Math.max(1, next));
  }
  AS.warnAck = false; updateAmountDisplay();
}
function asToggleKeypad() { AS.keypad = !AS.keypad; AS.fresh = true; AS.buf = ''; renderAmountSheet(); }
function asKey(k) {
  if (k === '⌫') AS.buf = AS.fresh ? '' : AS.buf.slice(0, -1);
  else { if (AS.fresh) AS.buf = ''; if (k === '.') { if (AS.buf.includes('.')) return; if (AS.buf === '') AS.buf = '0'; } if (AS.buf.length >= 6) return; AS.buf += k; }
  AS.fresh = false;
  const v = parseFloat(AS.buf) || 0;
  if (AS.unit) { AS.count = Math.min(99, v); AS.amount = asClamp(AS.count * AS.unit.g); } else AS.amount = asClamp(v);
  AS.warnAck = false; updateAmountDisplay();
}
function confirmAmountSheet() {
  const w = asWarning(); if (w && w.block) return;
  if (w && !AS.warnAck) { AS.warnAck = true; updateAmountDisplay(); return; }   // 極端な量は、もう一度押さないと確定しない
  const amt = AS.amount, mode = AS.mode, f = AS.f, meal = AS.meal, id = AS.entryId;
  closeAmountSheet();
  if (mode === 'add' && f) registerFromSelection(f, meal, amt, false); else if (mode === 'edit') applyEntryAmount(id, amt);
}
document.addEventListener('keydown', ev => { if (!AS.open) return; if (ev.key === 'Escape') closeAmountSheet(); else if (ev.key === 'Enter' && !(ev.target && ev.target.type === 'checkbox')) confirmAmountSheet(); });
document.addEventListener('pointerup', asStopHold); document.addEventListener('touchend', asStopHold);

// ═══ ④ 検索結果タップ時の動き（確認モード=シートを開く／すぐ記録モード=既定量で記録）═══
function registerFromSelection(f, meal, amt, offerChange) {
  const { entry, merged, snap } = registerFoodEntry(f, meal, amt);
  const msg = merged ? `✅「${fdEsc(f.name)}」を合算しました（+${fmtAmt(amt)}g）` : `✅「${fdEsc(f.name)}」${fmtAmt(amt)}g を記録しました`;
  const acts = []; if (offerChange) acts.push({ label: '量を変更', fn: () => openAmountSheetForEntry(entry.id) });
  acts.push({ label: '元に戻す', fn: () => { entries = snap; save(); renderRecord(); renderCalendar(); } });
  showActionToast(msg, acts, offerChange ? 7000 : 5000);
}
function selectAddResult(i, meal) {
  const box = document.getElementById('addResultsBox_' + meal); if (!box) return;
  const f = box._local && box._local[i]; if (!f) return;
  window._addBase[meal] = { ...f };
  const q = box._qty ? resolveQtyAmount(f, box._qty) : null;
  if (q) { registerFromSelection(f, meal, q.amount, true); return; }               // 検索欄に量を打った → その量でそのまま記録
  if (getAmountSheetMode() === 'ask') { box.style.display = 'none'; openAmountSheetForFood(f, meal); return; }   // 数量シートで量を決めてから記録
  registerFromSelection(f, meal, defaultAmountFor(f), true);                        // すぐ記録（通知から量を変更できる）
}
