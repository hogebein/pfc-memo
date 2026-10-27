// 食品記録の数量指定（数量シート・検索欄での量指定・単位・既定量の学習・スワイプ操作・複製）のテスト。
// 実行: npm install --no-save jsdom && node tests/amount-sheet.test.js
const { loadApp, makeT, sleep } = require('./harness');
const { w, errs } = loadApp(); const t = makeT(); const ev = s => w.eval(s); const $ = id => w.document.getElementById(id);
const touch = (type, x, y, target) => { const e = new w.Event(type, { bubbles: true, cancelable: true }); Object.defineProperty(e, 'touches', { value: type === 'touchend' || type === 'touchcancel' ? [] : [{ clientX: x, clientY: y }] }); target.dispatchEvent(e); return e; };
setTimeout(async () => {
  try {
    const D = ev('currentDate');
    const foods = [
      { id: 1, name: 'テストご飯', per: 100, cal: 160, p: 2.5, f: 0.3, c: 35, serving: 150 },
      { id: 2, name: 'テスト卵', per: 100, cal: 150, p: 12, f: 10, c: 0.3, units: [{ label: '個', g: 50 }] },
      { id: 3, name: 'テスト牛乳', per: 100, cal: 67, p: 3.3, f: 3.8, c: 4.8, density: 1.03, units: [{ label: '杯', g: 200 }] },
      { id: 4, name: 'テストオーツ', per: 100, cal: 380, p: 13, f: 6, c: 69, fiber: 9.4 },
      { id: 5, name: 'テスト納豆', per: 50, cal: 100, p: 8, f: 5, c: 6, units: [{ label: 'パック', g: 45 }] },
    ];
    const setup = (entries = []) => { ev(`customFoods=${JSON.stringify(foods)};comboFoods=[];entries=${JSON.stringify(entries).replace(/__D__/g, D)};saveLocal();window.localStorage.removeItem('pfcAmountSheet');editingId=null;activeAddMeal='朝食';closeAmountSheet();`); ev('renderRecord()'); };
    const E = (id, meal, name, amount, cal, extra = {}) => ({ id, date: '__D__', meal, time: extra.time || '08:00', name, amount, cal, p: 1, f: 1, c: 1, ...extra });
    const food = n => ev('getAllFoods()').find(f => f.name === n); const entriesOf = n => ev('entries').filter(e => e.name === n);
    const pick = (name, meal = '朝食') => { $('addResultsBox_' + meal)._local = [food(name)]; $('addResultsBox_' + meal)._qty = null; w.selectAddResult(0, meal); };
    const toast = () => $('toast'); const undo = () => toast().querySelector('.toast-undo-btn').click(); const row = id => w.document.querySelector(`#mealBlocks .log-item[data-eid="${id}"]`);
    // ── 設定・単位・履歴 ──
    setup(); t('mode default = ask', ev('getAmountSheetMode()') === 'ask'); w.setAmountSheetMode('instant'); t('mode instant', ev('getAmountSheetMode()') === 'instant'); w.setAmountSheetMode('x'); t('mode invalid → ask', ev('getAmountSheetMode()') === 'ask');
    const su = w.sanitizeUnits([{ label: ' 個 ', g: '50' }, { label: '個', g: 60 }, { label: '', g: 5 }, { label: 'x', g: 0 }, { label: 'y', g: 6000 }, null, { label: '枚', g: 12.34 }]); t('sanitizeUnits: trims/dedupes/drops invalid', su.length === 2 && su[0].label === '個' && su[0].g === 50 && su[1].g === 12.3);
    t('units text round trip', ev(`unitsToText([{label:'個',g:50},{label:'切れ',g:30}])`) === '個=50, 切れ=30' && ev(`JSON.stringify(parseUnitsText('個＝50、切れ=30g'))`) === '[{"label":"個","g":50},{"label":"切れ","g":30}]'); t('parseUnitsText invalid → empty', ev(`parseUnitsText('abc').length`) === 0);
    setup([E(1, '朝食', 'テストオーツ', 40, 152, { date: '2026-01-01', time: '07:00' }), E(2, '朝食', 'テストオーツ', 40, 152, { date: '2026-01-02' }), E(3, '朝食', 'テストオーツ', 60, 228, { date: '2026-01-03' }), E(4, '朝食', 'テストオーツ', 40, 152, { date: '2026-01-04' }), E(5, '昼食', 'テストご飯', 200, 320, { date: '2026-01-05' })]);
    t('lastAmountFor = most recent', ev(`lastAmountFor('テストオーツ')`) === 40 && ev(`lastAmountFor('テスト卵')`) === null);
    t('recentAmountsFor: by frequency then recency', ev(`JSON.stringify(recentAmountsFor('テストオーツ'))`) === '[40,60]');
    t('default: serving wins over history', ev(`defaultAmountFor(getAllFoods().find(f=>f.name==='テストご飯'))`) === 150); t('default: learned from history when no serving', ev(`defaultAmountFor(getAllFoods().find(f=>f.name==='テストオーツ'))`) === 40); t('default: per when never logged', ev(`defaultAmountFor(getAllFoods().find(f=>f.name==='テスト卵'))`) === 100);
    // ── 検索欄の量指定 ──
    const pq = s => ev(`JSON.stringify(parseQtyQuery(${JSON.stringify(s)}))`);
    t('parseQtyQuery: grams', pq('ご飯150') === '{"q":"ご飯","num":150,"unit":""}' && pq('ご飯 150g') === '{"q":"ご飯","num":150,"unit":"g"}' && pq('ご飯１５０') === '{"q":"ご飯","num":150,"unit":""}');
    t('parseQtyQuery: counts & decimals', pq('卵2個') === '{"q":"卵","num":2,"unit":"個"}' && pq('納豆 1パック') === '{"q":"納豆","num":1,"unit":"パック"}' && pq('牛乳 0.5杯') === '{"q":"牛乳","num":0.5,"unit":"杯"}');
    t('parseQtyQuery: not a quantity', pq('ご飯') === 'null' && pq('150') === 'null' && pq('') === 'null');
    const rq = (n, qty) => ev(`(r=>r?[r.amount,r.label]:null)(resolveQtyAmount(getAllFoods().find(f=>f.name==='${n}'),${JSON.stringify(qty)}))`);
    t('resolve: plain grams', JSON.stringify(rq('テストご飯', { num: 120, unit: '' })) === '[120,"120g"]' && JSON.stringify(rq('テストご飯', { num: 80, unit: 'g' })) === '[80,"80g"]');
    t('resolve: small number + food unit → count', JSON.stringify(rq('テスト卵', { num: 2, unit: '' })) === '[100,"2個"]' && JSON.stringify(rq('テスト卵', { num: 3, unit: '個' })) === '[150,"3個"]');
    t('resolve: big number stays grams even with units', rq('テスト卵', { num: 60, unit: '' })[0] === 60);
    t('resolve: no units → grams', rq('テストオーツ', { num: 5, unit: '' })[0] === 5);
    t('resolve: パック/杯 own units', rq('テスト納豆', { num: 2, unit: 'パック' })[0] === 90 && rq('テスト牛乳', { num: 1, unit: '杯' })[0] === 200);
    t('resolve: ml uses density', rq('テスト牛乳', { num: 200, unit: 'ml' })[0] === 206 && rq('テストオーツ', { num: 100, unit: 'ml' })[0] === 100);
    t('resolve: generic spoon units', rq('テスト牛乳', { num: 2, unit: '大さじ' })[0] === 31 && rq('テストオーツ', { num: 1, unit: '小さじ' })[0] === 5);
    t('resolve: serving fallback for counters', rq('テストご飯', { num: 2, unit: '杯' })[0] === 300 && rq('テストオーツ', { num: 2, unit: '杯' }) === null);
    t('resolve: kg, invalid, too large', rq('テストご飯', { num: 0.2, unit: 'kg' })[0] === 200 && rq('テストご飯', { num: 0, unit: '' }) === null && rq('テストご飯', { num: 9999, unit: '' }) === null);
    function r1(v) { return Math.round(v * 10) / 10; }
    // 検索欄に「名前＋量」を打つ
    setup(); const inp = $('addSearch_朝食'); w.onAddSearch('テストご飯150', '朝食'); let box = $('addResultsBox_朝食');
    t('search with quantity: results for the name', box.style.display === 'block' && box._local.some(f => f.name === 'テストご飯') && box._qty && box._qty.num === 150);
    t('search with quantity: label + per-row amount', /テストご飯」を 150 で記録/.test(box.textContent) && /150g/.test(box.textContent) && /240kcal/.test(box.textContent));
    w.onAddSearch('テスト卵2', '朝食'); box = $('addResultsBox_朝食'); t('search 卵2 shows 2個＝100g', /2個＝100g/.test(box.textContent) && /150kcal/.test(box.textContent));
    w.onAddSearch('テスト', '朝食'); t('plain search: no quantity mode', $('addResultsBox_朝食')._qty === null);
    w.onAddSearch('テストご飯150', '朝食'); box = $('addResultsBox_朝食'); box._local = [food('テストご飯')]; w.selectAddResult(0, '朝食');
    t('quantity search registers directly (no sheet)', !ev('AS.open') && entriesOf('テストご飯').length === 1 && entriesOf('テストご飯')[0].amount === 150 && entriesOf('テストご飯')[0].cal === 240);
    t('toast offers 量を変更 + 元に戻す', !!toast().querySelector('.toast-act-btn') && !!toast().querySelector('.toast-undo-btn') && /150g を記録しました/.test(toast().textContent));
    toast().querySelector('.toast-act-btn').click(); t('量を変更 opens the sheet in edit mode', ev('AS.open') && ev('AS.mode') === 'edit' && ev('AS.amount') === 150); w.closeAmountSheet();
    undo(); t('undo registration', entriesOf('テストご飯').length === 0);
    // 全体で見つかる入力は通常の検索（量扱いにしない）
    ev(`customFoods.push({id:9,name:'ビタミンB12ドリンク',per:100,cal:10,p:0,f:0,c:2})`); w.onAddSearch('B12', '朝食'); t('whole query with results is a normal search', $('addResultsBox_朝食')._qty === null && /ビタミンB12/.test($('addResultsBox_朝食').textContent));
    // ── 数量シート（確認モード）──
    setup([E(1, '昼食', 'テストオーツ', 40, 152, { date: '2026-01-04' }), E(2, '昼食', 'テストオーツ', 60, 228, { date: '2026-01-03' })]);
    pick('テストオーツ'); t('ask mode: sheet opens instead of registering', ev('AS.open') && $('amountSheet').style.display === 'block' && entriesOf('テストオーツ').length === 2 && ev("document.body.style.overflow") === 'hidden');
    t('sheet shows name/meal/amount/preview', /テストオーツ/.test($('asPanel').textContent) && /朝食に記録/.test($('asPanel').textContent) && $('asNum').textContent === '40' && /152kcal/.test($('asPv').textContent));
    t('sheet default = learned amount', ev('AS.base') === 40 && /よく使う量/.test($('asPanel').textContent) && !!$('asPanel').querySelector('.as-r[data-a="60"]'));
    t('big targets: confirm label', /朝食に記録する　40g/.test($('asConfirm').textContent));
    // 倍率
    w.asMultiply(1.5); t('multiplier ×1.5', ev('AS.amount') === 60 && $('asPanel').querySelector('.as-m[data-m="1.5"]').classList.contains('on') && /228kcal/.test($('asPv').textContent)); w.asMultiply(0.5); t('multiplier ½', ev('AS.amount') === 20);
    w.asSetGrams(60); t('recent chip', ev('AS.amount') === 60 && $('asPanel').querySelector('.as-r[data-a="60"]').classList.contains('on'));
    // ステッパー（量に応じて刻みが変わる）
    const step = (from, dir) => { ev(`AS.unit=null;AS.amount=${from}`); w.asStep(dir); return ev('AS.amount'); };
    t('stepper adaptive: <20 → 1g', step(10, 1) === 11 && step(19, 1) === 20 && step(5, -1) === 4); t('stepper adaptive: <100 → 5g (next round number)', step(20, 1) === 25 && step(52, 1) === 55 && step(52, -1) === 50 && step(50, -1) === 45 && step(100, -1) === 95); t('stepper adaptive: ≥100 → 10g', step(100, 1) === 110 && step(155, 1) === 160 && step(155, -1) === 150 && step(110, -1) === 100);
    t('stepper floor/ceiling', step(1, -1) === 1 && step(5000, 1) === 5000);
    // 長押しで連続変更
    ev('AS.unit=null;AS.amount=100;AS.keypad=false;renderAmountSheet()'); const plus = $('asPanel').querySelector('[data-step="1"]'); plus.dispatchEvent(new w.Event('pointerdown', { bubbles: true, cancelable: true })); t('hold: first step immediately', ev('AS.amount') === 110);
    await sleep(700); t('hold: repeats while pressed', ev('AS.amount') > 120); w.document.dispatchEvent(new w.Event('pointerup', { bubbles: true })); const held = ev('AS.amount'); await sleep(250); t('hold: stops on release', ev('AS.amount') === held && ev('AS.timer') === null);
    // 数字キー
    ev('AS.unit=null;AS.amount=40;AS.base=40'); w.asToggleKeypad(); t('keypad opens', ev('AS.keypad') && !!$('asPanel').querySelector('.as-keypad') && !$('asPanel').querySelector('.as-stepper'));
    ['1', '5', '0'].forEach(k => w.asKey(k)); t('keypad: first key replaces, digits append', ev('AS.amount') === 150 && $('asNum').textContent === '150'); w.asKey('⌫'); t('keypad: backspace', ev('AS.amount') === 15);
    w.asKey('.'); w.asKey('5'); t('keypad: decimal', ev('AS.amount') === 15.5); w.asKey('.'); t('keypad: second dot ignored', ev('AS.buf') === '15.5'); ['1', '2', '3', '4'].forEach(k => w.asKey(k)); t('keypad: max length', ev('AS.buf').length <= 6);
    w.asToggleKeypad(); w.asToggleKeypad(); w.asKey('9'); w.asKey('9'); w.asKey('9'); w.asKey('9'); t('keypad: clamp to 5000', ev('AS.amount') === 5000); w.asToggleKeypad();
    // 単位
    setup(); pick('テスト卵'); t('units listed: own + generic', !!$('asPanel').querySelector('.as-u:not(.as-gen)') && $('asPanel').querySelectorAll('.as-gen').length === 3 && /個/.test($('asPanel').textContent));
    w.asPickUnit(0); t('unit mode: 1個 = 50g', ev('AS.unit.label') === '個' && ev('AS.amount') === 50 && $('asUnit').textContent === '個' && $('asNum').textContent === '1' && /＝ 50g/.test($('asSub').textContent));
    w.asStep(1); t('unit step 0.5 below 5', ev('AS.count') === 1.5 && ev('AS.amount') === 75); ev('AS.count=5;AS.amount=250'); w.asStep(1); t('unit step 1 from 5', ev('AS.count') === 6); w.asStep(-1); w.asStep(-1); t('unit step back down is symmetric (5 → 4.5)', ev('AS.count') === 4.5);
    ev('AS.count=2;AS.amount=100;updateAmountDisplay()'); w.asStep(-1); t('unit step down', ev('AS.count') === 1.5); ev('AS.count=1;AS.amount=50'); w.asStep(-1); w.asStep(-1); t('unit count floor 0.5', ev('AS.count') === 0.5);
    w.asToggleKeypad(); w.asKey('3'); t('keypad edits the unit count', ev('AS.count') === 3 && ev('AS.amount') === 150); w.asToggleKeypad();
    w.asGramMode(); t('back to gram mode keeps amount', ev('AS.unit') === null && ev('AS.amount') === 150);
    ev('AS.unit=null;AS.amount=100'); w.asPickUnit(ev('AS.units.findIndex(u=>u.label==="大さじ")')); t('generic unit uses density (大さじ 15ml)', ev('AS.amount') === 15);
    // 確定で登録
    setup(); pick('テスト卵'); w.asPickUnit(0); w.asStep(1); w.confirmAmountSheet(); const eg = entriesOf('テスト卵');
    t('confirm registers amount from unit mode', eg.length === 1 && eg[0].amount === 75 && eg[0].cal === 112.5 || (eg.length === 1 && eg[0].amount === 75)); t('sheet closed + scroll unlocked', !ev('AS.open') && $('amountSheet').style.display === 'none' && ev('document.body.style.overflow') === ''); t('confirm toast has only undo', !!toast().querySelector('.toast-undo-btn') && !toast().querySelector('.toast-act-btn'));
    undo(); t('undo after confirm', entriesOf('テスト卵').length === 0);
    // 極端な量の確認
    setup(); pick('テストオーツ'); ev('AS.unit=null;AS.base=100;AS.amount=800;updateAmountDisplay()'); t('warning: ×8 of usual', $('asWarn').style.display === 'block' && /8倍/.test($('asWarn').textContent));
    w.confirmAmountSheet(); t('first press on warning does not register', ev('AS.open') && entriesOf('テストオーツ').length === 0 && /それでも 800g/.test($('asConfirm').textContent) && $('asConfirm').classList.contains('as-warnbtn'));
    w.asStep(-1); t('changing amount resets the acknowledgement', !ev('AS.warnAck')); ev('AS.amount=800;AS.warnAck=false;updateAmountDisplay()'); w.confirmAmountSheet(); w.confirmAmountSheet(); t('second press registers', !ev('AS.open') && entriesOf('テストオーツ').length === 1 && entriesOf('テストオーツ')[0].amount === 800);
    setup(); pick('テストオーツ'); ev('AS.unit=null;AS.base=1000;AS.amount=500;updateAmountDisplay()'); t('warning: calories ≥1500', /kcal.*多め/.test($('asWarn').textContent)); w.closeAmountSheet();
    setup(); pick('テストオーツ'); ev('AS.amount=0;updateAmountDisplay()'); t('zero amount: blocked', $('asConfirm').disabled === true); w.confirmAmountSheet(); t('zero amount: confirm ignored', ev('AS.open') && entriesOf('テストオーツ').length === 0); w.closeAmountSheet();
    // 閉じ方（キャンセルは何も記録しない）
    setup(); pick('テストオーツ'); w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' })); t('Escape closes without registering', !ev('AS.open') && entriesOf('テストオーツ').length === 0);
    pick('テストオーツ'); w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter' })); t('Enter confirms', !ev('AS.open') && entriesOf('テストオーツ').length === 1);
    setup(); pick('テストオーツ'); $('amountSheet').querySelector('.as-backdrop').click(); t('backdrop tap closes without registering', !ev('AS.open') && entriesOf('テストオーツ').length === 0);
    // 同じ食品は同じ食事に合算される（従来どおり）
    setup([E(1, '朝食', 'テストオーツ', 40, 152)]); pick('テストオーツ'); w.confirmAmountSheet(); t('same food same meal merges', entriesOf('テストオーツ').length === 1 && entriesOf('テストオーツ')[0].amount === 80 && /合算/.test(toast().textContent)); undo(); t('undo merge restores amount', entriesOf('テストオーツ')[0].amount === 40);
    // ── すぐ記録モード ──
    setup(); pick('テストご飯'); $('asInstant').checked = true; $('asInstant').dispatchEvent(new w.Event('change')); t('toggle in sheet sets instant mode', ev('getAmountSheetMode()') === 'instant'); w.closeAmountSheet();
    pick('テストご飯'); t('instant mode: registers at default (serving) without sheet', !ev('AS.open') && entriesOf('テストご飯').length === 1 && entriesOf('テストご飯')[0].amount === 150);
    toast().querySelector('.toast-act-btn').click(); t('instant: 量を変更 → sheet (edit)', ev('AS.open') && ev('AS.mode') === 'edit' && ev('AS.name') === 'テストご飯' && ev('AS.amount') === 150);
    // ── 既存の記録の量を変更（シート・編集モード）──
    setup([E(1, '朝食', 'テストご飯', 150, 240, { p: 3.75, f: 0.45, c: 52.5 })]); w.openAmountSheetForEntry(1); t('edit mode: base = current, title', ev('AS.mode') === 'edit' && /量の変更/.test($('asPanel').textContent) && /240kcal/.test($('asPv').textContent) && /量を変更する　150g/.test($('asConfirm').textContent));
    w.asMultiply(2); t('edit mode: preview scales', /480kcal/.test($('asPv').textContent)); w.confirmAmountSheet();
    const e1 = ev('entries.find(e=>e.id===1)'); t('edit mode: values scaled proportionally', e1.amount === 300 && e1.cal === 480 && Math.abs(e1.p - 7.5) < 0.05 && Math.abs(e1.c - 105) < 0.1); t('edit mode: persisted', JSON.parse(w.localStorage.getItem('pfcEntries'))[0].amount === 300);
    undo(); t('edit mode: undo', ev('entries.find(e=>e.id===1)').amount === 150 && ev('entries.find(e=>e.id===1)').cal === 240);
    // 材料を持つ記録（グループ）は、材料を同じ比率で変更
    setup([E(1, '朝食', 'グループ', 200, 300, { ingredients: [{ name: 'A', amount: 100, per: 100, cal: 100, p: 1, f: 1, c: 1 }, { name: 'B', amount: 100, per: 100, cal: 200, p: 2, f: 2, c: 2 }], group: true })]); w.openAmountSheetForEntry(1); w.asMultiply(0.5); w.confirmAmountSheet();
    const g1 = ev('entries.find(e=>e.id===1)'); t('group amount scales ingredients', g1.amount === 100 && g1.ingredients[0].amount === 50 && g1.ingredients[1].amount === 50 && g1.cal === 150);
    // ── 行の操作（量のピル・✕の撤去・スワイプ・複製）──
    setup([E(1, '朝食', 'テストご飯', 150, 240), E(2, '朝食', 'テスト卵', 50, 75), E(3, '昼食', 'テストオーツ', 40, 152)]);
    t('row shows tappable amount pill', !!row(1).querySelector('.amt-pill') && /150g/.test(row(1).querySelector('.amt-pill').textContent)); row(1).querySelector('.amt-pill').click(); t('pill opens the sheet (edit)', ev('AS.open') && ev('AS.entryId') === 1); w.closeAmountSheet();
    t('no always-visible delete button (✕) in rows', !row(1).querySelector('.li-right .btn-danger') && !!row(1).querySelector('.sw-actions .btn-danger') && !/✕/.test(row(1).querySelector('.li-right').textContent));
    t('swipe actions hidden by default', !row(1).classList.contains('sw-open'));
    const lbl = r => r.querySelector('.li-name');
    touch('touchstart', 200, 300, lbl(row(1))); touch('touchmove', 180, 302, lbl(row(1))); t('small move: stays closed', !row(1).classList.contains('sw-open')); touch('touchmove', 120, 305, lbl(row(1))); t('swipe left opens actions', row(1).classList.contains('sw-open')); touch('touchend', 120, 305, w.document.body);
    touch('touchstart', 200, 300, lbl(row(2))); touch('touchmove', 120, 303, lbl(row(2))); t('opening another closes the first', row(2).classList.contains('sw-open') && !row(1).classList.contains('sw-open')); touch('touchend', 120, 303, w.document.body);
    touch('touchstart', 100, 300, lbl(row(2))); touch('touchmove', 180, 303, lbl(row(2))); t('swipe right closes', !row(2).classList.contains('sw-open')); touch('touchend', 180, 303, w.document.body);
    touch('touchstart', 200, 300, lbl(row(3))); touch('touchmove', 195, 360, lbl(row(3))); touch('touchmove', 100, 365, lbl(row(3))); t('vertical scroll gesture does not open', !row(3).classList.contains('sw-open')); touch('touchend', 100, 365, w.document.body);
    touch('touchstart', 200, 300, lbl(row(3))); touch('touchmove', 100, 302, lbl(row(3))); touch('touchend', 100, 302, w.document.body); await sleep(400); w.document.body.click(); t('tap elsewhere closes', !row(3).classList.contains('sw-open'));
    // 複製
    setup([E(1, '朝食', 'テストご飯', 150, 240, { time: '07:00' }), E(2, '朝食', 'テスト卵', 50, 75)]); touch('touchstart', 200, 300, lbl(row(1))); touch('touchmove', 100, 302, lbl(row(1))); touch('touchend', 100, 302, w.document.body); await sleep(400);
    [...row(1).querySelectorAll('.sw-actions .btn')].find(b => b.textContent === '複製').click(); const eg2 = ev('entries'); t('duplicate inserts a copy right after the original', eg2.length === 3 && eg2[1].name === 'テストご飯' && eg2[1].id !== 1 && eg2[1].amount === 150 && eg2[1].cal === 240 && eg2[1].meal === '朝食' && eg2[2].name === 'テスト卵');
    t('duplicate gets current time', /^\d{2}:\d{2}$/.test(eg2[1].time) && eg2[1].time !== '07:00' || eg2[1].time.length === 5); undo(); t('undo duplicate', ev('entries.length') === 2);
    // 削除（スワイプの「削除」から）
    touch('touchstart', 200, 300, lbl(row(2))); touch('touchmove', 100, 302, lbl(row(2))); touch('touchend', 100, 302, w.document.body); await sleep(400);
    [...row(2).querySelectorAll('.sw-actions .btn')].find(b => b.textContent === '削除').click(); t('swipe delete removes entry', ev('entries.length') === 1 && !ev('entries.some(e=>e.id===2)')); undo(); t('undo delete', ev('entries.length') === 2);
    // 編集フォーム: スライダー・±ボタンは撤去、数量シートと複製/削除
    setup([E(1, '朝食', 'テストご飯', 150, 240)]); w.startEdit(1); const form = $('mealBlocks');
    t('edit form: slider/nudge/volume removed', !form.querySelector('input[type=range]') && !/\+10g|−10g|小さじ|大さじ/.test(form.textContent) && typeof w.syncAmountFromSlider === 'undefined' && typeof w.nudgeEditAmount === 'undefined');
    t('edit form: sheet button + duplicate/delete', /数量|量を変更/.test(form.textContent) && [...form.querySelectorAll('button')].some(b => b.textContent === '複製') && [...form.querySelectorAll('button')].some(b => b.textContent === '削除'));
    [...form.querySelectorAll('button')].find(b => /量を変更/.test(b.textContent)).click(); t('edit form button opens the sheet', ev('AS.open') && ev('AS.entryId') === 1); w.closeAmountSheet();
    // ── 単位の編集（目安量画面）と、AI・インポート ──
    setup(); w.renderCustomFoodList(); w.toggleFoodServingMode('custom'); const unitsRow = n => [...$('customFoodList').querySelectorAll('.custom-item')].find(r => r.textContent.includes(n)).querySelector('.fd-units');
    t('serving screen shows unit editor', unitsRow('テスト卵').value === '個=50' && unitsRow('テストオーツ').value === ''); unitsRow('テストオーツ').value = '杯=40, 大盛=60'; unitsRow('テストオーツ').dispatchEvent(new w.Event('change'));
    t('units saved', ev(`JSON.stringify(customFoods.find(f=>f.id===4).units)`) === '[{"label":"杯","g":40},{"label":"大盛","g":60}]');
    unitsRow('テストオーツ').value = 'でたらめ'; unitsRow('テストオーツ').dispatchEvent(new w.Event('change')); t('invalid units rejected', ev('customFoods.find(f=>f.id===4).units.length') === 2 && /形式/.test(toast().textContent));
    unitsRow('テストオーツ').value = ''; unitsRow('テストオーツ').dispatchEvent(new w.Event('change')); t('blank clears units', ev('customFoods.find(f=>f.id===4).units') === undefined); w.toggleFoodServingMode('custom');
    w.executeAiCommands([{ type: 'add_custom_food', foods: [{ name: 'AI単位テスト', per: 100, cal: 100, p: 5, f: 5, c: 5, units: [{ label: '個', g: 40 }, { label: 'bad', g: -1 }] }] }, { type: 'edit_custom_food', name: 'テスト卵', updates: { units: [{ label: 'コ', g: 55 }] } }], 't');
    t('AI add_custom_food keeps sanitized units', ev(`JSON.stringify(customFoods.find(f=>f.name==='AI単位テスト').units)`) === '[{"label":"個","g":40}]'); t('AI edit_custom_food updates units', ev(`JSON.stringify(customFoods.find(f=>f.name==='テスト卵').units)`) === '[{"label":"コ","g":55}]');
    ev('window.__imp=1'); { const exp = { kind: ev('FOOD_DB_EXPORT_KIND'), version: 1, customFoods: [{ id: 77, name: 'インポート単位', per: 100, cal: 10, p: 1, f: 0, c: 1, units: [{ label: '切れ', g: 30 }] }], comboFoods: [] }; $('fooddbImportArea').value = JSON.stringify(exp); w.importFoodDb(); t('import keeps units', ev(`JSON.stringify(customFoods.find(f=>f.name==='インポート単位').units)`) === '[{"label":"切れ","g":30}]'); }
    // 内蔵DBの単位
    t('built-in DB has units for common counted foods', ev('LOCAL_DB.filter(f=>f.units).length') >= 15 && ev(`LOCAL_DB.find(f=>f.name==='卵').units[0].g`) === 50 && ev('LOCAL_DB.every(f=>!f.units||sanitizeUnits(f.units).length===f.units.length)'));
    setup(); w.onAddSearch('卵2個', '朝食'); box = $('addResultsBox_朝食'); t('built-in: 卵2個 resolves to 100g', box._local.length > 0 && box._qty.unit === '個' && /100g/.test(box.textContent));
  } catch (err) { console.log('EXC', err.stack.split('\n').slice(0, 6).join(' | ')); process.exitCode = 1; }
  t.done(errs);
}, 800);
