// 添加塩（食品とは別に足した塩）の入力欄の回帰テスト
const { loadApp, makeT, sleep } = require('./harness');
const { w, errs } = loadApp(); const t = makeT(); const ev = s => w.eval(s); const $ = id => w.document.getElementById(id);
setTimeout(async () => {
  try {
    ev("currentDate='2026-11-14';entries=[]");
    const food = { id: 1, date: '2026-11-14', meal: '昼食', name: '醤油（濃口）', amount: 6, cal: 4, p: 0.5, f: 0, c: 0.6, salt: 0.9 };
    ev("entries.push(" + JSON.stringify(food) + ")"); w.renderRecord();
    t('row is rendered with 4 meal options', $('asMeal') && $('asMeal').options.length === 4 && $('asG'));
    $('asMeal').value = '昼食'; w.eval("_asMeal='昼食'"); $('asG').value = '1.5'; w.addAddedSalt();
    t('adds one 食塩（添加） entry in the chosen meal, salt = grams, no calories', (a => a.length === 1 && a[0].meal === '昼食' && a[0].salt === 1.5 && a[0].amount === 1.5 && a[0].cal === 0 && a[0].addedSalt === true && a[0].date === '2026-11-14')(ev("entries.filter(e=>e.name==='食塩（添加）')")));
    t('input cleared after adding', $('asG').value === '');
    t('daily salt total = food 0.9 + added 1.5', Math.abs(ev("sumEntries(getDayEntries('2026-11-14')).salt") - 2.4) < 1e-9);
    t('micro grid shows food/added breakdown for salt', /食品 0\.9 \/ 添加 1\.5/.test($('microGrid').innerHTML));
    t('info line shows added vs food-derived', /添加塩 1\.5g（食品由来 0\.9g）/.test($('addedSaltInfo').textContent));
    // 同じ食事への追加は1件に合算
    $('asG').value = '0.5'; w.addAddedSalt();
    t('second addition to the same meal merges into one entry (2.0g)', (a => a.length === 1 && Math.abs(a[0].salt - 2) < 1e-9 && Math.abs(a[0].amount - 2) < 1e-9)(ev("entries.filter(e=>e.name==='食塩（添加）')")));
    // 別の食事は別件
    $('asMeal').value = '夕食'; $('asMeal').onchange(); $('asG').value = '1'; w.addAddedSalt();
    t('another meal gets its own entry; day total 3.9', ev("entries.filter(e=>e.name==='食塩（添加）').length") === 2 && Math.abs(ev("sumEntries(getDayEntries('2026-11-14')).salt") - 3.9) < 1e-9);
    t('selected meal is remembered after re-render', $('asMeal').value === '夕食');
    // 入力の検証
    const n = ev('entries.length'); $('asG').value = ''; w.addAddedSalt(); $('asG').value = '-2'; w.addAddedSalt(); $('asG').value = '99'; w.addAddedSalt();
    t('empty / negative / absurd amounts are rejected', ev('entries.length') === n);
    // 保存・同期・CSV
    t('persisted to localStorage', JSON.parse(w.localStorage.getItem('pfcEntries')).some(e => e.name === '食塩（添加）' && e.addedSalt));
    t('isAddedSalt also recognises an AI-added entry by name only', ev("isAddedSalt({name:'食塩（添加）',salt:1})") === true && ev("isAddedSalt({name:'塩（小さじ1）'})") === false && ev("addedSaltOf([{name:'食塩（添加）',salt:2},{name:'x',salt:5}])") === 2);
    // 別日のデータには影響しない
    ev("currentDate='2026-11-15'"); w.renderRecord(); t('other day shows no added salt', ev("addedSaltOf(getDayEntries('2026-11-15'))") === 0 && $('addedSaltInfo').textContent === '');
    // 日付コピーで引き継がれる
    ev("currentDate='2026-11-15'"); w.eval("(function(){var i=document.getElementById('copyFromDate');i.value='2026-11-14';var c=document.getElementById('copyExercise');if(c)c.checked=false;})()"); w.executeCopyDay(); await sleep(30);
    t('copy-day carries the added salt too', Math.abs(ev("sumEntries(getDayEntries('2026-11-15')).salt") - 3.9) < 1e-9);
    // 統計の平均（塩分）にも入る
    ev("statsPeriod=7"); t('stats average includes added salt', ev("(getAvg(7)||{}).salt") > 0);
    // 編集で量を変えると塩分も比例
    ev("currentDate='2026-11-14'"); const id = ev("entries.find(e=>e.name==='食塩（添加）'&&e.meal==='昼食').id"); w.renderRecord(); w.startEdit(id); await sleep(10);
    $('ea' + id).value = '3'; w.recalcEdit(id);
    t('editing the amount of the added-salt entry scales its salt proportionally (2g → 3g)', Math.abs(parseFloat($('esl' + id).value) - 3) < 0.011);
    t('AI prompt tells the model how to log added salt', /【添加した塩】[^\n]*食塩（添加）/.test(require('fs').readFileSync(__dirname + '/../app.js', 'utf8')));
    t.done(errs);
  } catch (x) { console.log('EXC', x); process.exit(1); }
}, 300);
