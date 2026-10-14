#!/usr/bin/env node
/**
 * 日本食品標準成分表（八訂）の「水溶性/不溶性食物繊維」を foods-db.js に取り込むスクリプト
 *
 * 【使う資料】文部科学省「日本食品標準成分表（八訂）増補2023年 炭水化物成分表編」のExcel（xlsx）
 *   ※ 八訂の「本表」には食物繊維の総量しか載っていません。水溶性/不溶性の内訳は炭水化物成分表編にあります。
 *   入手先: https://www.mext.go.jp/a_menu/syokuhinseibun/ （「日本食品標準成分表」→ 八訂 → 炭水化物成分表編 のExcel）
 *
 * 【使い方】
 *   npm install --no-save xlsx            # 初回のみ（xlsxの読み込みに使用）
 *   node scripts/import-mext-fiber.js <炭水化物成分表編.xlsx>            # ドライラン（変更せず、照合結果のレポートだけ出力）
 *   node scripts/import-mext-fiber.js <xlsx> --apply                     # foods-db.js に反映（foods-db.js.bak を自動作成）
 *   オプション: --min-score 0.6  照合スコアの下限 / --ratio-only  総量が食い違っても比率のみ採用しない（常に比率で反映）
 *               --include-exact  既に実測値（fibEstなし）の食品も上書きする / --db <path>  foods-db.js の場所
 *               --force-ratio  総量が大きく食い違う（±50%超）食品も比率だけで反映する（通常は「要確認」として反映しません）
 *               --sheet <名前>  対象シートを指定（省略時は水溶性/不溶性の列を持つシートを自動検出）
 *
 * 【照合】食品名の一致は自動の曖昧照合です。曖昧な候補（同点が複数など）は自動では反映せず、レポートに出します。
 *   scripts/mext-name-map.json に {"当アプリの食品名": "成分表の食品名"} を書くと、その対応を最優先で使います。
 * 【反映のしかた】成分表の水溶性/不溶性の比率を、当アプリの fiber（基準量あたり）に掛けて fibS/fibI を決めます。
 *   成分表の総量と当アプリの fiber が±15%以内なら成分表の値そのもの（基準量に換算）を使い、fibEst を外します。ずれる場合は比率のみ採用し、fibEst は残します。
 *   測定法（プロスキー変法／AOAC.2011.25法）が複数載っている食品は、当アプリの総量に近い方を使います。AOAC法の水溶性は「低分子量＋高分子量」の合計です。
 */
const fs = require('fs'), path = require('path');

const args = process.argv.slice(2);
const flag = n => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const xlsxPath = args.find(a => !a.startsWith('--') && /\.(xlsx|xls|csv)$/i.test(a));
const DB_PATH = path.resolve(opt('--db', path.join(__dirname, '..', 'foods-db.js')));
const MIN_SCORE = parseFloat(opt('--min-score', '0.55')), MARGIN = 0.08;
const APPLY = flag('--apply'), RATIO_ONLY = flag('--ratio-only'), INCLUDE_EXACT = flag('--include-exact'), FORCE_RATIO = flag('--force-ratio');

// ── 文字列の正規化 ──
const norm = s => String(s == null ? '' : s).normalize('NFKC').toLowerCase().replace(/[\s　・･,、，]/g, '');
const stripTags = s => String(s || '').replace(/[＜<][^＞>]*[＞>]/g, '').replace(/^\s*[（(][^）)]*類[）)]/, '').trim();   // 「＜野菜類＞」「（ごぼう類）」などの食品群タグ
const num = v => {                                                              // Tr, (0), (1.2), -, * などの表記ゆれ
  if (v == null) return null;
  const t = String(v).normalize('NFKC').trim();
  if (t === '' || t === '-' || t === '*' || t === '…') return null;
  if (/^tr$/i.test(t.replace(/[()]/g, ''))) return 0;
  const n = parseFloat(t.replace(/[()（）*]/g, ''));
  return isFinite(n) ? n : null;
};

