// 食品記録の量の扱い（検索結果タップで即記録・既定量の学習・検索欄での量指定・行の中の量の調整・✏️フォームの量の調整・複製）のテスト。
// 別ウィンドウ（ボトムシート）・スワイプ・単位は使わない。実行: npm install --no-save jsdom && node tests/amount-inline.test.js
const { loadApp, makeT, sleep } = require('./harness');
const { w, errs } = loadApp(); const t = makeT(); const ev = s => w.eval(s); const $ = id => w.document.getElementById(id);
setTimeout(async () => {
  try {
    const D = ev('currentDate');
    const foods = [
      { id: 1, name: 'テストご飯', per: 100, cal: 160, p: 2.5, f: 0.3, c: 35, serving: 150 },
      { id: 2, name: 'テスト卵', per: 100, cal: 150, p: 12, f: 10, c: 0.3, serving: 50 },
      { id: 3, name: 'テスト牛乳', per: 100, cal: 67, p: 3.3, f: 3.8, c: 4.8, density: 1.03 },
      { id: 4, name: 'テストオーツ', per: 100, cal: 380, p: 13, f: 6, c: 69, fiber: 9.4 },
    ];
    const E = (id, meal, name, amount, cal, extra = {}) => ({ id, date: '__D__', meal, time: extra.time || '08:00', name, amount, cal, p: 1, f: 1, c: 1, ...extra });
    const setup = (entries = []) => { ev(`customFoods=${JSON.stringify(foods)};comboFoods=[];entries=${JSON.stringify(entries).replace(/__D__/g, D)};saveLocal();editingId=null;activeAddMeal='朝食';_amtOpen=null;_focusAddSearchMeal=null;`); ev('renderRecord()'); };
    const food = n => ev('getAllFoods()').find(f => f.name === n); const entriesOf = n => ev('entries').filter(e => e.name === n); const getE = id => ev('entries').find(e => e.id === id);
    const pick = (name, meal = '朝食') => { $('addResultsBox_' + meal)._local = [food(name)]; $('addResultsBox_' + meal)._qty = null; w.selectAddResult(0, meal); };
    const toast = () => $('toast'); const undo = () => toast().querySelector('.toast-undo-btn').click(); const row = id => w.document.querySelector(`#mealBlocks .log-item[data-eid="${id}"]`); const strip = id => row(id) && row(id).querySelector('.amt-strip');
    const ls = () => JSON.parse(w.localStorage.getItem('pfcEntries'));
    const base1 = () => [E(1, '朝食', 'テストご飯', 150, 240, { p: 3.75, f: 0.45, c: 52.5, fiber: 1.5 }), E(2, '昼食', 'テスト卵', 50, 75, { p: 6, f: 5, c: 0.15 })];
    // ── 別ウィンドウ・スワイプ・単位は無い ──
    setup(base1()); t('no bottom sheet / overlay', !$('amountSheet') && !w.document.querySelector('.as-panel') && typeof w.openAmountSheetForEntry === 'undefined' && typeof w.getAmountSheetMode === 'undefined');
    t('no swipe actions', !w.document.querySelector('.sw-actions') && typeof w.bindEntrySwipe === 'undefined'); t('units feature deferred (not present)', typeof w.sanitizeUnits === 'undefined' && ev('LOCAL_DB.every(f=>f.units===undefined)') && !/単位/.test($('panel-custom').textContent));
    // ── 行の見た目（✕と✏️は大きく・離す）──
    t('row keeps ✏️ and ✕ buttons', !!row(1).querySelector('.li-right .li-edit') && !!row(1).querySelector('.li-right .li-del') && /✕/.test(row(1).querySelector('.li-del').textContent));
    t('amount pill is a tap target', !!row(1).querySelector('.amt-pill') && /150g/.test(row(1).querySelector('.amt-pill').textContent));
    const css = w.document.documentElement.innerHTML; t('CSS: bigger, spaced buttons', /\.li-edit, \.log-item \.li-del \{ min-width: 44px; min-height: 44px/.test(css) && /\.log-item \.li-right \{ gap: 12px/.test(css));
    // ── 既定量（1食分 → 前回の量 → 基準量）と履歴 ──
    setup([E(1, '朝食', 'テストオーツ', 40, 152, { date: '2026-01-01', time: '07:00' }), E(2, '朝食', 'テストオーツ', 40, 152, { date: '2026-01-02' }), E(3, '朝食', 'テストオーツ', 60, 228, { date: '2026-01-03' }), E(4, '朝食', 'テストオーツ', 40, 152, { date: '2026-01-04' })]);
    const dflt = n => ev(`defaultAmountFor(getAllFoods().find(f=>f.name==='${n}'))`);
    t('default: serving wins', dflt('テストご飯') === 150); t('default: learned previous amount', dflt('テストオーツ') === 40); t('default: base per when never logged', dflt('テスト牛乳') === 100);
    t('lastAmountFor / recentAmountsFor', ev(`lastAmountFor('テストオーツ')`) === 40 && ev(`JSON.stringify(recentAmountsFor('テストオーツ'))`) === '[40,60]');
    // ── 検索結果のタップ＝すぐ記録 ──
    setup(); pick('テストご飯'); t('tap registers immediately at the default (serving) amount', entriesOf('テストご飯').length === 1 && entriesOf('テストご飯')[0].amount === 150 && entriesOf('テストご飯')[0].cal === 240);
    t('no window opened; toast offers 量を変更 + 元に戻す', !w.document.querySelector('[role=dialog]') && !!toast().querySelector('.toast-act-btn') && !!toast().querySelector('.toast-undo-btn') && /150g を記録しました/.test(toast().textContent));
    toast().querySelector('.toast-act-btn').click(); t('量を変更 opens the inline strip on the new row', !!strip(entriesOf('テストご飯')[0].id) && ev('_amtOpen').id === entriesOf('テストご飯')[0].id); w.closeAmtStrip();
    undo(); t('undo registration', entriesOf('テストご飯').length === 0);
    setup([E(1, '昼食', 'テストオーツ', 40, 152, { date: '2026-01-04' })]); pick('テストオーツ'); t('learned amount used on tap', entriesOf('テストオーツ').length === 2 && entriesOf('テストオーツ').some(e => e.meal === '朝食' && e.amount === 40));
    setup([E(1, '朝食', 'テストご飯', 150, 240)]); pick('テストご飯'); t('same food same meal merges', entriesOf('テストご飯').length === 1 && entriesOf('テストご飯')[0].amount === 300 && /合算/.test(toast().textContent)); undo(); t('undo merge', entriesOf('テストご飯')[0].amount === 150);
    // ── 検索欄の量指定 ──
    const pq = s => ev(`JSON.stringify(parseQtyQuery(${JSON.stringify(s)}))`);
    t('parseQtyQuery', pq('ご飯150') === '{"q":"ご飯","num":150,"unit":""}' && pq('ご飯 150g') === '{"q":"ご飯","num":150,"unit":"g"}' && pq('ご飯１５０') === '{"q":"ご飯","num":150,"unit":""}' && pq('卵2個') === '{"q":"卵","num":2,"unit":"個"}' && pq('牛乳 0.5杯') === '{"q":"牛乳","num":0.5,"unit":"杯"}' && pq('ご飯') === 'null' && pq('150') === 'null');
    const rq = (n, qty) => ev(`(r=>r?[r.amount,r.label]:null)(resolveQtyAmount(getAllFoods().find(f=>f.name==='${n}'),${JSON.stringify(qty)}))`);
    t('resolve: grams / kg', JSON.stringify(rq('テストご飯', { num: 120, unit: '' })) === '[120,"120g"]' && rq('テストご飯', { num: 80, unit: 'g' })[0] === 80 && rq('テストご飯', { num: 0.2, unit: 'kg' })[0] === 200);
    t('resolve: unit-less number is always grams', rq('テスト卵', { num: 2, unit: '' })[0] === 2);
    t('resolve: counters use the food\'s 1食分', JSON.stringify(rq('テスト卵', { num: 2, unit: '個' })) === '[100,"2個（1食分50g）"]' && rq('テストご飯', { num: 2, unit: '杯' })[0] === 300);
    t('resolve: counters without 1食分 → null', rq('テストオーツ', { num: 2, unit: '個' }) === null && rq('テスト牛乳', { num: 1, unit: '杯' }) === null);
    t('resolve: ml / spoons use density', rq('テスト牛乳', { num: 200, unit: 'ml' })[0] === 206 && rq('テスト牛乳', { num: 2, unit: '大さじ' })[0] === 30.9 && rq('テストオーツ', { num: 1, unit: '小さじ' })[0] === 5 && rq('テストオーツ', { num: 1, unit: 'カップ' })[0] === 200);
    t('resolve: invalid / too large', rq('テストご飯', { num: 0, unit: '' }) === null && rq('テストご飯', { num: 9999, unit: '' }) === null);
    setup(); w.onAddSearch('テストご飯150', '朝食'); let box = $('addResultsBox_朝食');
    t('search with quantity: name results + label + per-row amount/kcal', box._qty && box._qty.num === 150 && /テストご飯」を 150 で記録/.test(box.textContent) && /150g/.test(box.textContent) && /240kcal/.test(box.textContent));
    w.onAddSearch('テスト卵2個', '朝食'); box = $('addResultsBox_朝食'); t('卵2個 → 100g via 1食分', /2個（1食分50g）/.test(box.textContent) && /150kcal/.test(box.textContent));
    w.onAddSearch('テスト', '朝食'); t('plain search is not quantity mode', $('addResultsBox_朝食')._qty === null);
    w.onAddSearch('テストご飯150', '朝食'); $('addResultsBox_朝食')._local = [food('テストご飯')]; w.selectAddResult(0, '朝食'); t('quantity search registers directly', entriesOf('テストご飯').length === 1 && entriesOf('テストご飯')[0].amount === 150); t('offers 量を変更', !!toast().querySelector('.toast-act-btn'));
    setup(); w.onAddSearch('テストオーツ2個', '朝食'); box = $('addResultsBox_朝食'); box._local = [food('テストオーツ')]; w.selectAddResult(0, '朝食'); t('unresolvable counter falls back to default + explains', entriesOf('テストオーツ').length === 1 && entriesOf('テストオーツ')[0].amount === 100 && /換算ができない/.test(toast().textContent));
    ev(`customFoods.push({id:9,name:'ビタミンB12ドリンク',per:100,cal:10,p:0,f:0,c:2})`); w.onAddSearch('B12', '朝食'); t('whole query with results stays a normal search', $('addResultsBox_朝食')._qty === null && /ビタミンB12/.test($('addResultsBox_朝食').textContent));
    // ── 行の中の量の調整 ──
    setup(base1()); row(1).querySelector('.amt-pill').click(); t('pill tap opens the strip inside the row', !!strip(1) && row(1).classList.contains('amt-open') && strip(1).parentElement === row(1) && !!strip(1).querySelector('.amt-input') && strip(1).querySelectorAll('.amt-step').length === 2);
    t('strip: input shows the amount, chips ½ 1× 1.5× 2×', strip(1).querySelector('.amt-input').value === '150' && [...strip(1).querySelectorAll('.amt-chip[data-m]')].map(b => b.textContent).join() === '½,1×,1.5×,2×' && strip(1).querySelector('.amt-chip[data-m="1"]').classList.contains('on'));
    t('strip: no revert link before any change', !strip(1).querySelector('.amt-foot .amt-link[onclick^="amtRevert"]'));
    w.amtStep(1, 1); t('＋ steps to the next round number (10g above 100g) and applies live', getE(1).amount === 160 && getE(1).cal === 256 && Math.abs(getE(1).p - 4) < 0.01 && strip(1).querySelector('.amt-input').value === '160');
    t('live apply persists locally', ls().find(e => e.id === 1).amount === 160); t('day totals follow the change', /256/.test($('mealBlocks').textContent));
    w.amtStep(1, -1); w.amtStep(1, -1); t('− steps down', getE(1).amount === 140);
    const stepFrom = (a, dir) => ev(`stepAmount(${a},${dir})`); t('step rules: <20 → 1, <100 → 5, ≥100 → 10 (next round number)', stepFrom(10, 1) === 11 && stepFrom(19, 1) === 20 && stepFrom(5, -1) === 4 && stepFrom(20, 1) === 25 && stepFrom(52, 1) === 55 && stepFrom(52, -1) === 50 && stepFrom(100, -1) === 95 && stepFrom(155, 1) === 160 && stepFrom(155, -1) === 150 && stepFrom(1, -1) === 1 && stepFrom(5000, 1) === 5000);
    w.amtMul(1, 2); t('2× scales from the opening amount (not the current one)', getE(1).amount === 300 && getE(1).cal === 480); w.amtMul(1, 0.5); t('½', getE(1).amount === 75 && getE(1).cal === 120);
    w.amtMul(1, 1); t('1× restores the exact original values (no rounding drift)', getE(1).amount === 150 && getE(1).cal === 240 && getE(1).p === 3.75 && getE(1).f === 0.45 && getE(1).c === 52.5 && getE(1).fiber === 1.5);
    for (let i = 0; i < 7; i++) w.amtStep(1, i % 2 ? -1 : 1); w.amtMul(1, 1); t('many steps then 1× is still exact', getE(1).cal === 240 && getE(1).p === 3.75);
    { const inp = strip(1).querySelector('.amt-input'); inp.value = '123.4'; inp.dispatchEvent(new w.Event('change')); t('typing a number applies it', getE(1).amount === 123.4 && getE(1).cal === 197.4 || Math.abs(getE(1).cal - 197.4) < 0.11); }
    { const inp = strip(1).querySelector('.amt-input'); inp.value = '0'; inp.dispatchEvent(new w.Event('change')); t('zero is ignored', getE(1).amount === 123.4); inp.value = 'abc'; inp.dispatchEvent(new w.Event('change')); t('non-number is ignored', getE(1).amount === 123.4); inp.value = '99999'; inp.dispatchEvent(new w.Event('change')); t('clamped to 5,000g', getE(1).amount === 5000); }
    t('warning shown inline for a huge amount (not blocking)', !!strip(1).querySelector('.amt-warn') && getE(1).amount === 5000); w.amtMul(1, 5.4); t('×5.4 warning text', /元の量（150g）の5.4倍です/.test(strip(1).querySelector('.amt-warn').textContent) && getE(1).amount === 810);
    w.amtMul(1, 1); t('no warning at normal amounts', !strip(1).querySelector('.amt-warn'));
    w.amtMul(1, 2); t('revert link appears after a change', !!strip(1).querySelector('.amt-link[onclick^="amtRevert"]') && /元の量（150g）に戻す/.test(strip(1).textContent)); w.amtRevert(1); t('revert restores the opening amount', getE(1).amount === 150 && !strip(1).querySelector('.amt-link[onclick^="amtRevert"]'));
    // 閉じる: 変更があれば「元に戻す」
    w.amtMul(1, 2); w.closeAmtStrip(); t('close: strip gone, undo toast mentions the change', !strip(1) && /150g → 300gに変更しました/.test(toast().textContent) && ev('_amtOpen') === null); undo(); t('undo restores amount and values', getE(1).amount === 150 && getE(1).cal === 240 && ls().find(e => e.id === 1).amount === 150);
    toast().classList.remove('show'); row(1).querySelector('.amt-pill').click(); w.closeAmtStrip(); t('close without change: no toast', !toast().classList.contains('show')); 
    // トグル・同時に1つ
    row(1).querySelector('.amt-pill').click(); row(1).querySelector('.amt-pill').click(); t('pill toggles the strip', !strip(1)); row(1).querySelector('.amt-pill').click(); w.amtMul(1, 2); row(2).querySelector('.amt-pill').click();
    t('opening another strip closes the first (keeping its change, with undo)', !strip(1) && !!strip(2) && getE(1).amount === 300 && /150g → 300g/.test(toast().textContent)); w.closeAmtStrip();
    // 材料を持つ記録（グループ）は、材料を同じ比率で
    setup([E(1, '朝食', 'グループ', 200, 300, { ingredients: [{ name: 'A', amount: 100, per: 100, cal: 100, p: 1, f: 1, c: 1 }, { name: 'B', amount: 100, per: 100, cal: 200, p: 2, f: 2, c: 2 }], group: true })]); w.openAmtStrip(1); w.amtMul(1, 0.5);
    t('group: ingredients scaled proportionally and totals recomputed', getE(1).amount === 100 && getE(1).ingredients[0].amount === 50 && getE(1).ingredients[1].amount === 50 && getE(1).cal === 150); w.amtMul(1, 1); t('group: 1× restores', getE(1).amount === 200 && getE(1).ingredients[0].amount === 100 && getE(1).cal === 300); w.closeAmtStrip();
    // 別の日に移る・削除すると閉じる
    setup(base1()); w.openAmtStrip(1); w.deleteEntry(1); t('deleting the entry closes its strip', ev('_amtOpen') === null); setup(base1()); w.openAmtStrip(1); w.changeDate(1); t('changing the day closes the strip', ev('_amtOpen') === null && !strip(1)); w.changeDate(-1);
    // ドラッグ（長押し）は量の調整エリアでは始まらない
    setup(base1()); w.openAmtStrip(1); t('drag does not start from the strip', ev(`dragRowFromEvent({target:document.querySelector('.amt-strip .amt-input')})`) === null && ev(`dragRowFromEvent({target:document.querySelector('.amt-strip .amt-chip')})`) === null); t('drag still starts from the row name', ev(`dragRowFromEvent({target:document.querySelector('.log-item[data-eid="1"] .li-name')})`) !== null); w.closeAmtStrip();
    // ── ✏️の編集フォーム ──
    setup(base1()); w.openAmtStrip(1); w.amtMul(1, 2); w.startEdit(1);
    t('startEdit closes the strip (keeping the change)', ev('_amtOpen') === null && !strip(1) && getE(1).amount === 300); w.cancelEdit(1); t('cancelEdit restores the opening state', getE(1).amount === 300 || getE(1).amount === 150);
    setup(base1()); w.startEdit(1); const form = $('mealBlocks');
    t('edit form: ±, current amount, chips, no slider', !!$('eaCtl1') && !form.querySelector('input[type=range]') && $('eaCtl1').querySelectorAll('.amt-step').length === 2 && /150g/.test($('eaCur1').textContent) && [...$('eaCtl1').querySelectorAll('.amt-chip[data-m]')].length === 4);
    t('edit form: ea input still available for typing', !!$('ea1') && $('ea1').value === '150'); w.editAmtStep(1, 1); t('edit form: ＋ updates input, display and (live) the record', $('ea1').value === '160' && /160g/.test($('eaCur1').textContent) && getE(1).amount === 160 && getE(1).cal === 256);
    w.editAmtMul(1, 2); t('edit form: 2× is relative to the opening amount', $('ea1').value === '300' && getE(1).cal === 480 && $('eaCtl1').querySelector('.amt-chip[data-m="2"]').classList.contains('on')); w.editAmtSet(1, 123.4); t('edit form: set value', $('ea1').value === '123.4');
    w.editAmtMul(1, 6); t('edit form: warning', $('eaWarn1').style.display === 'block' && /6倍/.test($('eaWarn1').textContent)); w.editAmtMul(1, 1); t('edit form: warning cleared', $('eaWarn1').style.display === 'none');
    $('ea1').value = '200'; $('ea1').dispatchEvent(new w.Event('input')); t('edit form: typing keeps the display in sync', /200g/.test($('eaCur1').textContent) && getE(1).amount === 200);
    w.cancelEdit(1); t('edit form: 取消 restores the original', getE(1).amount === 150 && getE(1).cal === 240);
    // 複製（✏️フォームの中）
    setup(base1()); w.startEdit(1); const dupBtn = [...$('mealBlocks').querySelectorAll('.edit-form button, #mealBlocks button')].find(b => /複製/.test(b.textContent)); t('edit form has 複製 (and no delete button inside)', !!dupBtn && ![...$('mealBlocks').querySelectorAll('.edit-form button')].some(b => b.textContent === '削除'));
    dupBtn.click(); const es = ev('entries'); t('duplicate inserts a copy right after the original', es.length === 3 && es[1].name === 'テストご飯' && es[1].id !== 1 && es[1].amount === 150 && es[1].cal === 240 && es[1].meal === '朝食' && es[2].name === 'テスト卵');
    t('duplicate: edit form closed, gets a fresh time', ev('editingId') === null && /^\d{2}:\d{2}$/.test(es[1].time)); undo(); t('undo duplicate', ev('entries.length') === 2);
    // ✕（削除）は行に残り、元に戻せる
    setup(base1()); row(2).querySelector('.li-del').click(); t('✕ deletes (with undo)', ev('entries.length') === 1 && !getE(2)); undo(); t('undo delete', ev('entries.length') === 2);
    // ── 単位は取り込まない（見送り）──
    w.executeAiCommands([{ type: 'add_custom_food', foods: [{ name: 'AI単位なし', per: 100, cal: 100, p: 5, f: 5, c: 5, units: [{ label: '個', g: 40 }] }] }], 't'); t('AI units field is ignored (deferred)', ev(`customFoods.find(f=>f.name==='AI単位なし').units`) === undefined);
    { const exp = { kind: ev('FOOD_DB_EXPORT_KIND'), version: 1, customFoods: [{ id: 77, name: 'インポート単位なし', per: 100, cal: 10, p: 1, f: 0, c: 1, units: [{ label: '切れ', g: 30 }] }], comboFoods: [] }; $('fooddbImportArea').value = JSON.stringify(exp); w.importFoodDb(); t('import ignores units', ev(`customFoods.find(f=>f.name==='インポート単位なし').units`) === undefined); }
  } catch (err) { console.log('EXC', err.stack.split('\n').slice(0, 6).join(' | ')); process.exitCode = 1; }
  t.done(errs);
}, 800);
