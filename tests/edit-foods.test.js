// AIによる食品DBの一括修正（edit_foods）の回帰テスト
const { loadApp, makeT, sleep } = require('./harness');
const { w, errs } = loadApp(); const t = makeT(); const ev = s => w.eval(s);
const near = (a, b, e = 0.011) => Math.abs(a - b) <= e;
const ing = (name, amount, per, o) => ({ name, amount, per, cal: 0, p: 0, f: 0, c: 0, salt: 0, vitd: 0, ...o });
const combo = (id, name, ings, extra) => { // 保存時と同じ方式で合計を作る
  const f = { id, name, per: 0, serving: 0, cal: 0, p: 0, f: 0, c: 0, ingredients: ings, _src: 'combo', digest: 'mixed', ...extra }; return f; };
setTimeout(async () => {
  try {
    const mkCustoms = () => { ev(`customFoods = [
      {id:1,name:'ささみプロテインバー',per:100,serving:100,cal:350,p:30,f:10,c:30,salt:0.5},
      {id:2,name:'メロンパン',per:50,serving:50,cal:200,p:3,f:6,c:32,salt:0.3,category:'主食'},
      {id:3,name:'食パン（6枚切り）',per:60,serving:60,cal:150,p:5,f:2.5,c:28,salt:0.8,category:'主食'},
      {id:4,name:'パンケーキミックス',per:100,serving:100,cal:360,p:7,f:3,c:75,salt:1.2}];
      comboFoods = [];`); };
    mkCustoms();
    const mkCombos = () => { mkCustoms(); ev(`comboFoods = [
      {id:11,name:'ハムチーズサンド',per:200,serving:200,cal:420,p:20,f:18,c:45,salt:2.4,vitd:0.5,_src:'combo',digest:'mixed',category:'主食',ingredients:[
        {name:'食パン',amount:120,per:100,cal:250,p:8,f:4,c:46,salt:1.2,vitd:0},{name:'ハム',amount:40,per:100,cal:120,p:16,f:6,c:1,salt:2.4,vitd:0.5},{name:'チーズ',amount:40,per:100,cal:310,p:23,f:25,c:1,salt:2.0,vitd:0}]},
      {id:12,name:'カレーパン',per:100,serving:100,cal:300,p:6,f:16,c:32,salt:1.0,_src:'combo',digest:'mixed',ingredients:[{name:'パン生地',amount:60,per:100,cal:250,p:7,f:6,c:44,salt:1.0,vitd:0},{name:'カレー具',amount:40,per:100,cal:130,p:4,f:12,c:8,salt:1.0,vitd:0}]},
      {id:13,name:'親子丼',per:300,serving:300,cal:600,p:30,f:15,c:80,salt:3.0,_src:'combo',digest:'mixed',ingredients:[{name:'ごはん',amount:200,per:100,cal:150,p:2.5,f:0.3,c:35,salt:0,vitd:0},{name:'具',amount:100,per:100,cal:300,p:27,f:14,c:9,salt:3,vitd:0}]}];`);
      // 合計を材料から作り直して整合させる（テストデータ用）
      ev("comboFoods.forEach(recomputeComboFromIngredients)"); };
    mkCombos();
    const run = cmds => ev(`executeAiCommands(${JSON.stringify(cmds)}, 'テスト')`);
    const cmdSalt = { type: 'edit_foods', target: { db: 'combo', name_contains: ['パン', 'サンド'] }, ops: [{ field: 'salt', mode: 'add_per100', value: 1 }] };
    t('registered as a command type + documented compactly in the prompt', ev("AI_COMMAND_TYPES.includes('edit_foods')") && /edit_foods/.test(require('fs').readFileSync(__dirname + '/../app.js', 'utf8')));
    const promptDoc = require('fs').readFileSync(__dirname + '/../app.js', 'utf8').match(/8b\. edit_foods[\s\S]*?\n\n9\. delete_custom_food/)[0];
    t('prompt addition is small (< 1200 chars ≈ few hundred tokens)', promptDoc.length < 1200);
    const sandPer0 = ev("comboFoods[0].per"), sandSalt0 = ev("comboFoods[0].salt"), sandCal0 = ev("comboFoods[0].cal");
    const bk0 = ev('aiBackups.length');
    // dry run
    let log = run([{ ...cmdSalt, dry_run: true }]);
    t('dry_run lists targets and changes nothing', /対象2件/.test(log.join('')) && /ハムチーズサンド/.test(log.join('')) && /カレーパン/.test(log.join('')) && !/親子丼/.test(log.join('')) && ev("comboFoods[0].salt") === sandSalt0);
    // 本番: パン系の複合食品に100gあたり1%の食塩
    log = run([cmdSalt]);
    t('executes and reports count/rule/before→after', /2件更新/.test(log.join('')) && /塩分\+1\/100g/.test(log.join('')) && /→/.test(log.join('')));
    const s0 = ev("comboFoods[0]"), s1 = ev("comboFoods[1]"), s2 = ev("comboFoods[2]");
    t('sandwich: salt ingredient added = 1% of weight (2.0g of 200g)', (i => i && near(i.amount, 2.0))(s0.ingredients.find(i => i.name === '食塩（添加）')));
    t('sandwich: total salt +2.0g, weight +2.0g, calories unchanged', near(s0.salt, sandSalt0 + 2.0) && near(s0.per, sandPer0 + 2.0) && near(s0.cal, sandCal0) );
    t('curry bread (100g): +1.0g salt ingredient', near(s1.salt, 1.0 + 1.0) && near(s1.per, 101));
    t('non-bread combo untouched', ev("comboFoods[2].ingredients.length") === 2 && s2.salt === 3);
    t('totals stay consistent with ingredients (recompute gives same numbers)', (() => { const c = JSON.parse(JSON.stringify(ev("comboFoods[0]"))); ev(`window.__t=${JSON.stringify(c)};recomputeComboFromIngredients(window.__t)`); const r = ev("window.__t"); return near(r.salt, c.salt, 0.011) && near(r.per, c.per, 0.11) && near(r.cal, c.cal, 0.11); })());
    t('customs not touched when db=combo', ev("customFoods[1].salt") === 0.3);
    t('saved to localStorage', JSON.parse(w.localStorage.getItem('pfcComboFoods'))[0].ingredients.some(i => i.name === '食塩（添加）'));
    t('AI backup taken before the edit, and it holds the old values', ev('aiBackups.length') === bk0 + 2 && near(ev(`aiBackups[aiBackups.length-1].comboFoods[0].salt`), sandSalt0));
    // 2回目は累積（材料は1件のまま）
    run([cmdSalt]); const s0b = ev("comboFoods[0]"); t('running again accumulates into the same ingredient (no duplicates)', s0b.ingredients.filter(i => i.name === '食塩（添加）').length === 1 && near(s0b.ingredients.find(i => i.name === '食塩（添加）').amount, 2.0 + 2.02, 0.02));
    // カスタム食品: per換算
    mkCombos(); log = run([{ type: 'edit_foods', target: { db: 'custom', name_contains: ['パン'], exclude_contains: ['ケーキ'] }, ops: [{ field: 'salt', mode: 'add_per100', value: 1 }] }]);
    t('custom: per-aware (per50 → +0.5, per60 → +0.6) and excluded item skipped', near(ev("customFoods[1].salt"), 0.8) && near(ev("customFoods[2].salt"), 1.4) && ev("customFoods[3].salt") === 1.2 && ev("customFoods[0].salt") === 0.5);
    // category + mul
    mkCombos(); run([{ type: 'edit_foods', target: { db: 'both', category: '主食' }, ops: [{ field: 'salt', mode: 'mul', value: 0.5 }] }]);
    t('category match + mul: custom halves, combo ingredients halve and total follows', near(ev("customFoods[1].salt"), 0.15) && near(ev("customFoods[2].salt"), 0.4) && near(ev("comboFoods[0].salt"), sandSalt0 / 2, 0.06));
    // set_per100
    mkCombos(); run([{ type: 'edit_foods', target: { db: 'custom', names: ['メロンパン'] }, ops: [{ field: 'salt', mode: 'set_per100', value: 1.5 }, { field: 'cal', mode: 'mul', value: 1.1 }] }]);
    t('set_per100 + multiple ops (per50: 0.75g, cal ×1.1)', near(ev("customFoods[1].salt"), 0.75) && near(ev("customFoods[1].cal"), 220));
    // その他の栄養素: 調整材料
    mkCombos(); run([{ type: 'edit_foods', target: { db: 'combo', names: ['親子丼'] }, ops: [{ field: 'vitd', mode: 'add_per100', value: 2 }] }]);
    const oy = ev("comboFoods[2]"); t('non-salt add on a combo goes into a visible 調整（AI） ingredient and the total follows (+6μg for 300g)', (a => a && near(oy.vitd, 6, 0.02))(oy.ingredients.find(i => i.name === '調整（AI）')));
    t('adjustment ingredient is tiny (weight +0.1g only)', near(oy.per, 300.1, 0.05));
    run([{ type: 'edit_foods', target: { db: 'combo', names: ['親子丼'] }, ops: [{ field: 'vitd', mode: 'add_per100', value: 2 }] }]); t('repeated adjustment accumulates in the same adjustment ingredient', ev("comboFoods[2].ingredients.filter(i=>i.name==='調整（AI）').length") === 1 && near(ev("comboFoods[2].vitd"), 12, 0.05));
    // 検証・ガード
    const before = JSON.stringify([ev('customFoods'), ev('comboFoods')]);
    const errLines = [
      run([{ type: 'edit_foods', ops: [{ field: 'salt', mode: 'add_per100', value: 1 }] }]),
      run([{ type: 'edit_foods', target: { name_contains: ['パン'] }, ops: [{ field: 'nope', mode: 'add_per100', value: 1 }] }]),
      run([{ type: 'edit_foods', target: { name_contains: ['パン'] }, ops: [{ field: 'salt', mode: 'add_per100', value: 5000 }] }]),
      run([{ type: 'edit_foods', target: { name_contains: ['パン'] }, ops: [{ field: 'salt', mode: 'mul', value: 50 }] }]),
      run([{ type: 'edit_foods', target: { name_contains: ['パン'] }, ops: [] }]),
      run([{ type: 'edit_foods', target: { name_contains: ['存在しない食品'] }, ops: [{ field: 'salt', mode: 'add', value: 1 }] }])];
    t('no target / bad field / absurd per100 / huge multiplier / empty ops / zero hits are all rejected without changes', before === JSON.stringify([ev('customFoods'), ev('comboFoods')]) && errLines.every(l => /❌|⚠️/.test(l.join(''))));
    t('rejections are written to the error log', /edit_foods/.test(ev("JSON.stringify(errorLog)")));
    ev("customFoods = Array.from({length:120},(_,i)=>({id:1000+i,name:'パン'+i,per:100,cal:1,p:0,f:0,c:0,salt:0}))"); const big = run([{ type: 'edit_foods', target: { db: 'custom', name_contains: ['パン'] }, ops: [{ field: 'salt', mode: 'add', value: 1 }] }]);
    t('more than 100 matches aborts (nothing changed)', /多すぎ/.test(big.join('')) && ev("customFoods.every(f=>f.salt===0)"));
    // 1件ずつの結果出力は上限つき（トークン/表示の節約）
    ev("customFoods = Array.from({length:60},(_,i)=>({id:2000+i,name:'パン'+i,per:100,cal:1,p:0,f:0,c:0,salt:0}))"); const many = run([{ type: 'edit_foods', target: { db: 'custom', name_contains: ['パン'] }, ops: [{ field: 'salt', mode: 'add', value: 1 }] }]).join('');
    t('result list is capped at 15 names with a "ほか" count', (many.match(/・パン/g) || []).length === 15 && /ほか45件/.test(many));
    t.done(errs);
  } catch (x) { console.log('EXC', x); process.exit(1); }
}, 300);
