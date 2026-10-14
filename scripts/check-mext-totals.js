#!/usr/bin/env node
/**
 * 日本食品標準成分表（八訂）「本表」のExcelと、foods-db.js の食物繊維総量(fiber)を突き合わせて、食い違いを一覧にする（確認専用。foods-db.js は変更しません）
 *
 *   npm install --no-save xlsx
 *   node scripts/check-mext-totals.js <本表.xlsx> [--db <foods-db.js>]   → scripts/out/mext-total-check.csv
 *
 * ※ 本表には食物繊維の総量しかありません。水溶性/不溶性の差し替えには「炭水化物成分表編」のExcelと
 *    scripts/import-mext-fiber.js を使います。食品名の照合は自動の曖昧照合のため、判定が「要確認」のものは別の食品と照合された可能性があります。
 */
const fs = require('fs'), path = require('path');
const M = require('./import-mext-fiber.js');
const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const file = args.find(a => /\.(xlsx|xls)$/i.test(a));
if (!file) { console.error('使い方: node scripts/check-mext-totals.js <本表.xlsx>'); process.exit(1); }
let XLSX; try { XLSX = require('xlsx'); } catch (e) { console.error('xlsx パッケージが必要です: npm install --no-save xlsx'); process.exit(1); }
const wb = XLSX.readFile(file), sheet = wb.Sheets['表全体'] || wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
// 見出し行から「食物繊維総量」「食品名」の列を探す（列位置は版によって変わるため）
let nameCol = -1, fibCol = -1, codeCol = -1, noteCol = -1;
rows.slice(0, 10).forEach(r => (r || []).forEach((c, j) => { const t = String(c || '').replace(/[\s　]/g, ''); if (t === '食品名') nameCol = j; if (/食物繊維総量/.test(t)) fibCol = j; if (t === '食品番号') codeCol = j; if (t === '備考') noteCol = j; }));
if (nameCol < 0 || fibCol < 0) { console.error('「食品名」「食物繊維総量」の列が見つかりませんでした。八訂の本表のExcelを指定してください'); process.exit(2); }
const mext = rows.filter(r => r && r[nameCol] && r[codeCol] && /^\d{5}$/.test(String(r[codeCol]))).map(r => ({
  name: M.stripTags(String(r[nameCol]).replace(/[\r\n]/g, '')).replace(/　/g, ' ').replace(/\s+/g, ' ').trim(), code: r[codeCol], fiber: M.num(r[fibCol]), aoac: /AOAC2011\.25/.test(String(r[noteCol] || '')) }));
const { items } = M.loadDb(path.resolve(opt('--db', path.join(__dirname, '..', 'foods-db.js'))));
const out = [['判定', '食品名', '成分表の食品名', '食品番号', '当DB(100gあたり)', '本表(100g)', '差', '備考']]; let ok = 0, ng = 0, rev = 0;
items.forEach(it => {
  if (!(it.fiber > 0)) return;
  const sc = M.bestFor(M.parseOurName(it.name), mext.map(m => ({ name: m.name, m }))); if (!sc.length) return;
  const [a, b] = sc; if (a.s < 0.55 || (b && a.s - b.s < 0.08)) return;           // 確実に1つに絞れたものだけ
  const m = a.c.m; if (m.fiber == null) return;
  const mine = it.fiber / (it.per || 100) * 100, d = mine - m.fiber, tol = Math.max(0.3, 0.15 * m.fiber);
  const big = Math.abs(d) > Math.max(0.5, 0.25 * m.fiber), st = Math.abs(d) <= tol ? '一致' : (big ? '要確認' : '差あり');
  if (st === '一致') ok++; else if (st === '差あり') ng++; else rev++;
  out.push([st, it.name, m.name, m.code, Math.round(mine * 100) / 100, m.fiber, Math.round(d * 100) / 100, m.aoac ? '本表はAOAC2011.25法' : '']);
});
out.sort((x, y) => (x[0] === '一致') - (y[0] === '一致') || Math.abs(y[6] || 0) - Math.abs(x[6] || 0));
const dir = path.join(__dirname, 'out'); fs.mkdirSync(dir, { recursive: true });
const csv = path.join(dir, 'mext-total-check.csv'); fs.writeFileSync(csv, '\uFEFF' + out.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n'));
console.log(`本表 ${mext.length}食品 / 照合できた食品 ${ok + ng + rev}件: 一致 ${ok}・差あり ${ng}・要確認 ${rev}\nレポート: ${path.relative(process.cwd(), csv)}`);