// ── Excel読み込みと表の検出 ──
function loadRows(file) {
  let XLSX; try { XLSX = require('xlsx'); } catch (e) { console.error('xlsx パッケージが必要です: npm install --no-save xlsx'); process.exit(1); }
  const wb = XLSX.readFile(file);
  const only = opt('--sheet', null);
  return wb.SheetNames.filter(n => !only || n === only).map(n => ({ name: n, rows: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: null, raw: true }) }));
}
function detectTable(rows) {
  const isNumLike = v => num(v) !== null;
  for (let top = 0; top < Math.min(rows.length, 25); top++) {
    if (!rows[top] || !rows[top].some(c => /食品名/.test(String(c || '')))) continue;
    const nameCol = rows[top].findIndex(c => /食品名/.test(String(c || '')));
    // データ開始行: 食品名があり、数値らしいセルが3つ以上ある最初の行（単位行・見出し行は数値がほぼ無い）
    let dataStart = top + 1;
    while (dataStart < rows.length && !(rows[dataStart] && rows[dataStart][nameCol] != null && String(rows[dataStart][nameCol]).trim() !== '' && rows[dataStart].filter(isNumLike).length >= 3)) dataStart++;
    if (dataStart >= rows.length) continue;
    // ヘッダ: 食品名の行の1〜2行上から、データ開始の直前まで。結合セル（横に広がる見出し）は右の空欄へ引き継ぐ
    const start = Math.max(0, top - 2), width = Math.max(...rows.slice(start, dataStart).map(r => (r || []).length));
    const filled = Array.from({ length: width }, () => '');
    for (let r = start; r < dataStart; r++) { let last = ''; for (let c = 0; c < width; c++) { const v = rows[r] && rows[r][c] != null ? String(rows[r][c]).normalize('NFKC').replace(/\s/g, '') : ''; if (v) last = v; filled[c] += (v || (r <= top ? last : '')) + '|'; } }
    const find = pred => filled.map((h, i) => pred(h) ? i : -1).filter(i => i >= 0);
    const sdfs = find(h => /低分子/.test(h) && /水溶性/.test(h)), sdfp = find(h => /高分子/.test(h) && /水溶性/.test(h));
    const sol = find(h => /水溶性/.test(h) && !/不溶性|低分子|高分子/.test(h));
    const ins = find(h => /不溶性/.test(h));
    const tot = find(h => (/食物繊維/.test(h) && /(総量|合計|総)/.test(h)) || /TDF/.test(h));
    if (!(ins.length && (sol.length || sdfs.length || sdfp.length))) continue;
    return { nameCol, sdfs: sdfs[0], sdfp: sdfp[0], sol: sol[0], ins: ins[0], tot: tot[0], dataStart, heads: filled };
  }
  return null;
}
// 炭水化物成分表編 別表1: 「成分識別子」行に FIBSOL/FIBINS/FIBTG（プロスキー変法）と FIB-SDFS/FIB-SDFP/FIB-IDF/FIB-TDF（AOAC.2011.25法）が並ぶ
function detectIdTable(rows) {
  for (let r = 0; r < Math.min(rows.length, 25); r++) {
    const row = rows[r] || []; const idx = id => row.findIndex(c => String(c || '').trim() === id);
    const c = { sol: idx('FIBSOL'), ins: idx('FIBINS'), tg: idx('FIBTG'), sdfs: idx('FIB-SDFS'), sdfp: idx('FIB-SDFP'), idf: idx('FIB-IDF'), tdf: idx('FIB-TDF') };
    if (c.sol < 0 || c.ins < 0) continue;
    let nameCol = -1; for (let h = Math.max(0, r - 8); h <= r; h++) (rows[h] || []).forEach((v, j) => { if (String(v || '').replace(/[\s　]/g, '') === '食品名') nameCol = j; });
    if (nameCol < 0) nameCol = row.findIndex(c2 => String(c2 || '').trim() === '成分識別子');   // 成分識別子の行では食品名の列に「成分識別子」と入っている
    if (nameCol < 0) continue;
    return { ...c, nameCol, dataStart: r + 1 };
  }
  return null;
}
function extractIdFoods(sheet, t) {
  const out = [];
  for (let r = t.dataStart; r < sheet.rows.length; r++) {
    const row = sheet.rows[r]; if (!row || row[t.nameCol] == null || String(row[t.nameCol]).trim() === '') continue;
    const g = c => (c < 0 ? null : num(row[c]));
    const est = c => c >= 0 && /^\(.*\)$/.test(String(row[c] == null ? '' : row[c]).trim());   // (0.4) 形式は成分表上の推計値
    const methods = [];
    const ps = g(t.sol), pi = g(t.ins), pt = g(t.tg);
    if (ps != null && pi != null) methods.push({ type: 'プロスキー変法', soluble: ps, insoluble: pi, total: pt != null ? pt : ps + pi, est: est(t.sol) });
    const lo = g(t.sdfs), hi = g(t.sdfp), idf = g(t.idf), tdf = g(t.tdf);
    if ((lo != null || hi != null) && idf != null) methods.push({ type: 'AOAC2011.25', soluble: (lo || 0) + (hi || 0), insoluble: idf, total: tdf != null ? tdf : (lo || 0) + (hi || 0) + idf, est: est(t.sdfs) });
    if (!methods.length) continue;
    out.push({ name: stripTags(String(row[t.nameCol]).replace(/[\r\n]/g, '')).replace(/　/g, ' ').replace(/\s+/g, ' ').trim(), methods, sheet: sheet.name });
  }
  return out;
}
function extractFoods(sheet) {
  const idt = detectIdTable(sheet.rows); if (idt) return extractIdFoods(sheet, idt);
  const t = detectTable(sheet.rows); if (!t) return [];
  const out = [];
  for (let r = t.dataStart; r < sheet.rows.length; r++) {
    const row = sheet.rows[r]; if (!row || row[t.nameCol] == null) continue;
    const name = stripTags(row[t.nameCol]); if (!name) continue;
    const g = c => (c == null ? null : num(row[c]));
    const lo = g(t.sdfs), hi = g(t.sdfp), plain = g(t.sol);
    const soluble = (lo != null || hi != null) ? (lo || 0) + (hi || 0) : plain;
    const insol = g(t.ins); if (soluble == null || insol == null) continue;
    const total = g(t.tot);
    out.push({ name, methods: [{ type: '表の値', soluble, insoluble: insol, total: total != null ? total : soluble + insol, est: false }], sheet: sheet.name });
  }
  return out;
}

