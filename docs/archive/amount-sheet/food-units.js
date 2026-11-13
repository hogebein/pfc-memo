// 【アーカイブ】単体では実行できない断片です。当時の app.js（2026-11-03時点・数量シート版）から抜き出したものです。
// 再利用するときは README.md の「戻し方」を参照してください。

// 食品ごとの単位（1個＝50g など）。2026-11 に「使う食品が決まるまで見送り」とした機能。

// ═══ ① 単位の整形・解析・取得 ═══
// ── 単位（1個＝50g など）──
function sanitizeUnits(arr) {
  if (!Array.isArray(arr)) return []; const out = [];
  arr.forEach(u => {
    if (!u || typeof u !== 'object') return;
    const label = String(u.label == null ? '' : u.label).trim().slice(0, 8), g = parseFloat(u.g);
    if (label && isFinite(g) && g > 0 && g <= AMOUNT_MAX && !out.some(x => x.label === label)) out.push({ label, g: Math.round(g * 10) / 10 });
  });
  return out.slice(0, 8);
}
function unitsToText(units) { return sanitizeUnits(units).map(u => `${u.label}=${u.g}`).join(', '); }
function parseUnitsText(txt) {
  return sanitizeUnits(String(txt || '').normalize('NFKC').split(/[,、，\n]/).map(p => { const m = p.split('='); return m.length >= 2 ? { label: m[0].trim(), g: m[1].replace(/g/i, '') } : null; }).filter(Boolean));
}
function foodUnits(f) { return sanitizeUnits(f && f.units); }
const GENERIC_UNIT_DEFS = [{ label: '小さじ', ml: 5 }, { label: '大さじ', ml: 15 }, { label: 'カップ', ml: 200 }];
function genericUnitsFor(f) { const d = (f && f.density > 0) ? f.density : (f && f.name ? getFoodDensity(f.name) : 1) || 1; return GENERIC_UNIT_DEFS.map(u => ({ label: u.label, g: r1(u.ml * d), generic: true })); }
function allUnitsFor(f) { return [...foodUnits(f), ...genericUnitsFor(f)]; }

// ═══ ② 検索欄の量指定の換算（食品ごとの単位に対応した版）═══
function resolveQtyAmount(f, qty) {
  const n = qty.num; if (!(n > 0)) return null;
  const u = UNIT_ALIASES[qty.unit] || qty.unit, units = allUnitsFor(f), own = foodUnits(f);
  const ok = (amount, label) => (amount > 0 && amount <= AMOUNT_MAX) ? { amount: Math.round(amount * 10) / 10, label } : null;
  if (u === '' || u === 'g') {
    if (u === '' && n <= 10 && own[0] && ok(n * own[0].g)) return ok(n * own[0].g, `${fmtAmt(n)}${own[0].label}`);   // 「卵2」→2個（単位のある食品で、小さい数のとき）
    return ok(n, `${fmtAmt(n)}g`);
  }
  if (u === 'kg') return ok(n * 1000, `${fmtAmt(n)}kg`);
  if (u === 'ml' || u === 'cc') return ok(n * (((f && f.density) > 0 ? f.density : getFoodDensity(f.name)) || 1), `${fmtAmt(n)}ml`);
  const hit = units.find(x => x.label === u); if (hit) return ok(n * hit.g, `${fmtAmt(n)}${hit.label}`);
  if (f.serving > 0 && ['個', '枚', '杯', '本', 'パック', '切れ', '人前', '食', '皿', '膳', '袋', '缶', '丁', '玉', '尾'].includes(u)) return ok(n * f.serving, `${fmtAmt(n)}${u}（1食分${fmtAmt(f.serving)}g）`);
  return null;
}

// ═══ ③ 目安量画面での単位の保存 ═══
// 単位（「個=50, 切れ=30」の形式）を保存する。数量シートの単位ボタンと、検索欄の「卵2個」で使われる
function commitFoodUnits(kind, id, v) {
  const f = foodDbList(kind).find(x => x.id === id); if (!f) return;
  const raw = String(v).trim();
  if (raw === '') delete f.units;
  else { const u = parseUnitsText(raw); if (!u.length) { showToast('単位は「個=50, 切れ=30」の形式で入力してください'); renderFoodDbList(kind); return; } f.units = u; }
  saveCustom(); renderFoodDbList(kind);
}

// ═══ ④ 目安量画面の行に足していた入力欄（servingRowHtml の末尾）═══
/*
    <div class="fd-units-row"><span>単位</span><input type="text" class="fd-units" value="${fdEsc(unitsToText(f.units))}" placeholder="例: 個=50, 切れ=30" onchange="commitFoodUnits('${kind}', ${f.id}, this.value)" autocomplete="off"></div></div>`;
*/

// ═══ ⑤ AI・インポートでの受け取り（元のコードの該当行）═══
/*
return sanitizeUnits(String(txt || '').normalize('NFKC').split(/[,、，\n]/).map(p => { const m = p.split('='); return m.length >= 2 ? { label: m[0].trim(), g: m[1].replace(/g/i, '') } : null; }).filter(Boolean));
{ const u = sanitizeUnits(raw.units); if (u.length) food.units = u; }
...(sanitizeUnits(food.units).length ? { units: sanitizeUnits(food.units) } : {}),
if (Array.isArray(updates.units)) { const u = sanitizeUnits(updates.units); if (u.length) customFoods[idx].units = u; else delete customFoods[idx].units; }
*/
