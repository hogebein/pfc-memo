// 複合食品の登録画面: 材料ごと・合計の栄養表示のテスト
const { loadApp, makeT, sleep } = require('./harness');
const { w, errs } = loadApp(); const t = makeT(); const ev = s => w.eval(s); const $ = id => w.document.getElementById(id);
const near = (a, b, e = 0.011) => Math.abs(a - b) <= e;
setTimeout(async () => {
  try {
    ev(`customFoods = [
      {id:1,name:'テスト鶏むね',per:100,serving:100,cal:120,p:23,f:2,c:0,fiber:0,salt:0.1,iron:0.3,calcium:4,vitc:0,vitd:0.1,vita:8,vite:0.2,vitk:5,iodine:1},
      {id:2,name:'テストごはん',per:100,serving:150,cal:150,p:2.5,f:0.3,c:35,fiber:0.5,fibS:0.1,fibI:0.4,salt:0,iron:0.1,calcium:3,vitc:0,vitd:0,vita:0,vite:0,vitk:0,iodine:0},
      {id:3,name:'テスト醤油',per:100,serving:6,cal:70,p:8,f:0,c:8,fiber:0,salt:14.5,iron:1.7,calcium:29,vitc:0,vitd:0,vita:0,vite:0,vitk:0,iodine:0}]; comboFoods = []; comboIngredients = [];`);
    // 検索結果に繊維・塩分が出る
    w.renderComboResults(w.localSearch('テストごはん'));
    t('search result row shows fibre and salt as well as P/F/C', /繊0\.5 塩0/.test($('comboResultsBox').innerHTML) && /150kcal/.test($('comboResultsBox').innerHTML));
    const add = name => { w.renderComboResults(w.localSearch(name)); const i = $('comboResultsBox')._local.findIndex(f => f.name === name); w.addComboIngredient(i); };
    add('テスト鶏むね'); add('テストごはん'); add('テスト醤油');
    t('three ingredients added with default amounts (100 / 150 / 6 g)', ev('comboIngredients.map(f=>f.amount).join()') === '100,150,6');
    const l0 = $('cin0').textContent, l1 = $('cin1').textContent, l2 = $('cin2').textContent;
    t('each ingredient row shows kcal, share of total, PFC, 糖質, fibre and salt', /120kcal（全体の\d+%）/.test(l0) && /P23 F2 C0（糖質0）/.test(l0) && /塩0\.1/.test(l0) && /225kcal/.test(l1) && /糖質51\.7/.test(l1) && /繊0\.8/.test(l1) && /塩0\.87/.test(l2));
    const share = el => parseInt(/全体の(\d+)%/.exec(el)[1]); t('shares of kcal sum to ~100%', Math.abs(share(l0) + share(l1) + share(l2) - 100) <= 2);
    // 詳細は折りたたみで、全栄養素
    const det = $('cid2').innerHTML;
    t('per-ingredient details list all nutrients incl. iron/calcium/salt and the source data', /鉄/.test(det) && /Ca/.test(det) && /ヨウ素/.test(det) && /塩分<\/div><div[^>]*>0\.87g/.test(det) && /元のデータ: 100gあたり 70kcal/.test(det) && /入れた量 6g/.test(det));
    t('fibre breakdown rows are labelled (水溶性/不溶性)', /水溶性/.test($('cid1').innerHTML) && /不溶性/.test($('cid1').innerHTML));
    // 量を変えると、その材料と全体の割合が更新され、入力欄は作り直されない（フォーカス維持）
    const inp = $('comboIngredients').querySelectorAll('input[type=number]')[0];
    inp.value = '200'; w.updateComboAmt(0, '200');
    t('amount change updates that ingredient line (240kcal) and all shares', /240kcal/.test($('cin0').textContent) && share($('cin0').textContent) > share(l0) && share($('cin1').textContent) < share(l1));
    t('input element is not re-created while typing (focus kept)', $('comboIngredients').querySelectorAll('input[type=number]')[0] === inp);
    t('per-ingredient detail updates with the amount (iron 0.6)', /0\.6mg/.test($('cid0').innerHTML));
    // 合計
    const tot = $('comboTotal').innerHTML;
    t('total line shows weight, kcal, PFC, 糖質, fibre and salt', /合計 356g 469kcal/.test(tot) && /糖質/.test(tot) && /塩1\.07g/.test(tot));
    t('total details: 合計 and 100gあたり columns', /全栄養素の合計と100gあたり/.test(tot) && />合計<\/div>/.test(tot) && />100gあたり<\/div>/.test(tot));
    const tt = ev("comboTotals(comboIngredients)"); t('100g column = total × 100/weight (salt 0.3 per 100g)', near(tt.salt * 100 / 356, 0.3, 0.01) && new RegExp(`塩分</div><div[^>]*>${tt.salt.toFixed(2).replace(/0$/, '0?')}g</div><div[^>]*>0\\.3g`).test(tot));
    // 開閉状態の保持
    ev("comboToggle(1,true)"); w.renderComboIngredients(); t('open state of an ingredient is kept across re-render', $('comboIngredients').querySelectorAll('details')[1].open === true && $('comboIngredients').querySelectorAll('details')[0].open === false);
    w.removeComboIngredient(0); t('removing an ingredient shifts the open state with it', $('comboIngredients').querySelectorAll('details')[0].open === true && ev('comboOpen.has(0)') && !ev('comboOpen.has(1)'));
    // 入れ替えでも表示される
    w.toggleComboReplace(0); w.renderComboResults(w.localSearch('テスト鶏むね')); w.addComboIngredient(0);
    t('replacing keeps the amount and refreshes nutrition (150g rice slot → 180kcal chicken)', /180kcal/.test($('cin0').textContent) && ev('comboIngredients[0].amount') === 150);
    // 保存して再編集しても表示される
    ev("document.getElementById('comboName').value='テスト丼'"); w.saveComboFood(); const id = ev("comboFoods[0].id"); w.editComboFood(id);
    t('editing a saved combo shows per-ingredient nutrition again', ev('comboIngredients.length') === 2 && /kcal（全体の/.test($('cin0').textContent) && /kcal（全体の/.test($('cin1').textContent));
    t('saved numbers are unchanged by the new display (total kcal)', near(ev("comboFoods[0].cal"), ev("comboIngredients.reduce((a,f)=>a+f._cal,0)"), 0.2));
    t('empty list clears the total', (ev("comboIngredients=[]"), w.renderComboIngredients(), $('comboTotal').textContent === ''));
    t('ingredient names with special characters are escaped', (() => { ev("comboIngredients=[{name:'<b>x</b>',amount:10,per:100,cal:1,p:0,f:0,c:0,_cal:1,_p:0,_f:0,_c:0,_fiber:0,_salt:0}]"); w.renderComboIngredients(); return !/<b>x<\/b>/.test($('comboIngredients').innerHTML.replace(/&lt;b&gt;/g, '')) ; })());
    t.done(errs);
  } catch (x) { console.log('EXC', x); process.exit(1); }
}, 300);