// ── 食品DB（foods-db.js）の読み込み ──
function loadDb(file) {
  const src = fs.readFileSync(file, 'utf8');
  const items = new Function(src + '\nreturn LOCAL_DB;')();
  return { src, items };
}

// ── 名前の照合 ──
const MOD_MAP = [[/生/, ['生']], [/ゆで|茹/, ['ゆで']], [/乾燥|乾/, ['乾']], [/焼/, ['焼']], [/水煮/, ['水煮']], [/炊飯|炊き/, ['炊き', '飯']], [/揚/, ['揚']], [/缶/, ['缶']]];
// 当アプリの食品名 → 成分表の表記（成分表は野菜などをひらがなで載せていることが多い）。いずれかで一致すれば採用
const ALIASES = { '玉ねぎ': ['たまねぎ'], '長ねぎ': ['根深ねぎ'], '白菜': ['はくさい'], '小松菜': ['こまつな'], '人参': ['にんじん'], '大根': ['だいこん'], '山芋': ['ながいも', 'やまのいも'],
  '里芋': ['さといも'], 'ほうれん草': ['ほうれんそう'], 'しょうが': ['しょうが'], 'れんこん': ['れんこん'], 'パプリカ': ['パプリカ', 'ピーマン'], 'もやし': ['もやし'], '豆腐': ['豆腐'],
  'キャベツ': ['キャベツ'], 'ごぼう': ['ごぼう'], 'ごま': ['ごま'], 'みかん': ['うんしゅうみかん', 'みかん'], 'いんげん': ['いんげんまめ'], 'そば': ['そば'], 'うどん': ['うどん'], 'パスタ': ['マカロニ・スパゲッティ', 'スパゲッティ'],
  'ご飯': ['めし', '水稲めし'], '白米': ['水稲穀粒', '精白米'], '食パン': ['角形食パン', '食パン'], '玄米': ['玄米'], 'きな粉': ['きな粉'], '豆乳': ['豆乳'], '納豆': ['糸引き納豆'] };
