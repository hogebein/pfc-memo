// 食品検索の連続登録（行の「＋」・「連続登録」スイッチ）のテスト
const { loadApp, makeT, sleep } = require('./harness');
const { w, errs } = loadApp(); const t = makeT(); const ev = s => w.eval(s); const $ = id => w.document.getElementById(id);
const near = (a, b, e = 0.011) => Math.abs(a - b) <= e;
setTimeout(async () => {
  try {
    const today = ev("toDateStr(new Date())");
    ev(`currentDate='${today}';entries=[];customFoods=[
      {id:1,name:'連続テスト白米',per:100,serving:150,cal:150,p:2.5,f:0.3,c:35,fiber:0.5,salt:0},
      {id:2,name:'連続テスト卵',per:100,serving:50,cal:150,p:12,f:10,c:0.3,fiber:0,salt:0.4},
      {id:3,name:'連続テスト味噌汁',per:100,serving:200,cal:40,p:3,f:1,c:4,fiber:0.5,salt:0.8}];comboFoods=[]`);
    const MEAL = '昼食', search = q => { const inp = $('addSearch_' + MEAL); inp.value = q; w.onAddSearch(q, MEAL); };
    const rows = () => [...$('addResultsBox_' + MEAL).querySelectorAll('.ri')], names = () => ev("entries.map(e=>e.name+':'+e.amount).join('|')");
    const settle = async () => { await sleep(80); if (w.document.activeElement && w.document.activeElement !== w.document.body) w.document.activeElement.blur(); };
    w.toggleAddPanel(MEAL); await settle();
    t('panel open; the 連続登録 switch exists and is OFF by default', ev('activeAddMeal') === MEAL && !!$('addKeep_' + MEAL) && $('addKeep_' + MEAL).checked === false && ev('_keepAddMeal') === null);
    search('連続テスト');
    t('every result row has a ＋ button', rows().length === 3 && rows().every(r => !!r.querySelector('button.ri-plus')));
    // ── 従来どおり: 行をタップ → 記録して検索を閉じる ──
    rows()[0].click(); await sleep(20);
    t('row tap (switch OFF) records and closes the results, clearing the text — unchanged behaviour', names() === '連続テスト白米:150' && $('addResultsBox_' + MEAL).style.display === 'none' && $('addSearch_' + MEAL).value === '');
    t('the panel itself is still the add panel of the meal (not the keep logic)', ev('activeAddMeal') === MEAL);
    // ── B: ＋ で記録して検索を残す ──
    ev("entries=[]"); w.renderRecord(); await settle(); search('連続テスト');
    const plus = i => rows()[i].querySelector('button.ri-plus');
    plus(1).click(); await sleep(20);
    t('＋ records exactly one entry (the row click is not triggered as well)', ev('entries.length') === 1 && names() === '連続テスト卵:50');
    t('after ＋ the search text is kept', $('addSearch_' + MEAL).value === '連続テスト');
    t('after ＋ the result list is still shown with the same rows', $('addResultsBox_' + MEAL).style.display === 'block' && rows().length === 3 && rows().every(r => !!r.querySelector('.ri-plus')));
    t('the add panel stays open for the meal', ev('activeAddMeal') === MEAL && !!$('addSearch_' + MEAL));
    t('recorded item appears in the meal list behind the panel', /連続テスト卵/.test($('mealsContainer') ? $('mealsContainer').textContent : w.document.body.textContent));
    plus(0).click(); await sleep(20); plus(2).click(); await sleep(20);
    t('consecutive ＋ taps register different foods one after another', ev('entries.length') === 3 && names() === '連続テスト卵:50|連続テスト白米:150|連続テスト味噌汁:200');
    plus(1).click(); await sleep(20);
    t('＋ on the same food again merges (卵 50 → 100)', ev('entries.length') === 3 && /連続テスト卵:100/.test(names()));
    t('toast offers 元に戻す and 量を変更 for each addition', /合算/.test($('toast').textContent) && /元に戻す/.test($('toast').textContent) && /量を変更/.test($('toast').textContent));
    $('toast').querySelector('.toast-undo-btn').click(); await sleep(20);
    t('undo reverts the last ＋ and the search stays open with the text', /連続テスト卵:50/.test(names()) && $('addSearch_' + MEAL).value === '連続テスト' && $('addResultsBox_' + MEAL).style.display === 'block');
    t('no entries are written to other meals', ev("entries.every(e=>e.meal==='昼食')"));
    // ── A: スイッチ ON → 行タップでも閉じない ──
    ev("entries=[]"); w.renderRecord(); await settle(); search('連続テスト');
    $('addKeep_' + MEAL).checked = true; $('addKeep_' + MEAL).dispatchEvent(new w.Event('change', { bubbles: true }));
    t('switch ON is stored for this meal', ev('_keepAddMeal') === MEAL);
    rows()[0].click(); await sleep(20);
    t('with the switch ON, tapping the row records and keeps the search open', names() === '連続テスト白米:150' && $('addSearch_' + MEAL).value === '連続テスト' && $('addResultsBox_' + MEAL).style.display === 'block');
    t('the switch stays ON (checked) after the re-render', $('addKeep_' + MEAL).checked === true);
    rows()[1].click(); await sleep(20); t('second row tap also keeps open and records', ev('entries.length') === 2);
    // 数量つきの検索でも
    search('連続テスト白米200'); await sleep(5);
    t('a quantity query ("…200") shows the amount-mode list', /200/.test($('addResultsBox_' + MEAL).textContent));
    rows()[0].querySelector('.ri-plus').click(); await sleep(20);
    t('＋ with a typed quantity records that quantity (150+200 = 350) and keeps the query', /連続テスト白米:350/.test(names()) && $('addSearch_' + MEAL).value === '連続テスト白米200');
    // ── スイッチはパネルを閉じるとOFFに戻る ──
    w.toggleAddPanel(MEAL); await sleep(20);
    t('closing the panel turns the switch OFF', ev('activeAddMeal') === null && ev('_keepAddMeal') === null);
    w.toggleAddPanel(MEAL); await settle();
    t('reopening the panel: switch is OFF again', $('addKeep_' + MEAL).checked === false && ev('_keepAddMeal') === null);
    // 別の食事に切り替えても引き継がない
    $('addKeep_' + MEAL).checked = true; $('addKeep_' + MEAL).dispatchEvent(new w.Event('change', { bubbles: true }));
    w.toggleAddPanel('夕食'); await settle();
    t('switching to another meal\'s panel resets the switch (no accidental keep-open)', $('addKeep_夕食').checked === false && ev('_keepAddMeal') === null);
    // ── 空の検索欄（最近・よく使う食品の一覧）でも続けて追加できる ──
    ev("entries=[{id:50,date:'" + today + "',meal:'朝食',time:'07:00',name:'連続テスト白米',amount:150,cal:225,p:3.8,f:0.5,c:52.5,fiber:0.8,salt:0}]"); w.renderRecord(); await settle();
    const inp = $('addSearch_夕食'); inp.value = ''; w.onAddSearchFocus('夕食');
    const qrows = () => [...$('addResultsBox_夕食').querySelectorAll('.ri')];
    t('empty search shows the recent-foods list with ＋ buttons', qrows().length >= 1 && /最近使った食品/.test($('addResultsBox_夕食').textContent) && qrows().every(r => !!r.querySelector('.ri-plus')));
    const before = ev('entries.length'); qrows()[0].querySelector('.ri-plus').click(); await sleep(30);
    t('＋ from the recent list records and the list is still visible afterwards', ev('entries.length') === before + 1 && $('addResultsBox_夕食').style.display === 'block' && qrows().length >= 1);
    // フォーカスを奪わない
    t('the search input is not force-focused after ＋ (keyboard does not pop up)', w.document.activeElement !== $('addSearch_夕食'));
    // ＋ は目標が分かりやすいラベルを持つ
    t('＋ has an accessible label', /続けて追加/.test(qrows()[0].querySelector('.ri-plus').getAttribute('aria-label')));
    t.done(errs);
  } catch (x) { console.log('EXC', x); process.exit(1); }
}, 300);
