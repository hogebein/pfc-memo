// 食品記録の行（数量｜PFC｜繊維）に塩分も表示するテスト
const { loadApp, makeT } = require('./harness');
const { w, errs } = loadApp(); const t = makeT(); const ev = s => w.eval(s); const $ = id => w.document.getElementById(id);
setTimeout(() => {
  try {
    const today = ev("toDateStr(new Date())");
    ev(`currentDate='${today}';entries=[
      {id:1,date:'${today}',meal:'朝食',time:'07:00',name:'塩分あり',amount:120,cal:200,p:10,f:5,c:30,fiber:2.5,salt:1.27},
      {id:2,date:'${today}',meal:'朝食',time:'07:00',name:'塩分なし',amount:100,cal:100,p:1,f:1,c:20,fiber:1,salt:0},
      {id:3,date:'${today}',meal:'朝食',time:'07:00',name:'繊維なし塩あり',amount:50,cal:50,p:1,f:1,c:5,salt:0.05},
      {id:4,date:'${today}',meal:'昼食',time:'12:00',name:'食塩（添加）',amount:2,cal:0,p:0,f:0,c:0,salt:2,addedSalt:true},
      {id:5,date:'${today}',meal:'昼食',time:'12:00',name:'VD',amount:80,cal:100,p:1,f:1,c:1,fiber:1,salt:3.4,vitd:5.2}]`);
    w.renderRecord();
    const row = id => w.document.querySelector(`.log-item[data-eid="${id}"] .li-detail`).textContent.replace(/\s+/g, '');
    t('row shows 数量｜PFC｜繊維｜塩分 in that order', row(1) === '120g｜P10F5C30｜繊2.5｜塩1.27');
    t('no salt segment when the entry has no salt', row(2) === '100g｜P1F1C20｜繊1' && !/塩/.test(row(2)));
    t('salt is shown even without fibre; small values keep 2 decimals', row(3) === '50g｜P1F1C5｜塩0.05');
    t('added-salt entry shows its salt', /塩2$/.test(row(4)));
    t('salt comes before the vitamin D segment', row(5) === '80g｜P1F1C1｜繊1｜塩3.4｜D5.2μg');
    t('amount pill is still there (tap target for the quantity strip)', !!w.document.querySelector('.log-item[data-eid="1"] .amt-pill'));
    t.done(errs);
  } catch (x) { console.log('EXC', x); process.exit(1); }
}, 300);