function parseOurName(name) {
  const base = name.normalize('NFKC').split(/[（(]/)[0].replace(/\d+g|\d+個|1人前|1本|1杯/g, '').trim();
  const mods = (name.normalize('NFKC').match(/[（(]([^）)]*)[）)]/g) || []).join(' ');
  return { base: norm(base), rawBase: base, mods };
}
function score(our, cand) {
  const n = norm(cand.name); if (!our.base || !n.includes(our.base)) return 0;
  // 成分表の名前は「こむぎ ［パン類］ 角形食パン 食パン」「和風料理 煮物類 肉じゃが」のように、食品群の語（［…］、〜類、〜料理、先頭の原材料名）が付く。
  // それらを除いた「食品そのものの部分」に対する一致の割合で評価する（短く一般的な名前ほど高い）
  const rawToks = String(cand.name).normalize('NFKC').split(/\s+/).filter(Boolean);
  const isGroup = (t, i) => /^[［\[].*[］\]]$/.test(t) || (/(料理|類|製品)$/.test(t) && norm(t) !== our.base) || (i === 0 && rawToks[1] && /^[［\[]/.test(rawToks[1]));
  const core = norm(rawToks.filter((t, i) => !isGroup(t, i)).join(' ')) || n;
  let sc = Math.min(1, our.base.length / core.length);
  // 食材名が1語として一致するものを優先（「つるにんじん」「めキャベツ」「昆布茶」などの部分一致を避ける）
  const toks = String(cand.name).normalize('NFKC').split(/[\s　\[\]［］()（）]+/).filter(Boolean).map(norm);
  if (!toks.includes(our.base)) sc *= 0.45;
  if (n.startsWith(our.base)) sc += 0.15;
  for (const [re, toks] of MOD_MAP) { const want = re.test(our.mods); const has = toks.some(t => n.includes(t)); if (want && has) sc += 0.25; else if (want && !has) sc -= 0.2; else if (!want && has && toks[0] !== '生') sc -= 0.1; }
  if (!our.mods && n.includes('生')) sc += 0.1;
  return Math.max(0, sc);
}
function tokenMatch(base, cand) { return String(cand.name).normalize('NFKC').split(/[\s　\[\]［］()（）]+/).filter(Boolean).map(norm).includes(base); }
function bestFor(our, mext) {
  const bases = [our.base, ...((ALIASES[our.rawBase] || []).map(norm))];
  let best = []; bases.forEach(b => { mext.forEach(c => { const sc = score({ ...our, base: b }, c); if (sc > 0) best.push({ c, s: sc, tok: tokenMatch(b, c) }); }); });
  const seen = new Map(); best.forEach(x => { const k = x.c.name; if (!seen.has(k) || seen.get(k).s < x.s) seen.set(k, x); });
  return [...seen.values()].sort((a, b) => b.s - a.s);
}
function match(item, mext, manual) {
  const m = manual[item.name]; if (m) { const hit = mext.find(c => norm(c.name) === norm(m) || norm(c.name).includes(norm(m))); return hit ? { cand: hit, score: 1, how: 'manual' } : { cand: null, how: 'manual-miss' }; }
  const our = parseOurName(item.name); const scored = bestFor(our, mext);
  if (!scored.length) return { cand: null, how: 'no-candidate' };
  const our100 = item.fiber / (item.per || 100) * 100;
  const relDiff = c => Math.min(...c.methods.map(m => Math.abs(m.total - our100))) / Math.max(our100, 0.3);
  const top = scored[0];
  if (top.s < MIN_SCORE) return { cand: top.c, score: top.s, how: 'low-score', alt: scored[1] && scored[1].c.name };
  // 名前の近い候補が複数あるときは、当DBの食物繊維の総量に合うもの（±15%）を選ぶ（例:「にんじん 根 皮つき 生」と「にんじん 根 皮 生」）
  const pool = scored.filter(x => x.tok && x.s >= Math.max(MIN_SCORE, top.s - 0.3));
  const fits = pool.filter(x => relDiff(x.c) <= 0.15);
  if (fits.length === 1 || (fits.length > 1 && fits[0].s - fits[1].s >= MARGIN)) { const f = fits[0]; return { cand: f.c, score: f.s, how: f === top ? 'auto' : 'auto(総量で選択)' }; }
  if (fits.length > 1) return { cand: fits[0].c, score: fits[0].s, how: 'ambiguous', alt: fits[1].c.name };
  const second = scored[1];
  if (second && top.s - second.s < MARGIN) return { cand: top.c, score: top.s, how: 'ambiguous', alt: second.c.name };
  return { cand: top.c, score: top.s, how: 'auto' };
}

// ── 実行 ──
function main() {
  if (!xlsxPath) { console.error('使い方: node scripts/import-mext-fiber.js <炭水化物成分表編.xlsx> [--apply]\n詳細はファイル先頭のコメントを参照してください'); process.exit(1); }
  let sheets = loadRows(xlsxPath);
  if (sheets.some(s => s.name === '表全体')) sheets = sheets.filter(s => s.name === '表全体');   // 「表全体」は各食品群のシートの合計なので、重複して読まない
  let mext = []; sheets.forEach(s => { mext = mext.concat(extractFoods(s)); });
  { const seen = new Set(); mext = mext.filter(f => { const k = f.name + JSON.stringify(f.methods); if (seen.has(k)) return false; seen.add(k); return true; }); }
  if (!mext.length) { console.error('水溶性/不溶性の食物繊維の列を持つ表が見つかりませんでした。\n八訂の「本表」ではなく「炭水化物成分表編」のExcelを指定してください。'); process.exit(2); }
  console.log(`成分表から ${mext.length} 食品の水溶性/不溶性を読み込みました（シート: ${[...new Set(mext.map(m => m.sheet))].join(', ')}）`);
  let manual = {}; const mp = path.join(__dirname, 'mext-name-map.json'); if (fs.existsSync(mp)) manual = JSON.parse(fs.readFileSync(mp, 'utf8'));
  const { src, items } = loadDb(DB_PATH);
  const report = [['状態', '食品名', '成分表の食品名', 'スコア', '水溶性(100g)', '不溶性(100g)', '総量(100g)', '旧fibS', '旧fibI', '新fibS', '新fibI', '備考']];
  const updates = new Map(); let nOk = 0, nSkip = 0, nAmb = 0, nNo = 0;
  items.forEach(it => {
    if (!(it.fiber > 0) || it.fibS === undefined) return;                 // 内訳なし（藻類など）や食物繊維0は対象外
    if (!it.fibEst && !INCLUDE_EXACT) { nSkip++; return; }                // 既に実測値のものは触らない
    const m = match(it, mext, manual);
    if (!m.cand || m.how === 'low-score' || m.how === 'ambiguous' || m.how === 'manual-miss') {
      const st = m.how === 'ambiguous' ? '曖昧' : (m.cand ? '低スコア' : '候補なし'); (m.how === 'ambiguous' ? nAmb++ : nNo++);
      report.push([st, it.name, m.cand ? m.cand.name : '', m.score ? m.score.toFixed(2) : '', '', '', '', it.fibS, it.fibI, '', '', m.alt ? '次点: ' + m.alt : (m.how === 'manual-miss' ? '手動対応表の名前が成分表に見つかりません' : '')]); return;
    }
    const per = it.per || 100, our100 = it.fiber / per * 100;
    // 測定法が複数ある食品は、当DBの食物繊維の総量に最も近い測定法の値を使う（同程度ならプロスキー変法＝従来の本表の方法を優先）
    const pick = m.cand.methods.slice().sort((a, b) => Math.abs(a.total - our100) - Math.abs(b.total - our100) || (a.type === 'プロスキー変法' ? -1 : 1))[0];
    const c = { name: m.cand.name, soluble: pick.soluble, insoluble: pick.insoluble, total: pick.total, type: pick.type, est: pick.est }, sum = c.soluble + c.insoluble;
    if (!(sum > 0)) { nNo++; report.push(['除外', it.name, c.name, m.score.toFixed(2), r2(c.soluble), r2(c.insoluble), r2(c.total), it.fibS, it.fibI, '', '', '成分表の内訳が0']); return; }
    const consistent = !RATIO_ONLY && c.total > 0 && Math.abs(c.total - our100) / Math.max(c.total, 0.01) <= 0.15;
    const ratioTot = c.total > 0 && our100 > 0 ? c.total / our100 : 1;
    if (!consistent && !FORCE_RATIO && (ratioTot < 0.67 || ratioTot > 1.5)) { // 別の測定法・別の食品の値の可能性が高いので、自動では反映しない
      nNo++; report.push(['要確認', it.name, c.name, m.score.toFixed(2), r2(c.soluble), r2(c.insoluble), r2(c.total), it.fibS, it.fibI, '', '', `総量が大きく食い違う（成分表${r2(c.total)} / 当DB${r2(our100)}）。同じ食品・同じ測定法か確認し、確かなら --force-ratio か手動対応表で`]); return;
    }
    let fibS, fibI, note;
    if (consistent) { fibS = c.soluble * per / 100; fibI = it.fiber - fibS; note = `成分表の値を換算（${c.type}${c.est ? '・成分表上の推計値' : ''}）`; }
    else { fibS = it.fiber * c.soluble / sum; fibI = it.fiber - fibS; note = `比率のみ採用（${c.type}・成分表総量${c.total}と当DBの${r2(our100)}が不一致）`; }
    fibS = r2(fibS); fibI = r2(Math.max(0, it.fiber - fibS));
    updates.set(it.name, { fibS, fibI, ratioOnly: !consistent }); nOk++;
    report.push(['反映', it.name, c.name, m.score.toFixed(2), r2(c.soluble), r2(c.insoluble), r2(c.total), it.fibS, it.fibI, fibS, fibI, note]);
  });
  const outDir = path.join(__dirname, 'out'); fs.mkdirSync(outDir, { recursive: true });
  const repPath = path.join(outDir, 'mext-fiber-report.csv');
  fs.writeFileSync(repPath, '\uFEFF' + report.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n'));
  console.log(`反映できる: ${nOk}件 / 曖昧: ${nAmb}件 / 候補なし・低スコア: ${nNo}件 / 既に実測値でスキップ: ${nSkip}件`);
  console.log(`レポート: ${path.relative(process.cwd(), repPath)}  ← 曖昧・低スコアは scripts/mext-name-map.json に対応を書いて再実行できます`);
  if (!APPLY) { console.log('（ドライランです。foods-db.js は変更していません。--apply で反映します）'); return; }
  let out = src, applied = 0;
  out = out.split('\n').map(line => {
    const m = line.match(/^\s*\{name:'([^']*)'/); if (!m || !updates.has(m[1])) return line;
    const u = updates.get(m[1]);
    const nl = line.replace(/fibS:[\d.]+,fibI:[\d.]+,(fibEst:1,)?/, `fibS:${u.fibS},fibI:${u.fibI},${u.ratioOnly ? 'fibEst:1,' : ''}`);   // 総量が一致した食品は実測値扱い（fibEstを外す）。比率のみ採用は推定扱いのまま
    if (nl !== line) applied++; return nl;
  }).join('\n');
  fs.copyFileSync(DB_PATH, DB_PATH + '.bak'); fs.writeFileSync(DB_PATH, out);
  console.log(`foods-db.js を更新しました（${applied}行）。バックアップ: ${path.basename(DB_PATH)}.bak`);
}
function r2(v) { return Math.round(v * 100) / 100; }
if (require.main === module) main();
module.exports = { norm, stripTags, num, parseOurName, bestFor, match, score, loadDb, detectTable, extractFoods };
