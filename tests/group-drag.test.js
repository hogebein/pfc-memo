// 記録の「長押し→ドラッグでグループ化」と、グループの解除・複合食品への登録のテスト。
// 実行: npm install --no-save jsdom && node tests/group-drag.test.js
const { loadApp, makeT, sleep } = require('./harness');
const { w, errs } = loadApp(); const t = makeT(); const ev = s => w.eval(s); const $ = id => w.document.getElementById(id);
const mk = (id, meal, name, amount, cal, p, f, c, extra = {}) => ({ id, date: '__D__', meal, time: extra.time || '08:00', name, amount, cal, p, f, c, ...extra });
setTimeout(async () => {
  try {
    const D = ev('currentDate'); const J = o => JSON.stringify(o).replace(/__D__/g, D);
    const setup = () => {
      ev(`customFoods=[];comboFoods=[];entries=[${[mk(1, '朝食', 'オートミール', 50, 190, 6.9, 2.9, 34.6, { fiber: 4.7, fibS: 1.6, fibI: 3.1, time: '07:30' }), mk(2, '朝食', '牛乳', 200, 134, 6.6, 7.6, 9.6, { time: '07:40' }), mk(3, '昼食', '納豆', 50, 100, 8, 5, 6, { fiber: 3.4, time: '12:10' }), mk(4, '昼食', 'ご飯', 150, 252, 3.8, 0.5, 55.7, { time: '12:00' }), mk(5, '夕食', 'サラダチキン', 100, 120, 24, 2, 1, { time: '19:00' })].map(J).join(',')}];saveLocal();`);
      ev('window.__calls=0;window.__fsApi={doc:()=>({}),setDoc:async()=>{window.__calls++}};fbDb={};fbUser={uid:"u"};initialSyncDone=true;_grpOpen.clear();DRAG.suppressUntil=0;editingId=null;activeAddMeal=null;'); ev('renderRecord()');
    };
    const E = id => ev('entries').find(e => e.id === id); const ids = () => ev('entries.map(e=>e.id).join()');
    const row = id => w.document.querySelector(`#mealBlocks .log-item[data-eid="${id}"]`);
    const undo = () => $('toast').querySelector('.toast-undo-btn').click();
    const ls = () => JSON.parse(w.localStorage.getItem('pfcEntries'));
    // ── 表示 ──
    setup(); t('rows are draggable targets (data-eid)', !!row(1) && !!row(5)); t('drag hint shown', $('dragHint').style.display !== 'none');
    w.dismissDragHint(); t('hint dismissed + remembered', $('dragHint').style.display === 'none' && w.localStorage.getItem('pfcDragHint') === '1');
    // ── グループ化: 単品→単品 ──
    setup(); t('group: returns true', w.groupEntries(2, 1) === true);
    t('src merged into target (target keeps position/id)', ids() === '1,3,4,5' && !E(2));
    const g = E(1); t('group entry fields', g.group === true && g.ingredients.length === 2 && g.name === 'オートミール＋牛乳' && g.meal === '朝食' && g.time === '07:30' && g.digest === 'mixed');
    t('group totals = sum of members', g.amount === 250 && g.cal === 324 && Math.abs(g.p - 13.5) < 0.05 && Math.abs(g.f - 10.5) < 0.05 && Math.abs(g.c - 44.2) < 0.06);
    t('group fiber split summed', Math.abs(g.fiber - 4.7) < 0.05 && Math.abs(g.fibS + g.fibI - g.fiber) < 0.06 && g.fibS > 1);
    t('members keep per=amount & values', g.ingredients[0].name === 'オートミール' && g.ingredients[0].per === 50 && g.ingredients[0].cal === 190 && g.ingredients[1].name === '牛乳' && g.ingredients[1].per === 200 && g.ingredients[1].cal === 134);
    t('persisted locally', ls().length === 4 && ls().find(e => e.id === 1).ingredients.length === 2); await sleep(20); t('cloud save triggered', ev('window.__calls') >= 1);
    t('group row shown with badge', /🗂 オートミール＋牛乳/.test(row(1).textContent) && /2品/.test(row(1).textContent) && row(1).classList.contains('grp'));
    t('group opened after creation (shows members with kcal)', /牛乳/.test(row(1).querySelector('.grp-members').textContent) && /134kcal/.test(row(1).querySelector('.grp-members').textContent) && !/NaN/.test(row(1).textContent) && !!$('grpName_1'));
    undo(); t('undo restores both entries', ids() === '1,2,3,4,5' && !E(1).ingredients && ls().length === 5);
    // ── 3つ目・4つ目: 名前が自動更新される ──
    setup(); w.groupEntries(2, 1); w.groupEntries(4, 1); t('3 members: auto name updated', E(1).name === 'オートミール＋牛乳＋ご飯' && E(1).ingredients.length === 3 && E(1).cal === 576);
    w.groupEntries(3, 1); t('4 members: ほか表記', E(1).name === 'オートミール＋牛乳＋ほか2品' && E(1).ingredients.length === 4);
    // ── グループをドラッグして単品へ（フラット化）──
    setup(); w.groupEntries(4, 3); w.groupEntries(3, 5);
    t('group dragged onto single → flattened into target', ids() === '1,2,5' && E(5).ingredients.length === 3 && E(5).ingredients.map(i => i.name).sort().join() === ['サラダチキン', 'ご飯', '納豆'].sort().join());
    t('flatten: totals and meal from target', E(5).cal === 100 + 252 + 120 && E(5).meal === '夕食' && E(5).amount === 50 + 150 + 100 && E(5).group === true);
    // ── 名前を付けたグループは、メンバーが増えても名前を保つ ──
    setup(); w.groupEntries(2, 1); entriesRename(1, '朝のオートミール'); w.groupEntries(3, 1); t('custom group name kept', E(1).name === '朝のオートミール' && E(1).ingredients.length === 3);
    function entriesRename(id, n) { ev(`entries.find(e=>e.id===${id}).name='${n}'`); }
    // ── DB複合食品の記録に取り込む ──
    setup(); ev(`entries.push(${J(mk(6, '間食', 'ミックス', 100, 200, 10, 5, 30, { ingredients: [{ name: 'x', amount: 50, per: 50, cal: 100, p: 5, f: 2, c: 15 }, { name: 'y', amount: 50, per: 50, cal: 100, p: 5, f: 3, c: 15 }] }))})`); w.groupEntries(5, 6);
    t('combo entry + single: name kept (not auto), 3 members', E(6).name === 'ミックス' && E(6).ingredients.length === 3 && E(6).cal === 320);
    // ── 無効な操作 ──
    setup(); t('self drop ignored', w.groupEntries(1, 1) === false && ids() === '1,2,3,4,5'); t('unknown id ignored', w.groupEntries(1, 999) === false && w.groupEntries(999, 1) === false);
    // ── グループの展開・編集 ──
    setup(); w.groupEntries(2, 1); w.toggleGroupOpen(1); t('toggle closes', !row(1).querySelector('.grp-members')); w.toggleGroupOpen(1); t('toggle opens', !!row(1).querySelector('.grp-members'));
    ev('startEdit(1)'); t('edit panel lists members', /構成食品の分量/.test($('mealBlocks').textContent) && !!$('eIng1_0') && !!$('eIng1_1'));
    w.updateEditIngredientAmt(1, 0, '100'); t('member amount edit recomputes group', E(1).ingredients[0].amount === 100 && E(1).amount === 300 && E(1).cal === 134 + 380 && Math.abs(E(1).fiber - 9.4) < 0.1);
    ev('cancelEdit(1)');
    // ── グループ解除 ──
    setup(); w.groupEntries(2, 1); const before = E(1); w.ungroupEntry(1);
    t('ungroup: restores separate entries in place', ev('entries.length') === 5 && ids().split(',')[0] !== '1' && ev('entries').slice(0, 2).map(e => e.name).join() === 'オートミール,牛乳');
    const e0 = ev('entries')[0], e1 = ev('entries')[1]; t('ungrouped values/meal/time', e0.amount === 50 && e0.cal === 190 && e0.meal === '朝食' && e0.time === '07:30' && e1.amount === 200 && e1.cal === 134 && e1.meal === '朝食' && !e0.ingredients);
    t('ungrouped fiber split kept', Math.abs((e0.fibS || 0) + (e0.fibI || 0) - e0.fiber) < 0.06 && e0.fibS > 1);
    undo(); t('undo ungroup restores group', ev('entries.length') === 4 && E(1) && E(1).ingredients.length === 2);
    // 解除前に分量を変えていた場合は、変更後の量で個別記録に戻る
    setup(); w.groupEntries(2, 1); w.updateEditIngredientAmt(1, 1, '100'); w.ungroupEntry(1); t('ungroup after edit uses edited amounts', ev('entries')[1].amount === 100 && ev('entries')[1].cal === 67);
    // ── 複合食品として登録 ──
    setup(); w.groupEntries(4, 3); const gid = 3; $('grpName_3').value = '   '; w.registerGroupAsCombo(3); t('register: empty name rejected', /名を入力/.test($('grpMsg_3').textContent) && ev('comboFoods.length') === 0);
    ev(`customFoods=[{id:9,name:'既存',cal:1,per:100,p:0,f:0,c:0}]`); $('grpName_3').value = '既存'; w.registerGroupAsCombo(3); t('register: duplicate rejected', /既に登録/.test($('grpMsg_3').textContent) && ev('comboFoods.length') === 0);
    $('grpName_3').value = '納豆ご飯'; $('grpCat_3').value = 'マイ定食'; w.registerGroupAsCombo(3);
    const cf = ev('comboFoods'); t('registered as combo food', cf.length === 1 && cf[0].name === '納豆ご飯' && cf[0].category === 'マイ定食' && cf[0].per === 200 && cf[0].cal === 352 && cf[0].ingredients.length === 2 && cf[0]._src === 'combo');
    t('combo keeps fiber split', Math.abs(cf[0].fiber - 3.4) < 0.05 && cf[0].fibS > 0); t('entries untouched by registration', ev('entries.length') === 4 && !!E(3));
    t('combo listed in food tab', (w.renderComboFoodList(), /納豆ご飯/.test($('comboFoodList').textContent))); undo(); t('undo registration', ev('comboFoods.length') === 0);
    // 登録した複合食品を記録すると同じ値になる
    $('grpName_3').value = '納豆ご飯'; w.registerGroupAsCombo(3); ev(`activeAddMeal='間食'`); ev('renderRecord()'); const food = ev('getAllFoods()').find(f => f.name === '納豆ご飯'); $('addResultsBox_間食')._local = [food]; w.selectAddResult(0, '間食'); w.confirmAmountSheet();   // 数量シートで量(既定=1食分)を確定
    const logged = ev('entries').filter(e => e.name === '納豆ご飯').pop(); t('logging registered combo reproduces totals', logged && logged.amount === 200 && logged.cal === 352 && logged.ingredients.length === 2);
    // ── ドラッグ操作（長押し→移動→ドロップ）──
    setup(); let hit = null; w.document.elementFromPoint = () => hit;
    const touch = (type, x, y, target) => { const e = new w.Event(type, { bubbles: true, cancelable: true }); const list = type === 'touchend' || type === 'touchcancel' ? [] : [{ clientX: x, clientY: y }]; Object.defineProperty(e, 'touches', { value: list }); target.dispatchEvent(e); return e; };
    // ボタン上の長押しではドラッグしない
    touch('touchstart', 100, 300, row(2).querySelector('.btn-danger')); await sleep(430); t('long-press on button does not drag', !ev('DRAG.active'));
    // 長押しでドラッグ開始
    touch('touchstart', 100, 300, row(2).querySelector('.li-name')); t('pending after touchstart', ev('DRAG.pending') !== null && !ev('DRAG.active')); await sleep(430);
    t('drag begins after hold', ev('DRAG.active') && ev('DRAG.srcId') === 2 && !!w.document.querySelector('.drag-ghost') && row(2).classList.contains('dragging-src') && w.document.body.classList.contains('drag-mode'));
    hit = row(1).querySelector('.li-name'); const mv = touch('touchmove', 110, 320, row(1)); t('scroll blocked while dragging', mv.defaultPrevented === true);
    t('hovered target highlighted', row(1).classList.contains('drop-target'));
    hit = row(4).querySelector('.li-name'); touch('touchmove', 120, 340, row(4)); t('target switches', !row(1).classList.contains('drop-target') && row(4).classList.contains('drop-target'));
    hit = row(1).querySelector('.li-name'); touch('touchmove', 110, 320, row(1)); touch('touchend', 110, 320, w.document.body);
    t('drop groups onto hovered target', ids() === '1,3,4,5' && E(1).ingredients.length === 2 && E(1).name === 'オートミール＋牛乳');
    t('ghost/classes cleaned up', !w.document.querySelector('.drag-ghost') && !w.document.body.classList.contains('drag-mode') && !w.document.querySelector('.dragging-src') && !w.document.querySelector('.drop-target') && !ev('DRAG.active'));
    // ドロップ直後のクリックは無効（編集画面が開かない）
    const cl = new w.MouseEvent('click', { bubbles: true, cancelable: true }); row(3).querySelector('.btn-ghost').dispatchEvent(cl); t('click right after drop suppressed', ev('editingId') === null);
    await sleep(500); row(3).querySelector('.btn-ghost').dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); t('click works again later', ev('editingId') === 3); ev('editingId=null;renderRecord()');
    // 何もない所にドロップ → 変更なし
    setup(); hit = null; touch('touchstart', 100, 300, row(2).querySelector('.li-name')); await sleep(430); touch('touchmove', 150, 400, w.document.body); touch('touchend', 150, 400, w.document.body); t('drop on empty area: no change', ids() === '1,2,3,4,5' && !ev('DRAG.active'));
    // touchcancel → 変更なし
    setup(); touch('touchstart', 100, 300, row(2).querySelector('.li-name')); await sleep(430); hit = row(1).querySelector('.li-name'); touch('touchmove', 110, 320, row(1)); touch('touchcancel', 0, 0, w.document.body); t('cancel: no change', ids() === '1,2,3,4,5' && !w.document.querySelector('.drag-ghost'));
    // 保持前に動いた(スクロール)ら、ドラッグを始めない
    setup(); touch('touchstart', 100, 300, row(2).querySelector('.li-name')); touch('touchmove', 100, 330, row(2)); await sleep(430); t('moving before hold cancels (scroll)', !ev('DRAG.active') && ev('DRAG.pending') === null);
    // 保持前に離したら、ドラッグは始まらない（通常のタップ）
    setup(); touch('touchstart', 100, 300, row(2).querySelector('.li-name')); touch('touchend', 100, 300, w.document.body); await sleep(430); t('quick tap does not start drag', !ev('DRAG.active'));
    // 自分自身の上は対象にならない
    setup(); touch('touchstart', 100, 300, row(2).querySelector('.li-name')); await sleep(430); hit = row(2).querySelector('.li-name'); touch('touchmove', 101, 301, row(2)); t('own row is not a drop target', !row(2).classList.contains('drop-target')); touch('touchend', 101, 301, w.document.body); t('drop on self: no change', ids() === '1,2,3,4,5');
    // ゴースト上は対象にしない
    setup(); touch('touchstart', 100, 300, row(2).querySelector('.li-name')); await sleep(430); hit = w.document.querySelector('.drag-ghost .li-name'); touch('touchmove', 101, 301, row(2)); t('ghost is never a target', !w.document.querySelector('.drop-target')); touch('touchcancel', 0, 0, w.document.body);
    // マウス（PC）でも同様
    setup(); const md = new w.MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: 100, clientY: 300 }); row(2).querySelector('.li-name').dispatchEvent(md); await sleep(430); t('mouse: drag begins', ev('DRAG.active'));
    hit = row(1).querySelector('.li-name'); w.document.dispatchEvent(new w.MouseEvent('mousemove', { bubbles: true, clientX: 110, clientY: 320 })); w.document.dispatchEvent(new w.MouseEvent('mouseup', { bubbles: true, clientX: 110, clientY: 320 })); t('mouse: drop groups', ids() === '1,3,4,5' && E(1).ingredients.length === 2);
    // 編集中の行はドラッグ対象外
    setup(); ev('startEdit(2)'); t('edit form row is not a drag target', !row(2));
    // ── AIの combo_food_from_log は従来どおり ──
    setup(); w.executeAiCommands([{ type: 'combo_food_from_log', name: 'AI朝食', entry_ids: [1, 2], category: '主食', delete_originals: true }], 't'); const ai = ev('comboFoods')[0];
    t('AI combo_food_from_log still works', ai && ai.name === 'AI朝食' && ai.per === 250 && ai.cal === 324 && ai.category === '主食' && ai.ingredients.length === 2 && ev('entries.length') === 3);
  } catch (err) { console.log('EXC', err.stack.split('\n').slice(0, 5).join(' | ')); process.exitCode = 1; }
  t.done(errs);
}, 800);
