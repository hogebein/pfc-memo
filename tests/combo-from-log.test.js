// 記録タブ「記録から複合食品を作る」のテスト。実行: NODE_PATH=<jsdomのnode_modules> node tests/combo-from-log.test.js
const { loadApp, makeT, sleep } = require('./harness');
const { w, errs } = loadApp(); const t = makeT(); const ev = s => w.eval(s); const $ = id => w.document.getElementById(id);
const E = (id, meal, name, amount, cal, p, f, c, extra = {}) => ({ id, date: '__D__', meal, time: extra.time || '08:00', name, amount, cal, p, f, c, ...extra });
setTimeout(async () => {
  try {
    const D = ev('currentDate'); const mk = (...a) => JSON.stringify(E(...a)).replace(/__D__/g, D);
    const setup = () => { ev(`customFoods=[];comboFoods=[];entries=[${mk(1,'朝食','オートミール',50,190,6.9,2.9,34.6,{fiber:4.7,fibS:1.6,fibI:3.1,time:'07:30'})},${mk(2,'朝食','牛乳',200,134,6.6,7.6,9.6,{time:'07:40'})},${mk(3,'昼食','納豆',50,100,8,5,6,{fiber:3.4,time:'12:10'})},${mk(4,'昼食','ご飯',150,252,3.8,0.5,55.7,{time:'12:00'})},${mk(5,'夕食','サラダチキン',100,120,24,2,1,{time:'19:00'})}];saveLocal();`); ev('window.__cloud=0;saveToCloud=async function(){window.__cloud++};fbDb={};fbUser={uid:"u"};initialSyncDone=true;_cl.active=false;_cl.ids.clear();'); ev('renderRecord()'); };
    const rows = () => [...$('mealBlocks').querySelectorAll('.cl-row')];
    const check = name => { const r = rows().find(x => x.textContent.includes(name)); const c = r.querySelector('input'); c.checked = !c.checked; c.dispatchEvent(new w.Event('change')); };
    const undo = () => $('toast').querySelector('.toast-undo-btn').click();
    // 1) 選択モードの開始
    setup(); t('start button visible', $('clStartBtn').style.display !== 'none');
    w.startComboFromLog(); t('mode on: button hidden, bar shown', $('clStartBtn').style.display === 'none' && !!$('clName') && /材料にする記録をタップ/.test($('clSummary').textContent));
    t('rows have checkboxes, no edit/delete/add', rows().length === 5 && !$('mealBlocks').querySelector('.li-right .btn') && !$('mealBlocks').querySelector('.meal-add-btn.active-add') && !/＋ 追加/.test($('mealBlocks').textContent));
    t('meal select buttons', /この食事を選択/.test($('mealBlocks').textContent));
    // 2) 選択と集計
    check('オートミール'); check('牛乳'); t('summary 2 items', /2品・合計250g ／ 324kcal/.test($('clSummary').textContent) && /繊4.7/.test($('clSummary').textContent));
    check('牛乳'); t('toggle off', /1品・合計50g/.test($('clSummary').textContent)); check('牛乳');
    w.clToggleMeal('昼食'); t('select whole meal', rows().filter(r => r.querySelector('input').checked).length === 4); w.clToggleMeal('昼食'); t('deselect whole meal', rows().filter(r => r.querySelector('input').checked).length === 2);
    // 3) 入力の保持（再描画しても名前が消えない）
    $('clName').value = '朝のオートミール'; $('clCat').value = ''; ev('renderRecord()'); t('name kept across re-render', $('clName').value === '朝のオートミール' && rows().filter(r => r.querySelector('input').checked).length === 2);
    // 4) 登録（記録は残す）
    w.registerComboFromLog();
    const cf = ev('comboFoods'); t('combo registered', cf.length === 1 && cf[0].name === '朝のオートミール');
    const c = cf[0]; t('combo totals', c.per === 250 && c.serving === 250 && c.cal === 324 && Math.abs(c.p - 13.5) < 0.05 && Math.abs(c.c - 44.2) < 0.05);
    t('combo ingredients (per=amount)', c.ingredients.length === 2 && c.ingredients[0].name === 'オートミール' && c.ingredients[0].per === 50 && c.ingredients[0].amount === 50 && c.ingredients[0].cal === 190);
    t('fiber split carried', Math.abs(c.fiber - 4.7) < 0.05 && Math.abs(c.fibS + c.fibI - c.fiber) < 0.06 && c.fibS > 1);
    t('category guessed (オートミール→主食)', c.category === '主食'); t('digest/src', c._src === 'combo' && c.digest === 'mixed');
    t('entries untouched', ev('entries.length') === 5 && ev('entries.some(e=>e.id===1)')); t('mode exited', !ev('_cl.active') && !$('clName') && $('clStartBtn').style.display !== 'none');
    t('persisted to localStorage', JSON.parse(w.localStorage.getItem('pfcComboFoods') || '[]').some(f => f.name === '朝のオートミール') && JSON.parse(w.localStorage.getItem('pfcEntries') || '[]').length === 5);
    await sleep(20); t('cloud save triggered', ev('window.__cloud') >= 1);
    t('combo listed in registration tab', (w.renderComboFoodList(), /朝のオートミール/.test($('comboFoodList').textContent)));
    undo(); t('undo removes combo', ev('comboFoods.length') === 0 && ev('entries.length') === 5);
    // 5) 検証エラー（モードは維持）
    w.startComboFromLog(); w.registerComboFromLog(); t('error: nothing selected', /記録を選んでください/.test($('clMsg').textContent) && ev('_cl.active'));
    check('納豆'); $('clName').value = '   '; w.registerComboFromLog(); t('error: empty name', /複合食品名を入力/.test($('clMsg').textContent));
    ev(`customFoods=[{id:7,name:'既存の食品',cal:1,per:100,p:0,f:0,c:0}]`); $('clName').value = '既存の食品'; w.registerComboFromLog(); t('error: duplicate name (custom)', /既に登録されています/.test($('clMsg').textContent) && ev('comboFoods.length') === 0);
    ev(`comboFoods=[{id:8,name:'既存コンボ',per:1,cal:1,p:0,f:0,c:0,ingredients:[]}]`); $('clName').value = '既存コンボ'; w.registerComboFromLog(); t('error: duplicate name (combo)', /既に登録されています/.test($('clMsg').textContent) && ev('comboFoods.length') === 1);
    ev('customFoods=[];comboFoods=[]'); w.cancelComboFromLog(); t('cancel exits without changes', !ev('_cl.active') && ev('entries.length') === 5 && ev('comboFoods.length') === 0);
    // 6) 食事をまたいだ選択 + 1件にまとめる + 元に戻す
    setup(); w.startComboFromLog(); check('納豆'); check('ご飯'); $('clName').value = '納豆ご飯'; $('clCat').value = 'マイ定食'; $('clReplace').checked = true; w.registerComboFromLog();
    const nc = ev('comboFoods')[0]; t('cross-meal combo', nc.name === '納豆ご飯' && nc.per === 200 && nc.cal === 352 && nc.category === 'マイ定食' && nc.ingredients.length === 2);
    t('ingredient order follows screen order', nc.ingredients[0].name === '納豆' || nc.ingredients[0].name === 'ご飯');
    const es = ev('entries'); t('originals replaced by one entry', es.length === 4 && !es.some(e => e.id === 3 || e.id === 4) && es.filter(e => e.name === '納豆ご飯').length === 1);
    const ne = es.find(e => e.name === '納豆ご飯'); t('merged entry values', ne.amount === 200 && ne.cal === 352 && ne.meal === '昼食' && ne.time === '12:00' && ne.date === D && ne.ingredients.length === 2);
    t('merged entry fiber', Math.abs(ne.fiber - 3.4) < 0.05);
    t('replace persisted', JSON.parse(w.localStorage.getItem('pfcEntries')).length === 4 && JSON.parse(w.localStorage.getItem('pfcComboFoods')).length === 1);
    undo(); t('undo restores originals in place', ev('entries.map(e=>e.id).join()') === '1,2,3,4,5' && ev('comboFoods.length') === 0 && JSON.parse(w.localStorage.getItem('pfcEntries')).length === 5);
    // 7) 複合食品の記録を材料にする（入れ子は1つの材料として扱う）
    setup(); ev(`entries.push({id:6,date:currentDate,meal:'間食',time:'15:00',name:'入れ子コンボ',amount:100,cal:200,p:10,f:5,c:30,ingredients:[{name:'x',amount:50,per:50,cal:100,p:5,f:2,c:15}]})`); w.startComboFromLog(); check('入れ子コンボ'); check('サラダチキン'); $('clName').value = '入れ子テスト'; w.registerComboFromLog();
    const nn = ev('comboFoods')[0]; t('nested combo as single ingredient', nn.ingredients.length === 2 && nn.ingredients.some(i => i.name === '入れ子コンボ' && i.cal === 200) && nn.cal === 320);
    // 8) 食事ごとの選択ボタンから開始
    setup(); w.startComboFromLog('朝食'); t('start from a meal preselects it', ev('_cl.ids.size') === 2 && /2品・合計250g/.test($('clSummary').textContent)); w.cancelComboFromLog();
    // 9) 旧形式の記録（内訳なし）でも内訳が補完される
    setup(); ev(`entries.push(${mk(9,'間食','ごぼう',100,65,1.8,0.1,15.4,{fiber:5.7})})`); w.startComboFromLog(); check('ごぼう'); $('clName').value = 'ごぼうだけ'; w.registerComboFromLog(); const gb = ev('comboFoods[0]'); t('legacy entry split materialized', Math.abs(gb.fibS - 2.3) < 0.15 && Math.abs(gb.fibS + gb.fibI - 5.7) < 0.06);
    // 10) 登録した複合食品を通常どおり記録できる（記録タブの検索→タップ）
    ev(`activeAddMeal='間食'`); ev('renderRecord()'); const food = ev('getAllFoods()').find(f => f.name === 'ごぼうだけ'); t('new combo visible to search', !!food && food._src === 'combo');
    $('addResultsBox_間食')._local = [food]; w.selectAddResult(0, '間食'); const le = ev('entries').filter(e => e.name === 'ごぼうだけ').pop(); t('logging the new combo reproduces totals', le && le.amount === 100 && le.cal === 65 && le.ingredients.length === 1);
    // 11) AIの combo_food_from_log（共通化後も同じ結果）
    setup(); w.executeAiCommands([{ type: 'combo_food_from_log', name: 'AI朝食', entry_ids: [1, 2], category: '主食', delete_originals: true }], 't'); const ai = ev('comboFoods')[0];
    t('AI combo_food_from_log still works', ai && ai.name === 'AI朝食' && ai.per === 250 && ai.cal === 324 && ai.category === '主食' && ai.ingredients.length === 2 && ev('entries.length') === 3);
    // 12) 編集中・追加パネルは選択モード開始で閉じる
    setup(); ev("editingId=3;activeAddMeal='昼食';renderRecord()"); w.startComboFromLog(); t('editing/add panel closed', ev('editingId') === null && ev('activeAddMeal') === null && !$('mealBlocks').querySelector('.edit-form'));
  } catch (err) { console.log('EXC', err.stack.split('\n').slice(0, 5).join(' | ')); process.exitCode = 1; }
  t.done(errs);
}, 800);
