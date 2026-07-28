// ── 正規化 ──
function normalize(s) {
  return s.toLowerCase()
    .replace(/[\u3041-\u3096]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60))
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
}

// ── ミクロ栄養素目標 ──
const MICRO_GOALS = {
  fiber:   { label:'食物繊維', unit:'g',  goal:21,   color:'#8bc34a' },
  iron:    { label:'鉄',       unit:'mg', goal:7,    color:'#e91e63' },
  calcium: { label:'Ca',       unit:'mg', goal:700,  color:'#03a9f4' },
  vitc:    { label:'VitC',     unit:'mg', goal:100,  color:'#ff9800' },
  vitd:    { label:'VitD',     unit:'μg', goal:8.5,  color:'#ffd600' },
  salt:    { label:'塩分',     unit:'g',  goal:7.5,  color:'#9e9e9e', reverse:true },
};
const MICRO_KEYS = Object.keys(MICRO_GOALS);

const MEAL_META = {
  朝食:{ icon:'🌅', bg:'#fff8e6' },
  昼食:{ icon:'☀️', bg:'#e6f1fb' },
  夕食:{ icon:'🌙', bg:'#ede9ff' },
  間食:{ icon:'🍎', bg:'#e8f5e9' },
};
const MEALS_ORDER = ['朝食','昼食','夕食','間食'];

// ── タンパク質吸収率 ──
// 肉類・魚類・卵類: ×0.95（消化性高）/ その他: ×0.85
const P_ABS_HIGH = 0.95;
const P_ABS_LOW  = 0.85;
const P_ABS_HIGH_PATTERN = /鶏|豚|牛|羊|合いびき|ひき肉|ベーコン|ハム|ソーセージ|ウインナー|サラミ|いわし|さば|さんま|あじ|さけ|鮭|サーモン|まぐろ|マグロ|ツナ|えび|いか|ほたて|あさり|カニ|かに|ぶり|たい|鯛|たら|タラ|さわら|卵|たまご|タマゴ|ゆで卵|目玉焼き|スクランブル|ヴィーナス|ささみ|チキン|ポーク|ビーフ|シーフード|seafood|chicken|pork|beef|fish|salmon|tuna|egg|shrimp/i;

function calcAbsorbedProtein(list) {
  // aa.scoreがあればDIAAS近似値×吸収率、なければ従来のパターンマッチ
  return list.reduce((sum, e) => {
    const p = e.p || 0;
    if (p <= 0) return sum;
    // aa.score があれば DIAAS × 0.9（腸吸収係数）で高精度推定
    if (e.aa && e.aa.score) {
      return sum + p * Math.min(e.aa.score, 1.0) * 0.9;
    }
    // フォールバック: 従来の食品名パターン
    const rate = P_ABS_HIGH_PATTERN.test(e.name) ? P_ABS_HIGH : P_ABS_LOW;
    return sum + p * rate;
  }, 0);
}



// ── 内蔵DB ──
const LOCAL_DB = [
  {name:'白米（炊飯）',yomi:'ハクマイ',tags:'ごはん こめ',en:'white rice cooked rice',cal:168,p:2.5,f:0.3,c:37.1,per:100,fiber:0.3,iron:0.1,calcium:3,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59},serving:150},
  {name:'玄米（炊飯）',yomi:'ゲンマイ',tags:'ごはん こめ',en:'brown rice',cal:165,p:2.8,f:1.0,c:35.6,per:100,fiber:1.4,iron:0.6,calcium:7,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59},serving:150,fa:{sat:0.17,mufa:0.42,n3:0.01,n6:0.35,trans:0.01}},
  {name:'白米（生米・精白米）',yomi:'ハクマイナマゴメ',tags:'ごはん こめ 生米 乾物 精米',en:'white rice raw uncooked milled',cal:342,p:6.1,f:0.9,c:77.6,per:100,fiber:0.5,iron:0.8,calcium:5,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59},fa:{sat:0.25,mufa:0.3,n3:0.04,n6:0.3,trans:0.01}},
  {name:'玄米（生米）',yomi:'ゲンマイナマゴメ',tags:'ごはん こめ 生米 乾物',en:'brown rice raw uncooked',cal:346,p:6.8,f:2.7,c:74.3,per:100,fiber:3.0,iron:2.1,calcium:9,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59},fa:{sat:0.17,mufa:0.42,n3:0.01,n6:0.35,trans:0.01}},
  {name:'ご飯（茶碗1杯）',yomi:'ゴハン',tags:'こめ めし',en:'cooked rice bowl',cal:269,p:4.0,f:0.5,c:59.4,per:160,fiber:0.5,iron:0.2,calcium:5,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59},serving:160,fa:{sat:0.25,mufa:0.3,n3:0.04,n6:0.3,trans:0.01}},
  {name:'食パン',yomi:'ショクパン',tags:'ぱん',en:'bread white bread',cal:248,p:8.9,f:4.1,c:44.4,per:100,fiber:2.3,iron:0.5,calcium:29,vitc:0,vitd:0,salt:1.2,aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},fa:{sat:0.2,mufa:0.3,n3:0.05,n6:0.35,trans:0.0},serving:60},
  {name:'うどん（茹で）',yomi:'ウドン',tags:'',en:'udon noodle',cal:105,p:2.6,f:0.4,c:21.6,per:100,fiber:0.8,iron:0.2,calcium:9,vitc:0,vitd:0,salt:0.3,fa:{sat:.25,mufa:.30,n3:.04,n6:.30,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},serving:200},
  {name:'そば（茹で）',yomi:'ソバ',tags:'',en:'soba buckwheat noodle',cal:130,p:4.8,f:1.0,c:26.0,per:100,fiber:2.0,iron:0.8,calcium:9,vitc:0,vitd:0,salt:0,fa:{sat:.25,mufa:.30,n3:.04,n6:.30,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},serving:180},
  {name:'パスタ（茹で）',yomi:'パスタ',tags:'スパゲッティ',en:'pasta spaghetti',cal:149,p:5.8,f:0.9,c:29.2,per:100,fiber:1.5,iron:0.7,calcium:7,vitc:0,vitd:0,salt:0,fa:{sat:.25,mufa:.30,n3:.04,n6:.30,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},serving:180},
  {name:'オートミール',yomi:'オートミール',tags:'えんばく',en:'oatmeal oats',cal:380,p:13.7,f:5.7,c:69.1,per:100,fiber:9.4,iron:3.9,calcium:47,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},fa:{sat:0.18,mufa:0.36,n3:0.05,n6:0.38,trans:0.0},serving:40},
  {name:'鶏むね肉（皮なし）',yomi:'トリムネニク',tags:'チキン',en:'chicken breast skinless',cal:108,p:22.3,f:1.5,c:0,per:100,fiber:0,iron:0.3,calcium:4,vitc:3,vitd:0.1,salt:0.1,fa:{sat:.28,mufa:.40,n3:.02,n6:.22,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08},serving:150},
  {name:'鶏もも肉（皮あり）',yomi:'トリモモニク',tags:'チキン',en:'chicken thigh',cal:190,p:17.3,f:13.0,c:0,per:100,fiber:0,iron:0.4,calcium:5,vitc:2,vitd:0.4,salt:0.2,fa:{sat:.31,mufa:.44,n3:.03,n6:.18,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08},serving:150},
  {name:'ささみ',yomi:'ササミ',tags:'とり チキン',en:'chicken tenderloin',cal:98,p:23.0,f:0.8,c:0,per:100,fiber:0,iron:0.3,calcium:3,vitc:3,vitd:0,salt:0.1,fa:{sat:.28,mufa:.40,n3:.02,n6:.22,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08},serving:100},
  {name:'豚ロース',yomi:'ブタロース',tags:'ぽーく',en:'pork loin',cal:263,p:19.3,f:19.2,c:0.2,per:100,fiber:0,iron:0.5,calcium:4,vitc:1,vitd:0.4,salt:0.1,fa:{sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:0.98},serving:150},
  {name:'豚バラ',yomi:'ブタバラ',tags:'ぽーく',en:'pork belly',cal:395,p:14.4,f:35.4,c:0.1,per:100,fiber:0,iron:0.4,calcium:4,vitc:1,vitd:0.3,salt:0.1,fa:{sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:0.98},serving:150},
  {name:'牛もも肉',yomi:'ウシモモニク',tags:'ビーフ',en:'beef round steak',cal:182,p:21.2,f:10.2,c:0.4,per:100,fiber:0,iron:2.7,calcium:4,vitc:1,vitd:0.1,salt:0.1,fa:{sat:.47,mufa:.43,n3:.01,n6:.05,trans:.02},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08},serving:150},
  {name:'牛ひき肉',yomi:'ウシヒキニク',tags:'ひき ビーフ',en:'ground beef',cal:272,p:17.1,f:21.1,c:0.3,per:100,fiber:0,iron:2.4,calcium:5,vitc:1,vitd:0.1,salt:0.1,fa:{sat:.47,mufa:.43,n3:.01,n6:.05,trans:.02},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:100},
  {name:'合いびき肉',yomi:'アイビキニク',tags:'ひき',en:'mixed ground meat',cal:257,p:17.4,f:19.0,c:0.3,per:100,fiber:0,iron:1.5,calcium:5,vitc:1,vitd:0.2,salt:0.1,fa:{sat:.43,mufa:.44,n3:.01,n6:.08,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},serving:100},
  {name:'ベーコン',yomi:'ベーコン',tags:'',en:'bacon',cal:405,p:12.9,f:39.1,c:0.3,per:100,fiber:0,iron:0.4,calcium:5,vitc:15,vitd:0.5,salt:2.0,fa:{sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:0.98},serving:30},
  {name:'ウインナー',yomi:'ウインナー',tags:'ソーセージ',en:'sausage wiener',cal:321,p:11.5,f:28.5,c:3.3,per:100,fiber:0,iron:0.7,calcium:9,vitc:11,vitd:0.3,salt:1.9,fa:{sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:0.98},serving:50},
  {name:'いわし（マイワシ）',yomi:'イワシ',tags:'',en:'sardine iwashi',cal:177,p:19.2,f:9.2,c:0.2,per:100,fiber:0,iron:2.1,calcium:74,vitc:0,vitd:32,salt:0.2,fa:{sat:.25,mufa:.27,n3:.31,n6:.05,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:100},
  {name:'いわし缶（水煮）',yomi:'イワシカン',tags:'いわし 缶詰',en:'canned sardine',cal:136,p:20.3,f:5.6,c:0.1,per:100,fiber:0,iron:2.6,calcium:320,vitc:0,vitd:27,salt:0.8,fa:{sat:.25,mufa:.27,n3:.31,n6:.05,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:100},
  {name:'さば（マサバ）',yomi:'サバ',tags:'',en:'mackerel saba',cal:247,p:20.6,f:16.8,c:0.3,per:100,fiber:0,iron:1.2,calcium:6,vitc:1,vitd:11,salt:0.3,fa:{sat:.25,mufa:.29,n3:.31,n6:.04,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:100},
  {name:'さば缶（水煮）',yomi:'サバカン',tags:'さば 缶詰',en:'canned mackerel',cal:174,p:20.9,f:10.7,c:0.2,per:100,fiber:0,iron:1.7,calcium:260,vitc:0,vitd:11,salt:0.9,fa:{sat:.25,mufa:.29,n3:.31,n6:.04,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:100},
  {name:'さば缶（味噌煮）',yomi:'サバカンミソ',tags:'さば 缶詰 みそ',en:'canned mackerel miso',cal:210,p:16.3,f:13.9,c:6.6,per:100,fiber:0.5,iron:1.5,calcium:200,vitc:0,vitd:9,salt:1.2,fa:{sat:.25,mufa:.29,n3:.31,n6:.04,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:100},
  {name:'さんま',yomi:'サンマ',tags:'',en:'pacific saury',cal:318,p:17.4,f:25.6,c:0.1,per:100,fiber:0,iron:1.4,calcium:28,vitc:0,vitd:19,salt:0.3,fa:{sat:.22,mufa:.42,n3:.22,n6:.03,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:130},
  {name:'あじ（マアジ）',yomi:'アジ',tags:'',en:'horse mackerel aji',cal:126,p:20.7,f:4.5,c:0.1,per:100,fiber:0,iron:0.6,calcium:66,vitc:0,vitd:8,salt:0.3,fa:{sat:.27,mufa:.31,n3:.25,n6:.07,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:130},
  {name:'サーモン（養殖）',yomi:'サーモン',tags:'鮭 しゃけ さけ',en:'salmon',cal:204,p:20.1,f:12.8,c:0.1,per:100,fiber:0,iron:0.4,calcium:14,vitc:5,vitd:15,salt:0.1,fa:{sat:.22,mufa:.32,n3:.32,n6:.08,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:100},
  {name:'鮭（シロサケ）',yomi:'サケ',tags:'さけ しゃけ',en:'salmon sake',cal:133,p:22.3,f:4.1,c:0.1,per:100,fiber:0,iron:0.5,calcium:14,vitc:5,vitd:32,salt:0.2,fa:{sat:.22,mufa:.32,n3:.32,n6:.08,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:100},
  {name:'マグロ（赤身）',yomi:'マグロ',tags:'ツナ まぐろ',en:'tuna maguro lean',cal:115,p:26.4,f:1.4,c:0.1,per:100,fiber:0,iron:1.1,calcium:5,vitc:2,vitd:4,salt:0.1,fa:{sat:.28,mufa:.18,n3:.38,n6:.05,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:100},
  {name:'マグロ（トロ）',yomi:'マグロトロ',tags:'まぐろ',en:'tuna fatty toro',cal:344,p:20.1,f:27.5,c:0.1,per:100,fiber:0,iron:1.6,calcium:7,vitc:2,vitd:18,salt:0.1,fa:{sat:.28,mufa:.18,n3:.38,n6:.05,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:100},
  {name:'えび',yomi:'エビ',tags:'海老',en:'shrimp prawn ebi',cal:83,p:18.4,f:0.3,c:0.7,per:100,fiber:0,iron:0.7,calcium:67,vitc:0,vitd:0,salt:0.6,fa:{sat:.30,mufa:.18,n3:.28,n6:.10,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:100},
  {name:'いか',yomi:'イカ',tags:'烏賊',en:'squid ika',cal:83,p:17.9,f:0.8,c:0.1,per:100,fiber:0,iron:0.1,calcium:11,vitc:1,vitd:0,salt:0.5,fa:{sat:.31,mufa:.22,n3:.26,n6:.07,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'ツナ缶（水煮）',yomi:'ツナカン',tags:'まぐろ 缶詰',en:'canned tuna water',cal:71,p:16.0,f:0.7,c:0.1,per:100,fiber:0,iron:0.5,calcium:6,vitc:0,vitd:3,salt:0.4,fa:{sat:.28,mufa:.18,n3:.38,n6:.05,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:100},
  {name:'ツナ缶（油漬け）',yomi:'ツナカンアブラ',tags:'まぐろ 缶詰',en:'canned tuna oil',cal:267,p:14.5,f:21.7,c:0.1,per:100,fiber:0,iron:0.5,calcium:5,vitc:0,vitd:3,salt:0.4,fa:{sat:.28,mufa:.18,n3:.38,n6:.05,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:100},
  {name:'卵',yomi:'タマゴ',tags:'えっぐ たまご',en:'egg',cal:151,p:12.3,f:10.3,c:0.3,per:100,fiber:0,iron:1.8,calcium:51,vitc:0,vitd:3.8,salt:0.3,fa:{sat:.30,mufa:.42,n3:.03,n6:.19,trans:.01},aa:{leu:.09,ile:.06,val:.07,lys:.09,met:.03,thr:.06,trp:.02,his:.03,score:1.13},serving:50},
  {name:'牛乳',yomi:'ギュウニュウ',tags:'ミルク',en:'milk',cal:67,p:3.3,f:3.8,c:4.8,per:100,fiber:0,iron:0,calcium:110,vitc:1,vitd:0.3,salt:0.1,fa:{sat:.47,mufa:.43,n3:.01,n6:.05,trans:.02},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:200},
  {name:'低脂肪乳',yomi:'テイシボウニュウ',tags:'ミルク',en:'low fat milk',cal:46,p:3.8,f:1.0,c:5.5,per:100,fiber:0,iron:0,calcium:130,vitc:1,vitd:0.3,salt:0.1,fa:{sat:.62,mufa:.28,n3:.01,n6:.02,trans:.03},aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22}},
  {name:'ヨーグルト（無糖）',yomi:'ヨーグルト',tags:'',en:'yogurt plain unsweetened',cal:62,p:3.6,f:3.0,c:4.9,per:100,fiber:0,iron:0,calcium:120,vitc:1,vitd:0,salt:0.1,fa:{sat:.60,mufa:.30,n3:.01,n6:.03,trans:.02},aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22},serving:150},
  {name:'ギリシャヨーグルト',yomi:'ギリシャヨーグルト',tags:'ヨーグルト',en:'greek yogurt',cal:83,p:8.7,f:3.0,c:4.0,per:100,fiber:0,iron:0,calcium:100,vitc:0,vitd:0,salt:0.1,fa:{sat:.60,mufa:.30,n3:.01,n6:.03,trans:.02},aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22},serving:100},
  {name:'チーズ（プロセス）',yomi:'チーズ',tags:'',en:'cheese processed',cal:339,p:22.7,f:26.0,c:1.3,per:100,fiber:0,iron:0.3,calcium:630,vitc:0,vitd:0.2,salt:2.8,fa:{sat:.63,mufa:.27,n3:.01,n6:.02,trans:.03},aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22}},
  {name:'カッテージチーズ',yomi:'カッテージチーズ',tags:'チーズ',en:'cottage cheese',cal:105,p:13.3,f:4.5,c:1.9,per:100,fiber:0,iron:0.1,calcium:55,vitc:0,vitd:0,salt:0.7,fa:{sat:.63,mufa:.27,n3:.01,n6:.02,trans:.03},aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22},serving:100},
  {name:'バター',yomi:'バター',tags:'',en:'butter',cal:745,p:0.5,f:81.0,c:0.2,per:100,fiber:0,iron:0,calcium:14,vitc:0,vitd:0,salt:1.9,fa:{sat:.63,mufa:.27,n3:.01,n6:.03,trans:.04}},
  {name:'豆腐（木綿）',yomi:'モメンドウフ',tags:'とうふ',en:'tofu firm',cal:72,p:6.6,f:4.2,c:1.6,per:100,fiber:0.4,iron:1.5,calcium:93,vitc:0,vitd:0,salt:0,fa:{sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00},aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.91}},
  {name:'豆腐（絹ごし）',yomi:'キヌゴシドウフ',tags:'とうふ',en:'tofu silken soft',cal:56,p:4.9,f:3.0,c:2.0,per:100,fiber:0.3,iron:1.2,calcium:75,vitc:0,vitd:0,salt:0,fa:{sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00},aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.91}},
  {name:'納豆',yomi:'ナットウ',tags:'',en:'natto fermented soybean',cal:200,p:16.5,f:10.0,c:10.7,per:100,fiber:6.7,iron:3.3,calcium:90,vitc:13,vitd:0,salt:0,fa:{sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00},aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.91},serving:50},
  {name:'大豆（乾燥）',yomi:'ダイズ',tags:'まめ 豆',en:'soybean dried',cal:417,p:35.3,f:19.0,c:28.2,per:100,fiber:17.1,iron:9.4,calcium:240,vitc:0,vitd:0,salt:0,fa:{sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00},aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.91}},
  {name:'小豆（乾燥）',yomi:'アズキ',tags:'あずき まめ 豆',en:'azuki red bean adzuki',cal:339,p:20.3,f:2.2,c:59.6,per:100,fiber:24.2,iron:5.4,calcium:70,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},fa:{sat:0.14,mufa:0.24,n3:0.07,n6:0.52,trans:0}},
  {name:'ひよこ豆（茹で）',yomi:'ヒヨコマメ',tags:'ガルバンゾー まめ 豆',en:'chickpea garbanzo',cal:171,p:9.5,f:2.5,c:27.4,per:100,fiber:11.6,iron:2.6,calcium:45,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.72},fa:{sat:0.14,mufa:0.24,n3:0.07,n6:0.52,trans:0}},
  {name:'ひよこ豆（乾燥）',yomi:'ヒヨコマメカンソウ',tags:'ガルバンゾー まめ 豆 乾物 乾燥',en:'chickpea garbanzo dried',cal:336,p:20.0,f:5.2,c:61.5,per:100,fiber:16.3,iron:2.6,calcium:100,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.72},fa:{sat:0.14,mufa:0.24,n3:0.07,n6:0.52,trans:0}},
  {name:'レンズ豆（茹で）',yomi:'レンズマメ',tags:'まめ 豆',en:'lentil',cal:130,p:11.0,f:0.8,c:21.2,per:100,fiber:9.0,iron:2.9,calcium:27,vitc:2,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.72},fa:{sat:0.14,mufa:0.24,n3:0.07,n6:0.52,trans:0}},
  {name:'黒豆（茹で）',yomi:'クロマメ',tags:'まめ 豆',en:'black bean black soybean',cal:174,p:13.0,f:3.9,c:24.2,per:100,fiber:11.0,iron:2.9,calcium:130,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.72},fa:{sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00}},
  {name:'黒豆（乾燥）',yomi:'クロマメカンソウ',tags:'まめ 豆 乾物 乾燥 黒大豆',en:'black soybean dried',cal:417,p:33.9,f:18.4,c:28.7,per:100,fiber:15.9,iron:6.8,calcium:140,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.91},fa:{sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00}},
  {name:'えだまめ',yomi:'エダマメ',tags:'まめ 豆',en:'edamame green soybean',cal:135,p:11.5,f:6.1,c:8.8,per:100,fiber:5.0,iron:2.5,calcium:76,vitc:27,vitd:0,salt:0,fa:{sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00},aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.91}},
  {name:'きな粉',yomi:'キナコ',tags:'きなこ 大豆',en:'kinako soy flour roasted',cal:437,p:36.7,f:25.7,c:28.5,per:100,fiber:15.4,iron:8.0,calcium:190,vitc:0,vitd:0,salt:0,fa:{sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00},aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.91}},
  {name:'豆乳（無調整）',yomi:'トウニュウ',tags:'まめ 大豆 ミルク',en:'soy milk unsweetened',cal:46,p:3.6,f:2.0,c:3.1,per:100,fiber:0.2,iron:1.2,calcium:15,vitc:0,vitd:0,salt:0,fa:{sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00},aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22},serving:200},
  {name:'インゲン豆（茹で）',yomi:'インゲンマメ',tags:'まめ 豆 いんげん',en:'kidney bean green bean',cal:143,p:8.5,f:0.9,c:24.8,per:100,fiber:19.6,iron:3.2,calcium:130,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.72},fa:{sat:0.14,mufa:0.24,n3:0.07,n6:0.52,trans:0}},
  {name:'ブロッコリー',yomi:'ブロッコリー',tags:'',en:'broccoli',cal:33,p:4.3,f:0.5,c:5.2,per:100,fiber:4.4,iron:1.0,calcium:38,vitc:120,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},fa:{sat:0.2,mufa:0.15,n3:0.3,n6:0.2,trans:0.0}},
  {name:'ほうれん草',yomi:'ホウレンソウ',tags:'',en:'spinach',cal:20,p:2.2,f:0.4,c:3.1,per:100,fiber:2.8,iron:2.0,calcium:49,vitc:35,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'小松菜',yomi:'コマツナ',tags:'菜っ葉',en:'komatsuna japanese mustard spinach',cal:14,p:1.5,f:0.2,c:2.4,per:100,fiber:1.9,iron:2.8,calcium:170,vitc:39,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'キャベツ',yomi:'キャベツ',tags:'',en:'cabbage',cal:23,p:1.3,f:0.2,c:5.2,per:100,fiber:1.8,iron:0.3,calcium:43,vitc:41,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'白菜',yomi:'ハクサイ',tags:'',en:'napa cabbage chinese cabbage',cal:14,p:0.8,f:0.1,c:3.2,per:100,fiber:1.3,iron:0.3,calcium:43,vitc:19,vitd:0,salt:0},
  {name:'玉ねぎ',yomi:'タマネギ',tags:'',en:'onion',cal:37,p:1.0,f:0.1,c:8.8,per:100,fiber:1.6,iron:0.2,calcium:21,vitc:8,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'長ねぎ',yomi:'ナガネギ',tags:'ねぎ',en:'leek green onion negi',cal:34,p:1.4,f:0.3,c:8.3,per:100,fiber:2.5,iron:0.3,calcium:36,vitc:14,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'にんにく',yomi:'ニンニク',tags:'ガーリック',en:'garlic',cal:136,p:6.4,f:0.9,c:27.5,per:100,fiber:6.2,iron:0.8,calcium:14,vitc:12,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},fa:{sat:0.2,mufa:0.05,n3:0.3,n6:0.4,trans:0}},
  {name:'しょうが',yomi:'ショウガ',tags:'ジンジャー',en:'ginger',cal:30,p:0.9,f:0.3,c:6.6,per:100,fiber:2.1,iron:0.5,calcium:19,vitc:2,vitd:0,salt:0},
  {name:'にんじん',yomi:'ニンジン',tags:'キャロット',en:'carrot',cal:39,p:0.7,f:0.1,c:9.3,per:100,fiber:2.8,iron:0.2,calcium:28,vitc:6,vitd:0,salt:0.1},
  {name:'じゃがいも',yomi:'ジャガイモ',tags:'ポテト',en:'potato',cal:76,p:1.6,f:0.1,c:17.6,per:100,fiber:1.3,iron:0.4,calcium:4,vitc:35,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'さつまいも',yomi:'サツマイモ',tags:'',en:'sweet potato',cal:132,p:1.2,f:0.2,c:31.5,per:100,fiber:2.2,iron:0.6,calcium:47,vitc:29,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'かぼちゃ',yomi:'カボチャ',tags:'パンプキン',en:'pumpkin kabocha squash',cal:91,p:1.9,f:0.3,c:20.6,per:100,fiber:3.5,iron:0.5,calcium:15,vitc:43,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'トマト',yomi:'トマト',tags:'',en:'tomato',cal:20,p:0.7,f:0.1,c:4.7,per:100,fiber:1.0,iron:0.2,calcium:7,vitc:15,vitd:0,salt:0},
  {name:'アボカド',yomi:'アボカド',tags:'',en:'avocado',cal:187,p:2.1,f:17.5,c:6.2,per:100,fiber:5.6,iron:0.7,calcium:9,vitc:15,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},serving:100,fa:{sat:0.14,mufa:0.74,n3:0.01,n6:0.1,trans:0}},
  {name:'ピーマン',yomi:'ピーマン',tags:'',en:'green pepper bell pepper',cal:22,p:0.9,f:0.2,c:5.1,per:100,fiber:2.3,iron:0.4,calcium:11,vitc:76,vitd:0,salt:0},
  {name:'パプリカ（赤）',yomi:'パプリカ',tags:'ピーマン',en:'red bell pepper paprika',cal:30,p:1.0,f:0.2,c:7.2,per:100,fiber:1.6,iron:0.4,calcium:7,vitc:170,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'もやし',yomi:'モヤシ',tags:'',en:'bean sprouts moyashi',cal:15,p:1.7,f:0.1,c:2.6,per:100,fiber:1.3,iron:0.3,calcium:23,vitc:8,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'ごぼう',yomi:'ゴボウ',tags:'',en:'burdock gobo',cal:65,p:1.8,f:0.1,c:15.4,per:100,fiber:5.7,iron:0.7,calcium:46,vitc:3,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'れんこん',yomi:'レンコン',tags:'蓮根',en:'lotus root renkon',cal:66,p:1.9,f:0.1,c:15.5,per:100,fiber:2.0,iron:0.5,calcium:20,vitc:48,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'しいたけ',yomi:'シイタケ',tags:'きのこ',en:'shiitake mushroom',cal:25,p:3.0,f:0.4,c:6.4,per:100,fiber:4.2,iron:0.3,calcium:2,vitc:0,vitd:0.4,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'えのきたけ',yomi:'エノキ',tags:'きのこ えのき',en:'enoki mushroom',cal:34,p:2.7,f:0.2,c:7.6,per:100,fiber:3.9,iron:1.1,calcium:5,vitc:0,vitd:0.9,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'まいたけ',yomi:'マイタケ',tags:'きのこ',en:'maitake mushroom',cal:22,p:2.0,f:0.5,c:4.4,per:100,fiber:3.5,iron:0.2,calcium:4,vitc:0,vitd:4.9,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},fa:{sat:0.15,mufa:0.05,n3:0.05,n6:0.65,trans:0}},
  {name:'しめじ',yomi:'シメジ',tags:'きのこ',en:'shimeji mushroom',cal:26,p:2.7,f:0.5,c:5.0,per:100,fiber:3.0,iron:0.5,calcium:2,vitc:0,vitd:0.5,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},fa:{sat:0.15,mufa:0.05,n3:0.05,n6:0.65,trans:0}},
  {name:'バナナ',yomi:'バナナ',tags:'',en:'banana',cal:86,p:1.1,f:0.2,c:22.5,per:100,fiber:1.1,iron:0.3,calcium:6,vitc:16,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'りんご',yomi:'リンゴ',tags:'アップル',en:'apple',cal:61,p:0.2,f:0.2,c:15.5,per:100,fiber:1.5,iron:0,calcium:4,vitc:6,vitd:0,salt:0},
  {name:'みかん',yomi:'ミカン',tags:'オレンジ',en:'mandarin orange tangerine',cal:46,p:0.7,f:0.1,c:11.0,per:100,fiber:1.0,iron:0.1,calcium:21,vitc:35,vitd:0,salt:0},
  {name:'いちご',yomi:'イチゴ',tags:'',en:'strawberry',cal:34,p:0.9,f:0.1,c:8.5,per:100,fiber:1.4,iron:0.3,calcium:17,vitc:62,vitd:0,salt:0},
  {name:'米油',yomi:'コメアブラ',tags:'こめ 油 あぶら',en:'rice bran oil rice oil',cal:921,p:0,f:100,c:0,per:100,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0,fa:{sat:.17,mufa:.42,n3:.01,n6:.35,trans:.01}},
  {name:'オリーブオイル',yomi:'オリーブオイル',tags:'油 あぶら',en:'olive oil',cal:921,p:0,f:100,c:0,per:100,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0,fa:{sat:.14,mufa:.74,n3:.01,n6:.10,trans:.00}},
  {name:'ごま油',yomi:'ゴマアブラ',tags:'油 あぶら',en:'sesame oil',cal:921,p:0,f:100,c:0,per:100,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0,fa:{sat:.15,mufa:.39,n3:.00,n6:.43,trans:.00}},
  {name:'サラダ油',yomi:'サラダアブラ',tags:'油 あぶら',en:'vegetable oil salad oil',cal:921,p:0,f:100,c:0,per:100,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0,fa:{sat:.15,mufa:.29,n3:.07,n6:.47,trans:.00}},
  {name:'亜麻仁油',yomi:'アマニアブラ',tags:'油',en:'flaxseed oil linseed oil',cal:900,p:0,f:100,c:0,per:100,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0,fa:{sat:.09,mufa:.19,n3:.57,n6:.14,trans:.00}},
  {name:'味噌（米みそ）',yomi:'ミソ',tags:'みそ 調味料',en:'miso paste rice miso',cal:192,p:12.5,f:6.0,c:21.9,per:100,fiber:4.9,iron:3.4,calcium:130,vitc:0,vitd:0,salt:12.4,aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59},fa:{sat:0.14,mufa:0.24,n3:0.07,n6:0.52,trans:0}},
  {name:'醤油（濃口）',yomi:'ショウユ',tags:'しょうゆ 調味料',en:'soy sauce shoyu',cal:71,p:7.7,f:0,c:10.1,per:100,fiber:0,iron:1.7,calcium:29,vitc:0,vitd:0,salt:14.5,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'砂糖（上白糖）',yomi:'サトウ',tags:'さとう 調味料',en:'sugar white sugar',cal:391,p:0,f:0,c:99.3,per:100,fiber:0,iron:0,calcium:1,vitc:0,vitd:0,salt:0},
  {name:'マヨネーズ',yomi:'マヨネーズ',tags:'マヨ',en:'mayonnaise mayo',cal:703,p:1.4,f:76.0,c:2.8,per:100,fiber:0,iron:0.3,calcium:17,vitc:0,vitd:0,salt:1.9,fa:{sat:.12,mufa:.35,n3:.06,n6:.44,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'ごま（炒り）',yomi:'ゴマ',tags:'セサミ',en:'sesame seeds',cal:605,p:19.8,f:54.2,c:18.5,per:100,fiber:10.8,iron:9.9,calcium:1200,vitc:0,vitd:0,salt:0,fa:{sat:.15,mufa:.38,n3:.00,n6:.42,trans:.00},aa:{leu:.07,ile:.04,val:.05,lys:.03,met:.02,thr:.03,trp:.01,his:.03,score:0.40}},
  {name:'アーモンド',yomi:'アーモンド',tags:'ナッツ',en:'almond',cal:608,p:19.6,f:51.8,c:19.7,per:100,fiber:11.0,iron:3.7,calcium:260,vitc:0,vitd:0,salt:0,fa:{sat:.08,mufa:.66,n3:.00,n6:.22,trans:.00},aa:{leu:.07,ile:.04,val:.05,lys:.03,met:.02,thr:.03,trp:.01,his:.03,score:0.40}},
  {name:'くるみ',yomi:'クルミ',tags:'ナッツ',en:'walnut',cal:674,p:14.6,f:68.8,c:11.7,per:100,fiber:7.5,iron:2.7,calcium:85,vitc:0,vitd:0,salt:0,fa:{sat:.08,mufa:.15,n3:.13,n6:.58,trans:.00},aa:{leu:.07,ile:.04,val:.05,lys:.03,met:.02,thr:.03,trp:.01,his:.03,score:0.40}},
  {name:'ピーナッツ',yomi:'ピーナッツ',tags:'らっかせい 落花生 ナッツ',en:'peanut',cal:585,p:25.4,f:49.4,c:18.6,per:100,fiber:7.4,iron:1.6,calcium:50,vitc:0,vitd:0,salt:0,fa:{sat:.17,mufa:.46,n3:.00,n6:.32,trans:.00},aa:{leu:.07,ile:.04,val:.05,lys:.03,met:.02,thr:.03,trp:.01,his:.03,score:0.40}},
  {name:'チアシード',yomi:'チアシード',tags:'',en:'chia seed',cal:486,p:19.8,f:30.7,c:42.1,per:100,fiber:34.4,iron:7.7,calcium:631,vitc:1.6,vitd:0,salt:0,fa:{sat:.10,mufa:.07,n3:.60,n6:.20,trans:.00},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'プロテイン（1杯）',yomi:'プロテイン',tags:'ホエイ カゼイン',en:'protein whey protein shake',cal:120,p:25.0,f:1.5,c:4.0,per:30,fiber:0.5,iron:1.0,calcium:150,vitc:0,vitd:0,salt:0.2,fa:{sat:.20,mufa:.28,n3:.04,n6:.16,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'コーヒー（ブラック）',yomi:'コーヒー',tags:'',en:'coffee black coffee',cal:4,p:0.3,f:0,c:0.7,per:100,fiber:0,iron:0.1,calcium:2,vitc:0,vitd:0,salt:0},
  {name:'オレンジジュース',yomi:'オレンジジュース',tags:'みかん ジュース',en:'orange juice',cal:45,p:0.7,f:0.1,c:10.4,per:100,fiber:0.2,iron:0.1,calcium:8,vitc:42,vitd:0,salt:0},
  {name:'スポーツドリンク',yomi:'スポーツドリンク',tags:'ポカリ アクエリアス',en:'sports drink energy drink',cal:21,p:0,f:0,c:5.1,per:100,fiber:0,iron:0,calcium:2,vitc:0,vitd:0,salt:0.1},
  // ── 麺類・ラーメン ──
  {name:'インスタントラーメン（日清チキンラーメン）',yomi:'チキンラーメン',tags:'ラーメン インスタント 日清',en:'chicken ramen instant noodle',cal:453,p:10.5,f:17.5,c:63.5,per:85,fiber:2.2,iron:1.5,calcium:50,vitc:0,vitd:0,salt:5.5,fa:{sat:.25,mufa:.30,n3:.04,n6:.30,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08},serving:85},
  {name:'インスタントラーメン（マルちゃん正麺醤油）',yomi:'マルチャンセイメン',tags:'ラーメン インスタント 東洋水産 マルちゃん',en:'maruchan seimen soy sauce ramen',cal:468,p:11.5,f:17.8,c:65.2,per:100,fiber:2.0,iron:1.2,calcium:45,vitc:0,vitd:0,salt:5.8,fa:{sat:.25,mufa:.30,n3:.04,n6:.30,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45}},
  {name:'カップヌードル（日清）',yomi:'カップヌードル',tags:'カップラーメン インスタント 日清',en:'cup noodle nissin',cal:351,p:10.5,f:14.6,c:44.5,per:78,fiber:1.5,iron:1.0,calcium:120,vitc:0,vitd:0,salt:4.9,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},serving:78,fa:{sat:0.45,mufa:0.4,n3:0.01,n6:0.13,trans:0.01}},
  {name:'カップヌードルシーフード（日清）',yomi:'カップヌードルシーフード',tags:'カップラーメン インスタント 日清 シーフード',en:'cup noodle seafood nissin',cal:322,p:9.0,f:11.5,c:46.0,per:75,fiber:1.4,iron:0.8,calcium:100,vitc:0,vitd:0,salt:4.5,aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},fa:{sat:0.45,mufa:0.4,n3:0.01,n6:0.13,trans:0.01}},
  {name:'どん兵衛きつねうどん（日清）',yomi:'ドンベエ',tags:'カップうどん インスタント 日清',en:'donbei kitsune udon nissin',cal:362,p:9.0,f:6.5,c:68.5,per:96,fiber:2.0,iron:1.1,calcium:130,vitc:0,vitd:0,salt:5.9,fa:{sat:.25,mufa:.30,n3:.04,n6:.30,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45}},
  {name:'赤いきつね（東洋水産）',yomi:'アカイキツネ',tags:'カップうどん マルちゃん インスタント',en:'akai kitsune udon maruchan',cal:446,p:12.0,f:6.3,c:84.5,per:103,fiber:2.5,iron:1.3,calcium:150,vitc:0,vitd:0,salt:6.0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},fa:{sat:0.45,mufa:0.4,n3:0.01,n6:0.13,trans:0.01}},
  {name:'緑のたぬき（東洋水産）',yomi:'ミドリノタヌキ',tags:'カップそば マルちゃん インスタント',en:'midori no tanuki soba maruchan',cal:440,p:12.5,f:7.0,c:83.0,per:101,fiber:2.8,iron:1.5,calcium:130,vitc:0,vitd:0,salt:5.6,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},fa:{sat:0.45,mufa:0.4,n3:0.01,n6:0.13,trans:0.01}},
  {name:'チャルメラ醤油ラーメン（明星）',yomi:'チャルメラ',tags:'インスタントラーメン 明星',en:'charumera shoyu ramen myojo',cal:440,p:10.0,f:16.5,c:63.0,per:90,fiber:1.8,iron:1.2,calcium:80,vitc:0,vitd:0,salt:5.3,fa:{sat:.25,mufa:.30,n3:.04,n6:.30,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45}},
  {name:'サッポロ一番塩ラーメン（サンヨー食品）',yomi:'サッポロイチバンシオ',tags:'インスタントラーメン サッポロ',en:'sapporo ichiban shio ramen',cal:451,p:10.2,f:17.2,c:63.8,per:90,fiber:1.8,iron:1.0,calcium:85,vitc:0,vitd:0,salt:5.5,fa:{sat:.25,mufa:.30,n3:.04,n6:.30,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45}},
  {name:'サッポロ一番みそラーメン（サンヨー食品）',yomi:'サッポロイチバンミソ',tags:'インスタントラーメン サッポロ みそ',en:'sapporo ichiban miso ramen',cal:463,p:10.8,f:18.0,c:64.5,per:90,fiber:2.0,iron:1.1,calcium:90,vitc:0,vitd:0,salt:5.8,fa:{sat:.25,mufa:.30,n3:.04,n6:.30,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45}},
  {name:'ラ王醤油（日清）',yomi:'ラオウショウユ',tags:'インスタントラーメン 日清 ラ王',en:'ra-ou shoyu ramen nissin',cal:452,p:12.5,f:16.0,c:64.5,per:95,fiber:2.0,iron:1.2,calcium:90,vitc:0,vitd:0,salt:5.5,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},fa:{sat:0.45,mufa:0.4,n3:0.01,n6:0.13,trans:0.01}},
  {name:'うまかっちゃん（ハウス食品）',yomi:'ウマカッチャン',tags:'インスタントラーメン ハウス 豚骨 九州',en:'umakachan hakata tonkotsu ramen house',cal:448,p:10.5,f:18.0,c:60.5,per:90,fiber:1.5,iron:0.8,calcium:70,vitc:0,vitd:0,salt:5.2,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},fa:{sat:0.45,mufa:0.4,n3:0.01,n6:0.13,trans:0.01}},

  // ── コンビニ・外食 ──
  {name:'おにぎり 鮭（セブン・ローソン・ファミマ）',yomi:'オニギリサケ',tags:'おにぎり コンビニ 鮭 しゃけ',en:'onigiri salmon rice ball',cal:192,p:5.3,f:1.8,c:38.5,per:105,fiber:0.5,iron:0.3,calcium:10,vitc:1,vitd:5,salt:1.1,fa:{sat:.22,mufa:.32,n3:.32,n6:.08,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'おにぎり ツナマヨ（コンビニ）',yomi:'オニギリツナマヨ',tags:'おにぎり コンビニ ツナ マヨ',en:'onigiri tuna mayo rice ball',cal:232,p:5.5,f:6.0,c:38.5,per:113,fiber:0.5,iron:0.2,calcium:8,vitc:0,vitd:1,salt:1.4,fa:{sat:.28,mufa:.32,n3:.06,n6:.26,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'おにぎり 梅（コンビニ）',yomi:'オニギリウメ',tags:'おにぎり コンビニ 梅',en:'onigiri ume plum rice ball',cal:177,p:3.5,f:0.5,c:38.5,per:103,fiber:0.5,iron:0.2,calcium:6,vitc:0,vitd:0,salt:1.3,fa:{sat:.28,mufa:.32,n3:.06,n6:.26,trans:.01},aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59}},
  {name:'サンドイッチ ミックス（コンビニ）',yomi:'サンドイッチ',tags:'サンド コンビニ',en:'sandwich mix convenience store',cal:255,p:10.5,f:10.5,c:30.5,per:150,fiber:1.8,iron:0.8,calcium:65,vitc:3,vitd:0.2,salt:1.8,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},fa:{sat:0.3,mufa:0.35,n3:0.03,n6:0.25,trans:0.02}},
  {name:'チキン南蛮弁当（コンビニ）',yomi:'チキンナンバンベントウ',tags:'弁当 コンビニ チキン',en:'chicken nanban bento lunch box',cal:710,p:28.0,f:22.0,c:97.0,per:430,fiber:3.5,iron:1.5,calcium:70,vitc:5,vitd:0.5,salt:3.5,fa:{sat:.31,mufa:.44,n3:.03,n6:.18,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08}},
  {name:'のり弁当（コンビニ）',yomi:'ノリベントウ',tags:'弁当 コンビニ のり',en:'nori bento lunch box',cal:680,p:18.0,f:20.0,c:100.0,per:400,fiber:2.5,iron:1.2,calcium:80,vitc:2,vitd:1,salt:3.2,fa:{sat:.28,mufa:.32,n3:.06,n6:.26,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'幕の内弁当（コンビニ）',yomi:'マクノウチベントウ',tags:'弁当 コンビニ',en:'makunouchi bento lunch box',cal:620,p:22.0,f:18.0,c:87.0,per:450,fiber:3.0,iron:1.5,calcium:90,vitc:5,vitd:0.5,salt:3.5,fa:{sat:.28,mufa:.32,n3:.06,n6:.26,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'ファミマ ファミチキ',yomi:'ファミチキ',tags:'ファミリーマート チキン 揚げ物 コンビニ',en:'famichiki fried chicken familymart',cal:245,p:14.5,f:14.5,c:14.5,per:95,fiber:0.3,iron:0.5,calcium:8,vitc:0,vitd:0.1,salt:1.2,fa:{sat:.31,mufa:.44,n3:.03,n6:.18,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08}},
  {name:'セブン ブラックサンダー（有楽製菓）',yomi:'ブラックサンダー',tags:'チョコ お菓子',en:'black thunder chocolate bar',cal:170,p:1.8,f:7.5,c:24.5,per:44,fiber:0.8,iron:0.5,calcium:25,vitc:0,vitd:0,salt:0.2,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},fa:{sat:0.55,mufa:0.3,n3:0.01,n6:0.1,trans:0.02}},

  // ── 牛丼・丼もの ──
  {name:'牛丼 並盛（吉野家）',yomi:'ギュウドンナミモリヨシノヤ',tags:'吉野家 牛丼 どんぶり 外食',en:'yoshinoya gyudon beef bowl regular',cal:666,p:26.0,f:22.0,c:87.0,per:360,fiber:2.0,iron:2.5,calcium:70,vitc:3,vitd:0.2,salt:2.5,fa:{sat:.47,mufa:.43,n3:.01,n6:.05,trans:.02},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:360},
  {name:'牛丼 並盛（すき家）',yomi:'ギュウドンナミモリスキヤ',tags:'すき家 牛丼 どんぶり 外食',en:'sukiya gyudon beef bowl regular',cal:699,p:25.0,f:22.5,c:92.0,per:380,fiber:2.0,iron:2.5,calcium:75,vitc:3,vitd:0.2,salt:2.8,fa:{sat:.47,mufa:.43,n3:.01,n6:.05,trans:.02},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:360},
  {name:'牛丼 並盛（松屋）',yomi:'ギュウドンナミモリマツヤ',tags:'松屋 牛丼 どんぶり 外食',en:'matsuya gyudon beef bowl regular',cal:658,p:27.0,f:19.5,c:88.0,per:360,fiber:2.5,iron:2.8,calcium:80,vitc:3,vitd:0.2,salt:2.6,fa:{sat:.47,mufa:.43,n3:.01,n6:.05,trans:.02},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:360},
  {name:'親子丼',yomi:'オヤコドン',tags:'どんぶり 卵 鶏',en:'oyakodon chicken egg bowl',cal:650,p:28.0,f:15.0,c:92.0,per:400,fiber:1.5,iron:1.8,calcium:80,vitc:5,vitd:1.0,salt:3.0,fa:{sat:.30,mufa:.42,n3:.03,n6:.19,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'カツ丼',yomi:'カツドン',tags:'どんぶり とんかつ 豚',en:'katsudon pork cutlet bowl',cal:850,p:30.0,f:30.0,c:105.0,per:500,fiber:2.0,iron:2.0,calcium:80,vitc:3,vitd:0.5,salt:3.5,fa:{sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'天丼',yomi:'テンドン',tags:'どんぶり 天ぷら えび',en:'tendon tempura bowl',cal:720,p:20.0,f:18.0,c:108.0,per:420,fiber:2.0,iron:1.5,calcium:80,vitc:3,vitd:1.5,salt:3.2,fa:{sat:.28,mufa:.32,n3:.06,n6:.26,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},

  // ── ファストフード ──
  {name:'ビッグマック（マクドナルド）',yomi:'ビッグマック',tags:'マクドナルド マック バーガー ハンバーガー',en:'big mac mcdonalds hamburger',cal:525,p:27.0,f:27.5,c:45.0,per:214,fiber:2.5,iron:4.0,calcium:230,vitc:3,vitd:0.3,salt:2.5,fa:{sat:.47,mufa:.43,n3:.01,n6:.05,trans:.02},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:214},
  {name:'マックフライポテト M（マクドナルド）',yomi:'マックフライポテト',tags:'マクドナルド マック ポテト フライドポテト',en:'mcdonalds french fries medium',cal:410,p:4.5,f:19.5,c:54.0,per:135,fiber:4.0,iron:0.8,calcium:15,vitc:12,vitd:0,salt:1.0,fa:{sat:.20,mufa:.32,n3:.05,n6:.38,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},serving:135},
  {name:'チーズバーガー（マクドナルド）',yomi:'チーズバーガー',tags:'マクドナルド マック バーガー',en:'cheeseburger mcdonalds',cal:305,p:16.5,f:12.0,c:33.0,per:116,fiber:1.5,iron:2.5,calcium:170,vitc:1,vitd:0.2,salt:1.8,fa:{sat:.47,mufa:.43,n3:.01,n6:.05,trans:.02},aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22}},
  {name:'てりやきマックバーガー（マクドナルド）',yomi:'テリヤキマックバーガー',tags:'マクドナルド マック てりやき',en:'teriyaki burger mcdonalds',cal:494,p:18.5,f:22.0,c:56.0,per:194,fiber:2.0,iron:2.0,calcium:100,vitc:1,vitd:0.2,salt:2.5,fa:{sat:.47,mufa:.43,n3:.01,n6:.05,trans:.02},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'ワッパー（バーガーキング）',yomi:'ワッパー',tags:'バーガーキング ハンバーガー バーガー',en:'whopper burger king hamburger',cal:617,p:29.0,f:33.0,c:55.0,per:260,fiber:2.5,iron:4.5,calcium:120,vitc:5,vitd:0.3,salt:1.8,fa:{sat:.47,mufa:.43,n3:.01,n6:.05,trans:.02},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'ゾンビメガ盛りバーガー（モスバーガー）',yomi:'モスバーガー',tags:'モス バーガー',en:'mos burger',cal:420,p:20.0,f:18.5,c:43.5,per:185,fiber:2.0,iron:2.5,calcium:100,vitc:5,vitd:0.2,salt:2.0,fa:{sat:.32,mufa:.38,n3:.03,n6:.22,trans:.02},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'チキンフィレオ（マクドナルド）',yomi:'チキンフィレオ',tags:'マクドナルド マック チキン フィレオ',en:'mcchicken fillet o fish mcdonalds',cal:466,p:23.5,f:17.5,c:53.0,per:192,fiber:1.5,iron:1.5,calcium:80,vitc:2,vitd:0.2,salt:2.5,fa:{sat:.28,mufa:.40,n3:.02,n6:.22,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08}},
  {name:'フィレオフィッシュ（マクドナルド）',yomi:'フィレオフィッシュ',tags:'マクドナルド マック フィッシュ',en:'filet o fish mcdonalds',cal:329,p:14.5,f:14.0,c:36.5,per:145,fiber:1.5,iron:1.0,calcium:120,vitc:0,vitd:0.5,salt:1.5,fa:{sat:.32,mufa:.38,n3:.03,n6:.22,trans:.02},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'カーネルオリジナルチキン（KFC）',yomi:'ケンタッキー',tags:'KFC ケンタッキーフライドチキン フライドチキン',en:'kfc fried chicken original',cal:237,p:17.3,f:14.0,c:11.5,per:126,fiber:0.3,iron:0.7,calcium:15,vitc:0,vitd:0.2,salt:1.6,fa:{sat:.32,mufa:.38,n3:.03,n6:.22,trans:.02},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08}},

  // ── 寿司・和食 ──
  {name:'にぎり寿司 まぐろ（1貫）',yomi:'ニギリマグロ',tags:'すし 寿司 まぐろ',en:'sushi nigiri tuna',cal:47,p:4.0,f:0.3,c:7.0,per:30,fiber:0.1,iron:0.2,calcium:2,vitc:0,vitd:0.5,salt:0.3,fa:{sat:.28,mufa:.18,n3:.38,n6:.05,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'にぎり寿司 サーモン（1貫）',yomi:'ニギリサーモン',tags:'すし 寿司 サーモン 鮭',en:'sushi nigiri salmon',cal:54,p:3.5,f:1.8,c:7.0,per:30,fiber:0.1,iron:0.1,calcium:3,vitc:0.5,vitd:2,salt:0.3,fa:{sat:.22,mufa:.32,n3:.32,n6:.08,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:100},
  {name:'にぎり寿司 えび（1貫）',yomi:'ニギリエビ',tags:'すし 寿司 えび 海老',en:'sushi nigiri shrimp',cal:41,p:3.5,f:0.1,c:6.8,per:30,fiber:0.1,iron:0.1,calcium:5,vitc:0,vitd:0,salt:0.3,fa:{sat:.30,mufa:.18,n3:.28,n6:.10,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'にぎり寿司 いくら（1貫）',yomi:'ニギリイクラ',tags:'すし 寿司 いくら',en:'sushi nigiri salmon roe ikura',cal:54,p:4.5,f:1.5,c:6.5,per:30,fiber:0,iron:0.3,calcium:8,vitc:0,vitd:3,salt:0.5,fa:{sat:.28,mufa:.32,n3:.06,n6:.26,trans:.01},aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59}},
  {name:'にぎり寿司 うに（1貫）',yomi:'ニギリウニ',tags:'すし 寿司 うに',en:'sushi nigiri sea urchin uni',cal:48,p:3.5,f:0.8,c:7.0,per:30,fiber:0,iron:0.3,calcium:6,vitc:1,vitd:0,salt:0.4,fa:{sat:.28,mufa:.32,n3:.06,n6:.26,trans:.01},aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59}},
  {name:'にぎり寿司 玉子（1貫）',yomi:'ニギリタマゴ',tags:'すし 寿司 たまご 卵',en:'sushi nigiri egg tamagoyaki',cal:55,p:3.0,f:1.8,c:7.0,per:30,fiber:0,iron:0.3,calcium:10,vitc:0,vitd:0.3,salt:0.5,fa:{sat:.30,mufa:.42,n3:.03,n6:.19,trans:.01},aa:{leu:.09,ile:.06,val:.07,lys:.09,met:.03,thr:.06,trp:.02,his:.03,score:1.13}},
  {name:'巻き寿司 鉄火巻（6切）',yomi:'テッカマキ',tags:'すし 寿司 まきずし まぐろ',en:'sushi tekka maki tuna roll',cal:240,p:12.0,f:1.5,c:46.0,per:150,fiber:0.8,iron:1.0,calcium:20,vitc:0,vitd:2,salt:1.5,fa:{sat:.28,mufa:.32,n3:.06,n6:.26,trans:.01},aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59}},
  {name:'巻き寿司 かっぱ巻（6切）',yomi:'カッパマキ',tags:'すし 寿司 まきずし きゅうり',en:'sushi kappa maki cucumber roll',cal:195,p:4.5,f:0.5,c:42.0,per:140,fiber:1.0,iron:0.4,calcium:15,vitc:2,vitd:0,salt:1.2,fa:{sat:.28,mufa:.32,n3:.06,n6:.26,trans:.01},aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59}},
  {name:'ちらし寿司',yomi:'チラシズシ',tags:'すし 寿司 ちらし',en:'chirashi sushi scattered sushi',cal:580,p:22.0,f:10.5,c:95.0,per:350,fiber:2.0,iron:2.0,calcium:80,vitc:3,vitd:5,salt:2.8,fa:{sat:.28,mufa:.32,n3:.06,n6:.26,trans:.01},aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59}},
  {name:'稲荷寿司（2個）',yomi:'イナリズシ',tags:'すし 寿司 いなり いなりずし',en:'inari sushi tofu pocket',cal:260,p:6.5,f:5.5,c:46.0,per:130,fiber:1.5,iron:1.0,calcium:60,vitc:0,vitd:0,salt:1.5,fa:{sat:.28,mufa:.32,n3:.06,n6:.26,trans:.01},aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59}},
  {name:'天ぷら盛り合わせ（外食）',yomi:'テンプラモリアワセ',tags:'てんぷら 天ぷら 揚げ物',en:'tempura assorted',cal:480,p:16.0,f:25.0,c:48.0,per:250,fiber:2.5,iron:1.5,calcium:80,vitc:5,vitd:1,salt:1.5,fa:{sat:.20,mufa:.32,n3:.05,n6:.38,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'とんかつ定食',yomi:'トンカツテイショク',tags:'とんかつ 揚げ物 定食 豚',en:'tonkatsu set meal pork cutlet',cal:870,p:38.0,f:32.0,c:98.0,per:500,fiber:3.5,iron:2.5,calcium:100,vitc:5,vitd:0.5,salt:3.5,fa:{sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:0.98}},
  {name:'ラーメン（醤油 外食）',yomi:'ラーメンショウユ',tags:'らーめん ラーメン 外食 醤油',en:'ramen shoyu restaurant',cal:490,p:20.0,f:12.0,c:74.0,per:700,fiber:3.0,iron:2.0,calcium:80,vitc:3,vitd:0.3,salt:5.5,fa:{sat:.25,mufa:.30,n3:.04,n6:.30,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},serving:700},
  {name:'ラーメン（豚骨 外食）',yomi:'ラーメントンコツ',tags:'らーめん ラーメン 外食 豚骨',en:'ramen tonkotsu restaurant',cal:580,p:24.0,f:22.0,c:70.0,per:700,fiber:2.5,iron:2.0,calcium:120,vitc:2,vitd:0.3,salt:6.0,fa:{sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:0.98},serving:700},
  {name:'ラーメン（味噌 外食）',yomi:'ラーメンミソ',tags:'らーめん ラーメン 外食 みそ 味噌',en:'ramen miso restaurant',cal:550,p:22.0,f:18.0,c:73.0,per:700,fiber:3.5,iron:2.5,calcium:100,vitc:5,vitd:0.3,salt:6.5,fa:{sat:.25,mufa:.30,n3:.04,n6:.30,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},serving:700},
  {name:'つけ麺（外食）',yomi:'ツケメン',tags:'らーめん ラーメン 外食',en:'tsukemen dipping ramen',cal:720,p:30.0,f:18.0,c:107.0,per:550,fiber:4.0,iron:2.5,calcium:80,vitc:2,vitd:0.3,salt:5.0,aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},fa:{sat:0.2,mufa:0.3,n3:0.05,n6:0.35,trans:0.0}},

  // ── カレー・パスタ・洋食 ──
  {name:'カレーライス（家庭）',yomi:'カレーライス',tags:'カレー らいす',en:'curry rice japanese curry',cal:723,p:20.0,f:18.5,c:116.0,per:500,fiber:4.5,iron:2.5,calcium:80,vitc:10,vitd:0.2,salt:3.0,fa:{sat:.30,mufa:.35,n3:.03,n6:.25,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},serving:500},
  {name:'ビーフカレー レトルト（ハウス バーモントカレー）',yomi:'バーモントカレー',tags:'カレー レトルト ハウス',en:'vermont curry house retort',cal:211,p:7.0,f:9.0,c:26.5,per:200,fiber:2.5,iron:1.5,calcium:30,vitc:3,vitd:0,salt:2.8,fa:{sat:.47,mufa:.43,n3:.01,n6:.05,trans:.02},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'スパゲッティ ナポリタン',yomi:'スパゲッティナポリタン',tags:'パスタ ナポリタン',en:'spaghetti napolitan pasta',cal:530,p:16.5,f:16.0,c:79.0,per:400,fiber:4.0,iron:2.0,calcium:55,vitc:20,vitd:0,salt:3.5,aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},fa:{sat:0.2,mufa:0.3,n3:0.05,n6:0.35,trans:0.0}},
  {name:'スパゲッティ ボロネーゼ',yomi:'スパゲッティボロネーゼ',tags:'パスタ ミートソース',en:'spaghetti bolognese meat sauce',cal:610,p:26.0,f:21.0,c:76.0,per:420,fiber:4.0,iron:3.0,calcium:70,vitc:10,vitd:0.2,salt:3.0,aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},fa:{sat:0.2,mufa:0.3,n3:0.05,n6:0.35,trans:0.0}},
  {name:'ピザ マルゲリータ（1枚）',yomi:'ピザマルゲリータ',tags:'ぴざ ピザ イタリアン',en:'pizza margherita',cal:760,p:32.0,f:26.0,c:100.0,per:400,fiber:4.0,iron:3.5,calcium:350,vitc:15,vitd:0.5,salt:4.0,fa:{sat:.35,mufa:.35,n3:.02,n6:.20,trans:.02},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45}},
  {name:'ハンバーグ 定食',yomi:'ハンバーグ',tags:'はんばーぐ 外食 定食',en:'hamburger steak teishoku set',cal:740,p:33.0,f:34.0,c:72.0,per:450,fiber:3.5,iron:3.5,calcium:100,vitc:8,vitd:0.3,salt:3.5,fa:{sat:.47,mufa:.43,n3:.01,n6:.05,trans:.02},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'エビフライ（3本）',yomi:'エビフライ',tags:'えびふらい 揚げ物 えび',en:'ebi fry fried shrimp',cal:290,p:18.5,f:15.0,c:22.0,per:165,fiber:1.0,iron:0.8,calcium:50,vitc:0,vitd:0,salt:1.5,fa:{sat:.20,mufa:.32,n3:.05,n6:.38,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'コロッケ（1個）',yomi:'コロッケ',tags:'ころっけ 揚げ物 じゃがいも',en:'korokke croquette potato',cal:200,p:5.5,f:11.0,c:21.5,per:100,fiber:1.5,iron:0.5,calcium:20,vitc:15,vitd:0,salt:0.8,fa:{sat:.20,mufa:.32,n3:.05,n6:.38,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},

  // ── 缶詰・加工品 ──
  {name:'コーン缶（クリームスタイル）',yomi:'コーンカン',tags:'とうもろこし 缶詰 コーン',en:'canned corn cream style',cal:77,p:1.7,f:0.5,c:17.2,per:100,fiber:1.8,iron:0.3,calcium:4,vitc:5,vitd:0,salt:0.5,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},fa:{sat:0.15,mufa:0.28,n3:0.01,n6:0.55,trans:0}},
  {name:'コーン缶（ホールカーネル）',yomi:'コーンカンホール',tags:'とうもろこし 缶詰 コーン',en:'canned corn whole kernel',cal:82,p:2.3,f:0.8,c:16.5,per:100,fiber:2.2,iron:0.4,calcium:3,vitc:6,vitd:0,salt:0.3,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},fa:{sat:0.15,mufa:0.28,n3:0.01,n6:0.55,trans:0}},
  {name:'焼き鳥缶（タレ）',yomi:'ヤキトリカン',tags:'焼き鳥 缶詰 とり',en:'canned yakitori chicken teriyaki',cal:170,p:17.5,f:8.5,c:6.5,per:100,fiber:0,iron:0.8,calcium:10,vitc:0,vitd:0.2,salt:1.5,fa:{sat:.31,mufa:.44,n3:.03,n6:.18,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08}},
  {name:'やきとり缶（塩）',yomi:'ヤキトリカンシオ',tags:'焼き鳥 缶詰 とり 塩',en:'canned yakitori chicken salt',cal:155,p:18.5,f:8.0,c:1.5,per:100,fiber:0,iron:0.7,calcium:8,vitc:0,vitd:0.2,salt:1.2,fa:{sat:.31,mufa:.44,n3:.03,n6:.18,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'カニ缶（ズワイガニ）',yomi:'カニカン',tags:'かに 蟹 缶詰',en:'canned crab snow crab',cal:70,p:14.5,f:0.8,c:0.3,per:100,fiber:0,iron:0.5,calcium:75,vitc:0,vitd:0,salt:1.8,fa:{sat:.28,mufa:.24,n3:.24,n6:.08,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'あさり水煮缶',yomi:'アサリカン',tags:'あさり 貝 缶詰',en:'canned clam asari',cal:74,p:14.0,f:1.5,c:1.5,per:100,fiber:0,iron:25,calcium:90,vitc:3,vitd:0,salt:1.0,fa:{sat:.28,mufa:.24,n3:.24,n6:.08,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:100},
  {name:'ホタテ缶（水煮）',yomi:'ホタテカン',tags:'ほたて 貝 缶詰',en:'canned scallop',cal:88,p:19.5,f:0.8,c:1.5,per:100,fiber:0,iron:1.0,calcium:18,vitc:0,vitd:0,salt:0.9,fa:{sat:.28,mufa:.24,n3:.24,n6:.08,trans:.00},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},serving:80},
  {name:'オイルサーディン缶（いわし油漬け）',yomi:'オイルサーディン',tags:'いわし 缶詰 オイル',en:'oil sardine canned',cal:350,p:17.0,f:30.0,c:0.3,per:100,fiber:0,iron:2.0,calcium:350,vitc:0,vitd:25,salt:0.8,fa:{sat:.25,mufa:.27,n3:.31,n6:.05,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'トマト缶（ホール）',yomi:'トマトカン',tags:'とまと 缶詰 イタリアン',en:'canned tomato whole',cal:24,p:1.2,f:0.2,c:4.5,per:100,fiber:1.2,iron:0.5,calcium:12,vitc:15,vitd:0,salt:0.3,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'トマト缶（カット）',yomi:'トマトカンカット',tags:'とまと 缶詰',en:'canned diced tomato',cal:24,p:1.2,f:0.2,c:4.5,per:100,fiber:1.2,iron:0.5,calcium:12,vitc:15,vitd:0,salt:0.3,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'大豆水煮缶',yomi:'ダイズスイニカン',tags:'だいず 大豆 缶詰 豆',en:'canned soybean water',cal:124,p:10.5,f:5.0,c:9.5,per:100,fiber:7.0,iron:2.5,calcium:75,vitc:0,vitd:0,salt:0.5,fa:{sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00},aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.91}},
  {name:'ミックスビーンズ缶',yomi:'ミックスビーンズ',tags:'豆 缶詰 ミックス',en:'canned mixed beans',cal:133,p:8.5,f:1.5,c:22.0,per:100,fiber:9.5,iron:2.0,calcium:50,vitc:0,vitd:0,salt:0.5,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},fa:{sat:0.14,mufa:0.24,n3:0.07,n6:0.52,trans:0}},

  // ── 粉類・乾物 ──
  {name:'薄力粉（小麦粉）',yomi:'ハクリキコ',tags:'こむぎこ 小麦粉 薄力 ケーキ',en:'cake flour soft wheat flour',cal:368,p:8.3,f:1.5,c:75.8,per:100,fiber:2.5,iron:0.6,calcium:20,vitc:0,vitd:0,salt:0,aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},fa:{sat:0.2,mufa:0.15,n3:0.06,n6:0.55,trans:0}},
  {name:'強力粉（小麦粉）',yomi:'キョウリキコ',tags:'こむぎこ 小麦粉 強力 パン',en:'bread flour strong wheat flour',cal:365,p:11.8,f:1.5,c:71.7,per:100,fiber:2.7,iron:0.9,calcium:17,vitc:0,vitd:0,salt:0,aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},fa:{sat:0.2,mufa:0.15,n3:0.06,n6:0.55,trans:0}},
  {name:'片栗粉',yomi:'カタクリコ',tags:'でんぷん 澱粉 とろみ',en:'katakuriko potato starch cornstarch',cal:338,p:0.1,f:0.1,c:81.6,per:100,fiber:0,iron:0.1,calcium:4,vitc:0,vitd:0,salt:0},
  {name:'天ぷら粉',yomi:'テンプラコ',tags:'こむぎこ 小麦粉 てんぷら 天ぷら',en:'tempura flour batter mix',cal:352,p:8.0,f:1.5,c:72.0,per:100,fiber:2.0,iron:0.8,calcium:80,vitc:0,vitd:0,salt:0.5,fa:{sat:.20,mufa:.32,n3:.05,n6:.38,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'パン粉',yomi:'パンコ',tags:'ぱんこ ブレッドクラム',en:'panko bread crumbs',cal:373,p:13.5,f:4.5,c:73.0,per:100,fiber:2.8,iron:0.7,calcium:31,vitc:0,vitd:0,salt:1.0,aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},fa:{sat:0.2,mufa:0.3,n3:0.05,n6:0.35,trans:0.0}},
  {name:'春雨（乾燥）',yomi:'ハルサメ',tags:'はるさめ',en:'harusame glass noodles dried',cal:345,p:0.2,f:0.4,c:85.2,per:100,fiber:1.4,iron:1.5,calcium:20,vitc:0,vitd:0,salt:0},
  {name:'海苔（焼き）',yomi:'ノリ',tags:'のり 焼き海苔 海苔',en:'nori seaweed roasted',cal:188,p:41.4,f:3.7,c:44.3,per:100,fiber:31.2,iron:11.4,calcium:280,vitc:210,vitd:0,salt:1.3,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},fa:{sat:0.25,mufa:0.1,n3:0.35,n6:0.1,trans:0}},
  {name:'わかめ（乾燥）',yomi:'ワカメ',tags:'わかめ 海藻',en:'wakame seaweed dried',cal:186,p:16.1,f:5.6,c:39.0,per:100,fiber:32.7,iron:6.1,calcium:780,vitc:27,vitd:0,salt:8.3,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},fa:{sat:0.25,mufa:0.1,n3:0.35,n6:0.1,trans:0}},
  {name:'ひじき（乾燥）',yomi:'ヒジキ',tags:'ひじき 海藻',en:'hijiki seaweed dried',cal:180,p:10.6,f:3.2,c:52.0,per:100,fiber:51.8,iron:6.2,calcium:1000,vitc:0,vitd:0,salt:4.7,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},fa:{sat:0.25,mufa:0.1,n3:0.35,n6:0.1,trans:0}},
  {name:'かつおぶし',yomi:'カツオブシ',tags:'かつおぶし 鰹節 出汁 だし',en:'katsuobushi dried bonito flakes',cal:356,p:75.7,f:2.9,c:0.8,per:100,fiber:0,iron:9.0,calcium:57,vitc:0,vitd:17,salt:0.3,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},fa:{sat:.27,mufa:.25,n3:.28,n6:.05,trans:.00}},

  // ── お菓子・デザート ──
  {name:'ポテトチップス（カルビー うすしお）',yomi:'ポテトチップス',tags:'お菓子 スナック カルビー',en:'potato chips calbee lightly salted',cal:536,p:5.3,f:33.3,c:54.7,per:100,fiber:3.3,iron:0.8,calcium:18,vitc:40,vitd:0,salt:0.6,fa:{sat:.32,mufa:.38,n3:.03,n6:.22,trans:.02},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'コーンスナック（カルビーかっぱえびせん）',yomi:'カッパエビセン',tags:'お菓子 スナック カルビー えび',en:'kappa ebisen calbee shrimp snack',cal:488,p:10.5,f:18.5,c:68.5,per:100,fiber:1.3,iron:0.5,calcium:200,vitc:0,vitd:0,salt:1.8,fa:{sat:.30,mufa:.18,n3:.28,n6:.10,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'チョコレート（明治ミルクチョコ）',yomi:'ミルクチョコレート',tags:'お菓子 チョコ 明治',en:'milk chocolate meiji',cal:558,p:7.0,f:33.0,c:60.0,per:100,fiber:2.5,iron:2.4,calcium:200,vitc:0,vitd:0,salt:0.1,fa:{sat:.62,mufa:.28,n3:.01,n6:.02,trans:.03},aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22}},
  {name:'ビスケット（森永マリー）',yomi:'ビスケット',tags:'お菓子 クッキー ビスケット 森永',en:'biscuit marie morinaga',cal:463,p:6.6,f:16.5,c:73.5,per:100,fiber:1.8,iron:0.7,calcium:50,vitc:0,vitd:0,salt:0.8,aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},fa:{sat:0.2,mufa:0.3,n3:0.05,n6:0.35,trans:0.0}},
  {name:'おかき（亀田製菓）',yomi:'オカキ',tags:'お菓子 せんべい おかき 米',en:'okaki rice cracker kameda',cal:426,p:7.3,f:8.5,c:79.0,per:100,fiber:1.0,iron:0.5,calcium:15,vitc:0,vitd:0,salt:1.5,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},fa:{sat:.27,mufa:.25,n3:.28,n6:.05,trans:.00}},
  {name:'プリン（江崎グリコ プッチンプリン）',yomi:'プッチンプリン',tags:'お菓子 デザート プリン グリコ',en:'pudding glico pucchin',cal:99,p:2.7,f:2.7,c:16.1,per:68,fiber:0,iron:0.1,calcium:60,vitc:0,vitd:0.3,salt:0.2,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},fa:{sat:0.55,mufa:0.3,n3:0.01,n6:0.05,trans:0.02}},
  {name:'カップアイスクリーム（明治エッセルスーパーカップ）',yomi:'スーパーカップ',tags:'アイス アイスクリーム 明治',en:'super cup ice cream meiji',cal:374,p:6.5,f:20.0,c:43.0,per:200,fiber:0,iron:0.1,calcium:175,vitc:1,vitd:0.3,salt:0.3,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},fa:{sat:0.6,mufa:0.28,n3:0.01,n6:0.03,trans:0.03}},
  {name:'どら焼き（1個）',yomi:'ドラヤキ',tags:'お菓子 和菓子 どら焼き あんこ',en:'dorayaki japanese pancake red bean',cal:271,p:5.5,f:4.0,c:54.0,per:100,fiber:2.5,iron:1.0,calcium:30,vitc:0,vitd:0.3,salt:0.4,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},fa:{sat:0.3,mufa:0.42,n3:0.03,n6:0.19,trans:0.01}},

  // ── 調味料・ソース ──
  {name:'ウスターソース（ブルドッグ）',yomi:'ウスターソース',tags:'ソース 調味料 ブルドッグ',en:'worcestershire sauce',cal:117,p:1.0,f:0.1,c:27.8,per:100,fiber:0.5,iron:1.7,calcium:36,vitc:0,vitd:0,salt:8.4,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'お好み焼きソース（オタフク）',yomi:'オコノミヤキソース',tags:'ソース 調味料 オタフク',en:'okonomiyaki sauce otafuku',cal:131,p:1.6,f:0.1,c:31.0,per:100,fiber:0.8,iron:0.8,calcium:28,vitc:2,vitd:0,salt:5.5,fa:{sat:.20,mufa:.32,n3:.05,n6:.38,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'焼肉のたれ（市販）',yomi:'ヤキニクノタレ',tags:'たれ 調味料 焼肉',en:'yakiniku sauce bbq sauce',cal:135,p:3.5,f:1.0,c:29.0,per:100,fiber:0.5,iron:0.8,calcium:30,vitc:2,vitd:0,salt:8.0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},fa:{sat:0.15,mufa:0.3,n3:0.05,n6:0.45,trans:0}},
  {name:'ポン酢（市販）',yomi:'ポンズ',tags:'ぽんず 調味料 さっぱり',en:'ponzu sauce citrus soy',cal:44,p:2.8,f:0,c:8.0,per:100,fiber:0,iron:0.5,calcium:12,vitc:5,vitd:0,salt:7.0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'だし（顆粒 ほんだし）',yomi:'ホンダシ',tags:'ほんだし 出汁 だし 味の素',en:'hondashi instant dashi bonito',cal:227,p:28.5,f:2.5,c:23.5,per:100,fiber:0,iron:1.5,calcium:60,vitc:0,vitd:0,salt:41,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},fa:{sat:0.28,mufa:0.2,n3:0.35,n6:0.05,trans:0}},
  {name:'めんつゆ（ストレート）',yomi:'メンツユ',tags:'めんつゆ つゆ 調味料',en:'mentsuyu noodle soup base',cal:44,p:2.2,f:0,c:8.5,per:100,fiber:0,iron:0.5,calcium:8,vitc:0,vitd:0,salt:3.0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'ケチャップ（カゴメ）',yomi:'ケチャップ',tags:'トマトケチャップ 調味料 カゴメ',en:'ketchup tomato catsup kagome',cal:119,p:1.7,f:0.2,c:27.5,per:100,fiber:1.8,iron:0.7,calcium:18,vitc:12,vitd:0,salt:3.3,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'マカロニサラダ（市販・惣菜）',yomi:'マカロニサラダ',tags:'サラダ 惣菜 パスタ',en:'macaroni salad deli',cal:198,p:3.5,f:13.5,c:17.0,per:100,fiber:0.8,iron:0.3,calcium:15,vitc:2,vitd:0,salt:1.2,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},fa:{sat:0.12,mufa:0.35,n3:0.06,n6:0.44,trans:0.01}},
  {name:'ポテトサラダ（市販・惣菜）',yomi:'ポテトサラダ',tags:'サラダ 惣菜 ポテト じゃがいも',en:'potato salad deli',cal:142,p:2.3,f:8.5,c:15.0,per:100,fiber:1.2,iron:0.3,calcium:12,vitc:18,vitd:0,salt:1.0,fa:{sat:.32,mufa:.38,n3:.03,n6:.22,trans:.02},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},

  // ── 飲み物 ──
  {name:'コーラ（コカ・コーラ）',yomi:'コーラ',tags:'コーラ ジュース 炭酸 コカコーラ',en:'coca cola coke soda',cal:45,p:0,f:0,c:11.3,per:100,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0},
  {name:'野菜ジュース（カゴメ）',yomi:'ヤサイジュース',tags:'野菜ジュース カゴメ ジュース',en:'vegetable juice kagome',cal:44,p:1.1,f:0.1,c:9.5,per:100,fiber:1.0,iron:0.3,calcium:12,vitc:50,vitd:0,salt:0.3,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'豆乳（マルサン調製豆乳）',yomi:'チョウセイトウニュウ',tags:'とうにゅう 豆乳 大豆 マルサン',en:'soymilk adjusted soy milk marusan',cal:64,p:3.5,f:3.0,c:6.5,per:100,fiber:0.3,iron:0.5,calcium:30,vitc:0,vitd:0,salt:0.2,fa:{sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00},aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22}},
  {name:'麦茶（ストレート）',yomi:'ムギチャ',tags:'むぎちゃ 麦茶 茶',en:'mugicha barley tea',cal:1,p:0.1,f:0,c:0.3,per:100,fiber:0,iron:0,calcium:2,vitc:0,vitd:0,salt:0},
  {name:'エナジードリンク（レッドブル 250ml）',yomi:'レッドブル',tags:'エナジードリンク カフェイン レッドブル',en:'red bull energy drink',cal:110,p:1.0,f:0,c:27.5,per:250,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0.2,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},

  // ── 惣菜・加工食品 ──
  {name:'餃子（冷凍 味の素）',yomi:'ギョウザ',tags:'ぎょうざ 餃子 冷凍 味の素',en:'gyoza frozen dumplings ajinomoto',cal:232,p:9.5,f:11.0,c:25.5,per:138,fiber:2.0,iron:1.0,calcium:25,vitc:3,vitd:0,salt:2.0,fa:{sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:0.98}},
  {name:'シュウマイ（冷凍 崎陽軒）',yomi:'シュウマイ',tags:'しゅうまい 焼売 崎陽軒',en:'shumai steamed dumpling kiyoken',cal:205,p:10.5,f:8.5,c:22.0,per:120,fiber:1.0,iron:0.8,calcium:30,vitc:2,vitd:0,salt:1.5,fa:{sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:0.98}},
  {name:'唐揚げ（鶏もも）',yomi:'カラアゲ',tags:'からあげ 唐揚げ とり 揚げ物',en:'karaage fried chicken thigh',cal:250,p:18.0,f:16.5,c:8.5,per:130,fiber:0.3,iron:0.6,calcium:10,vitc:3,vitd:0.3,salt:1.5,fa:{sat:.31,mufa:.44,n3:.03,n6:.18,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08}},
  {name:'メンチカツ',yomi:'メンチカツ',tags:'めんちかつ 揚げ物 ひき肉',en:'menchi katsu fried minced meat cutlet',cal:270,p:12.5,f:17.5,c:17.0,per:130,fiber:1.5,iron:1.5,calcium:25,vitc:3,vitd:0,salt:1.3,fa:{sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:0.98}},
  {name:'春巻き（1本）',yomi:'ハルマキ',tags:'はるまき 春巻 揚げ物',en:'harumaki spring roll fried',cal:180,p:5.5,f:9.5,c:18.5,per:80,fiber:1.0,iron:0.6,calcium:15,vitc:3,vitd:0,salt:0.8,fa:{sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'ハンバーグ（冷凍 びっくりドンキー風）',yomi:'ハンバーグ',tags:'はんばーぐ 冷凍 惣菜',en:'hamburger steak frozen',cal:220,p:12.5,f:15.5,c:8.5,per:130,fiber:0.8,iron:1.5,calcium:25,vitc:1,vitd:0.1,salt:1.2,fa:{sat:.47,mufa:.43,n3:.01,n6:.05,trans:.02},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'たこ焼き（6個）',yomi:'タコヤキ',tags:'たこやき たこ 大阪',en:'takoyaki octopus ball',cal:310,p:11.5,f:14.0,c:34.5,per:180,fiber:1.0,iron:0.8,calcium:50,vitc:1,vitd:0.5,salt:2.5,fa:{sat:.20,mufa:.32,n3:.05,n6:.38,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'お好み焼き（1枚）',yomi:'オコノミヤキ',tags:'おこのみやき 大阪 関西',en:'okonomiyaki japanese pancake',cal:540,p:22.0,f:22.0,c:62.0,per:350,fiber:3.0,iron:2.0,calcium:120,vitc:10,vitd:0.5,salt:3.5,fa:{sat:.20,mufa:.32,n3:.05,n6:.38,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'焼きそば（1人前）',yomi:'ヤキソバ',tags:'やきそば 焼きそば 麺',en:'yakisoba stir fried noodles',cal:510,p:15.5,f:16.0,c:76.0,per:350,fiber:3.5,iron:1.5,calcium:50,vitc:15,vitd:0,salt:3.5,fa:{sat:.25,mufa:.30,n3:.04,n6:.30,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45}},
  {name:'チャーハン（1人前）',yomi:'チャーハン',tags:'ちゃーはん 炒飯 ライス',en:'chahan fried rice',cal:560,p:16.0,f:18.5,c:83.0,per:350,fiber:1.5,iron:1.0,calcium:25,vitc:3,vitd:0.2,salt:3.0,fa:{sat:.25,mufa:.30,n3:.04,n6:.30,trans:.01},aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59}},

  // ── フレッシュ野菜・サラダ ──
  {name:'グリーンサラダ（外食）',yomi:'グリーンサラダ',tags:'サラダ 野菜 外食',en:'green salad restaurant',cal:25,p:1.5,f:0.3,c:5.0,per:100,fiber:2.0,iron:0.5,calcium:40,vitc:20,vitd:0,salt:0.3,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'シーザーサラダ（ドレッシング付き）',yomi:'シーザーサラダ',tags:'サラダ 外食',en:'caesar salad with dressing',cal:180,p:5.5,f:14.0,c:10.0,per:200,fiber:2.5,iron:0.8,calcium:120,vitc:15,vitd:0.2,salt:1.5,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},fa:{sat:0.3,mufa:0.35,n3:0.03,n6:0.25,trans:0.02}},
  {name:'ドレッシング フレンチ（カロリーハーフ）',yomi:'フレンチドレッシング',tags:'ドレッシング サラダ',en:'french dressing low calorie',cal:100,p:0.5,f:8.0,c:6.5,per:100,fiber:0,iron:0.1,calcium:5,vitc:1,vitd:0,salt:1.5,fa:{sat:.18,mufa:.35,n3:.05,n6:.38,trans:.01}},
  {name:'ゆで卵（1個）',yomi:'ユデタマゴ',tags:'たまご 卵 ゆでたまご',en:'boiled egg hard boiled',cal:91,p:7.7,f:6.2,c:0.3,per:60,fiber:0,iron:1.1,calcium:31,vitc:0,vitd:2.3,salt:0.2,fa:{sat:.30,mufa:.42,n3:.03,n6:.19,trans:.01},aa:{leu:.09,ile:.06,val:.07,lys:.09,met:.03,thr:.06,trp:.02,his:.03,score:1.13},serving:60},
  {name:'目玉焼き（1個）',yomi:'メダマヤキ',tags:'たまご 卵 目玉焼き',en:'fried egg sunny side up',cal:102,p:7.5,f:7.8,c:0.1,per:60,fiber:0,iron:1.1,calcium:28,vitc:0,vitd:2.3,salt:0.4,fa:{sat:.30,mufa:.42,n3:.03,n6:.19,trans:.01},aa:{leu:.09,ile:.06,val:.07,lys:.09,met:.03,thr:.06,trp:.02,his:.03,score:1.13},serving:60},
  {name:'スクランブルエッグ（2個）',yomi:'スクランブルエッグ',tags:'たまご 卵 スクランブル',en:'scrambled eggs',cal:192,p:14.5,f:14.5,c:1.0,per:120,fiber:0,iron:2.2,calcium:56,vitc:0,vitd:4.6,salt:0.8,fa:{sat:.30,mufa:.42,n3:.03,n6:.19,trans:.01},aa:{leu:.09,ile:.06,val:.07,lys:.09,met:.03,thr:.06,trp:.02,his:.03,score:1.13},serving:60},
  // ── 乳製品・チーズ追加 ──
  {name:'カッテージチーズ',yomi:'カッテージチーズ',tags:'チーズ 乳製品 低脂肪 高タンパク',en:'cottage cheese low fat',cal:105,p:13.3,f:4.5,c:1.9,per:100,fiber:0,iron:0.1,calcium:55,vitc:0,vitd:0.2,salt:0.9,fa:{sat:.63,mufa:.27,n3:.01,n6:.02,trans:.03},aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22},serving:100},
  {name:'モッツァレラチーズ',yomi:'モッツァレラ',tags:'チーズ 乳製品 イタリアン',en:'mozzarella cheese',cal:276,p:18.4,f:21.6,c:2.7,per:100,fiber:0,iron:0.2,calcium:330,vitc:0,vitd:0.4,salt:1.5,fa:{sat:.63,mufa:.27,n3:.01,n6:.02,trans:.03},aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22}},
  {name:'クリームチーズ',yomi:'クリームチーズ',tags:'チーズ 乳製品 ケーキ',en:'cream cheese',cal:346,p:8.2,f:33.0,c:2.3,per:100,fiber:0,iron:0.1,calcium:70,vitc:0,vitd:0.2,salt:0.7,fa:{sat:.63,mufa:.27,n3:.01,n6:.02,trans:.03},aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22}},
  {name:'ギリシャヨーグルト（無糖）',yomi:'ギリシャヨーグルト',tags:'ヨーグルト 乳製品 高タンパク プロテイン',en:'greek yogurt plain nonfat',cal:59,p:10.2,f:0.4,c:3.6,per:100,fiber:0,iron:0.1,calcium:110,vitc:0,vitd:0.1,salt:0.1,fa:{sat:.60,mufa:.30,n3:.01,n6:.03,trans:.02},aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22},serving:150},
  {name:'スキムミルク（脱脂粉乳）',yomi:'スキムミルク',tags:'ミルク 粉乳 低脂肪 乳製品',en:'skim milk powder nonfat dry',cal:359,p:34.0,f:1.0,c:53.3,per:100,fiber:0,iron:0.3,calcium:1100,vitc:3,vitd:0.2,salt:1.5,fa:{sat:.62,mufa:.28,n3:.01,n6:.02,trans:.03},aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22}},

  // ── 大豆・豆類追加 ──
  {name:'絹ごし豆腐',yomi:'キヌゴシトウフ',tags:'豆腐 とうふ 大豆 絹',en:'silken tofu soft',cal:56,p:5.3,f:3.0,c:2.0,per:100,fiber:0.9,iron:1.2,calcium:75,vitc:0,vitd:0,salt:0.1,fa:{sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00},aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.91},serving:150},
  {name:'木綿豆腐',yomi:'モメントウフ',tags:'豆腐 とうふ 大豆 木綿',en:'firm tofu',cal:72,p:7.0,f:4.3,c:1.5,per:100,fiber:0.4,iron:1.5,calcium:93,vitc:0,vitd:0,salt:0.1,fa:{sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00},aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.91},serving:150},
  {name:'高野豆腐（乾燥）',yomi:'コウヤドウフ',tags:'凍り豆腐 高野豆腐 大豆',en:'koya tofu freeze dried',cal:529,p:50.5,f:34.1,c:4.2,per:100,fiber:2.5,iron:7.5,calcium:630,vitc:0,vitd:0,salt:0.4,fa:{sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00},aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.91}},
  {name:'ひよこ豆（水煮缶）',yomi:'ヒヨコマメ',tags:'ガルバンゾー 豆 缶詰',en:'chickpeas canned',cal:171,p:9.5,f:2.5,c:27.4,per:100,fiber:11.6,iron:2.9,calcium:45,vitc:0,vitd:0,salt:0.4,fa:{sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00},aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.72}},
  {name:'レンズ豆（乾燥）',yomi:'レンズマメ',tags:'豆 レンティル 鉄分',en:'lentils dried',cal:352,p:25.7,f:1.4,c:56.9,per:100,fiber:16.5,iron:9.0,calcium:56,vitc:5,vitd:0,salt:0,fa:{sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00},aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.72}},
  {name:'ひじき煮',yomi:'ヒジキニ',tags:'ひじき 惣菜 副菜 鉄分 海藻',en:'hijiki seaweed salad simmered',cal:73,p:2.6,f:2.8,c:10.8,per:100,fiber:5.0,iron:2.1,calcium:140,vitc:0,vitd:0,salt:1.2,fa:{sat:.20,mufa:.30,n3:.05,n6:.35,trans:.00},aa:{leu:.07,ile:.04,val:.05,lys:.05,met:.01,thr:.04,trp:.01,his:.03,score:0.65}},

  // ── 穀物・パン追加 ──
  {name:'食パン（6枚切り1枚）',yomi:'ショクパン',tags:'パン 食パン 白パン トースト',en:'white bread slice',cal:158,p:5.6,f:2.6,c:28.0,per:60,fiber:1.4,iron:0.4,calcium:17,vitc:0,vitd:0,salt:0.7,aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},fa:{sat:0.2,mufa:0.3,n3:0.05,n6:0.35,trans:0.0},serving:60},
  {name:'全粒粉パン（1枚）',yomi:'ゼンリュウコムギパン',tags:'パン 全粒粉 食物繊維',en:'whole wheat bread slice',cal:137,p:5.8,f:2.2,c:23.7,per:55,fiber:3.5,iron:0.9,calcium:23,vitc:0,vitd:0,salt:0.5,aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},fa:{sat:0.2,mufa:0.3,n3:0.05,n6:0.35,trans:0.0},serving:55},
  {name:'クロワッサン',yomi:'クロワッサン',tags:'パン バター フランス 朝食',en:'croissant butter',cal:406,p:8.0,f:20.8,c:47.8,per:100,fiber:1.8,iron:0.7,calcium:21,vitc:0,vitd:0.1,salt:1.0,fa:{sat:.63,mufa:.27,n3:.01,n6:.03,trans:.04},aa:{leu:0.07,ile:0.04,val:0.04,lys:0.02,met:0.02,thr:0.03,trp:0.01,his:0.02,score:0.45}},
  {name:'オートミール（乾燥）',yomi:'オートミール',tags:'えん麦 燕麦 オーツ 朝食 食物繊維',en:'oatmeal rolled oats dry',cal:380,p:13.7,f:6.9,c:62.0,per:100,fiber:9.4,iron:3.9,calcium:52,vitc:0,vitd:0,salt:0,fa:{sat:.18,mufa:.28,n3:.04,n6:.35,trans:.00},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},serving:40},
  {name:'コーンフレーク',yomi:'コーンフレーク',tags:'シリアル 朝食 ケロッグ',en:'cornflakes cereal',cal:381,p:7.8,f:1.7,c:83.6,per:100,fiber:2.4,iron:6.0,calcium:6,vitc:0,vitd:0,salt:0.6,fa:{sat:.18,mufa:.28,n3:.04,n6:.35,trans:.00},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45}},
  {name:'グラノーラ（市販）',yomi:'グラノーラ',tags:'シリアル 朝食 燕麦',en:'granola cereal',cal:427,p:9.3,f:12.8,c:68.2,per:100,fiber:5.5,iron:3.0,calcium:45,vitc:0,vitd:0,salt:0.3,fa:{sat:.18,mufa:.28,n3:.04,n6:.35,trans:.00},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45}},

  // ── 野菜追加 ──
  {name:'ほうれん草（生）',yomi:'ホウレンソウ',tags:'野菜 葉野菜 鉄分 ビタミン',en:'spinach raw',cal:20,p:2.2,f:0.4,c:3.1,per:100,fiber:2.8,iron:2.0,calcium:49,vitc:35,vitd:0,salt:0,aa:{leu:.07,ile:.04,val:.05,lys:.05,met:.01,thr:.04,trp:.01,his:.03,score:0.65},serving:100},
  {name:'小松菜（生）',yomi:'コマツナ',tags:'野菜 葉野菜 カルシウム',en:'komatsuna japanese mustard spinach',cal:14,p:1.5,f:0.2,c:2.4,per:100,fiber:1.9,iron:2.8,calcium:170,vitc:39,vitd:0,salt:0.1,aa:{leu:.07,ile:.04,val:.05,lys:.05,met:.01,thr:.04,trp:.01,his:.03,score:0.65},serving:100},
  {name:'キャベツ（生）',yomi:'キャベツ',tags:'野菜 葉野菜',en:'cabbage raw',cal:23,p:1.3,f:0.2,c:5.2,per:100,fiber:1.8,iron:0.3,calcium:43,vitc:41,vitd:0,salt:0,aa:{leu:.07,ile:.04,val:.05,lys:.05,met:.01,thr:.04,trp:.01,his:.03,score:0.65},serving:100},
  {name:'もやし（緑豆）',yomi:'モヤシ',tags:'もやし 野菜 低カロリー',en:'bean sprouts mung',cal:15,p:1.7,f:0.1,c:2.6,per:100,fiber:1.3,iron:0.4,calcium:10,vitc:8,vitd:0,salt:0,aa:{leu:.07,ile:.04,val:.05,lys:.05,met:.01,thr:.04,trp:.01,his:.03,score:0.65}},
  {name:'ピーマン（生）',yomi:'ピーマン',tags:'野菜 緑黄色野菜 ビタミンC',en:'green bell pepper raw',cal:22,p:0.9,f:0.2,c:5.1,per:100,fiber:2.3,iron:0.4,calcium:11,vitc:76,vitd:0,salt:0},
  {name:'にんじん（生）',yomi:'ニンジン',tags:'野菜 根菜 ベータカロテン',en:'carrot raw',cal:39,p:0.6,f:0.1,c:9.3,per:100,fiber:2.8,iron:0.2,calcium:28,vitc:6,vitd:0,salt:0,serving:80},
  {name:'玉ねぎ（生）',yomi:'タマネギ',tags:'野菜 根菜 たまねぎ',en:'onion raw',cal:37,p:1.0,f:0.1,c:8.4,per:100,fiber:1.6,iron:0.2,calcium:21,vitc:8,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},serving:100},
  {name:'アボカド',yomi:'アボカド',tags:'果物 健康 脂質 アボカド',en:'avocado raw',cal:187,p:2.5,f:18.7,c:6.2,per:100,fiber:5.3,iron:0.7,calcium:9,vitc:15,vitd:0,salt:0.1,fa:{sat:.14,mufa:.74,n3:.01,n6:.10,trans:.00},serving:100,aa:{leu:0.08,ile:0.05,val:0.05,lys:0.06,met:0.02,thr:0.04,trp:0.01,his:0.03,score:0.75}},
  {name:'ブロッコリー（生）',yomi:'ブロッコリー',tags:'野菜 緑黄色 ビタミンC スプラウト',en:'broccoli raw',cal:33,p:4.3,f:0.5,c:5.2,per:100,fiber:4.4,iron:1.0,calcium:38,vitc:120,vitd:0,salt:0.1,fa:{sat:.20,mufa:.30,n3:.05,n6:.35,trans:.00},aa:{leu:.07,ile:.04,val:.05,lys:.05,met:.01,thr:.04,trp:.01,his:.03,score:0.65},serving:100},
  {name:'かぼちゃ（生）',yomi:'カボチャ',tags:'野菜 緑黄色野菜 根菜 ビタミン',en:'kabocha pumpkin squash raw',cal:91,p:1.9,f:0.3,c:20.6,per:100,fiber:3.5,iron:0.5,calcium:15,vitc:43,vitd:0,salt:0,aa:{leu:.07,ile:.04,val:.05,lys:.05,met:.01,thr:.04,trp:.01,his:.03,score:0.65}},
  {name:'トマト（生）',yomi:'トマト',tags:'野菜 緑黄色野菜 リコピン',en:'tomato raw',cal:19,p:0.7,f:0.1,c:4.7,per:100,fiber:1.0,iron:0.2,calcium:7,vitc:15,vitd:0,salt:0,serving:150},
  {name:'じゃがいも（生）',yomi:'ジャガイモ',tags:'野菜 芋 いも ポテト',en:'potato raw',cal:76,p:1.8,f:0.1,c:17.3,per:100,fiber:8.9,iron:0.4,calcium:4,vitc:28,vitd:0,salt:0,aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59},serving:150},
  {name:'さつまいも（生）',yomi:'サツマイモ',tags:'野菜 芋 いも スイートポテト',en:'sweet potato raw',cal:132,p:1.2,f:0.2,c:31.9,per:100,fiber:2.2,iron:0.5,calcium:36,vitc:29,vitd:0,salt:0,aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59},serving:150},
  {name:'山芋（生）',yomi:'ヤマイモ',tags:'芋 いも 長芋 とろろ',en:'japanese yam nagaimo raw',cal:65,p:2.2,f:0.3,c:13.9,per:100,fiber:1.0,iron:0.4,calcium:17,vitc:6,vitd:0,salt:0,aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59}},

  // ── 果物追加 ──
  {name:'バナナ（生）',yomi:'バナナ',tags:'果物 くだもの バナナ',en:'banana raw',cal:93,p:1.1,f:0.2,c:22.5,per:100,fiber:1.1,iron:0.3,calcium:6,vitc:16,vitd:0,salt:0,aa:{leu:.07,ile:.04,val:.05,lys:.05,met:.01,thr:.04,trp:.01,his:.03,score:0.65}},
  {name:'りんご（生）',yomi:'リンゴ',tags:'果物 くだもの りんご',en:'apple raw',cal:61,p:0.2,f:0.2,c:16.2,per:100,fiber:1.9,iron:0.1,calcium:4,vitc:4,vitd:0,salt:0},
  {name:'みかん（生）',yomi:'ミカン',tags:'果物 くだもの 柑橘 ビタミンC',en:'mandarin orange satsuma',cal:46,p:0.7,f:0.1,c:12.0,per:100,fiber:1.0,iron:0.1,calcium:21,vitc:35,vitd:0,salt:0},
  {name:'ブルーベリー',yomi:'ブルーベリー',tags:'果物 ベリー アントシアニン',en:'blueberry raw',cal:49,p:0.5,f:0.1,c:13.0,per:100,fiber:3.3,iron:0.3,calcium:6,vitc:9,vitd:0,salt:0},
  {name:'キウイフルーツ（生）',yomi:'キウイ',tags:'果物 ビタミンC キウイ',en:'kiwi fruit raw',cal:53,p:1.0,f:0.1,c:13.5,per:100,fiber:2.5,iron:0.3,calcium:33,vitc:71,vitd:0,salt:0,aa:{leu:.07,ile:.04,val:.05,lys:.05,met:.01,thr:.04,trp:.01,his:.03,score:0.65}},

  // ── 魚介追加 ──
  {name:'しらす干し',yomi:'シラスボシ',tags:'しらす ちりめん 小魚 カルシウム',en:'shirasu dried baby sardines',cal:206,p:40.5,f:3.5,c:0.5,per:100,fiber:0,iron:1.0,calcium:520,vitc:0,vitd:61,salt:4.4,fa:{sat:.25,mufa:.27,n3:.31,n6:.05,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'あじの干物（1枚）',yomi:'アジノヒモノ',tags:'あじ 干物 魚 焼き魚',en:'horse mackerel dried',cal:152,p:24.6,f:4.5,c:0.1,per:100,fiber:0,iron:1.4,calcium:75,vitc:0,vitd:9,salt:1.8,fa:{sat:.27,mufa:.31,n3:.25,n6:.07,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'焼きさけ（1切れ）',yomi:'ヤキサケ',tags:'さけ 鮭 焼き魚 定食',en:'grilled salmon fillet',cal:204,p:27.5,f:10.4,c:0.1,per:100,fiber:0,iron:0.6,calcium:16,vitc:0,vitd:33,salt:0.7,fa:{sat:.22,mufa:.32,n3:.32,n6:.08,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:100},
  {name:'焼きさば（1切れ）',yomi:'ヤキサバ',tags:'さば 鯖 焼き魚 定食 EPA DHA',en:'grilled mackerel fillet',cal:220,p:22.7,f:14.4,c:0.3,per:100,fiber:0,iron:1.5,calcium:20,vitc:0,vitd:7,salt:0.9,fa:{sat:.25,mufa:.29,n3:.31,n6:.04,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:100},
  {name:'さば水煮缶',yomi:'サバカン',tags:'さば缶 缶詰 魚 EPA DHA',en:'canned mackerel water',cal:174,p:20.9,f:10.7,c:0.2,per:100,fiber:0,iron:1.8,calcium:210,vitc:0,vitd:11,salt:0.8,fa:{sat:.25,mufa:.29,n3:.31,n6:.04,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'さけ水煮缶',yomi:'サケカン',tags:'鮭缶 さけ缶 缶詰 魚 DHA',en:'canned salmon water',cal:165,p:21.2,f:9.2,c:0.1,per:100,fiber:0,iron:0.8,calcium:210,vitc:0,vitd:17,salt:0.7,fa:{sat:.22,mufa:.32,n3:.32,n6:.08,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},

  // ── 肉追加 ──
  {name:'鶏むね肉（皮なし・生）',yomi:'トリムネニク',tags:'鶏肉 チキン 低脂質 高タンパク',en:'chicken breast skinless raw',cal:116,p:23.3,f:1.9,c:0,per:100,fiber:0,iron:0.3,calcium:4,vitc:3,vitd:0.1,salt:0.1,fa:{sat:.28,mufa:.40,n3:.02,n6:.22,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08},serving:150},
  {name:'鶏もも肉（皮なし・生）',yomi:'トリモモニク',tags:'鶏肉 チキン もも',en:'chicken thigh skinless raw',cal:127,p:19.0,f:5.0,c:0,per:100,fiber:0,iron:0.6,calcium:5,vitc:2,vitd:0.2,salt:0.2,fa:{sat:.31,mufa:.44,n3:.03,n6:.18,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08},serving:150},
  {name:'豚ヒレ肉（生）',yomi:'ブタヒレニク',tags:'豚肉 ヒレ 低脂質 高タンパク',en:'pork tenderloin raw',cal:115,p:22.2,f:3.7,c:0.2,per:100,fiber:0,iron:0.9,calcium:4,vitc:1,vitd:0.3,salt:0.1,fa:{sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:0.98},serving:150},
  {name:'牛もも肉（赤身・生）',yomi:'ウシモモニク',tags:'牛肉 もも 赤身 低脂質',en:'beef round lean raw',cal:182,p:21.2,f:10.7,c:0.4,per:100,fiber:0,iron:2.4,calcium:5,vitc:2,vitd:0.1,salt:0.1,fa:{sat:.47,mufa:.43,n3:.01,n6:.05,trans:.02},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:150},
  {name:'ラム肉（生）',yomi:'ラムニク',tags:'羊肉 ラム マトン',en:'lamb raw',cal:198,p:20.0,f:13.3,c:0.2,per:100,fiber:0,iron:2.0,calcium:10,vitc:1,vitd:0.1,salt:0.1,fa:{sat:.47,mufa:.40,n3:.02,n6:.04,trans:.03},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:150},

  // ── サプリ・プロテイン ──
  {name:'ホエイプロテイン（1スクープ30g）',yomi:'ホエイプロテイン',tags:'プロテイン ホエイ WPC WPI サプリ',en:'whey protein powder scoop 30g',cal:112,p:22.5,f:1.5,c:4.2,per:30,fiber:0,iron:0.2,calcium:80,vitc:0,vitd:0,salt:0.2,fa:{sat:.20,mufa:.28,n3:.04,n6:.16,trans:.01},aa:{leu:.11,ile:.07,val:.06,lys:.10,met:.02,thr:.07,trp:.02,his:.02,score:1.09},serving:30},
  {name:'ソイプロテイン（1スクープ30g）',yomi:'ソイプロテイン',tags:'プロテイン 大豆 ソイ サプリ',en:'soy protein powder scoop 30g',cal:112,p:22.0,f:1.5,c:4.5,per:30,fiber:0.5,iron:3.0,calcium:150,vitc:0,vitd:0,salt:0.3,fa:{sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00},aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.91},serving:30},
  {name:'カゼインプロテイン（1スクープ30g）',yomi:'カゼインプロテイン',tags:'プロテイン カゼイン 乳 サプリ',en:'casein protein powder scoop 30g',cal:112,p:22.0,f:1.2,c:4.8,per:30,fiber:0,iron:0.1,calcium:700,vitc:0,vitd:0,salt:0.3,fa:{sat:.20,mufa:.28,n3:.04,n6:.16,trans:.01},aa:{leu:.09,ile:.06,val:.06,lys:.08,met:.03,thr:.04,trp:.01,his:.03,score:1.07},serving:30},
  {name:'EAAサプリ（5g）',yomi:'イーエーエー',tags:'EAA 必須アミノ酸 サプリ',en:'essential amino acid supplement 5g',cal:17,p:4.0,f:0,c:0.5,per:5,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0,aa:{leu:.11,ile:.07,val:.06,lys:.10,met:.02,thr:.07,trp:.02,his:.02,score:1.09}},
  {name:'BCAAサプリ（5g）',yomi:'ビーシーエーエー',tags:'BCAA ロイシン イソロイシン バリン サプリ',en:'BCAA supplement 5g',cal:17,p:4.0,f:0,c:0.5,per:5,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0,aa:{leu:.45,ile:.22,val:.22,lys:.00,met:.00,thr:.00,trp:.00,his:.00,score:1.09}},

  // ── 果物（拡充） ──
  {name:'いちご（生）',yomi:'イチゴ',tags:'果物 ベリー ビタミンC',en:'strawberry raw',cal:34,p:0.9,f:0.1,c:8.5,per:100,fiber:1.4,iron:0.3,calcium:17,vitc:62,vitd:0,salt:0},
  {name:'ぶどう（巨峰）',yomi:'ブドウ',tags:'果物 グレープ',en:'grape kyoho raw',cal:59,p:0.6,f:0.1,c:15.2,per:100,fiber:0.5,iron:0.1,calcium:8,vitc:2,vitd:0,salt:0},
  {name:'もも（生）',yomi:'モモ',tags:'果物 ピーチ',en:'peach raw',cal:40,p:0.6,f:0.1,c:10.2,per:100,fiber:1.3,iron:0.1,calcium:4,vitc:8,vitd:0,salt:0},
  {name:'すいか（生）',yomi:'スイカ',tags:'果物 スイカ 夏',en:'watermelon raw',cal:37,p:0.6,f:0.1,c:9.5,per:100,fiber:0.3,iron:0.2,calcium:4,vitc:10,vitd:0,salt:0},
  {name:'メロン（生）',yomi:'メロン',tags:'果物 夏 カリウム',en:'melon raw',cal:45,p:1.1,f:0.1,c:10.4,per:100,fiber:0.5,iron:0.2,calcium:8,vitc:25,vitd:0,salt:0,aa:{leu:.07,ile:.04,val:.05,lys:.05,met:.01,thr:.04,trp:.01,his:.03,score:0.65}},
  {name:'グレープフルーツ（生）',yomi:'グレープフルーツ',tags:'果物 柑橘 ビタミンC',en:'grapefruit raw',cal:40,p:0.9,f:0.1,c:9.6,per:100,fiber:0.6,iron:0.1,calcium:15,vitc:36,vitd:0,salt:0},
  {name:'レモン果汁（大さじ1）',yomi:'レモン',tags:'レモン 柑橘 ビタミンC',en:'lemon juice tablespoon',cal:4,p:0.1,f:0,c:1.3,per:15,fiber:0,iron:0,calcium:1,vitc:8,vitd:0,salt:0},
  {name:'干しぶどう（レーズン）',yomi:'レーズン',tags:'ドライフルーツ ぶどう 鉄分',en:'raisins dried grapes',cal:301,p:2.7,f:0.2,c:79.0,per:100,fiber:4.1,iron:2.3,calcium:55,vitc:0,vitd:0,salt:0,aa:{leu:.07,ile:.04,val:.05,lys:.05,met:.01,thr:.04,trp:.01,his:.03,score:0.65}},
  {name:'なつめやし（デーツ）',yomi:'デーツ',tags:'ドライフルーツ なつめ',en:'dates dried',cal:286,p:1.8,f:0.2,c:75.8,per:100,fiber:7.0,iron:0.9,calcium:39,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'マンゴー（生）',yomi:'マンゴー',tags:'果物 熱帯 ビタミン',en:'mango raw',cal:68,p:0.6,f:0.2,c:17.0,per:100,fiber:1.3,iron:0.2,calcium:11,vitc:20,vitd:0,salt:0},
  {name:'パイナップル（生）',yomi:'パイナップル',tags:'果物 熱帯 パイン',en:'pineapple raw',cal:54,p:0.6,f:0.1,c:13.7,per:100,fiber:1.2,iron:0.2,calcium:10,vitc:35,vitd:0,salt:0},

  // ── 野菜（拡充） ──
  {name:'アスパラガス（生）',yomi:'アスパラガス',tags:'野菜 春 葉酸',en:'asparagus raw',cal:22,p:2.6,f:0.2,c:3.9,per:100,fiber:1.8,iron:0.7,calcium:19,vitc:15,vitd:0,salt:0,aa:{leu:.07,ile:.04,val:.05,lys:.05,met:.01,thr:.04,trp:.01,his:.03,score:0.65}},
  {name:'オクラ（生）',yomi:'オクラ',tags:'野菜 ねばねば 食物繊維',en:'okra raw',cal:30,p:2.1,f:0.2,c:6.6,per:100,fiber:5.0,iron:0.5,calcium:92,vitc:11,vitd:0,salt:0,aa:{leu:.07,ile:.04,val:.05,lys:.05,met:.01,thr:.04,trp:.01,his:.03,score:0.65}},
  {name:'セロリ（生）',yomi:'セロリ',tags:'野菜 低カロリー',en:'celery raw',cal:15,p:0.4,f:0.1,c:3.6,per:100,fiber:1.5,iron:0.2,calcium:39,vitc:7,vitd:0,salt:0.1},
  {name:'ズッキーニ（生）',yomi:'ズッキーニ',tags:'野菜 イタリアン 夏',en:'zucchini raw',cal:16,p:1.3,f:0.1,c:3.0,per:100,fiber:1.4,iron:0.4,calcium:24,vitc:20,vitd:0,salt:0,aa:{leu:.07,ile:.04,val:.05,lys:.05,met:.01,thr:.04,trp:.01,his:.03,score:0.65}},
  {name:'パプリカ（赤・生）',yomi:'パプリカ',tags:'野菜 赤 カラーピーマン ビタミンC',en:'red bell pepper raw',cal:30,p:1.0,f:0.2,c:7.2,per:100,fiber:1.6,iron:0.4,calcium:7,vitc:170,vitd:0,salt:0,aa:{leu:.07,ile:.04,val:.05,lys:.05,met:.01,thr:.04,trp:.01,his:.03,score:0.65}},
  {name:'ゴーヤ（生）',yomi:'ゴーヤ',tags:'野菜 苦瓜 沖縄 ビタミンC',en:'bitter melon goya raw',cal:17,p:1.0,f:0.1,c:3.9,per:100,fiber:2.6,iron:0.4,calcium:14,vitc:76,vitd:0,salt:0,aa:{leu:.07,ile:.04,val:.05,lys:.05,met:.01,thr:.04,trp:.01,his:.03,score:0.65}},
  {name:'れんこん（生）',yomi:'レンコン',tags:'野菜 蓮根 根菜',en:'lotus root raw',cal:66,p:1.9,f:0.1,c:15.5,per:100,fiber:2.0,iron:0.5,calcium:20,vitc:48,vitd:0,salt:0,aa:{leu:.07,ile:.04,val:.05,lys:.05,met:.01,thr:.04,trp:.01,his:.03,score:0.65}},
  {name:'ごぼう（生）',yomi:'ゴボウ',tags:'野菜 根菜 食物繊維',en:'burdock root raw',cal:65,p:1.8,f:0.1,c:15.4,per:100,fiber:5.7,iron:0.7,calcium:46,vitc:3,vitd:0,salt:0,aa:{leu:.07,ile:.04,val:.05,lys:.05,met:.01,thr:.04,trp:.01,his:.03,score:0.65}},
  {name:'大根（生）',yomi:'ダイコン',tags:'野菜 根菜 だいこん',en:'daikon radish raw',cal:18,p:0.5,f:0.1,c:4.1,per:100,fiber:1.4,iron:0.2,calcium:24,vitc:12,vitd:0,salt:0,serving:100},
  {name:'白菜（生）',yomi:'ハクサイ',tags:'野菜 葉野菜 冬 鍋',en:'napa cabbage raw',cal:14,p:0.8,f:0.1,c:3.2,per:100,fiber:1.3,iron:0.3,calcium:43,vitc:19,vitd:0,salt:0},
  {name:'ネギ（長ねぎ・生）',yomi:'ネギ',tags:'野菜 ねぎ 薬味',en:'green onion leek raw',cal:28,p:1.4,f:0.1,c:6.5,per:100,fiber:2.5,iron:0.3,calcium:36,vitc:14,vitd:0,salt:0,aa:{leu:.07,ile:.04,val:.05,lys:.05,met:.01,thr:.04,trp:.01,his:.03,score:0.65}},
  {name:'にら（生）',yomi:'ニラ',tags:'野菜 葉野菜 餃子',en:'garlic chives nira raw',cal:18,p:1.7,f:0.3,c:2.9,per:100,fiber:2.7,iron:0.7,calcium:48,vitc:19,vitd:0,salt:0,aa:{leu:.07,ile:.04,val:.05,lys:.05,met:.01,thr:.04,trp:.01,his:.03,score:0.65}},
  {name:'しょうが（生）',yomi:'ショウガ',tags:'野菜 香辛料 生姜',en:'ginger root raw',cal:30,p:0.9,f:0.3,c:6.6,per:100,fiber:2.1,iron:0.5,calcium:12,vitc:2,vitd:0,salt:0},
  {name:'きのこ（しいたけ・生）',yomi:'シイタケ',tags:'きのこ 椎茸 食物繊維 ビタミンD',en:'shiitake mushroom raw',cal:34,p:3.0,f:0.4,c:6.4,per:100,fiber:4.9,iron:0.3,calcium:2,vitc:0,vitd:1.7,salt:0,aa:{leu:.07,ile:.04,val:.05,lys:.05,met:.01,thr:.04,trp:.01,his:.03,score:0.65}},
  {name:'えのきだけ（生）',yomi:'エノキダケ',tags:'きのこ えのき',en:'enoki mushroom raw',cal:34,p:2.7,f:0.2,c:7.8,per:100,fiber:3.9,iron:1.1,calcium:0,vitc:0,vitd:0.9,salt:0,aa:{leu:.07,ile:.04,val:.05,lys:.05,met:.01,thr:.04,trp:.01,his:.03,score:0.65}},
  {name:'まいたけ（生）',yomi:'マイタケ',tags:'きのこ 舞茸 ビタミンD',en:'maitake mushroom raw',cal:22,p:2.0,f:0.5,c:4.4,per:100,fiber:3.5,iron:0.2,calcium:0,vitc:0,vitd:4.9,salt:0,fa:{sat:.20,mufa:.30,n3:.05,n6:.35,trans:.00},aa:{leu:.07,ile:.04,val:.05,lys:.05,met:.01,thr:.04,trp:.01,his:.03,score:0.65}},
  {name:'エリンギ（生）',yomi:'エリンギ',tags:'きのこ',en:'king oyster mushroom raw',cal:31,p:2.8,f:0.4,c:6.0,per:100,fiber:3.4,iron:0.3,calcium:0,vitc:0,vitd:0.5,salt:0,aa:{leu:.07,ile:.04,val:.05,lys:.05,met:.01,thr:.04,trp:.01,his:.03,score:0.65}},
  {name:'なめこ（生）',yomi:'ナメコ',tags:'きのこ ぬめり',en:'nameko mushroom raw',cal:21,p:1.7,f:0.2,c:5.4,per:100,fiber:3.3,iron:0.7,calcium:4,vitc:0,vitd:0.9,salt:0,aa:{leu:.07,ile:.04,val:.05,lys:.05,met:.01,thr:.04,trp:.01,his:.03,score:0.65}},

  // ── 調味料・油脂（拡充） ──
  {name:'オリーブオイル（大さじ1）',yomi:'オリーブオイル',tags:'油 脂質 オリーブ 大さじ',en:'olive oil tablespoon',cal:111,p:0,f:12.0,c:0,per:12,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0,fa:{sat:.14,mufa:.74,n3:.01,n6:.10,trans:.00}},
  {name:'ごま油（大さじ1）',yomi:'ゴマアブラ',tags:'油 脂質 ごま 大さじ',en:'sesame oil tablespoon',cal:111,p:0,f:12.0,c:0,per:12,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0,fa:{sat:.15,mufa:.39,n3:.00,n6:.43,trans:.00}},
  {name:'砂糖（上白糖・小さじ1）',yomi:'サトウ',tags:'砂糖 甘味 調味料',en:'sugar white teaspoon',cal:13,p:0,f:0,c:3.3,per:3.5,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0},
  {name:'塩（小さじ1）',yomi:'シオ',tags:'塩 調味料 ナトリウム',en:'salt teaspoon',cal:0,p:0,f:0,c:0,per:6,fiber:0,iron:0,calcium:1,vitc:0,vitd:0,salt:6.0},
  {name:'酢（大さじ1）',yomi:'ス',tags:'酢 調味料 酢酸',en:'vinegar rice tablespoon',cal:5,p:0.1,f:0,c:1.2,per:15,fiber:0,iron:0,calcium:1,vitc:0,vitd:0,salt:0},
  {name:'料理酒（大さじ1）',yomi:'リョウリシュ',tags:'料理酒 調味料 酒',en:'cooking sake mirin tablespoon',cal:14,p:0.1,f:0,c:1.9,per:15,fiber:0,iron:0,calcium:1,vitc:0,vitd:0,salt:0},
  {name:'コチュジャン（小さじ1）',yomi:'コチュジャン',tags:'コチュジャン 韓国 調味料 唐辛子',en:'gochujang korean chili paste teaspoon',cal:17,p:0.5,f:0.3,c:3.2,per:8,fiber:0.3,iron:0.1,calcium:5,vitc:0,vitd:0,salt:0.5},
  {name:'豆板醤（小さじ1）',yomi:'トウバンジャン',tags:'豆板醤 中華 調味料',en:'doubanjiang spicy bean paste teaspoon',cal:8,p:0.4,f:0.3,c:1.0,per:6,fiber:0.2,iron:0.1,calcium:4,vitc:0,vitd:0,salt:0.8},
  {name:'オイスターソース（小さじ1）',yomi:'オイスターソース',tags:'オイスター 牡蠣 中華 調味料',en:'oyster sauce teaspoon',cal:8,p:0.4,f:0,c:1.8,per:6,fiber:0,iron:0.1,calcium:3,vitc:0,vitd:0,salt:0.5},
  {name:'ナンプラー（小さじ1）',yomi:'ナンプラー',tags:'ナンプラー タイ 魚醤 調味料',en:'fish sauce nam pla teaspoon',cal:3,p:0.5,f:0,c:0.4,per:5,fiber:0,iron:0.1,calcium:3,vitc:0,vitd:0,salt:1.4},
  {name:'蜂蜜（大さじ1）',yomi:'ハチミツ',tags:'はちみつ ハニー 甘味',en:'honey tablespoon',cal:62,p:0.1,f:0,c:16.8,per:21,fiber:0,iron:0.1,calcium:0,vitc:0,vitd:0,salt:0},
  {name:'バルサミコ酢（大さじ1）',yomi:'バルサミコ',tags:'バルサミコ 酢 イタリアン',en:'balsamic vinegar tablespoon',cal:14,p:0.1,f:0,c:3.4,per:15,fiber:0,iron:0.1,calcium:4,vitc:0,vitd:0,salt:0},

  // ── 加工食品・冷凍食品（拡充） ──
  {name:'冷凍餃子（味の素ギョーザ12個）',yomi:'レイトウギョウザ',tags:'餃子 冷凍 味の素',en:'frozen gyoza dumpling ajinomoto 12pcs',cal:378,p:15.6,f:17.6,c:39.8,per:228,fiber:3.0,iron:1.6,calcium:35,vitc:4,vitd:0,salt:3.2,fa:{sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:0.75}},
  {name:'冷凍唐揚げ（市販・5個）',yomi:'レイトウカラアゲ',tags:'唐揚げ 冷凍 鶏',en:'frozen fried chicken 5pcs',cal:330,p:19.0,f:18.5,c:21.0,per:170,fiber:0.5,iron:0.8,calcium:15,vitc:0,vitd:0.1,salt:1.8,fa:{sat:.31,mufa:.44,n3:.03,n6:.18,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08}},
  {name:'冷凍ピラフ（チャーハン 1袋）',yomi:'レイトウピラフ',tags:'ピラフ チャーハン 冷凍 ライス',en:'frozen pilaf fried rice bag',cal:560,p:11.0,f:12.0,c:98.0,per:350,fiber:2.0,iron:0.8,calcium:25,vitc:3,vitd:0,salt:2.5,fa:{sat:.28,mufa:.35,n3:.04,n6:.24,trans:.01},aa:{leu:.09,ile:.05,val:.06,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'冷凍ブロッコリー（100g）',yomi:'レイトウブロッコリー',tags:'ブロッコリー 冷凍 野菜',en:'frozen broccoli 100g',cal:27,p:3.5,f:0.4,c:3.8,per:100,fiber:3.7,iron:0.9,calcium:32,vitc:55,vitd:0,salt:0.1,aa:{leu:.07,ile:.04,val:.05,lys:.05,met:.01,thr:.04,trp:.01,his:.03,score:0.65}},
  {name:'インスタント味噌汁（1食）',yomi:'インスタントミソシル',tags:'味噌汁 インスタント みそ汁',en:'instant miso soup packet',cal:30,p:2.0,f:0.8,c:3.8,per:9,fiber:0.5,iron:0.2,calcium:40,vitc:0,vitd:0,salt:1.5,fa:{sat:.28,mufa:.35,n3:.04,n6:.24,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'カップスープ（コーンポタージュ）',yomi:'コーンポタージュ',tags:'スープ コーン ポタージュ カップ',en:'cup soup corn potage',cal:73,p:1.5,f:2.0,c:12.5,per:14,fiber:0.5,iron:0.2,calcium:30,vitc:1,vitd:0,salt:1.3,fa:{sat:.28,mufa:.35,n3:.04,n6:.24,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'レトルトカレー（辛口）',yomi:'レトルトカレー',tags:'カレー レトルト',en:'retort curry hot',cal:216,p:7.5,f:9.5,c:26.5,per:200,fiber:2.8,iron:1.6,calcium:32,vitc:4,vitd:0,salt:2.9,fa:{sat:.30,mufa:.35,n3:.03,n6:.25,trans:.01},aa:{leu:0.08,ile:0.05,val:0.05,lys:0.06,met:0.02,thr:0.04,trp:0.01,his:0.03,score:0.75},serving:350},
  {name:'シーフードミックス（冷凍）',yomi:'シーフードミックス',tags:'シーフード 冷凍 えび いか ほたて',en:'frozen seafood mix shrimp squid scallop',cal:68,p:13.0,f:0.8,c:2.0,per:100,fiber:0,iron:0.7,calcium:60,vitc:0,vitd:0,salt:0.5,fa:{sat:.28,mufa:.24,n3:.24,n6:.08,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},

  // ── 外食・チェーン（拡充） ──
  {name:'松屋 牛めし並盛',yomi:'マツヤギュウメシ',tags:'松屋 牛丼 外食 チェーン',en:'matsuya beef bowl regular',cal:658,p:27.0,f:19.5,c:88.0,per:360,fiber:2.5,iron:2.8,calcium:80,vitc:3,vitd:0.2,salt:2.6,fa:{sat:.47,mufa:.43,n3:.01,n6:.05,trans:.02},aa:{leu:0.09,ile:0.05,val:0.05,lys:0.09,met:0.03,thr:0.05,trp:0.01,his:0.03,score:1.0},serving:360},
  {name:'マクドナルド ビッグマックセット（ポテトM）',yomi:'ビッグマックセット',tags:'マクドナルド マック セット バーガー',en:'big mac set medium fries mcdonalds',cal:935,p:31.5,f:46.5,c:99.0,per:349,fiber:6.5,iron:4.8,calcium:245,vitc:15,vitd:0.3,salt:3.5,fa:{sat:.32,mufa:.38,n3:.03,n6:.22,trans:.02},aa:{leu:.09,ile:.05,val:.06,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:214},
  {name:'スターバックス ラテ（トール・全乳）',yomi:'スターバックスラテ',tags:'スタバ コーヒー ラテ カフェ',en:'starbucks latte tall whole milk',cal:180,p:10.0,f:7.0,c:19.0,per:354,fiber:0,iron:0.1,calcium:300,vitc:0,vitd:2.5,salt:0.2,fa:{sat:.62,mufa:.28,n3:.01,n6:.02,trans:.03},aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22}},
  {name:'スターバックス フラペチーノ（トール）',yomi:'フラペチーノ',tags:'スタバ フラペチーノ 甘い',en:'starbucks frappuccino tall',cal:300,p:4.5,f:8.5,c:52.0,per:354,fiber:0.5,iron:0.2,calcium:130,vitc:0,vitd:1.0,salt:0.3,fa:{sat:.45,mufa:.33,n3:.02,n6:.12,trans:.02},aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22}},
  {name:'吉野家 牛丼並盛',yomi:'ヨシノヤギュウドン',tags:'吉野家 牛丼 外食',en:'yoshinoya gyudon beef bowl regular',cal:666,p:26.0,f:22.0,c:87.0,per:360,fiber:2.0,iron:2.5,calcium:70,vitc:3,vitd:0.2,salt:2.5,fa:{sat:.47,mufa:.43,n3:.01,n6:.05,trans:.02},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'すき家 牛丼並盛',yomi:'スキヤギュウドン',tags:'すき家 牛丼 外食',en:'sukiya gyudon beef bowl regular',cal:699,p:25.0,f:22.5,c:92.0,per:380,fiber:2.0,iron:2.5,calcium:75,vitc:3,vitd:0.2,salt:2.8,fa:{sat:.47,mufa:.43,n3:.01,n6:.05,trans:.02},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'サイゼリヤ ミラノ風ドリア',yomi:'サイゼリヤ',tags:'サイゼ ドリア パスタ 外食',en:'saizeriya milan doria gratin',cal:520,p:19.0,f:16.5,c:73.0,per:350,fiber:2.5,iron:2.0,calcium:250,vitc:5,vitd:0.3,salt:3.0,fa:{sat:.45,mufa:.33,n3:.02,n6:.12,trans:.02},aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22}},
  {name:'丸亀製麺 かけうどん（並）',yomi:'マルガメうどん',tags:'うどん 丸亀 外食 チェーン',en:'marugame udon kake regular',cal:298,p:9.0,f:1.5,c:62.0,per:400,fiber:2.0,iron:1.0,calcium:80,vitc:0,vitd:0,salt:4.5,fa:{sat:.18,mufa:.28,n3:.04,n6:.35,trans:.00},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45}},
  {name:'スシロー まぐろ（1貫）',yomi:'スシロー',tags:'回転寿司 すし まぐろ',en:'sushiro tuna sushi nigiri',cal:47,p:4.0,f:0.3,c:7.0,per:30,fiber:0.1,iron:0.2,calcium:2,vitc:0,vitd:0.5,salt:0.3,fa:{sat:.28,mufa:.18,n3:.38,n6:.05,trans:.00},aa:{leu:0.09,ile:0.05,val:0.05,lys:0.1,met:0.03,thr:0.05,trp:0.01,his:0.03,score:1.0}},
  {name:'コンビニ　ざるそば（1食）',yomi:'ザルソバ',tags:'そば ざるそば コンビニ',en:'zaru soba cold noodle convenience store',cal:370,p:15.0,f:2.5,c:72.0,per:340,fiber:3.5,iron:1.5,calcium:50,vitc:0,vitd:0,salt:3.8,fa:{sat:.18,mufa:.28,n3:.04,n6:.35,trans:.00},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45}},
  {name:'コンビニ　幕の内弁当',yomi:'マクノウチベントウ',tags:'弁当 コンビニ 幕の内',en:'makunouchi bento lunch box convenience',cal:620,p:22.0,f:18.0,c:87.0,per:450,fiber:3.0,iron:1.5,calcium:90,vitc:5,vitd:0.5,salt:3.5,fa:{sat:.28,mufa:.35,n3:.04,n6:.24,trans:.01},aa:{leu:.09,ile:.05,val:.06,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'コンビニ　サラダチキン（1袋）',yomi:'サラダチキン',tags:'サラダチキン コンビニ 高タンパク 鶏',en:'salad chicken breast convenience store',cal:116,p:24.0,f:1.5,c:0.5,per:115,fiber:0,iron:0.3,calcium:5,vitc:0,vitd:0.1,salt:1.5,fa:{sat:.28,mufa:.40,n3:.02,n6:.22,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08}},
  {name:'コンビニ　ゆでたまご（2個入）',yomi:'コンビニゆでたまご',tags:'たまご ゆで卵 コンビニ',en:'convenience store boiled eggs 2pcs',cal:130,p:11.0,f:9.0,c:0.4,per:86,fiber:0,iron:1.5,calcium:44,vitc:0,vitd:3.2,salt:0.4,fa:{sat:.30,mufa:.42,n3:.03,n6:.19,trans:.01},aa:{leu:.09,ile:.06,val:.07,lys:.09,met:.03,thr:.06,trp:.02,his:.03,score:1.13}},

  // ── 和食・定食（拡充） ──
  {name:'肉じゃが（1人前）',yomi:'ニクジャガ',tags:'和食 煮物 家庭料理 定食',en:'nikujaga meat potato stew',cal:345,p:15.0,f:8.5,c:52.0,per:300,fiber:4.5,iron:2.5,calcium:40,vitc:25,vitd:0.2,salt:2.5,fa:{sat:.47,mufa:.43,n3:.01,n6:.05,trans:.02},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'筑前煮（1人前）',yomi:'チクゼンニ',tags:'和食 煮物 根菜',en:'chikuzenni chicken vegetable stew',cal:220,p:14.0,f:5.5,c:30.0,per:200,fiber:3.5,iron:1.5,calcium:45,vitc:10,vitd:0.1,salt:2.0,fa:{sat:.35,mufa:.42,n3:.02,n6:.14,trans:.01},aa:{leu:.09,ile:.05,val:.06,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'ひじきの煮物（1人前）',yomi:'ヒジキノニモノ',tags:'ひじき 副菜 和食 鉄分',en:'hijiki seaweed stewed',cal:85,p:3.5,f:2.5,c:12.0,per:80,fiber:4.5,iron:3.5,calcium:120,vitc:0,vitd:0,salt:1.2,fa:{sat:.20,mufa:.30,n3:.05,n6:.35,trans:.00},aa:{leu:.07,ile:.04,val:.05,lys:.05,met:.01,thr:.04,trp:.01,his:.03,score:0.65}},
  {name:'切り干し大根（1人前）',yomi:'キリボシダイコン',tags:'切り干し 副菜 和食',en:'kiriboshi daikon dried radish',cal:70,p:2.5,f:0.3,c:15.0,per:70,fiber:3.5,iron:0.7,calcium:65,vitc:3,vitd:0,salt:1.0,aa:{leu:.07,ile:.04,val:.05,lys:.05,met:.01,thr:.04,trp:.01,his:.03,score:0.65}},
  {name:'冷奴（1丁）',yomi:'ヒヤヤッコ',tags:'豆腐 冷奴 和食',en:'hiyayakko cold tofu',cal:72,p:7.0,f:4.3,c:1.5,per:100,fiber:0.4,iron:1.5,calcium:93,vitc:0,vitd:0,salt:0.2,fa:{sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00},aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.91},serving:150},
  {name:'茶碗蒸し（1個）',yomi:'チャワンムシ',tags:'卵 和食 蒸し物',en:'chawanmushi steamed egg custard',cal:65,p:5.5,f:2.5,c:5.5,per:150,fiber:0.2,iron:0.5,calcium:50,vitc:0,vitd:0.8,salt:0.9,aa:{leu:.09,ile:.06,val:.07,lys:.09,met:.03,thr:.06,trp:.02,his:.03,score:1.13},fa:{sat:0.3,mufa:0.42,n3:0.03,n6:0.19,trans:0.01}},
  {name:'味噌汁（豆腐・わかめ）',yomi:'ミソシル',tags:'味噌汁 みそ汁 和食 汁物',en:'miso soup tofu wakame',cal:35,p:2.5,f:1.2,c:3.8,per:200,fiber:1.0,iron:1.0,calcium:60,vitc:0,vitd:0,salt:1.8,aa:{leu:.07,ile:.04,val:.05,lys:.05,met:.01,thr:.04,trp:.01,his:.03,score:0.65},fa:{sat:0.14,mufa:0.24,n3:0.07,n6:0.52,trans:0.0}},
  {name:'豚汁（1杯）',yomi:'トンジル',tags:'豚汁 汁物 和食',en:'tonjiru pork miso soup',cal:120,p:6.5,f:4.5,c:14.0,per:250,fiber:2.5,iron:1.0,calcium:40,vitc:5,vitd:0.1,salt:1.8,fa:{sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01},aa:{leu:0.09,ile:0.05,val:0.05,lys:0.09,met:0.03,thr:0.05,trp:0.01,his:0.03,score:0.98}},
  {name:'けんちん汁（1杯）',yomi:'ケンチンジル',tags:'けんちん汁 汁物 和食 根菜',en:'kenchinjiru tofu vegetable soup',cal:95,p:5.0,f:3.0,c:12.0,per:250,fiber:3.0,iron:1.2,calcium:55,vitc:5,vitd:0,salt:1.6,fa:{sat:.35,mufa:.42,n3:.02,n6:.14,trans:.01},aa:{leu:.09,ile:.05,val:.06,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},

  // ── パン・洋食（拡充） ──
  {name:'ベーグル（プレーン）',yomi:'ベーグル',tags:'パン 低脂質 朝食',en:'bagel plain',cal:270,p:10.6,f:1.7,c:55.5,per:105,fiber:2.3,iron:2.0,calcium:13,vitc:0,vitd:0,salt:0.6,aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},fa:{sat:0.2,mufa:0.3,n3:0.05,n6:0.35,trans:0.0}},
  {name:'フレンチトースト（1枚）',yomi:'フレンチトースト',tags:'パン 卵 朝食 洋食',en:'french toast 1 slice',cal:185,p:7.0,f:7.5,c:23.5,per:90,fiber:0.8,iron:0.8,calcium:65,vitc:0,vitd:0.8,salt:0.6,fa:{sat:.30,mufa:.42,n3:.03,n6:.19,trans:.01},aa:{leu:.09,ile:.06,val:.07,lys:.09,met:.03,thr:.06,trp:.02,his:.03,score:1.13}},
  {name:'パンケーキ（1枚）',yomi:'パンケーキ',tags:'パンケーキ ホットケーキ 朝食',en:'pancake hotcake 1 piece',cal:195,p:5.5,f:6.0,c:30.5,per:100,fiber:0.5,iron:0.6,calcium:60,vitc:0,vitd:0.3,salt:0.5,fa:{sat:.30,mufa:.42,n3:.03,n6:.19,trans:.01},aa:{leu:.09,ile:.06,val:.07,lys:.09,met:.03,thr:.06,trp:.02,his:.03,score:1.13}},
  {name:'グラタン（1人前）',yomi:'グラタン',tags:'グラタン 洋食 チーズ',en:'gratin au gratin',cal:420,p:18.0,f:20.5,c:40.0,per:270,fiber:2.5,iron:1.5,calcium:280,vitc:8,vitd:0.5,salt:2.5,fa:{sat:.45,mufa:.33,n3:.02,n6:.12,trans:.02},aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22}},
  {name:'シチュー（クリーム・1人前）',yomi:'シチュー',tags:'シチュー 洋食 クリーム',en:'cream stew chicken',cal:380,p:16.0,f:16.0,c:42.0,per:300,fiber:3.0,iron:1.2,calcium:170,vitc:15,vitd:0.3,salt:2.5,fa:{sat:.45,mufa:.33,n3:.02,n6:.12,trans:.02},aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22}},
  {name:'オムライス',yomi:'オムライス',tags:'卵 洋食 チキンライス',en:'omurice omelette rice',cal:580,p:20.0,f:22.0,c:75.0,per:380,fiber:2.0,iron:2.0,calcium:90,vitc:8,vitd:1.0,salt:2.8,fa:{sat:.30,mufa:.42,n3:.02,n6:.20,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08}},
  {name:'ミネストローネ（1杯）',yomi:'ミネストローネ',tags:'スープ イタリアン 野菜',en:'minestrone soup',cal:95,p:4.5,f:2.5,c:14.5,per:250,fiber:3.5,iron:1.2,calcium:50,vitc:20,vitd:0,salt:1.8,fa:{sat:.28,mufa:.35,n3:.04,n6:.24,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},

  // ── 菓子・スイーツ（拡充） ──
  {name:'ショートケーキ（1ピース）',yomi:'ショートケーキ',tags:'ケーキ お菓子 スイーツ いちご',en:'strawberry shortcake slice',cal:295,p:5.5,f:13.5,c:38.5,per:110,fiber:0.5,iron:0.3,calcium:55,vitc:5,vitd:0.3,salt:0.2,fa:{sat:.63,mufa:.27,n3:.01,n6:.03,trans:.03},aa:{leu:0.09,ile:0.06,val:0.07,lys:0.09,met:0.03,thr:0.06,trp:0.02,his:0.03,score:1.13}},
  {name:'チーズケーキ（1ピース）',yomi:'チーズケーキ',tags:'ケーキ お菓子 チーズ',en:'cheesecake slice',cal:335,p:7.0,f:22.0,c:27.5,per:100,fiber:0.3,iron:0.3,calcium:95,vitc:0,vitd:0.3,salt:0.5,fa:{sat:.63,mufa:.27,n3:.01,n6:.02,trans:.03},aa:{leu:0.1,ile:0.06,val:0.07,lys:0.08,met:0.03,thr:0.05,trp:0.01,his:0.03,score:1.22}},
  {name:'ティラミス（1人前）',yomi:'ティラミス',tags:'お菓子 イタリアン スイーツ',en:'tiramisu dessert',cal:290,p:6.5,f:19.5,c:22.5,per:120,fiber:0.2,iron:0.5,calcium:85,vitc:0,vitd:0.3,salt:0.2,fa:{sat:.45,mufa:.33,n3:.02,n6:.12,trans:.02},aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22}},
  {name:'大福（1個）',yomi:'ダイフク',tags:'和菓子 餅 あんこ',en:'daifuku mochi rice cake',cal:219,p:3.8,f:0.5,c:50.0,per:80,fiber:1.5,iron:0.5,calcium:20,vitc:0,vitd:0,salt:0.1,fa:{sat:.18,mufa:.28,n3:.04,n6:.35,trans:.00},aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59}},
  {name:'ようかん（1切れ）',yomi:'ヨウカン',tags:'和菓子 羊羹 あんこ',en:'yokan sweet red bean jelly',cal:171,p:2.5,f:0.2,c:41.5,per:60,fiber:1.8,iron:0.5,calcium:15,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59}},
  {name:'たい焼き（1個）',yomi:'タイヤキ',tags:'和菓子 たい焼き あんこ',en:'taiyaki fish shaped cake',cal:215,p:5.0,f:3.5,c:42.0,per:90,fiber:2.0,iron:0.8,calcium:25,vitc:0,vitd:0,salt:0.3,fa:{sat:.18,mufa:.28,n3:.04,n6:.35,trans:.00},aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59}},
  {name:'みたらし団子（1串3個）',yomi:'ミタラシダンゴ',tags:'和菓子 団子 みたらし',en:'mitarashi dango sweet soy skewer',cal:135,p:2.0,f:0.3,c:31.5,per:65,fiber:0.3,iron:0.2,calcium:5,vitc:0,vitd:0,salt:0.3,aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59}},
  {name:'マカロン（1個）',yomi:'マカロン',tags:'洋菓子 お菓子 フランス',en:'macaron french cookie',cal:90,p:1.5,f:3.5,c:14.0,per:25,fiber:0.3,iron:0.1,calcium:8,vitc:0,vitd:0,salt:0.1,fa:{sat:.45,mufa:.33,n3:.02,n6:.12,trans:.02},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45}},
  {name:'ポップコーン（1袋・塩味）',yomi:'ポップコーン',tags:'お菓子 スナック とうもろこし',en:'popcorn salted bag',cal:465,p:9.5,f:22.0,c:58.0,per:100,fiber:9.0,iron:2.5,calcium:5,vitc:0,vitd:0,salt:1.2,fa:{sat:.18,mufa:.35,n3:.05,n6:.38,trans:.01},aa:{leu:.07,ile:.04,val:.05,lys:.05,met:.01,thr:.04,trp:.01,his:.03,score:0.65}},
  {name:'ハーゲンダッツ バニラ（1個）',yomi:'ハーゲンダッツ',tags:'アイスクリーム ハーゲンダッツ',en:'haagen dazs vanilla ice cream cup',cal:267,p:4.3,f:17.0,c:24.4,per:110,fiber:0,iron:0.1,calcium:125,vitc:0.5,vitd:0.2,salt:0.1,fa:{sat:.62,mufa:.28,n3:.01,n6:.02,trans:.03},aa:{leu:0.1,ile:0.06,val:0.07,lys:0.08,met:0.03,thr:0.05,trp:0.01,his:0.03,score:1.22}},

  // ── 飲み物（拡充） ──
  {name:'緑茶（100ml）',yomi:'リョクチャ',tags:'お茶 緑茶 飲み物 カフェイン',en:'green tea 100ml',cal:2,p:0.2,f:0,c:0.3,per:100,fiber:0,iron:0.2,calcium:3,vitc:6,vitd:0,salt:0},
  {name:'ほうじ茶（100ml）',yomi:'ホウジチャ',tags:'お茶 ほうじ茶 飲み物',en:'hojicha roasted green tea 100ml',cal:1,p:0.1,f:0,c:0.2,per:100,fiber:0,iron:0.1,calcium:2,vitc:0,vitd:0,salt:0},
  {name:'コーヒー ブラック（100ml）',yomi:'コーヒー',tags:'コーヒー ブラック カフェイン',en:'black coffee 100ml',cal:4,p:0.2,f:0,c:0.7,per:100,fiber:0,iron:0.1,calcium:2,vitc:0,vitd:0,salt:0},
  {name:'コーヒー 缶（微糖 185ml）',yomi:'カンコーヒー',tags:'缶コーヒー コーヒー 微糖',en:'canned coffee slightly sweet 185ml',cal:30,p:0.7,f:0.4,c:5.9,per:185,fiber:0,iron:0,calcium:25,vitc:0,vitd:0,salt:0.1},
  {name:'カフェラテ（牛乳入り200ml）',yomi:'カフェラテ',tags:'コーヒー ラテ ミルク カフェ',en:'cafe latte milk 200ml',cal:84,p:5.2,f:3.2,c:8.4,per:200,fiber:0,iron:0.1,calcium:195,vitc:0,vitd:1.0,salt:0.1,aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22},fa:{sat:0.62,mufa:0.28,n3:0.01,n6:0.02,trans:0.03}},
  {name:'オレンジジュース（果汁100%・200ml）',yomi:'オレンジジュース',tags:'ジュース オレンジ 果汁 ビタミンC',en:'orange juice 100% 200ml',cal:84,p:1.4,f:0.2,c:19.8,per:200,fiber:0.4,iron:0.2,calcium:20,vitc:80,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'プロテインドリンク（ザバス・1本）',yomi:'プロテインドリンク',tags:'プロテイン ドリンク ザバス',en:'protein drink zavas 1 bottle',cal:200,p:15.0,f:0.5,c:32.0,per:200,fiber:0,iron:0.5,calcium:200,vitc:0,vitd:0,salt:0.3,aa:{leu:.11,ile:.07,val:.06,lys:.10,met:.02,thr:.07,trp:.02,his:.02,score:1.09},fa:{sat:0.2,mufa:0.28,n3:0.04,n6:0.16,trans:0.01}},
  {name:'アミノバリュー（500ml）',yomi:'アミノバリュー',tags:'スポーツドリンク アミノ酸 大塚',en:'amino value sports drink 500ml otsuka',cal:50,p:2.0,f:0,c:11.0,per:500,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0.5,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'ポカリスエット（500ml）',yomi:'ポカリスエット',tags:'スポーツドリンク ポカリ 大塚',en:'pocari sweat sports drink 500ml',cal:126,p:0,f:0,c:31.5,per:500,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0.6},
  {name:'モンスターエナジー（355ml）',yomi:'モンスターエナジー',tags:'エナジードリンク モンスター カフェイン',en:'monster energy drink 355ml',cal:157,p:0,f:0,c:40.0,per:355,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0.4},


  // ── 漬物・発酵食品 ──
  {name:'キムチ（白菜）',yomi:'キムチ',tags:'キムチ 漬物 韓国 発酵 乳酸菌',en:'kimchi korean fermented cabbage',cal:34,p:2.5,f:0.5,c:5.8,per:100,fiber:2.7,iron:0.5,calcium:35,vitc:20,vitd:0,salt:2.2,fa:{sat:.20,mufa:.30,n3:.05,n6:.35,trans:.00},aa:{leu:.07,ile:.04,val:.05,lys:.05,met:.01,thr:.04,trp:.01,his:.03,score:0.65}},
  {name:'梅干し（1個）',yomi:'ウメボシ',tags:'梅干し 漬物 和食',en:'umeboshi pickled plum',cal:10,p:0.3,f:0,c:2.5,per:15,fiber:0.6,iron:0.1,calcium:8,vitc:1,vitd:0,salt:1.8},
  {name:'ぬか漬け きゅうり（1本）',yomi:'ヌカヅケキュウリ',tags:'ぬか漬け 漬物 きゅうり 乳酸菌',en:'nukazuke cucumber pickle',cal:16,p:0.9,f:0.1,c:3.0,per:90,fiber:0.9,iron:0.3,calcium:36,vitc:7,vitd:0,salt:1.8},
  {name:'たくあん（3切れ）',yomi:'タクアン',tags:'たくあん 漬物 大根',en:'takuan pickled daikon radish',cal:25,p:0.6,f:0,c:5.6,per:30,fiber:0.6,iron:0.1,calcium:12,vitc:0,vitd:0,salt:1.1},
  {name:'ザワークラウト',yomi:'ザワークラウト',tags:'ザワークラウト 発酵 キャベツ ドイツ',en:'sauerkraut fermented cabbage',cal:19,p:0.9,f:0.1,c:4.3,per:100,fiber:2.6,iron:0.5,calcium:30,vitc:15,vitd:0,salt:0.9},
  {name:'塩麹（大さじ1）',yomi:'シオコウジ',tags:'塩麹 発酵 調味料',en:'shio koji salt fermented rice',cal:25,p:0.8,f:0.1,c:5.5,per:18,fiber:0.1,iron:0.1,calcium:3,vitc:0,vitd:0,salt:1.5},
  {name:'甘酒（ノンアルコール・200ml）',yomi:'アマザケ',tags:'甘酒 発酵 米 糀',en:'amazake sweet sake nonalcohol 200ml',cal:120,p:2.0,f:0.2,c:27.0,per:200,fiber:0,iron:0.2,calcium:6,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59}},
  {name:'ラッキョウ（3粒）',yomi:'ラッキョウ',tags:'らっきょう 漬物 辛い',en:'rakkyo pickled shallot',cal:29,p:0.3,f:0,c:7.3,per:30,fiber:0.6,iron:0.1,calcium:5,vitc:6,vitd:0,salt:1.0},
  {name:'ぬか床ご飯（常備菜セット目安）',yomi:'ヌカドコ',tags:'ぬか漬け 発酵食品 乳酸菌 腸活',en:'nukadoko fermented rice bran pickles',cal:20,p:1.0,f:0.2,c:4.0,per:100,fiber:1.5,iron:0.2,calcium:25,vitc:5,vitd:0,salt:2.0,aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59}},

  // ── ナッツ・種実（拡充） ──
  {name:'ミックスナッツ（30g）',yomi:'ミックスナッツ',tags:'ナッツ 種実 健康 間食',en:'mixed nuts 30g',cal:188,p:5.4,f:16.8,c:6.3,per:30,fiber:1.8,iron:0.9,calcium:23,vitc:0,vitd:0,salt:0,fa:{sat:.12,mufa:.50,n3:.03,n6:.28,trans:.00},aa:{leu:.07,ile:.04,val:.05,lys:.03,met:.02,thr:.03,trp:.01,his:.03,score:0.40}},
  {name:'カシューナッツ（10粒）',yomi:'カシューナッツ',tags:'カシュー ナッツ 種実',en:'cashew nuts 10 pieces',cal:166,p:4.6,f:13.6,c:8.8,per:28,fiber:0.9,iron:1.6,calcium:13,vitc:0,vitd:0,salt:0,fa:{sat:.22,mufa:.62,n3:.00,n6:.16,trans:.00},aa:{leu:0.07,ile:0.04,val:0.05,lys:0.03,met:0.02,thr:0.03,trp:0.01,his:0.03,score:0.4}},
  {name:'マカダミアナッツ（5粒）',yomi:'マカダミア',tags:'マカダミア ナッツ 高脂質',en:'macadamia nuts 5 pieces',cal:111,p:1.0,f:11.9,c:2.2,per:18,fiber:0.9,iron:0.3,calcium:8,vitc:0,vitd:0,salt:0,fa:{sat:.17,mufa:.78,n3:.00,n6:.02,trans:.00},aa:{leu:0.07,ile:0.04,val:0.05,lys:0.03,met:0.02,thr:0.03,trp:0.01,his:0.03,score:0.4}},
  {name:'ひまわりの種（大さじ1）',yomi:'ヒマワリタネ',tags:'種 ひまわり ビタミンE',en:'sunflower seeds tablespoon',cal:86,p:2.9,f:7.8,c:2.3,per:16,fiber:1.3,iron:0.8,calcium:13,vitc:0,vitd:0,salt:0,fa:{sat:.10,mufa:.19,n3:.00,n6:.68,trans:.00},aa:{leu:0.07,ile:0.04,val:0.05,lys:0.03,met:0.02,thr:0.03,trp:0.01,his:0.03,score:0.4}},
  {name:'かぼちゃの種（大さじ1）',yomi:'カボチャタネ',tags:'種 かぼちゃ 亜鉛 マグネシウム',en:'pumpkin seeds pepitas tablespoon',cal:81,p:4.0,f:7.0,c:2.1,per:14,fiber:0.7,iron:1.1,calcium:5,vitc:0,vitd:0,salt:0,fa:{sat:.17,mufa:.34,n3:.00,n6:.47,trans:.00},aa:{leu:0.07,ile:0.04,val:0.05,lys:0.03,met:0.02,thr:0.03,trp:0.01,his:0.03,score:0.4}},
  {name:'松の実（大さじ1）',yomi:'マツノミ',tags:'松の実 ナッツ ピニョン',en:'pine nuts tablespoon',cal:97,p:2.1,f:9.8,c:1.6,per:14,fiber:0.4,iron:0.8,calcium:3,vitc:0,vitd:0,salt:0,fa:{sat:.07,mufa:.35,n3:.01,n6:.54,trans:.00},aa:{leu:0.07,ile:0.04,val:0.05,lys:0.03,met:0.02,thr:0.03,trp:0.01,his:0.03,score:0.4}},
  {name:'フラックスシード（亜麻仁・大さじ1）',yomi:'フラックスシード',tags:'亜麻仁 フラックス ω3 食物繊維',en:'flaxseed ground tablespoon',cal:55,p:1.9,f:4.3,c:3.0,per:10,fiber:2.8,iron:0.6,calcium:26,vitc:0,vitd:0,salt:0,fa:{sat:.09,mufa:.20,n3:.57,n6:.14,trans:.00},aa:{leu:0.07,ile:0.04,val:0.05,lys:0.03,met:0.02,thr:0.03,trp:0.01,his:0.03,score:0.4}},
  {name:'ピスタチオ（10粒・殻なし）',yomi:'ピスタチオ',tags:'ピスタチオ ナッツ 緑',en:'pistachio nuts shelled 10pcs',cal:78,p:2.8,f:6.5,c:3.4,per:14,fiber:1.5,iron:0.5,calcium:14,vitc:0.4,vitd:0,salt:0,fa:{sat:.11,mufa:.53,n3:.01,n6:.32,trans:.00},aa:{leu:0.07,ile:0.04,val:0.05,lys:0.03,met:0.02,thr:0.03,trp:0.01,his:0.03,score:0.4}},

  // ── 中華料理 ──
  {name:'麻婆豆腐（1人前）',yomi:'マーボードウフ',tags:'麻婆豆腐 中華 豆腐 辛い',en:'mapo tofu sichuan chinese',cal:290,p:16.0,f:16.5,c:20.0,per:250,fiber:2.5,iron:2.5,calcium:150,vitc:5,vitd:0,salt:3.0,fa:{sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01},aa:{leu:0.08,ile:0.05,val:0.05,lys:0.07,met:0.01,thr:0.04,trp:0.01,his:0.03,score:0.91}},
  {name:'酢豚（1人前）',yomi:'スブタ',tags:'酢豚 中華 豚 甘酢',en:'subuta sweet sour pork chinese',cal:380,p:18.0,f:15.0,c:43.0,per:280,fiber:2.5,iron:1.5,calcium:35,vitc:12,vitd:0.1,salt:2.5,fa:{sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01},aa:{leu:0.09,ile:0.05,val:0.05,lys:0.09,met:0.03,thr:0.05,trp:0.01,his:0.03,score:0.98}},
  {name:'回鍋肉（1人前）',yomi:'ホイコーロー',tags:'回鍋肉 中華 豚 キャベツ',en:'hui guo rou twice cooked pork',cal:320,p:18.0,f:20.0,c:16.0,per:250,fiber:2.5,iron:1.5,calcium:45,vitc:25,vitd:0.1,salt:2.8,fa:{sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01},aa:{leu:0.09,ile:0.05,val:0.05,lys:0.09,met:0.03,thr:0.05,trp:0.01,his:0.03,score:0.98}},
  {name:'青椒肉絲（1人前）',yomi:'チンジャオロース',tags:'青椒肉絲 チンジャオロース 中華 ピーマン',en:'qing jiao rou si green pepper beef',cal:290,p:16.5,f:17.5,c:16.0,per:230,fiber:2.0,iron:2.0,calcium:25,vitc:40,vitd:0.1,salt:2.3,fa:{sat:.35,mufa:.42,n3:.02,n6:.14,trans:.01},aa:{leu:.09,ile:.05,val:.06,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'エビチリ（1人前）',yomi:'エビチリ',tags:'エビチリ 中華 えび 辛い',en:'stir fried shrimp chili sauce',cal:220,p:18.0,f:8.5,c:18.0,per:220,fiber:1.5,iron:1.0,calcium:65,vitc:8,vitd:0,salt:2.5,fa:{sat:.30,mufa:.18,n3:.28,n6:.10,trans:.00},aa:{leu:0.09,ile:0.05,val:0.05,lys:0.1,met:0.03,thr:0.05,trp:0.01,his:0.03,score:1.0}},
  {name:'棒棒鶏（バンバンジー）',yomi:'バンバンジー',tags:'棒棒鶏 バンバンジー 中華 鶏',en:'bang bang chicken sichuan',cal:195,p:16.0,f:10.5,c:9.0,per:200,fiber:1.0,iron:0.8,calcium:30,vitc:3,vitd:0.1,salt:1.5,fa:{sat:.28,mufa:.40,n3:.02,n6:.22,trans:.01},aa:{leu:0.09,ile:0.05,val:0.05,lys:0.1,met:0.03,thr:0.05,trp:0.01,his:0.03,score:1.08}},
  {name:'八宝菜（1人前）',yomi:'ハッポウサイ',tags:'八宝菜 中華 野菜 シーフード',en:'happosai eight treasures mixed stir fry',cal:195,p:14.0,f:6.5,c:19.0,per:250,fiber:3.0,iron:1.5,calcium:80,vitc:20,vitd:0,salt:2.0,fa:{sat:.35,mufa:.42,n3:.02,n6:.14,trans:.01},aa:{leu:.09,ile:.05,val:.06,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'担々麺（外食）',yomi:'タンタンメン',tags:'担々麺 ラーメン 中華 ごま',en:'dan dan men sichuan sesame noodles',cal:680,p:28.0,f:28.0,c:75.0,per:700,fiber:4.0,iron:3.0,calcium:120,vitc:5,vitd:0.3,salt:6.5,fa:{sat:.25,mufa:.30,n3:.04,n6:.30,trans:.01},aa:{leu:0.07,ile:0.04,val:0.04,lys:0.02,met:0.02,thr:0.03,trp:0.01,his:0.02,score:0.45}},
  {name:'小籠包（4個）',yomi:'ショウロンポウ',tags:'小籠包 中華 豚 蒸し',en:'xiaolongbao soup dumplings 4pcs',cal:280,p:12.0,f:12.0,c:30.0,per:160,fiber:1.5,iron:1.5,calcium:30,vitc:2,vitd:0.1,salt:2.0,fa:{sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01},aa:{leu:0.09,ile:0.05,val:0.05,lys:0.09,met:0.03,thr:0.05,trp:0.01,his:0.03,score:0.98}},

  // ── 韓国料理 ──
  {name:'ビビンバ（外食）',yomi:'ビビンバ',tags:'ビビンバ 韓国 ご飯 野菜 牛',en:'bibimbap korean mixed rice',cal:620,p:22.0,f:15.0,c:96.0,per:450,fiber:4.5,iron:3.5,calcium:80,vitc:15,vitd:0.2,salt:3.0,fa:{sat:.28,mufa:.35,n3:.04,n6:.24,trans:.01},aa:{leu:.09,ile:.05,val:.06,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'プルコギ（1人前）',yomi:'プルコギ',tags:'プルコギ 韓国 牛 焼肉',en:'bulgogi korean marinated beef',cal:285,p:20.0,f:12.0,c:23.0,per:200,fiber:1.0,iron:2.5,calcium:25,vitc:5,vitd:0.1,salt:2.0,fa:{sat:.47,mufa:.43,n3:.01,n6:.05,trans:.02},aa:{leu:0.09,ile:0.05,val:0.05,lys:0.09,met:0.03,thr:0.05,trp:0.01,his:0.03,score:0.98}},
  {name:'スンドゥブチゲ（1人前）',yomi:'スンドゥブ',tags:'スンドゥブ チゲ 韓国 豆腐 辛い',en:'sundubu jjigae soft tofu stew korean',cal:240,p:18.0,f:10.5,c:18.0,per:400,fiber:2.5,iron:2.5,calcium:200,vitc:8,vitd:0.5,salt:3.5,fa:{sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00},aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.91}},
  {name:'キンパ（1本）',yomi:'キンパ',tags:'キンパ 韓国 海苔巻き ご飯',en:'kimbap korean seaweed rice roll',cal:395,p:13.0,f:9.0,c:65.0,per:240,fiber:2.5,iron:2.0,calcium:65,vitc:5,vitd:0.3,salt:2.2,fa:{sat:.28,mufa:.35,n3:.04,n6:.24,trans:.01},aa:{leu:.09,ile:.05,val:.06,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'チヂミ（1枚）',yomi:'チヂミ',tags:'チヂミ 韓国 ねぎ 海鮮',en:'jeon korean pancake pajeon',cal:290,p:9.0,f:11.0,c:39.0,per:180,fiber:2.0,iron:1.0,calcium:55,vitc:8,vitd:0,salt:1.5,fa:{sat:.18,mufa:.35,n3:.05,n6:.38,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'ユッケジャンスープ（1杯）',yomi:'ユッケジャン',tags:'ユッケジャン 韓国 牛 辛いスープ',en:'yukgaejang spicy beef vegetable soup',cal:210,p:16.0,f:9.0,c:15.0,per:350,fiber:3.0,iron:3.0,calcium:45,vitc:15,vitd:0.1,salt:3.5,fa:{sat:.47,mufa:.43,n3:.01,n6:.05,trans:.02},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},

  // ── インド・エスニック料理 ──
  {name:'バターチキンカレー（1人前）',yomi:'バターチキンカレー',tags:'インド カレー バター チキン',en:'butter chicken curry indian',cal:480,p:22.0,f:22.0,c:48.0,per:350,fiber:3.5,iron:2.5,calcium:80,vitc:10,vitd:0.2,salt:2.5,fa:{sat:.47,mufa:.43,n3:.01,n6:.05,trans:.02},aa:{leu:0.08,ile:0.05,val:0.05,lys:0.06,met:0.02,thr:0.04,trp:0.01,his:0.03,score:0.75},serving:350},
  {name:'ナン（1枚）',yomi:'ナン',tags:'ナン インド パン 小麦',en:'naan indian bread',cal:262,p:8.5,f:3.8,c:50.0,per:110,fiber:2.0,iron:2.5,calcium:45,vitc:0,vitd:0,salt:0.7,aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},fa:{sat:0.2,mufa:0.3,n3:0.05,n6:0.35,trans:0.0}},
  {name:'サグカレー（ほうれん草）',yomi:'サグカレー',tags:'インド カレー ほうれん草 サグ',en:'saag curry spinach indian',cal:280,p:15.0,f:14.0,c:22.0,per:300,fiber:4.5,iron:3.5,calcium:150,vitc:25,vitd:0.2,salt:2.0,fa:{sat:.28,mufa:.35,n3:.04,n6:.24,trans:.01},aa:{leu:.09,ile:.05,val:.06,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'ダルカレー（レンズ豆）',yomi:'ダルカレー',tags:'インド カレー 豆 レンズ豆 ダル',en:'dal curry lentil indian',cal:245,p:14.0,f:7.5,c:32.0,per:300,fiber:7.0,iron:4.5,calcium:55,vitc:5,vitd:0,salt:1.8,aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.72},fa:{sat:0.3,mufa:0.35,n3:0.03,n6:0.25,trans:0.01}},
  {name:'タンドリーチキン（2本）',yomi:'タンドリーチキン',tags:'インド 鶏 タンドリー スパイス',en:'tandoori chicken 2 pieces',cal:290,p:34.0,f:12.0,c:8.0,per:200,fiber:0.5,iron:1.5,calcium:30,vitc:5,vitd:0.3,salt:1.5,fa:{sat:.28,mufa:.40,n3:.02,n6:.22,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08}},
  {name:'ラッシー（ヨーグルト飲料・200ml）',yomi:'ラッシー',tags:'ラッシー ヨーグルト インド 飲み物',en:'lassi yogurt drink 200ml indian',cal:130,p:5.0,f:3.5,c:19.5,per:200,fiber:0,iron:0.1,calcium:190,vitc:0,vitd:0.2,salt:0.1,fa:{sat:.62,mufa:.28,n3:.01,n6:.02,trans:.03},aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22}},
  {name:'パッタイ（1人前）',yomi:'パッタイ',tags:'パッタイ タイ 麺 えび',en:'pad thai noodles thai',cal:520,p:18.0,f:18.0,c:70.0,per:380,fiber:3.0,iron:2.0,calcium:65,vitc:8,vitd:0.2,salt:3.0,fa:{sat:.28,mufa:.24,n3:.24,n6:.08,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'グリーンカレー（1人前）',yomi:'グリーンカレー',tags:'タイ カレー グリーン ガパオ',en:'green curry thai coconut',cal:420,p:18.0,f:28.0,c:22.0,per:350,fiber:3.5,iron:2.5,calcium:60,vitc:15,vitd:0.2,salt:2.5,fa:{sat:.55,mufa:.25,n3:.01,n6:.08,trans:.00},aa:{leu:0.08,ile:0.05,val:0.05,lys:0.06,met:0.02,thr:0.04,trp:0.01,his:0.03,score:0.75}},
  {name:'フォー（1杯）',yomi:'フォー',tags:'フォー ベトナム 麺 米麺',en:'pho vietnamese rice noodle soup',cal:380,p:22.0,f:6.5,c:58.0,per:600,fiber:2.0,iron:2.5,calcium:55,vitc:5,vitd:0.2,salt:3.5,fa:{sat:.28,mufa:.24,n3:.24,n6:.08,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},

  // ── 洋食・地中海（拡充） ──
  {name:'サーモンステーキ（1切れ）',yomi:'サーモンステーキ',tags:'鮭 ステーキ 洋食 DHA EPA',en:'salmon steak grilled',cal:230,p:28.0,f:13.0,c:0.5,per:150,fiber:0,iron:0.8,calcium:24,vitc:0,vitd:50,salt:0.4,fa:{sat:.22,mufa:.32,n3:.32,n6:.08,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:100},
  {name:'ローストビーフ（薄切り3枚）',yomi:'ローストビーフ',tags:'牛 ローストビーフ 洋食',en:'roast beef sliced 3pcs',cal:195,p:22.5,f:11.5,c:0.5,per:120,fiber:0,iron:2.8,calcium:6,vitc:0,vitd:0.1,salt:0.8,fa:{sat:.47,mufa:.43,n3:.01,n6:.05,trans:.02},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'キッシュ（1ピース）',yomi:'キッシュ',tags:'キッシュ 洋食 卵 フランス',en:'quiche lorraine slice',cal:320,p:12.0,f:22.0,c:18.0,per:130,fiber:0.8,iron:1.2,calcium:150,vitc:2,vitd:0.8,salt:1.2,fa:{sat:.45,mufa:.33,n3:.02,n6:.12,trans:.02},aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22}},
  {name:'ポトフ（1人前）',yomi:'ポトフ',tags:'ポトフ 洋食 煮込み フランス',en:'pot-au-feu french stew',cal:265,p:18.0,f:10.0,c:24.0,per:400,fiber:4.5,iron:2.0,calcium:55,vitc:25,vitd:0.1,salt:2.0,fa:{sat:.35,mufa:.42,n3:.02,n6:.14,trans:.01},aa:{leu:.09,ile:.05,val:.06,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'フムス（ひよこ豆ペースト・大さじ2）',yomi:'フムス',tags:'フムス 中東 ひよこ豆 ディップ',en:'hummus chickpea dip 2 tablespoons',cal:70,p:2.5,f:4.5,c:5.5,per:30,fiber:1.5,iron:0.6,calcium:15,vitc:1,vitd:0,salt:0.3,fa:{sat:.10,mufa:.28,n3:.01,n6:.30,trans:.00},aa:{leu:0.08,ile:0.05,val:0.05,lys:0.07,met:0.01,thr:0.04,trp:0.01,his:0.03,score:0.72}},
  {name:'タブーリ（パセリサラダ）',yomi:'タブーリ',tags:'タブーリ 中東 レバノン ハーブ',en:'tabbouleh parsley bulgur salad',cal:95,p:2.5,f:5.0,c:11.0,per:150,fiber:2.5,iron:1.5,calcium:50,vitc:35,vitd:0,salt:0.5,fa:{sat:.18,mufa:.35,n3:.05,n6:.38,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},

  // ── 健康食品・スーパーフード ──
  {name:'キヌア（乾燥・50g）',yomi:'キヌア',tags:'キヌア スーパーフード 穀物 全タンパク',en:'quinoa dry 50g',cal:185,p:7.0,f:3.0,c:33.9,per:50,fiber:2.8,iron:2.4,calcium:25,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.02,thr:.04,trp:.01,his:.03,score:0.85},fa:{sat:0.15,mufa:0.25,n3:0.08,n6:0.45,trans:0}},
  {name:'テンペ（100g）',yomi:'テンペ',tags:'テンペ 大豆 発酵 インドネシア',en:'tempeh fermented soybean',cal:193,p:18.5,f:10.8,c:9.4,per:100,fiber:4.1,iron:2.7,calcium:111,vitc:0,vitd:0,salt:0,fa:{sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00},aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.91}},
  {name:'スピルリナ（粉末・5g）',yomi:'スピルリナ',tags:'スピルリナ サプリ 藻 スーパーフード',en:'spirulina powder 5g',cal:14,p:2.9,f:0.4,c:0.7,per:5,fiber:0.2,iron:1.4,calcium:6,vitc:0,vitd:0,salt:0.1,aa:{leu:.08,ile:.05,val:.05,lys:.05,met:.01,thr:.04,trp:.01,his:.02,score:0.75}},
  {name:'クロレラ（錠剤・2g）',yomi:'クロレラ',tags:'クロレラ サプリ 藻 葉緑素',en:'chlorella tablets 2g',cal:8,p:1.2,f:0.2,c:0.4,per:2,fiber:0.3,iron:0.6,calcium:8,vitc:1,vitd:0,salt:0,aa:{leu:0.08,ile:0.05,val:0.05,lys:0.05,met:0.01,thr:0.04,trp:0.01,his:0.02,score:0.75}},
  {name:'MCTオイル（大さじ1）',yomi:'エムシーティーオイル',tags:'MCT ケトン ダイエット 油',en:'MCT oil medium chain triglyceride tablespoon',cal:111,p:0,f:12.0,c:0,per:12,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0,fa:{sat:.95,mufa:.03,n3:.00,n6:.00,trans:.00}},
  {name:'コラーゲンペプチド（5g）',yomi:'コラーゲン',tags:'コラーゲン サプリ 美容 タンパク',en:'collagen peptide powder 5g',cal:18,p:4.5,f:0,c:0,per:5,fiber:0,iron:0,calcium:5,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'マカ（粉末・3g）',yomi:'マカ',tags:'マカ スーパーフード サプリ ペルー',en:'maca powder 3g',cal:10,p:0.4,f:0.1,c:2.2,per:3,fiber:0.3,iron:0.2,calcium:8,vitc:0,vitd:0,salt:0},

  // ── ダイエット・ローカロリー食品 ──
  {name:'こんにゃく（100g）',yomi:'コンニャク',tags:'こんにゃく ダイエット 低カロリー 食物繊維',en:'konnyaku konjac jelly',cal:7,p:0.1,f:0,c:2.3,per:100,fiber:2.2,iron:0.4,calcium:43,vitc:0,vitd:0,salt:0},
  {name:'しらたき（100g）',yomi:'シラタキ',tags:'しらたき 糸こんにゃく ダイエット',en:'shirataki noodles konjac',cal:7,p:0.2,f:0,c:2.9,per:100,fiber:2.9,iron:0.5,calcium:60,vitc:0,vitd:0,salt:0},
  {name:'寒天（粉末・4g）',yomi:'カンテン',tags:'寒天 ゼリー 食物繊維 ダイエット',en:'agar powder 4g',cal:6,p:0.1,f:0,c:2.6,per:4,fiber:2.6,iron:0,calcium:6,vitc:0,vitd:0,salt:0},
  {name:'おからパウダー（大さじ1）',yomi:'オカラパウダー',tags:'おから 大豆 低糖質 食物繊維',en:'okara soy pulp powder tablespoon',cal:30,p:2.0,f:1.0,c:5.0,per:10,fiber:3.8,iron:0.5,calcium:40,vitc:0,vitd:0,salt:0,fa:{sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00},aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.91}},
  {name:'パルスィートゼロ（砂糖代替・5g）',yomi:'パルスィート',tags:'人工甘味料 ゼロカロリー ダイエット',en:'zero calorie sweetener 5g',cal:0,p:0,f:0,c:0,per:5,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0},
  {name:'ゼロカロリーコーラ（350ml）',yomi:'ダイエットコーラ',tags:'コーラ ゼロ ダイエット 炭酸',en:'diet cola zero calorie 350ml',cal:1,p:0,f:0,c:0.4,per:350,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0.1},
  {name:'プロテインバー（1本）',yomi:'プロテインバー',tags:'プロテイン バー 間食 高タンパク',en:'protein bar snack',cal:190,p:20.0,f:7.0,c:15.0,per:60,fiber:2.5,iron:1.5,calcium:200,vitc:0,vitd:0,salt:0.3,aa:{leu:.11,ile:.07,val:.06,lys:.10,met:.02,thr:.07,trp:.02,his:.02,score:1.09},fa:{sat:0.2,mufa:0.28,n3:0.04,n6:0.16,trans:0.01}},
  {name:'カロリーメイト（1本）',yomi:'カロリーメイト',tags:'カロリーメイト 栄養補助 大塚 間食',en:'calorie mate nutrition bar otsuka',cal:100,p:2.0,f:4.5,c:13.5,per:25,fiber:0.5,iron:1.2,calcium:100,vitc:8,vitd:0.9,salt:0.2,fa:{sat:.28,mufa:.35,n3:.04,n6:.24,trans:.01},aa:{leu:.11,ile:.07,val:.06,lys:.10,met:.02,thr:.07,trp:.02,his:.02,score:1.09}},
  {name:'SOYLENT（液体食 375ml）',yomi:'ソイレント',tags:'完全食 SOYLENT ダイエット 代替食',en:'soylent meal replacement drink 375ml',cal:400,p:20.0,f:21.0,c:37.0,per:375,fiber:3.0,iron:5.0,calcium:400,vitc:60,vitd:5.0,salt:0.6,fa:{sat:.07,mufa:.23,n3:.07,n6:.47,trans:.00},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.91}},

  // ── スポーツ・アスリート向け ──
  {name:'おにぎり（鮭・コンビニ）',yomi:'オニギリサケ',tags:'おにぎり コンビニ 鮭 主食',en:'salmon onigiri rice ball convenience',cal:192,p:5.3,f:1.8,c:38.5,per:105,fiber:0.5,iron:0.3,calcium:10,vitc:1,vitd:5,salt:1.1,fa:{sat:.22,mufa:.32,n3:.32,n6:.08,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'ウイダーinゼリー（180g）',yomi:'ウイダー',tags:'ゼリー 補給 スポーツ エネルギー',en:'weider in jelly energy 180g',cal:180,p:0,f:0,c:45.0,per:180,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0.1},
  {name:'メダリスト（粉末1袋）',yomi:'メダリスト',tags:'スポーツ ドリンク 補給 クエン酸',en:'medalist sports drink powder',cal:75,p:0,f:0,c:18.5,per:20,fiber:0,iron:0,calcium:0,vitc:200,vitd:0,salt:0.3},
  {name:'バナナ（1本）',yomi:'バナナヒトホン',tags:'バナナ 果物 スポーツ エネルギー',en:'banana 1 piece',cal:86,p:1.1,f:0.2,c:22.5,per:100,fiber:1.1,iron:0.3,calcium:6,vitc:16,vitd:0,salt:0,aa:{leu:.07,ile:.04,val:.05,lys:.05,met:.01,thr:.04,trp:.01,his:.03,score:0.65}},
  {name:'おはぎ（あんこ・1個）',yomi:'オハギ',tags:'おはぎ ぼたもち 和菓子 もち米',en:'ohagi mochi rice red bean',cal:185,p:3.5,f:0.5,c:42.0,per:80,fiber:2.5,iron:0.8,calcium:20,vitc:0,vitd:0,salt:0,fa:{sat:.18,mufa:.28,n3:.04,n6:.35,trans:.00},aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59}},


  // ── 魚介（追加） ──
  {name:'かつお（生）',yomi:'カツオ',tags:'かつお 鰹 魚 刺身 DHA',en:'bonito skipjack raw',cal:114,p:25.8,f:0.5,c:0.1,per:100,fiber:0,iron:1.9,calcium:11,vitc:0,vitd:4,salt:0.1,fa:{sat:.22,mufa:.11,n3:.42,n6:.02,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:100},
  {name:'たら（生）',yomi:'タラ',tags:'たら 鱈 魚 低脂質 白身',en:'cod pollock raw',cal:72,p:17.6,f:0.2,c:0.1,per:100,fiber:0,iron:0.2,calcium:32,vitc:0,vitd:1,salt:0.3,fa:{sat:.28,mufa:.24,n3:.24,n6:.08,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:150},
  {name:'はまち（生）',yomi:'ハマチ',tags:'はまち 鰤 ブリ 刺身 DHA',en:'yellowtail amberjack raw',cal:257,p:21.4,f:17.6,c:0.3,per:100,fiber:0,iron:0.6,calcium:5,vitc:0,vitd:8,salt:0.1,fa:{sat:.24,mufa:.39,n3:.21,n6:.06,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:100},
  {name:'さわら（生）',yomi:'サワラ',tags:'さわら 鰆 魚 DHA',en:'Spanish mackerel raw',cal:177,p:20.1,f:9.7,c:0.1,per:100,fiber:0,iron:0.8,calcium:13,vitc:0,vitd:7,salt:0.1,fa:{sat:.25,mufa:.29,n3:.31,n6:.04,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:100},
  {name:'ししゃも（生）',yomi:'シシャモ',tags:'ししゃも 魚 カルシウム',en:'shishamo smelt capelin raw',cal:166,p:15.6,f:11.6,c:0.1,per:100,fiber:0,iron:1.3,calcium:350,vitc:0,vitd:6,salt:0.3,fa:{sat:.25,mufa:.27,n3:.31,n6:.05,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'うなぎ（蒲焼き）',yomi:'ウナギ',tags:'うなぎ 鰻 蒲焼 ビタミンA',en:'eel grilled kabayaki',cal:293,p:23.0,f:21.0,c:3.1,per:100,fiber:0,iron:0.8,calcium:150,vitc:0,vitd:18,salt:0.6,fa:{sat:.27,mufa:.47,n3:.13,n6:.08,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:100},
  {name:'たこ（ゆで）',yomi:'タコ',tags:'たこ 蛸 魚介 低カロリー',en:'octopus boiled',cal:99,p:21.7,f:0.7,c:0.1,per:100,fiber:0,iron:0.6,calcium:16,vitc:0,vitd:0,salt:0.7,fa:{sat:.31,mufa:.22,n3:.26,n6:.07,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:100},
  {name:'メカジキ（生）',yomi:'メカジキ',tags:'メカジキ 魚 DHA ステーキ',en:'swordfish raw',cal:153,p:19.2,f:8.0,c:0.1,per:100,fiber:0,iron:0.5,calcium:3,vitc:0,vitd:8,salt:0.1,fa:{sat:.28,mufa:.18,n3:.38,n6:.05,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'いくら（鮭卵）',yomi:'イクラ',tags:'いくら 鮭卵 魚卵 DHA',en:'salmon roe ikura',cal:272,p:32.6,f:15.6,c:0.2,per:100,fiber:0,iron:2.0,calcium:94,vitc:0,vitd:44,salt:2.3,fa:{sat:.22,mufa:.32,n3:.32,n6:.08,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:30},
  {name:'明太子（1腹）',yomi:'メンタイコ',tags:'明太子 たらこ 魚卵 辛子',en:'mentaiko spicy cod roe',cal:121,p:21.0,f:3.3,c:3.4,per:100,fiber:0,iron:0.5,calcium:24,vitc:0,vitd:0,salt:5.6,fa:{sat:.28,mufa:.24,n3:.24,n6:.08,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:50},
  {name:'たらこ（生）',yomi:'タラコ',tags:'たらこ 魚卵 スパゲッティ',en:'tarako cod roe raw',cal:140,p:24.0,f:4.7,c:0.4,per:100,fiber:0,iron:0.4,calcium:24,vitc:0,vitd:0,salt:4.6,fa:{sat:.28,mufa:.24,n3:.24,n6:.08,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:50},
  {name:'かき（生）',yomi:'カキ',tags:'かき 牡蠣 カキ 亜鉛 鉄',en:'oyster raw',cal:60,p:6.9,f:2.2,c:4.9,per:100,fiber:0,iron:2.1,calcium:84,vitc:4,vitd:0,salt:1.3,fa:{sat:.28,mufa:.24,n3:.24,n6:.08,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:100},

  // ── 肉類・加工品（追加） ──
  {name:'鴨肉（生）',yomi:'カモニク',tags:'鴨 カモ 肉 ジビエ',en:'duck meat raw',cal:333,p:14.2,f:29.0,c:0.1,per:100,fiber:0,iron:1.8,calcium:5,vitc:2,vitd:0.3,salt:0.1,fa:{sat:.38,mufa:.48,n3:.02,n6:.10,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:0.98},serving:150},
  {name:'サラミ（ドライ）',yomi:'サラミ',tags:'サラミ 加工肉 イタリアン',en:'salami dry sausage',cal:497,p:24.9,f:43.7,c:1.6,per:100,fiber:0,iron:2.1,calcium:14,vitc:0,vitd:0.3,salt:3.5,fa:{sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:0.98}},
  {name:'コンビーフ缶（100g）',yomi:'コンビーフ',tags:'コンビーフ 缶詰 牛肉',en:'canned corned beef',cal:203,p:19.8,f:13.0,c:1.5,per:100,fiber:0,iron:3.2,calcium:14,vitc:0,vitd:0.1,salt:1.8,fa:{sat:.47,mufa:.43,n3:.01,n6:.05,trans:.02},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'スパム（ランチョンミート缶）',yomi:'スパム',tags:'スパム ランチョンミート 缶詰 豚',en:'spam luncheon meat canned',cal:304,p:13.3,f:26.5,c:3.3,per:100,fiber:0,iron:1.1,calcium:8,vitc:0,vitd:0,salt:3.2,fa:{sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:0.98}},
  {name:'チョリソー',yomi:'チョリソー',tags:'チョリソー スペイン 豚 腸詰',en:'chorizo spanish sausage',cal:455,p:22.5,f:39.5,c:2.5,per:100,fiber:0,iron:2.5,calcium:20,vitc:0,vitd:0.3,salt:2.8,fa:{sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:0.98}},
  {name:'鶏レバー（生）',yomi:'トリレバー',tags:'レバー 鶏 内臓 鉄分 ビタミンA',en:'chicken liver raw',cal:111,p:18.9,f:3.1,c:0.6,per:100,fiber:0,iron:9.0,calcium:5,vitc:20,vitd:0.2,salt:0.2,fa:{sat:.31,mufa:.44,n3:.03,n6:.18,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08},serving:100},
  {name:'豚レバー（生）',yomi:'ブタレバー',tags:'レバー 豚 内臓 鉄分 ビタミンA',en:'pork liver raw',cal:128,p:20.4,f:3.4,c:2.5,per:100,fiber:0,iron:13.0,calcium:5,vitc:20,vitd:1.3,salt:0.1,fa:{sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:0.98},serving:100},
  {name:'牛タン（生）',yomi:'ギュウタン',tags:'牛タン 舌 焼肉 BBQ',en:'beef tongue raw',cal:356,p:15.2,f:31.8,c:0.2,per:100,fiber:0,iron:2.5,calcium:5,vitc:1,vitd:0.1,salt:0.1,fa:{sat:.47,mufa:.43,n3:.01,n6:.05,trans:.02},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:100},
  {name:'砂肝（鶏）',yomi:'スナギモ',tags:'砂肝 鶏 内臓 低カロリー',en:'chicken gizzard raw',cal:94,p:18.3,f:1.8,c:0.2,per:100,fiber:0,iron:2.5,calcium:9,vitc:3,vitd:0,salt:0.1,fa:{sat:.31,mufa:.44,n3:.03,n6:.18,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08},serving:100},

  // ── 穀物・米加工 ──
  {name:'もち（切り餅1個）',yomi:'モチ',tags:'餅 もち 正月 米',en:'mochi rice cake cut 1piece',cal:235,p:4.2,f:0.6,c:51.9,per:100,fiber:0.5,iron:0.2,calcium:4,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59},serving:100,fa:{sat:0.25,mufa:0.3,n3:0.04,n6:0.3,trans:0.01}},
  {name:'赤飯（おこわ）',yomi:'セキハン',tags:'赤飯 おこわ もち米 小豆',en:'sekihan red rice azuki bean',cal:189,p:5.0,f:0.5,c:41.5,per:150,fiber:1.8,iron:0.9,calcium:15,vitc:0,vitd:0,salt:0.5,aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59},fa:{sat:0.25,mufa:0.3,n3:0.04,n6:0.3,trans:0.01}},
  {name:'そばがき',yomi:'ソバガキ',tags:'そば粉 蕎麦 日本食',en:'sobagaki buckwheat paste',cal:140,p:4.6,f:1.2,c:28.3,per:100,fiber:1.8,iron:1.4,calcium:10,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59},fa:{sat:0.25,mufa:0.3,n3:0.04,n6:0.3,trans:0.01}},
  {name:'玄米おにぎり',yomi:'ゲンマイオニギリ',tags:'玄米 おにぎり 食物繊維',en:'brown rice onigiri',cal:170,p:3.2,f:1.1,c:36.5,per:105,fiber:1.5,iron:0.7,calcium:7,vitc:0,vitd:0,salt:0.5,aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59},fa:{sat:0.17,mufa:0.42,n3:0.01,n6:0.35,trans:0.01}},
  {name:'ライ麦パン（1枚）',yomi:'ライムギパン',tags:'ライ麦 パン 食物繊維 低GI',en:'rye bread slice',cal:127,p:4.8,f:1.0,c:26.5,per:55,fiber:4.0,iron:1.0,calcium:19,vitc:0,vitd:0,salt:0.5,aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},fa:{sat:.20,mufa:.30,n3:.05,n6:.35,trans:.00}},
  {name:'クラッカー（5枚）',yomi:'クラッカー',tags:'クラッカー お菓子 小麦',en:'crackers 5 pieces',cal:215,p:4.5,f:6.5,c:35.0,per:50,fiber:1.2,iron:0.5,calcium:10,vitc:0,vitd:0,salt:0.7,fa:{sat:.20,mufa:.30,n3:.05,n6:.35,trans:.00},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45}},
  {name:'プレッツェル（1袋）',yomi:'プレッツェル',tags:'プレッツェル お菓子 塩',en:'pretzels bag',cal:381,p:9.8,f:3.5,c:79.0,per:100,fiber:2.5,iron:2.5,calcium:40,vitc:0,vitd:0,salt:2.5,aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},fa:{sat:.20,mufa:.30,n3:.05,n6:.35,trans:.00}},
  {name:'米せんべい（5枚）',yomi:'コメセンベイ',tags:'せんべい 米 お菓子 和菓子',en:'rice cracker senbei 5pcs',cal:180,p:3.0,f:0.5,c:40.0,per:45,fiber:0.5,iron:0.3,calcium:5,vitc:0,vitd:0,salt:0.8,aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59},fa:{sat:0.25,mufa:0.3,n3:0.04,n6:0.3,trans:0.01}},
  {name:'ポン菓子（一袋）',yomi:'ポンガシ',tags:'ポン菓子 お菓子 米 懐かし',en:'puffed rice snack',cal:390,p:7.0,f:1.0,c:87.0,per:100,fiber:1.2,iron:0.4,calcium:8,vitc:0,vitd:0,salt:0.3,aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59},fa:{sat:0.25,mufa:0.3,n3:0.04,n6:0.3,trans:0.01}},
  {name:'パン粉（大さじ2）',yomi:'パンコ',tags:'パン粉 揚げ物 衣',en:'panko bread crumbs 2 tablespoons',cal:60,p:2.2,f:0.7,c:11.8,per:16,fiber:0.4,iron:0.1,calcium:5,vitc:0,vitd:0,salt:0.2,fa:{sat:.20,mufa:.30,n3:.05,n6:.35,trans:.00},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45}},

  // ── 乳製品追加 ──
  {name:'生クリーム（動物性・大さじ1）',yomi:'ナマクリーム',tags:'生クリーム 乳製品 洋菓子',en:'heavy cream whipping tablespoon',cal:63,p:0.4,f:6.8,c:0.5,per:15,fiber:0,iron:0,calcium:14,vitc:0,vitd:0.2,salt:0,fa:{sat:.62,mufa:.28,n3:.01,n6:.02,trans:.03},serving:15},
  {name:'ホイップクリーム（植物性）',yomi:'ホイップクリーム',tags:'ホイップ 植物性 クリーム ケーキ',en:'whipped cream vegetable oil',cal:392,p:1.5,f:41.8,c:4.7,per:100,fiber:0,iron:0,calcium:35,vitc:0,vitd:0,salt:0.1,fa:{sat:.22,mufa:.44,n3:.06,n6:.24,trans:.04},aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22}},
  {name:'練乳（コンデンスミルク・大さじ1）',yomi:'レンニュウ',tags:'練乳 コンデンスミルク 甘い',en:'condensed milk sweetened tablespoon',cal:65,p:1.5,f:1.5,c:11.2,per:19,fiber:0,iron:0,calcium:57,vitc:0.5,vitd:0,salt:0,aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22},fa:{sat:.63,mufa:.27,n3:.01,n6:.03,trans:.04}},
  {name:'発酵バター（大さじ1）',yomi:'ハッコウバター',tags:'バター 発酵 乳製品 フランス',en:'cultured butter tablespoon',cal:89,p:0.1,f:9.7,c:0.1,per:12,fiber:0,iron:0,calcium:3,vitc:0,vitd:0.1,salt:0.2,fa:{sat:.63,mufa:.27,n3:.01,n6:.03,trans:.04}},
  {name:'サワークリーム（大さじ2）',yomi:'サワークリーム',tags:'サワークリーム 乳製品 ディップ',en:'sour cream 2 tablespoons',cal:48,p:0.7,f:4.6,c:1.2,per:28,fiber:0,iron:0,calcium:34,vitc:0.2,vitd:0.1,salt:0,fa:{sat:.62,mufa:.28,n3:.01,n6:.02,trans:.03}},
  {name:'バターミルク（200ml）',yomi:'バターミルク',tags:'バターミルク 乳製品 低脂肪',en:'buttermilk 200ml',cal:78,p:6.6,f:1.6,c:9.6,per:200,fiber:0,iron:0.1,calcium:254,vitc:2,vitd:0.2,salt:0.4,aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22},fa:{sat:.63,mufa:.27,n3:.01,n6:.03,trans:.04}},

  // ── 和菓子追加 ──
  {name:'桜もち（関東風）',yomi:'サクラモチ',tags:'和菓子 桜餅 春 もち',en:'sakuramochi cherry rice cake',cal:176,p:2.8,f:0.3,c:41.0,per:75,fiber:1.3,iron:0.4,calcium:14,vitc:0,vitd:0,salt:0.1,aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59}},
  {name:'柏もち',yomi:'カシワモチ',tags:'和菓子 柏餅 端午 こどもの日',en:'kashiwa mochi oak leaf rice cake',cal:185,p:2.9,f:0.4,c:43.5,per:80,fiber:1.5,iron:0.5,calcium:12,vitc:0,vitd:0,salt:0.1,aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59}},
  {name:'くず餅',yomi:'クズモチ',tags:'和菓子 くず餅 葛 夏',en:'kuzumochi arrowroot starch cake',cal:137,p:0.2,f:0.1,c:34.0,per:100,fiber:0.5,iron:0.2,calcium:3,vitc:0,vitd:0,salt:0},
  {name:'水まんじゅう',yomi:'ミズマンジュウ',tags:'和菓子 水まんじゅう 夏 あんこ',en:'mizu manju water chestnut cake',cal:87,p:1.5,f:0.1,c:21.0,per:60,fiber:0.8,iron:0.3,calcium:8,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59}},
  {name:'わらび餅（1人前）',yomi:'ワラビモチ',tags:'和菓子 わらび餅 きな粉',en:'warabi mochi bracken starch jelly',cal:155,p:1.5,f:1.5,c:35.0,per:100,fiber:0.5,iron:0.3,calcium:12,vitc:0,vitd:0,salt:0.1,aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59},fa:{sat:0.25,mufa:0.3,n3:0.04,n6:0.3,trans:0.01}},
  {name:'ういろう',yomi:'ウイロウ',tags:'和菓子 ういろう 名古屋 米粉',en:'uiro steamed rice cake',cal:211,p:2.5,f:0.5,c:49.5,per:100,fiber:0.5,iron:0.2,calcium:5,vitc:0,vitd:0,salt:0.1,aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59},fa:{sat:0.25,mufa:0.3,n3:0.04,n6:0.3,trans:0.01}},
  {name:'練り切り（1個）',yomi:'ネリキリ',tags:'和菓子 練り切り 上生菓子 あんこ',en:'nerikiri sweet bean paste art',cal:115,p:2.2,f:0.3,c:27.0,per:45,fiber:1.2,iron:0.4,calcium:10,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59}},
  {name:'最中（もなか）',yomi:'モナカ',tags:'和菓子 最中 もなか あんこ',en:'monaka wafer red bean',cal:208,p:3.5,f:0.5,c:49.5,per:80,fiber:2.0,iron:0.6,calcium:15,vitc:0,vitd:0,salt:0.1,aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59},fa:{sat:0.25,mufa:0.3,n3:0.04,n6:0.3,trans:0.01}},

  // ── 洋菓子追加 ──
  {name:'エクレア（1個）',yomi:'エクレア',tags:'洋菓子 エクレア シュークリーム チョコ',en:'eclair chocolate cream puff',cal:270,p:5.5,f:14.5,c:31.5,per:100,fiber:0.5,iron:0.5,calcium:55,vitc:0,vitd:0.3,salt:0.3,fa:{sat:.63,mufa:.27,n3:.01,n6:.03,trans:.03},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'シュークリーム（1個）',yomi:'シュークリーム',tags:'洋菓子 シュークリーム カスタード',en:'cream puff custard',cal:228,p:5.0,f:12.0,c:26.5,per:90,fiber:0.3,iron:0.4,calcium:60,vitc:0,vitd:0.4,salt:0.2,fa:{sat:.63,mufa:.27,n3:.01,n6:.03,trans:.03},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'ワッフル（1枚）',yomi:'ワッフル',tags:'洋菓子 ワッフル ベルギー',en:'waffle Belgian',cal:290,p:7.0,f:12.0,c:40.0,per:110,fiber:1.0,iron:1.2,calcium:60,vitc:0,vitd:0.3,salt:0.5,fa:{sat:.63,mufa:.27,n3:.01,n6:.03,trans:.03},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'カヌレ（1個）',yomi:'カヌレ',tags:'洋菓子 カヌレ フランス ボルドー',en:'canele bordeaux french cake',cal:245,p:5.0,f:7.0,c:41.0,per:80,fiber:0.3,iron:0.5,calcium:55,vitc:0,vitd:0.5,salt:0.2,fa:{sat:.63,mufa:.27,n3:.01,n6:.03,trans:.04},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'フィナンシェ（1個）',yomi:'フィナンシェ',tags:'洋菓子 フィナンシェ バター アーモンド',en:'financier french butter cake',cal:165,p:4.0,f:9.5,c:17.5,per:45,fiber:0.5,iron:0.5,calcium:25,vitc:0,vitd:0.2,salt:0.1,fa:{sat:.63,mufa:.27,n3:.01,n6:.03,trans:.03},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'マドレーヌ（1個）',yomi:'マドレーヌ',tags:'洋菓子 マドレーヌ バター フランス',en:'madeleine french butter cake',cal:155,p:3.0,f:7.5,c:19.5,per:45,fiber:0.4,iron:0.4,calcium:22,vitc:0,vitd:0.2,salt:0.1,fa:{sat:.63,mufa:.27,n3:.01,n6:.03,trans:.03},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'バウムクーヘン（1切れ）',yomi:'バウムクーヘン',tags:'洋菓子 バウムクーヘン ドイツ',en:'baumkuchen german ring cake',cal:340,p:7.0,f:14.0,c:48.0,per:100,fiber:0.8,iron:0.8,calcium:50,vitc:0,vitd:0.4,salt:0.3,fa:{sat:.63,mufa:.27,n3:.01,n6:.03,trans:.03},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45}},
  {name:'パンナコッタ（1人前）',yomi:'パンナコッタ',tags:'洋菓子 パンナコッタ イタリアン ゼリー',en:'panna cotta italian dessert',cal:215,p:4.0,f:14.0,c:18.5,per:120,fiber:0,iron:0,calcium:120,vitc:0,vitd:0.3,salt:0.1,fa:{sat:.62,mufa:.28,n3:.01,n6:.02,trans:.03},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},

  // ── パン追加 ──
  {name:'メロンパン（1個）',yomi:'メロンパン',tags:'パン 菓子パン メロンパン',en:'melon pan sweet bread',cal:350,p:7.5,f:9.0,c:59.5,per:110,fiber:1.5,iron:0.7,calcium:25,vitc:0,vitd:0,salt:0.7,fa:{sat:.63,mufa:.27,n3:.01,n6:.03,trans:.03},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45}},
  {name:'アンパン（1個）',yomi:'アンパン',tags:'パン 菓子パン あんこ',en:'anpan sweet red bean bun',cal:295,p:7.0,f:5.5,c:55.0,per:105,fiber:2.5,iron:1.0,calcium:20,vitc:0,vitd:0,salt:0.5,aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},fa:{sat:.20,mufa:.30,n3:.05,n6:.35,trans:.00}},
  {name:'カレーパン（1個）',yomi:'カレーパン',tags:'パン 揚げパン カレー',en:'curry pan deep fried curry bread',cal:310,p:8.0,f:12.5,c:42.5,per:110,fiber:2.0,iron:1.0,calcium:30,vitc:1,vitd:0,salt:1.0,fa:{sat:.20,mufa:.32,n3:.05,n6:.38,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45}},
  {name:'ピタパン（1枚）',yomi:'ピタパン',tags:'ピタ パン 中東 低脂肪',en:'pita bread flatbread',cal:270,p:9.0,f:1.5,c:56.0,per:110,fiber:2.0,iron:1.5,calcium:55,vitc:0,vitd:0,salt:0.6,aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},fa:{sat:.20,mufa:.30,n3:.05,n6:.35,trans:.00}},
  {name:'フォカッチャ（1切れ）',yomi:'フォカッチャ',tags:'フォカッチャ パン イタリアン オリーブ',en:'focaccia italian olive bread',cal:280,p:7.5,f:7.5,c:45.0,per:110,fiber:2.0,iron:1.0,calcium:20,vitc:0,vitd:0,salt:0.8,fa:{sat:.14,mufa:.74,n3:.01,n6:.10,trans:.00},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45}},
  {name:'イングリッシュマフィン（1個）',yomi:'イングリッシュマフィン',tags:'マフィン パン 朝食 低脂質',en:'english muffin',cal:220,p:8.5,f:2.0,c:43.5,per:90,fiber:2.0,iron:1.5,calcium:60,vitc:0,vitd:0,salt:0.6,aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},fa:{sat:.20,mufa:.30,n3:.05,n6:.35,trans:.00}},
  {name:'チャパティ（1枚）',yomi:'チャパティ',tags:'チャパティ インド パン 全粒粉',en:'chapati indian whole wheat flatbread',cal:200,p:6.5,f:2.5,c:38.5,per:80,fiber:3.5,iron:1.8,calcium:30,vitc:0,vitd:0,salt:0.3,aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},fa:{sat:.20,mufa:.30,n3:.05,n6:.35,trans:.00}},

  // ── 世界の料理 ──
  {name:'タコス（2個）',yomi:'タコス',tags:'タコス メキシコ トルティーヤ',en:'tacos mexican 2pcs',cal:420,p:18.0,f:18.0,c:48.0,per:280,fiber:4.5,iron:3.0,calcium:120,vitc:15,vitd:0.2,salt:2.5,fa:{sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'ブリトー（1本）',yomi:'ブリトー',tags:'ブリトー メキシコ トルティーヤ 巻き',en:'burrito mexican wrap',cal:520,p:22.0,f:18.0,c:66.0,per:330,fiber:6.0,iron:3.5,calcium:130,vitc:10,vitd:0.2,salt:2.8,fa:{sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'ガパオライス（1人前）',yomi:'ガパオライス',tags:'ガパオ タイ バジル 鶏 ライス',en:'gapao rice thai basil chicken',cal:580,p:24.0,f:16.0,c:80.0,per:400,fiber:3.0,iron:2.5,calcium:55,vitc:15,vitd:0.3,salt:3.0,fa:{sat:.31,mufa:.44,n3:.03,n6:.18,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08}},
  {name:'シャクシュカ（1人前）',yomi:'シャクシュカ',tags:'シャクシュカ 中東 イスラエル 卵 トマト',en:'shakshuka eggs in tomato sauce',cal:250,p:14.5,f:12.5,c:20.0,per:300,fiber:4.5,iron:2.5,calcium:90,vitc:35,vitd:1.5,salt:2.0,fa:{sat:.30,mufa:.42,n3:.03,n6:.19,trans:.01},aa:{leu:.09,ile:.06,val:.07,lys:.09,met:.03,thr:.06,trp:.02,his:.03,score:1.13}},
  {name:'ファラフェル（4個）',yomi:'ファラフェル',tags:'ファラフェル 中東 ひよこ豆 揚げ物',en:'falafel fried chickpea balls 4pcs',cal:280,p:9.5,f:15.0,c:29.5,per:140,fiber:5.5,iron:2.5,calcium:60,vitc:3,vitd:0,salt:1.0,fa:{sat:.20,mufa:.32,n3:.05,n6:.38,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.72}},
  {name:'ムサカ（1人前）',yomi:'ムサカ',tags:'ムサカ ギリシャ なす ひき肉 グラタン',en:'moussaka greek eggplant beef casserole',cal:410,p:20.0,f:24.0,c:28.0,per:300,fiber:4.5,iron:3.0,calcium:180,vitc:12,vitd:0.4,salt:2.5,fa:{sat:.47,mufa:.43,n3:.01,n6:.05,trans:.02},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'パエリア（1人前）',yomi:'パエリア',tags:'パエリア スペイン 米 シーフード',en:'paella spanish rice seafood',cal:540,p:24.0,f:14.0,c:77.0,per:400,fiber:3.0,iron:3.0,calcium:65,vitc:15,vitd:2.0,salt:3.0,fa:{sat:.28,mufa:.24,n3:.24,n6:.08,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'モロッカンクスクス（1人前）',yomi:'クスクス',tags:'クスクス モロッコ 北アフリカ 小麦',en:'moroccan couscous',cal:420,p:16.0,f:10.0,c:63.0,per:300,fiber:5.0,iron:2.5,calcium:50,vitc:20,vitd:0.1,salt:1.8,aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},fa:{sat:.20,mufa:.30,n3:.05,n6:.35,trans:.00}},

  // ── 飲み物追加 ──
  {name:'チャイ（ミルクティー・200ml）',yomi:'チャイ',tags:'チャイ インド ミルクティー スパイス',en:'masala chai milk tea 200ml',cal:120,p:4.5,f:4.0,c:16.5,per:200,fiber:0,iron:0.2,calcium:150,vitc:0,vitd:0.5,salt:0.1,aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22},fa:{sat:.62,mufa:.28,n3:.01,n6:.02,trans:.03}},
  {name:'ルイボスティー（200ml）',yomi:'ルイボスティー',tags:'ルイボス 南アフリカ ハーブティー カフェインなし',en:'rooibos herbal tea 200ml',cal:2,p:0,f:0,c:0.4,per:200,fiber:0,iron:0.1,calcium:2,vitc:0,vitd:0,salt:0},
  {name:'カモミールティー（200ml）',yomi:'カモミールティー',tags:'カモミール ハーブティー リラックス',en:'chamomile herbal tea 200ml',cal:2,p:0,f:0,c:0.5,per:200,fiber:0,iron:0.2,calcium:5,vitc:0,vitd:0,salt:0},
  {name:'コンブチャ（200ml）',yomi:'コンブチャ',tags:'コンブチャ 発酵 腸活 プロバイオティクス',en:'kombucha fermented tea 200ml',cal:30,p:0,f:0,c:7.5,per:200,fiber:0,iron:0.1,calcium:5,vitc:0,vitd:0,salt:0},
  {name:'ケフィア（200ml）',yomi:'ケフィア',tags:'ケフィア 発酵乳 プロバイオティクス',en:'kefir fermented milk 200ml',cal:116,p:7.8,f:4.4,c:10.4,per:200,fiber:0,iron:0.1,calcium:260,vitc:2,vitd:0.2,salt:0.2,aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22},fa:{sat:.62,mufa:.28,n3:.01,n6:.02,trans:.03}},
  {name:'抹茶ラテ（200ml）',yomi:'マッチャラテ',tags:'抹茶 ラテ 緑茶 ミルク',en:'matcha latte 200ml',cal:110,p:5.5,f:4.5,c:12.5,per:200,fiber:0.5,iron:0.5,calcium:180,vitc:2,vitd:0.5,salt:0.1,aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22},fa:{sat:.62,mufa:.28,n3:.01,n6:.02,trans:.03}},
  {name:'ビートルートジュース（200ml）',yomi:'ビートルート',tags:'ビーツ 根菜 鉄分 硝酸塩',en:'beetroot juice 200ml',cal:76,p:2.4,f:0.2,c:17.0,per:200,fiber:1.6,iron:1.6,calcium:36,vitc:10,vitd:0,salt:0.2,aa:{leu:0.08,ile:0.05,val:0.05,lys:0.06,met:0.02,thr:0.04,trp:0.01,his:0.03,score:0.75}},
  {name:'生姜湯（ジンジャーティー・200ml）',yomi:'ショウガユ',tags:'生姜 しょうが 飲み物 温活',en:'ginger tea 200ml',cal:30,p:0,f:0,c:7.5,per:200,fiber:0,iron:0.1,calcium:3,vitc:1,vitd:0,salt:0},
  {name:'甘酒（米麹・無加糖200ml）',yomi:'アマザケコメコウジ',tags:'甘酒 米麹 発酵 腸活 ノンアルコール',en:'amazake rice koji sweet sake 200ml',cal:124,p:2.2,f:0.2,c:28.4,per:200,fiber:0,iron:0.2,calcium:6,vitc:0,vitd:0,salt:0,aa:{leu:0.08,ile:0.04,val:0.05,lys:0.04,met:0.02,thr:0.04,trp:0.01,his:0.02,score:0.59}},
  {name:'ホットチョコレート（200ml）',yomi:'ホットチョコレート',tags:'ホットチョコ ミルク カカオ',en:'hot chocolate cocoa milk 200ml',cal:185,p:6.5,f:7.5,c:24.0,per:200,fiber:1.5,iron:1.0,calcium:220,vitc:0,vitd:1.0,salt:0.2,fa:{sat:.62,mufa:.28,n3:.01,n6:.02,trans:.03},aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22}},


  // ── 冷凍食品（拡充） ──
  {name:'冷凍えびフライ（3本）',yomi:'レイトウエビフライ',tags:'えびフライ 冷凍 揚げ物 えび',en:'frozen fried shrimp 3pcs',cal:225,p:10.5,f:11.0,c:21.5,per:135,fiber:0.8,iron:0.5,calcium:50,vitc:0,vitd:0,salt:1.2,serving:135,fa:{sat:.30,mufa:.18,n3:.28,n6:.10,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'冷凍コロッケ（1個）',yomi:'レイトウコロッケ',tags:'コロッケ 冷凍 揚げ物 じゃがいも',en:'frozen potato croquette',cal:190,p:4.5,f:10.5,c:21.0,per:100,fiber:1.5,iron:0.5,calcium:20,vitc:10,vitd:0,salt:0.8,serving:100,fa:{sat:.20,mufa:.32,n3:.05,n6:.38,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'冷凍グラタン（1個）',yomi:'レイトウグラタン',tags:'グラタン 冷凍 チーズ マカロニ',en:'frozen gratin macaroni cheese',cal:230,p:9.0,f:10.5,c:25.5,per:160,fiber:1.5,iron:0.8,calcium:180,vitc:3,vitd:0.3,salt:1.8,serving:160,fa:{sat:.62,mufa:.28,n3:.01,n6:.02,trans:.03},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'冷凍ポテトフライ（1人前）',yomi:'レイトウポテトフライ',tags:'ポテトフライ 冷凍 じゃがいも',en:'frozen french fries 1 serving',cal:275,p:3.5,f:13.0,c:36.5,per:130,fiber:2.5,iron:0.5,calcium:10,vitc:18,vitd:0,salt:0.8,serving:130,fa:{sat:.20,mufa:.32,n3:.05,n6:.38,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'冷凍枝豆（100g）',yomi:'レイトウエダマメ',tags:'枝豆 冷凍 大豆 ビール',en:'frozen edamame 100g',cal:135,p:11.5,f:6.2,c:8.8,per:100,fiber:4.6,iron:2.5,calcium:76,vitc:15,vitd:0,salt:0,serving:100,fa:{sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00},aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.91}},
  {name:'冷凍ほうれん草（100g）',yomi:'レイトウホウレンソウ',tags:'ほうれん草 冷凍 野菜 鉄分',en:'frozen spinach 100g',cal:22,p:2.6,f:0.5,c:2.8,per:100,fiber:3.0,iron:1.8,calcium:55,vitc:20,vitd:0,salt:0.1,aa:{leu:0.08,ile:0.05,val:0.05,lys:0.06,met:0.02,thr:0.04,trp:0.01,his:0.03,score:0.75},fa:{sat:0.15,mufa:0.05,n3:0.55,n6:0.2,trans:0}},
  {name:'冷凍から揚げ（市販・3個）',yomi:'レイトウカラアゲ3コ',tags:'から揚げ 冷凍 鶏 電子レンジ',en:'frozen karaage fried chicken 3pcs',cal:255,p:15.0,f:15.5,c:13.5,per:130,fiber:0.3,iron:0.5,calcium:12,vitc:0,vitd:0.1,salt:1.5,serving:130,fa:{sat:.31,mufa:.44,n3:.03,n6:.18,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08}},
  {name:'冷凍炒飯（市販・1人前）',yomi:'レイトウチャーハン',tags:'炒飯 冷凍 ご飯 中華',en:'frozen fried rice 1 serving',cal:495,p:10.5,f:11.5,c:86.0,per:300,fiber:1.5,iron:0.8,calcium:20,vitc:2,vitd:0,salt:2.2,serving:300,fa:{sat:.20,mufa:.32,n3:.05,n6:.38,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'冷凍たこ焼き（6個）',yomi:'レイトウタコヤキ',tags:'たこ焼き 冷凍 大阪 たこ',en:'frozen takoyaki 6pcs',cal:285,p:9.0,f:11.5,c:37.5,per:168,fiber:1.0,iron:0.6,calcium:45,vitc:0,vitd:0.3,salt:2.0,serving:168,fa:{sat:.28,mufa:.24,n3:.24,n6:.08,trans:.00},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'冷凍パスタ ナポリタン（1食）',yomi:'レイトウパスタ',tags:'パスタ ナポリタン 冷凍',en:'frozen pasta napolitan',cal:450,p:13.0,f:12.0,c:71.0,per:280,fiber:3.5,iron:1.5,calcium:40,vitc:15,vitd:0,salt:3.0,serving:280,fa:{sat:.20,mufa:.30,n3:.05,n6:.35,trans:.00},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},

  // ── 缶詰（追加） ──
  {name:'さば味噌煮缶',yomi:'サバミソニカン',tags:'さば缶 味噌煮 缶詰 魚 EPA DHA',en:'canned mackerel miso braised',cal:200,p:16.3,f:13.9,c:6.6,per:100,fiber:0.5,iron:1.5,calcium:200,vitc:0,vitd:11,salt:1.5,fa:{sat:.25,mufa:.29,n3:.31,n6:.04,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'やきとり缶（タレ）',yomi:'ヤキトリカンタレ',tags:'焼き鳥缶 缶詰 鶏 タレ',en:'canned yakitori chicken teriyaki sauce',cal:177,p:17.5,f:8.5,c:6.5,per:100,fiber:0,iron:0.8,calcium:10,vitc:0,vitd:0.2,salt:1.5,fa:{sat:.31,mufa:.44,n3:.03,n6:.18,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08}},
  {name:'パイン缶（スライス）',yomi:'パインカン',tags:'パイン パイナップル 缶詰 フルーツ',en:'canned pineapple slices',cal:76,p:0.4,f:0.1,c:19.2,per:100,fiber:0.5,iron:0.2,calcium:10,vitc:10,vitd:0,salt:0},
  {name:'みかん缶（シロップ漬け）',yomi:'ミカンカン',tags:'みかん 缶詰 フルーツ シロップ',en:'canned mandarin orange syrup',cal:64,p:0.5,f:0.1,c:16.0,per:100,fiber:0.5,iron:0.2,calcium:14,vitc:15,vitd:0,salt:0},
  {name:'もも缶（黄桃シロップ）',yomi:'モモカン',tags:'もも 桃 缶詰 フルーツ',en:'canned peach yellow syrup',cal:76,p:0.5,f:0.1,c:19.2,per:100,fiber:0.8,iron:0.2,calcium:4,vitc:3,vitd:0,salt:0},
  {name:'コーン缶（ホールカーネル）',yomi:'コーンカンホール',tags:'コーン とうもろこし 缶詰',en:'canned corn whole kernel',cal:82,p:2.3,f:0.8,c:16.5,per:100,fiber:2.2,iron:0.4,calcium:3,vitc:6,vitd:0,salt:0.3,aa:{leu:0.07,ile:0.04,val:0.04,lys:0.02,met:0.02,thr:0.03,trp:0.01,his:0.02,score:0.45},fa:{sat:0.15,mufa:0.28,n3:0.01,n6:0.55,trans:0}},
  {name:'トマトジュース缶（190ml）',yomi:'トマトジュースカン',tags:'トマト ジュース 缶 リコピン',en:'tomato juice canned 190ml',cal:34,p:1.5,f:0,c:7.5,per:190,fiber:1.0,iron:0.4,calcium:16,vitc:18,vitd:0,salt:0.6,aa:{leu:0.08,ile:0.05,val:0.05,lys:0.06,met:0.02,thr:0.04,trp:0.01,his:0.03,score:0.75}},

  // ── 丼もの追加 ──
  {name:'鉄火丼（外食）',yomi:'テッカドン',tags:'どんぶり まぐろ 寿司 鉄火',en:'tekkadon tuna rice bowl',cal:490,p:26.0,f:3.5,c:92.0,per:380,fiber:1.5,iron:2.5,calcium:25,vitc:0,vitd:2,salt:2.5,serving:380,fa:{sat:.28,mufa:.18,n3:.38,n6:.05,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'ネギトロ丼',yomi:'ネギトロドン',tags:'どんぶり まぐろ ねぎとろ',en:'negitoro don tuna rice bowl',cal:520,p:22.0,f:12.5,c:78.0,per:390,fiber:1.5,iron:2.0,calcium:25,vitc:2,vitd:3,salt:2.0,serving:390,fa:{sat:.28,mufa:.18,n3:.38,n6:.05,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'月見丼（卵のせご飯）',yomi:'ツキミドン',tags:'どんぶり 卵 温泉卵 つきみ',en:'tsukimi don egg rice bowl',cal:480,p:15.5,f:9.5,c:84.0,per:380,fiber:1.0,iron:1.2,calcium:40,vitc:0,vitd:1.5,salt:2.2,serving:380,aa:{leu:.09,ile:.06,val:.07,lys:.09,met:.03,thr:.06,trp:.02,his:.03,score:1.13},fa:{sat:.30,mufa:.42,n3:.03,n6:.19,trans:.01}},
  {name:'そぼろ丼（三色丼）',yomi:'ソボロドン',tags:'どんぶり そぼろ 鶏 卵',en:'soboro don three color rice bowl',cal:610,p:25.0,f:14.5,c:93.0,per:430,fiber:2.0,iron:2.5,calcium:55,vitc:5,vitd:1.0,salt:3.5,serving:430,fa:{sat:.31,mufa:.44,n3:.03,n6:.18,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08}},
  {name:'いくら丼',yomi:'イクラドン',tags:'どんぶり いくら 鮭卵',en:'ikura don salmon roe rice bowl',cal:495,p:24.5,f:7.5,c:85.0,per:370,fiber:0.5,iron:2.5,calcium:80,vitc:0,vitd:25,salt:3.5,serving:370,fa:{sat:.22,mufa:.32,n3:.32,n6:.08,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'うな重（1人前）',yomi:'ウナジュウ',tags:'うなぎ 蒲焼 重箱 ご飯',en:'unaju grilled eel rice box',cal:720,p:27.0,f:22.0,c:100.0,per:430,fiber:0.5,iron:1.5,calcium:140,vitc:0,vitd:18,salt:2.5,serving:430,fa:{sat:.27,mufa:.47,n3:.13,n6:.08,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},

  // ── 定食・家庭料理 ──
  {name:'豚の生姜焼き（1人前）',yomi:'ブタノショウガヤキ',tags:'生姜焼き 豚 定食 しょうが',en:'pork ginger stir fry teishoku',cal:380,p:22.0,f:18.5,c:26.0,per:220,fiber:1.5,iron:1.5,calcium:25,vitc:5,vitd:0.2,salt:2.5,serving:220,fa:{sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:0.98}},
  {name:'鶏の照り焼き（1人前）',yomi:'トリノテリヤキ',tags:'照り焼き 鶏 定食 テリヤキ',en:'chicken teriyaki teishoku',cal:340,p:24.0,f:14.5,c:24.5,per:200,fiber:0.5,iron:0.8,calcium:15,vitc:2,vitd:0.3,salt:2.2,serving:200,fa:{sat:.31,mufa:.44,n3:.03,n6:.18,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08}},
  {name:'さばの塩焼き（1切れ）',yomi:'サバノシオヤキ',tags:'さば 塩焼き 焼き魚 定食',en:'grilled mackerel salt',cal:210,p:22.0,f:13.5,c:0.1,per:130,fiber:0,iron:1.5,calcium:18,vitc:0,vitd:7,salt:0.8,serving:130,fa:{sat:.25,mufa:.29,n3:.31,n6:.04,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'あじの塩焼き（1尾）',yomi:'アジノシオヤキ',tags:'あじ 鯵 塩焼き 焼き魚',en:'grilled horse mackerel salt',cal:165,p:21.0,f:7.5,c:0.1,per:130,fiber:0,iron:1.2,calcium:65,vitc:0,vitd:8,salt:0.8,serving:130,fa:{sat:.27,mufa:.31,n3:.25,n6:.07,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'冷しゃぶ（1人前）',yomi:'ヒヤシャブ',tags:'しゃぶしゃぶ 豚 冷しゃぶ さっぱり',en:'cold shabu shabu pork slices',cal:320,p:20.0,f:14.0,c:26.0,per:250,fiber:2.0,iron:1.5,calcium:35,vitc:8,vitd:0.2,salt:1.5,serving:250,fa:{sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:0.98}},
  {name:'すき焼き（1人前）',yomi:'スキヤキ',tags:'すき焼き 牛 鍋 卵',en:'sukiyaki beef hot pot',cal:580,p:28.0,f:26.0,c:54.0,per:400,fiber:3.0,iron:3.5,calcium:80,vitc:8,vitd:1.5,salt:3.5,serving:400,fa:{sat:.47,mufa:.43,n3:.01,n6:.05,trans:.02},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'水炊き鍋（1人前）',yomi:'ミズタキナベ',tags:'水炊き 鍋 鶏 ポン酢',en:'mizutaki chicken hot pot',cal:380,p:28.0,f:14.0,c:32.0,per:380,fiber:3.0,iron:1.5,calcium:60,vitc:10,vitd:0.5,salt:2.0,serving:380,fa:{sat:.28,mufa:.40,n3:.02,n6:.22,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08}},
  {name:'ちゃんこ鍋（1人前）',yomi:'チャンコナベ',tags:'ちゃんこ 鍋 相撲 高タンパク',en:'chanko nabe sumo hot pot',cal:520,p:38.0,f:16.0,c:52.0,per:500,fiber:4.5,iron:3.5,calcium:120,vitc:15,vitd:2.0,salt:4.0,serving:500,fa:{sat:.31,mufa:.44,n3:.03,n6:.18,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08}},
  {name:'おでん（1人前・盛り合わせ）',yomi:'オデン',tags:'おでん 鍋 冬 練り物 大根',en:'oden japanese stew assorted',cal:310,p:16.5,f:8.5,c:38.0,per:400,fiber:3.5,iron:1.5,calcium:120,vitc:5,vitd:0.5,salt:4.5,serving:400,aa:{leu:0.09,ile:0.05,val:0.05,lys:0.1,met:0.03,thr:0.05,trp:0.01,his:0.03,score:1},fa:{sat:0.28,mufa:0.24,n3:0.24,n6:0.08,trans:0}},
  {name:'けんちん汁（1人前）',yomi:'ケンチンジル',tags:'けんちん汁 汁物 根菜 豆腐 精進',en:'kenchinjiru tofu vegetable soup',cal:110,p:5.5,f:3.5,c:14.5,per:300,fiber:3.5,iron:1.5,calcium:75,vitc:8,vitd:0,salt:2.0,serving:300,aa:{leu:0.08,ile:0.05,val:0.05,lys:0.07,met:0.01,thr:0.04,trp:0.01,his:0.03,score:0.91},fa:{sat:0.14,mufa:0.24,n3:0.07,n6:0.52,trans:0}},

  // ── 麺類追加 ──
  {name:'冷やし中華（1人前）',yomi:'ヒヤシチュウカ',tags:'冷やし中華 麺 夏 中華',en:'hiyashi chuka cold ramen noodles',cal:520,p:18.0,f:10.0,c:88.0,per:450,fiber:3.0,iron:2.0,calcium:50,vitc:10,vitd:0.5,salt:4.5,serving:450,fa:{sat:.28,mufa:.42,n3:.03,n6:.19,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45}},
  {name:'きつねうどん（外食）',yomi:'キツネウドン',tags:'うどん きつね 揚げ 外食',en:'kitsune udon aburaage tofu noodles',cal:445,p:15.0,f:8.5,c:78.0,per:500,fiber:3.0,iron:1.5,calcium:120,vitc:0,vitd:0,salt:5.5,serving:500,fa:{sat:.30,mufa:.35,n3:.04,n6:.26,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45}},
  {name:'天ぷらうどん（外食）',yomi:'テンプラウドン',tags:'うどん 天ぷら えび 外食',en:'tempura udon shrimp noodles',cal:540,p:18.5,f:11.5,c:90.0,per:550,fiber:3.5,iron:1.5,calcium:95,vitc:3,vitd:0.5,salt:5.8,serving:550,fa:{sat:.20,mufa:.32,n3:.05,n6:.38,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45}},
  {name:'月見うどん（外食）',yomi:'ツキミウドン',tags:'うどん 月見 卵 外食',en:'tsukimi udon egg noodles',cal:415,p:15.5,f:6.5,c:74.0,per:500,fiber:2.5,iron:1.2,calcium:75,vitc:0,vitd:1.5,salt:5.2,serving:500,aa:{leu:.09,ile:.06,val:.07,lys:.09,met:.03,thr:.06,trp:.02,his:.03,score:1.13},fa:{sat:.30,mufa:.42,n3:.03,n6:.19,trans:.01}},
  {name:'肉うどん（外食）',yomi:'ニクウドン',tags:'うどん 肉 牛 外食',en:'niku udon beef noodles',cal:560,p:22.0,f:14.5,c:83.0,per:530,fiber:2.5,iron:2.5,calcium:65,vitc:2,vitd:0.2,salt:5.5,serving:530,fa:{sat:.47,mufa:.43,n3:.01,n6:.05,trans:.02},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45}},
  {name:'鍋焼きうどん（外食）',yomi:'ナベヤキウドン',tags:'うどん 鍋焼き 外食 冬',en:'nabeyaki udon hot pot noodles',cal:580,p:24.0,f:12.5,c:91.0,per:580,fiber:4.0,iron:2.5,calcium:100,vitc:5,vitd:1.5,salt:6.0,serving:580,fa:{sat:.30,mufa:.35,n3:.04,n6:.26,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45}},
  {name:'皿うどん（長崎）',yomi:'サラウドン',tags:'皿うどん 長崎 中華 揚げ麺',en:'sara udon nagasaki fried noodles',cal:580,p:22.0,f:18.0,c:80.0,per:400,fiber:4.0,iron:2.5,calcium:90,vitc:20,vitd:0.5,salt:3.5,serving:400,fa:{sat:.30,mufa:.35,n3:.04,n6:.26,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45}},
  {name:'沖縄そば（1人前）',yomi:'オキナワソバ',tags:'沖縄そば 沖縄 豚 麺',en:'okinawa soba noodles pork',cal:535,p:22.0,f:14.5,c:78.0,per:500,fiber:2.5,iron:1.5,calcium:40,vitc:3,vitd:0.1,salt:5.0,serving:500,fa:{sat:.30,mufa:.35,n3:.04,n6:.26,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45}},

  // ── サンドイッチ・軽食 ──
  {name:'BLTサンドイッチ',yomi:'ビーエルティサンドイッチ',tags:'サンドイッチ BLT ベーコン レタス トマト',en:'BLT sandwich bacon lettuce tomato',cal:340,p:14.5,f:16.5,c:34.5,per:175,fiber:2.5,iron:1.5,calcium:70,vitc:12,vitd:0.2,salt:1.8,serving:175,fa:{sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45}},
  {name:'ツナサンドイッチ',yomi:'ツナサンドイッチ',tags:'サンドイッチ ツナ マヨ コンビニ',en:'tuna sandwich mayo',cal:295,p:12.5,f:11.5,c:36.5,per:155,fiber:2.0,iron:0.8,calcium:55,vitc:2,vitd:1,salt:1.5,serving:155,fa:{sat:.28,mufa:.18,n3:.38,n6:.05,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'エッグサンドイッチ',yomi:'エッグサンドイッチ',tags:'サンドイッチ 卵 エッグ コンビニ',en:'egg salad sandwich',cal:305,p:11.0,f:14.5,c:34.5,per:150,fiber:1.5,iron:1.2,calcium:65,vitc:1,vitd:0.8,salt:1.4,serving:150,fa:{sat:.30,mufa:.42,n3:.03,n6:.19,trans:.01},aa:{leu:.09,ile:.06,val:.07,lys:.09,met:.03,thr:.06,trp:.02,his:.03,score:1.13}},
  {name:'ハムチーズサンドイッチ',yomi:'ハムチーズサンド',tags:'サンドイッチ ハム チーズ',en:'ham cheese sandwich',cal:330,p:15.0,f:14.0,c:36.5,per:165,fiber:2.0,iron:1.0,calcium:130,vitc:1,vitd:0.2,salt:2.0,serving:165,fa:{sat:.63,mufa:.27,n3:.01,n6:.02,trans:.03},aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22}},
  {name:'ホットドッグ（1本）',yomi:'ホットドッグ',tags:'ホットドッグ ソーセージ パン ファスト',en:'hot dog bun sausage',cal:295,p:11.5,f:13.5,c:33.5,per:155,fiber:1.5,iron:1.2,calcium:45,vitc:2,vitd:0.1,salt:2.0,serving:155,fa:{sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45}},
  {name:'バーガーキング チキンサンド',yomi:'チキンサンド',tags:'バーガーキング チキン バーガー サンドイッチ',en:'burger king chicken sandwich',cal:490,p:28.0,f:19.5,c:52.0,per:215,fiber:2.5,iron:2.5,calcium:90,vitc:3,vitd:0.2,salt:2.5,serving:215,fa:{sat:.28,mufa:.40,n3:.02,n6:.22,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08}},

  // ── スナック・お菓子追加 ──
  {name:'柿の種（1袋・35g）',yomi:'カキノタネ',tags:'柿の種 スナック お菓子 亀田',en:'kaki no tane rice cracker peanut bag 35g',cal:152,p:3.8,f:5.2,c:23.5,per:35,fiber:0.7,iron:0.4,calcium:7,vitc:0,vitd:0,salt:0.6,serving:35,aa:{leu:0.08,ile:0.05,val:0.05,lys:0.07,met:0.01,thr:0.04,trp:0.01,his:0.03,score:0.72},fa:{sat:0.2,mufa:0.4,n3:0.02,n6:0.35,trans:0.01}},
  {name:'じゃがりこ（1カップ・58g）',yomi:'ジャガリコ',tags:'じゃがりこ スナック カルビー',en:'jagariko potato snack cup 58g',cal:299,p:4.1,f:16.0,c:35.2,per:58,fiber:3.0,iron:0.5,calcium:12,vitc:20,vitd:0,salt:0.8,serving:58,fa:{sat:.20,mufa:.32,n3:.05,n6:.38,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'プリングルズ（1缶・53g）',yomi:'プリングルス',tags:'プリングルス スナック ポテチ 筒',en:'pringles potato crisps can 53g',cal:285,p:2.9,f:17.5,c:30.0,per:53,fiber:1.6,iron:0.4,calcium:12,vitc:8,vitd:0,salt:0.5,serving:53,fa:{sat:.20,mufa:.32,n3:.05,n6:.38,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'コアラのマーチ（1箱・48g）',yomi:'コアラノマーチ',tags:'コアラのマーチ ロッテ お菓子 チョコ',en:'koala march chocolate biscuit 48g',cal:242,p:4.0,f:11.5,c:31.5,per:48,fiber:1.0,iron:0.5,calcium:35,vitc:0,vitd:0,salt:0.2,serving:48,fa:{sat:.47,mufa:.28,n3:.00,n6:.13,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'キャラメルコーン（1袋・77g）',yomi:'キャラメルコーン',tags:'キャラメルコーン 東ハト お菓子 コーン',en:'caramel corn snack bag 77g',cal:390,p:3.5,f:14.0,c:63.5,per:77,fiber:1.5,iron:0.5,calcium:20,vitc:0,vitd:0,salt:0.4,serving:77,aa:{leu:0.07,ile:0.04,val:0.04,lys:0.02,met:0.02,thr:0.03,trp:0.01,his:0.02,score:0.45},fa:{sat:0.3,mufa:0.35,n3:0.02,n6:0.3,trans:0.02}},
  {name:'ベビースター（1袋・70g）',yomi:'ベビースター',tags:'ベビースター ラーメン スナック おやつ',en:'baby star ramen snack 70g',cal:336,p:8.0,f:13.5,c:48.0,per:70,fiber:2.0,iron:0.8,calcium:30,vitc:0,vitd:0,salt:1.4,serving:70,aa:{leu:0.07,ile:0.04,val:0.04,lys:0.02,met:0.02,thr:0.03,trp:0.01,his:0.02,score:0.45},fa:{sat:0.45,mufa:0.4,n3:0.01,n6:0.13,trans:0.01}},
  {name:'チップスター（1缶・100g）',yomi:'チップスター',tags:'チップスター ヤマザキ ポテチ 筒',en:'chipstar potato chips can 100g',cal:536,p:5.5,f:33.5,c:54.5,per:100,fiber:3.5,iron:0.8,calcium:15,vitc:30,vitd:0,salt:0.7,serving:100,fa:{sat:.20,mufa:.32,n3:.05,n6:.38,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'グミ（果汁グミ・1袋・51g）',yomi:'グミ',tags:'グミ ガム お菓子 果汁 明治',en:'gummy candy fruit juice bag 51g',cal:172,p:3.0,f:0,c:41.5,per:51,fiber:0,iron:0,calcium:2,vitc:30,vitd:0,salt:0.1,serving:51,aa:{leu:0.08,ile:0.05,val:0.05,lys:0.06,met:0.02,thr:0.04,trp:0.01,his:0.03,score:0.75}},
  {name:'ガム（ロッテキシリトール・1粒）',yomi:'ガム',tags:'ガム キシリトール ロッテ',en:'xylitol gum 1 piece',cal:6,p:0,f:0,c:2.0,per:2,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0,serving:2},
  {name:'のど飴（1粒）',yomi:'ノドアメ',tags:'飴 キャンディ のど',en:'throat lozenge candy 1 piece',cal:18,p:0,f:0,c:4.5,per:5,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0,serving:5},

  // ── 乾物・加工品 ──
  {name:'湯葉（生）',yomi:'ユバ',tags:'湯葉 大豆 豆腐 和食',en:'yuba tofu skin raw',cal:218,p:21.8,f:13.7,c:4.1,per:100,fiber:0.8,iron:3.6,calcium:60,vitc:0,vitd:0,salt:0,fa:{sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00},aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.91}},
  {name:'麩（乾燥・車麩1個）',yomi:'フ',tags:'麩 車麩 グルテン 焼き麩',en:'fu gluten cake dried wheat',cal:385,p:28.5,f:2.8,c:62.5,per:100,fiber:2.5,iron:5.2,calcium:100,vitc:0,vitd:0,salt:0.4,aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},fa:{sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00}},
  {name:'切り干し大根（乾燥・20g）',yomi:'キリボシダイコンカンソウ',tags:'切り干し大根 乾物 根菜 食物繊維',en:'kiriboshi daikon dried strips 20g',cal:60,p:1.9,f:0.1,c:13.6,per:20,fiber:3.6,iron:1.0,calcium:100,vitc:0,vitd:0,salt:0,serving:20,aa:{leu:0.08,ile:0.05,val:0.05,lys:0.06,met:0.02,thr:0.04,trp:0.01,his:0.03,score:0.75}},
  {name:'高野豆腐（乾燥・1枚）',yomi:'コウヤドウフカンソウ',tags:'高野豆腐 凍り豆腐 乾物 大豆',en:'koya tofu freeze dried 1 piece',cal:106,p:10.1,f:6.8,c:0.8,per:20,fiber:0.5,iron:1.5,calcium:126,vitc:0,vitd:0,salt:0,serving:20,fa:{sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00},aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.91}},
  {name:'干しシイタケ（乾燥・5g）',yomi:'ホシシイタケ',tags:'干し椎茸 乾物 きのこ だし',en:'dried shiitake mushroom 5g',cal:14,p:0.9,f:0.1,c:3.5,per:5,fiber:2.3,iron:0.2,calcium:2,vitc:0,vitd:11,salt:0,serving:5},
  {name:'ひじき（乾燥・5g）',yomi:'ヒジキカンソウ',tags:'ひじき 海藻 乾物 鉄分',en:'hijiki seaweed dried 5g',cal:9,p:0.5,f:0.2,c:2.6,per:5,fiber:2.6,iron:0.3,calcium:50,vitc:0,vitd:0,salt:0.2,serving:5},
  {name:'とろろ昆布（5g）',yomi:'トロロコンブ',tags:'とろろ昆布 海藻 乾物 食物繊維',en:'tororo kombu shredded kelp 5g',cal:8,p:0.5,f:0.1,c:2.5,per:5,fiber:1.8,iron:0.3,calcium:38,vitc:0,vitd:0,salt:0.8,serving:5},

  // ── 薬味・香辛料 ──
  {name:'わさび（小さじ1）',yomi:'ワサビ',tags:'わさび 薬味 調味料 刺身',en:'wasabi teaspoon',cal:6,p:0.3,f:0.1,c:1.2,per:5,fiber:0.4,iron:0.1,calcium:8,vitc:5,vitd:0,salt:0},
  {name:'七味唐辛子（小さじ1）',yomi:'シチミトウガラシ',tags:'七味 調味料 スパイス 辛い',en:'shichimi togarashi seven spice teaspoon',cal:18,p:0.8,f:0.6,c:2.8,per:3,fiber:1.2,iron:0.5,calcium:15,vitc:2,vitd:0,salt:0,fa:{sat:0.15,mufa:0.25,n3:0.05,n6:0.5,trans:0}},
  {name:'山椒（小さじ1）',yomi:'サンショウ',tags:'山椒 調味料 スパイス うなぎ',en:'sansho japanese pepper teaspoon',cal:18,p:0.6,f:0.5,c:3.0,per:3,fiber:1.5,iron:0.5,calcium:20,vitc:0,vitd:0,salt:0,fa:{sat:0.15,mufa:0.25,n3:0.05,n6:0.5,trans:0}},
  {name:'クミン（小さじ1）',yomi:'クミン',tags:'クミン スパイス カレー インド',en:'cumin spice teaspoon',cal:8,p:0.4,f:0.5,c:1.0,per:2,fiber:0.5,iron:0.8,calcium:19,vitc:0.2,vitd:0,salt:0,fa:{sat:0.15,mufa:0.25,n3:0.05,n6:0.5,trans:0}},
  {name:'ターメリック（小さじ1）',yomi:'ターメリック',tags:'ターメリック スパイス カレー クルクミン',en:'turmeric spice teaspoon',cal:9,p:0.2,f:0.3,c:1.8,per:3,fiber:0.5,iron:0.9,calcium:5,vitc:0.5,vitd:0,salt:0},
  {name:'シナモン（小さじ1）',yomi:'シナモン',tags:'シナモン スパイス 菓子 紅茶',en:'cinnamon spice teaspoon',cal:6,p:0.1,f:0.1,c:2.0,per:3,fiber:1.4,iron:0.6,calcium:26,vitc:0,vitd:0,salt:0},
  {name:'パプリカパウダー（小さじ1）',yomi:'パプリカパウダー',tags:'パプリカ スパイス 彩り',en:'paprika powder teaspoon',cal:9,p:0.5,f:0.3,c:1.7,per:3,fiber:0.8,iron:0.5,calcium:6,vitc:5,vitd:0,salt:0},
  {name:'ガーリックパウダー（小さじ1）',yomi:'ガーリックパウダー',tags:'にんにく ガーリック スパイス パウダー',en:'garlic powder teaspoon',cal:10,p:0.5,f:0,c:2.2,per:3,fiber:0.2,iron:0.1,calcium:5,vitc:0.5,vitd:0,salt:0},
  {name:'バジル（乾燥・小さじ1）',yomi:'バジル',tags:'バジル ハーブ イタリアン 乾燥',en:'dried basil teaspoon',cal:6,p:0.6,f:0.1,c:1.0,per:2,fiber:0.7,iron:1.0,calcium:56,vitc:2,vitd:0,salt:0},
  {name:'オレガノ（乾燥・小さじ1）',yomi:'オレガノ',tags:'オレガノ ハーブ イタリアン 乾燥',en:'dried oregano teaspoon',cal:6,p:0.2,f:0.1,c:1.2,per:2,fiber:0.8,iron:1.0,calcium:48,vitc:1,vitd:0,salt:0},


  // ── 低脂肪・無脂肪食品 ──

  // 低脂肪乳製品
  {name:'低脂肪牛乳（200ml）',yomi:'テイシボウギュウニュウ',tags:'牛乳 低脂肪 乳製品 カルシウム',en:'low fat milk 200ml',cal:92,p:6.8,f:2.0,c:9.6,per:200,fiber:0,iron:0.1,calcium:240,vitc:2,vitd:0.6,salt:0.2,serving:200,fa:{sat:.40,mufa:.28,n3:.01,n6:.02,trans:.02},aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22}},
  {name:'無脂肪牛乳（200ml）',yomi:'ムシボウギュウニュウ',tags:'牛乳 無脂肪 ノンファット 乳製品',en:'nonfat skim milk 200ml',cal:70,p:7.0,f:0.2,c:9.8,per:200,fiber:0,iron:0.1,calcium:250,vitc:2,vitd:0.4,salt:0.2,serving:200,aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22}},
  {name:'低脂肪ヨーグルト（100g）',yomi:'テイシボウヨーグルト',tags:'ヨーグルト 低脂肪 乳製品 腸活',en:'low fat yogurt plain 100g',cal:45,p:4.3,f:0.5,c:5.7,per:100,fiber:0,iron:0.1,calcium:150,vitc:1,vitd:0.1,salt:0.1,serving:100,aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22},fa:{sat:.40,mufa:.28,n3:.01,n6:.02,trans:.02}},
  {name:'無脂肪ヨーグルト（100g）',yomi:'ムシボウヨーグルト',tags:'ヨーグルト 無脂肪 ノンファット 乳製品',en:'nonfat yogurt plain 100g',cal:35,p:4.0,f:0.1,c:5.0,per:100,fiber:0,iron:0.1,calcium:160,vitc:1,vitd:0.1,salt:0.1,serving:100,aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22}},
  {name:'無脂肪ギリシャヨーグルト（100g）',yomi:'ムシボウギリシャヨーグルト',tags:'ギリシャヨーグルト 無脂肪 高タンパク ノンファット',en:'nonfat greek yogurt 100g',cal:56,p:10.0,f:0.4,c:4.0,per:100,fiber:0,iron:0.1,calcium:110,vitc:0,vitd:0.1,salt:0.1,serving:100,aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22}},
  {name:'カッテージチーズ（低脂肪）',yomi:'カッテージチーズテイシボウ',tags:'チーズ 低脂肪 高タンパク 乳製品',en:'cottage cheese low fat 1%',cal:72,p:12.4,f:1.0,c:2.7,per:100,fiber:0,iron:0.1,calcium:61,vitc:0,vitd:0.1,salt:0.4,serving:100,aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22},fa:{sat:.40,mufa:.28,n3:.01,n6:.02,trans:.02}},
  {name:'リコッタチーズ（低脂肪）',yomi:'リコッタチーズ',tags:'チーズ リコッタ 低脂肪 イタリアン',en:'ricotta cheese part skim',cal:138,p:11.3,f:7.9,c:5.1,per:100,fiber:0,iron:0.2,calcium:208,vitc:0,vitd:0.2,salt:0.1,serving:100,fa:{sat:.40,mufa:.28,n3:.01,n6:.02,trans:.02},aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22}},
  {name:'クワルク（フレッシュチーズ低脂肪）',yomi:'クワルク',tags:'クワルク ドイツ 低脂肪 高タンパク チーズ',en:'quark fresh cheese low fat',cal:67,p:12.0,f:0.2,c:4.1,per:100,fiber:0,iron:0.1,calcium:95,vitc:0,vitd:0.1,salt:0.1,serving:100,aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22}},

  // 白身魚・低脂肪魚介
  {name:'かれい（生）',yomi:'カレイ',tags:'かれい 鰈 白身魚 低脂肪 高タンパク',en:'flounder flatfish raw',cal:89,p:19.6,f:1.3,c:0.1,per:100,fiber:0,iron:0.2,calcium:43,vitc:0,vitd:13,salt:0.2,serving:120,fa:{sat:.28,mufa:.24,n3:.24,n6:.08,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'ひらめ（生）',yomi:'ヒラメ',tags:'ひらめ 平目 白身魚 刺身 低脂肪',en:'halibut flounder raw',cal:103,p:20.0,f:2.0,c:0.1,per:100,fiber:0,iron:0.1,calcium:22,vitc:0,vitd:3,salt:0.2,serving:120,fa:{sat:.28,mufa:.24,n3:.24,n6:.08,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'たい（真鯛・生）',yomi:'タイ',tags:'鯛 たい 白身魚 刺身 祝い',en:'red sea bream raw',cal:142,p:20.6,f:5.8,c:0.1,per:100,fiber:0,iron:0.2,calcium:11,vitc:0,vitd:5,salt:0.1,serving:120,fa:{sat:.28,mufa:.24,n3:.24,n6:.08,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'すずき（生）',yomi:'スズキ',tags:'すずき 鱸 白身魚 低脂肪',en:'sea bass raw',cal:113,p:19.8,f:3.5,c:0.1,per:100,fiber:0,iron:0.2,calcium:12,vitc:0,vitd:2,salt:0.1,serving:120,fa:{sat:.28,mufa:.24,n3:.24,n6:.08,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'メバル（生）',yomi:'メバル',tags:'めばる メバル 白身魚 低脂肪',en:'rockfish raw',cal:94,p:18.1,f:2.6,c:0.1,per:100,fiber:0,iron:0.4,calcium:70,vitc:0,vitd:4,salt:0.2,serving:100,fa:{sat:.28,mufa:.24,n3:.24,n6:.08,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'はまぐり（生）',yomi:'ハマグリ',tags:'はまぐり 蛤 貝 低脂肪 旨味',en:'hard clam hamaguri raw',cal:35,p:6.1,f:0.6,c:1.8,per:100,fiber:0,iron:1.5,calcium:66,vitc:0,vitd:0,salt:0.6,serving:100,fa:{sat:.28,mufa:.24,n3:.24,n6:.08,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'ツナ缶（水煮ノンオイル・70g）',yomi:'ツナカンスイニ',tags:'ツナ まぐろ 缶詰 水煮 低脂肪 高タンパク',en:'canned tuna water no oil 70g',cal:50,p:11.2,f:0.5,c:0.1,per:70,fiber:0,iron:0.6,calcium:3,vitc:0,vitd:1,salt:0.2,serving:70,fa:{sat:.28,mufa:.18,n3:.38,n6:.05,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'かれいの煮付け（1切れ）',yomi:'カレイノニツケ',tags:'かれい 煮付け 和食 白身魚',en:'simmered flounder',cal:130,p:21.0,f:2.5,c:7.5,per:150,fiber:0,iron:0.3,calcium:65,vitc:0,vitd:10,salt:1.8,serving:150,fa:{sat:.28,mufa:.24,n3:.24,n6:.08,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},

  // 低脂肪肉類
  {name:'鶏むね肉（皮なし・茹で）',yomi:'トリムネニクユデ',tags:'鶏むね 皮なし ゆで 低脂肪 高タンパク',en:'chicken breast skinless boiled',cal:109,p:24.4,f:1.3,c:0,per:100,fiber:0,iron:0.3,calcium:5,vitc:2,vitd:0.1,salt:0.1,serving:150,fa:{sat:.28,mufa:.40,n3:.02,n6:.22,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08}},
  {name:'ささみ（茹で）',yomi:'ササミユデ',tags:'ささみ ゆで 低脂肪 高タンパク 鶏',en:'chicken tenderloin boiled',cal:113,p:26.0,f:0.8,c:0,per:100,fiber:0,iron:0.3,calcium:4,vitc:2,vitd:0.1,salt:0.1,serving:100,fa:{sat:.28,mufa:.40,n3:.02,n6:.22,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08}},
  {name:'ささみ（蒸し）',yomi:'ササミムシ',tags:'ささみ 蒸し 低脂肪 高タンパク ダイエット',en:'chicken tenderloin steamed',cal:105,p:24.6,f:0.6,c:0,per:100,fiber:0,iron:0.3,calcium:4,vitc:2,vitd:0.1,salt:0.1,serving:100,fa:{sat:.28,mufa:.40,n3:.02,n6:.22,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08}},
  {name:'豚ヒレ肉（茹で）',yomi:'ブタヒレユデ',tags:'豚ヒレ 低脂肪 高タンパク ゆで',en:'pork tenderloin boiled',cal:130,p:25.0,f:3.0,c:0.2,per:100,fiber:0,iron:1.0,calcium:4,vitc:1,vitd:0.3,salt:0.1,serving:150,fa:{sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:0.98}},
  {name:'馬肉（赤身・生）',yomi:'ウマニク',tags:'馬肉 赤身 低脂肪 高タンパク ヘルシー',en:'horse meat lean raw',cal:110,p:20.1,f:2.5,c:0.3,per:100,fiber:0,iron:4.3,calcium:11,vitc:5,vitd:0.1,salt:0.1,serving:100,fa:{sat:.42,mufa:.38,n3:.05,n6:.06,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'鹿肉（赤身・生）',yomi:'シカニク',tags:'鹿肉 ジビエ 赤身 低脂肪 高タンパク',en:'venison deer meat lean raw',cal:107,p:22.3,f:1.5,c:0.4,per:100,fiber:0,iron:3.9,calcium:5,vitc:4,vitd:0.1,salt:0.1,serving:100,fa:{sat:.40,mufa:.38,n3:.04,n6:.05,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'蒸し鶏（プレーン）',yomi:'ムシドリ',tags:'蒸し鶏 低脂肪 高タンパク 鶏 ヘルシー',en:'steamed chicken breast plain',cal:108,p:23.5,f:1.5,c:0,per:130,fiber:0,iron:0.3,calcium:5,vitc:2,vitd:0.1,salt:0.1,serving:130,fa:{sat:.28,mufa:.40,n3:.02,n6:.22,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08}},

  // 低脂肪豆類・植物性
  {name:'そら豆（茹で）',yomi:'ソラマメ',tags:'そら豆 豆 ゆで 低脂肪 食物繊維',en:'broad beans fava boiled',cal:112,p:10.5,f:0.2,c:16.9,per:100,fiber:4.0,iron:2.1,calcium:22,vitc:18,vitd:0,salt:0,serving:100,aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.72}},
  {name:'そら豆（乾燥）',yomi:'ソラマメカンソウ',tags:'そら豆 豆 乾物 乾燥 食物繊維',en:'broad beans fava dried',cal:348,p:26.0,f:2.0,c:55.9,per:100,fiber:9.3,iron:5.7,calcium:100,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.72},fa:{sat:0.14,mufa:0.24,n3:0.07,n6:0.52,trans:0}},
  {name:'さやいんげん（茹で）',yomi:'サヤインゲン',tags:'さやいんげん いんげん 茹で 野菜',en:'green beans snap boiled',cal:26,p:1.8,f:0.1,c:5.1,per:100,fiber:2.4,iron:0.7,calcium:57,vitc:8,vitd:0,salt:0,aa:{leu:0.08,ile:0.05,val:0.05,lys:0.07,met:0.01,thr:0.04,trp:0.01,his:0.03,score:0.72}},
  {name:'スナップえんどう（生）',yomi:'スナップエンドウ',tags:'スナップエンドウ えんどう 甘い 低カロリー',en:'snap peas sugar snap raw',cal:43,p:2.9,f:0.1,c:8.1,per:100,fiber:3.0,iron:0.8,calcium:32,vitc:43,vitd:0,salt:0,aa:{leu:0.08,ile:0.05,val:0.05,lys:0.07,met:0.01,thr:0.04,trp:0.01,his:0.03,score:0.72}},
  {name:'グリーンピース（冷凍）',yomi:'グリーンピース',tags:'グリーンピース 豆 冷凍 低脂肪',en:'green peas frozen',cal:76,p:5.2,f:0.4,c:13.6,per:100,fiber:5.9,iron:1.5,calcium:18,vitc:16,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.72}},
  {name:'黒豆（煮豆）',yomi:'クロマメ',tags:'黒豆 煮豆 大豆 和食 正月',en:'kuromame black soybean simmered',cal:189,p:8.6,f:2.8,c:34.4,per:100,fiber:6.4,iron:1.8,calcium:60,vitc:0,vitd:0,salt:0.8,fa:{sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00},aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.91}},
  {name:'豆苗（生）',yomi:'トウミョウ',tags:'豆苗 豆 スプラウト 低カロリー',en:'pea shoots raw',cal:31,p:3.8,f:0.4,c:4.4,per:100,fiber:2.2,iron:0.9,calcium:34,vitc:79,vitd:0,salt:0,aa:{leu:0.08,ile:0.05,val:0.05,lys:0.07,met:0.01,thr:0.04,trp:0.01,his:0.03,score:0.72}},
  {name:'ブロッコリースプラウト（生）',yomi:'ブロッコリースプラウト',tags:'スプラウト ブロッコリー 新芽 スルフォラファン',en:'broccoli sprouts raw',cal:23,p:2.9,f:0.4,c:3.0,per:100,fiber:1.8,iron:0.6,calcium:65,vitc:64,vitd:0,salt:0,aa:{leu:0.08,ile:0.05,val:0.05,lys:0.06,met:0.02,thr:0.04,trp:0.01,his:0.03,score:0.75}},

  // 低脂肪調理・海藻
  {name:'白身魚のホイル焼き（1切れ）',yomi:'シロミサカナホイルヤキ',tags:'白身魚 ホイル焼き 低脂肪 ヘルシー',en:'white fish foil baked',cal:120,p:22.0,f:1.5,c:3.5,per:160,fiber:1.0,iron:0.5,calcium:45,vitc:8,vitd:5,salt:0.8,serving:160,fa:{sat:.28,mufa:.24,n3:.24,n6:.08,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'もずく酢（1人前）',yomi:'モズクス',tags:'もずく 海藻 低カロリー ダイエット フコイダン',en:'mozuku seaweed vinegar',cal:14,p:0.5,f:0.2,c:2.5,per:100,fiber:1.5,iron:0.2,calcium:22,vitc:0,vitd:0,salt:0.5,serving:100},
  {name:'めかぶ（生・50g）',yomi:'メカブ',tags:'めかぶ 海藻 ぬめり 食物繊維 低カロリー',en:'mekabu young wakame 50g',cal:7,p:0.5,f:0.2,c:1.0,per:50,fiber:1.5,iron:0.1,calcium:60,vitc:0,vitd:0,salt:0.1,serving:50},
  {name:'海藻麺（100g）',yomi:'カイソウメン',tags:'海藻麺 低カロリー 麺代替 ダイエット',en:'seaweed noodles kelp',cal:12,p:1.0,f:0.1,c:2.5,per:100,fiber:2.0,iron:0.3,calcium:50,vitc:0,vitd:0,salt:0.5,serving:100,aa:{leu:0.07,ile:0.04,val:0.04,lys:0.02,met:0.02,thr:0.03,trp:0.01,his:0.02,score:0.45}},
  {name:'寒天ゼリー（低カロリー）',yomi:'カンテンゼリー',tags:'寒天 ゼリー ダイエット 低カロリー',en:'agar jelly low calorie',cal:20,p:0.5,f:0,c:5.5,per:100,fiber:2.0,iron:0,calcium:5,vitc:3,vitd:0,salt:0,serving:100},
  {name:'こんにゃくゼリー（1個）',yomi:'コンニャクゼリー',tags:'こんにゃく ゼリー ダイエット 低カロリー',en:'konjac jelly diet',cal:25,p:0,f:0,c:7.0,per:120,fiber:2.5,iron:0,calcium:10,vitc:0,vitd:0,salt:0,serving:120},

  // 食材代替・低糖質
  {name:'カリフラワーライス（100g）',yomi:'カリフラワーライス',tags:'カリフラワー 低糖質 米代替 ダイエット',en:'cauliflower rice 100g',cal:26,p:2.1,f:0.2,c:5.2,per:100,fiber:2.5,iron:0.4,calcium:24,vitc:81,vitd:0,salt:0.1,serving:100,aa:{leu:0.08,ile:0.05,val:0.05,lys:0.06,met:0.02,thr:0.04,trp:0.01,his:0.03,score:0.75}},
  {name:'ブロッコリーライス（100g）',yomi:'ブロッコリーライス',tags:'ブロッコリー 低糖質 米代替 ダイエット',en:'broccoli rice 100g',cal:33,p:4.3,f:0.5,c:5.2,per:100,fiber:4.4,iron:1.0,calcium:38,vitc:120,vitd:0,salt:0,serving:100,aa:{leu:0.08,ile:0.05,val:0.05,lys:0.06,met:0.02,thr:0.04,trp:0.01,his:0.03,score:0.75},fa:{sat:0.2,mufa:0.15,n3:0.2,n6:0.4,trans:0}},
  {name:'豆腐麺（100g）',yomi:'トウフメン',tags:'豆腐麺 低糖質 高タンパク 麺代替',en:'tofu noodles',cal:35,p:4.5,f:1.5,c:1.5,per:100,fiber:0.5,iron:0.5,calcium:60,vitc:0,vitd:0,salt:0.1,serving:100,fa:{sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00},aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.91}},
  {name:'卵白（生・1個分）',yomi:'タマゴシロミ',tags:'卵白 白身 低脂肪 ゼロ脂肪 高タンパク',en:'egg white raw 1 piece',cal:16,p:3.6,f:0,c:0.3,per:33,fiber:0,iron:0,calcium:2,vitc:0,vitd:0,salt:0.2,serving:33,aa:{leu:.09,ile:.06,val:.06,lys:.07,met:.04,thr:.05,trp:.02,his:.02,score:1.00}},
  {name:'液卵白（100ml）',yomi:'エキランパク',tags:'卵白 液卵 低脂肪 高タンパク プロテイン',en:'liquid egg whites 100ml',cal:52,p:11.0,f:0.1,c:0.7,per:100,fiber:0,iron:0,calcium:7,vitc:0,vitd:0,salt:0.4,serving:100,aa:{leu:.09,ile:.06,val:.06,lys:.07,met:.04,thr:.05,trp:.02,his:.02,score:1.00}},
  {name:'サイリウムハスク（大さじ1）',yomi:'サイリウム',tags:'サイリウム 食物繊維 低糖質 ダイエット',en:'psyllium husk tablespoon',cal:20,p:0.1,f:0.1,c:8.5,per:10,fiber:8.0,iron:0.3,calcium:20,vitc:0,vitd:0,salt:0},


  // ── 朝食系・スムージー ──
  {name:'ミューズリー（50g）',yomi:'ミューズリー',tags:'シリアル 朝食 燕麦 ドライフルーツ ナッツ',en:'muesli cereal 50g',cal:185,p:5.5,f:3.5,c:34.5,per:50,fiber:3.8,iron:2.0,calcium:35,vitc:0,vitd:0,salt:0.1,serving:50,aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.55},fa:{sat:0.18,mufa:0.35,n3:0.06,n6:0.35,trans:0}},
  {name:'プロテインパンケーキ（1枚）',yomi:'プロテインパンケーキ',tags:'パンケーキ プロテイン 高タンパク 朝食',en:'protein pancake 1 piece',cal:150,p:15.0,f:4.5,c:14.5,per:80,fiber:1.0,iron:1.0,calcium:80,vitc:0,vitd:0.3,salt:0.4,serving:80,fa:{sat:.20,mufa:.28,n3:.04,n6:.16,trans:.01},aa:{leu:.11,ile:.07,val:.06,lys:.10,met:.02,thr:.07,trp:.02,his:.02,score:1.09}},
  {name:'オーバーナイトオーツ（1人前）',yomi:'オーバーナイトオーツ',tags:'オーツ 朝食 ヨーグルト 低GI 簡単',en:'overnight oats with yogurt',cal:310,p:12.5,f:6.0,c:52.0,per:250,fiber:5.5,iron:2.5,calcium:180,vitc:1,vitd:0.2,salt:0.2,serving:250,aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22},fa:{sat:.20,mufa:.28,n3:.04,n6:.16,trans:.01}},
  {name:'グリーンスムージー（200ml）',yomi:'グリーンスムージー',tags:'スムージー 野菜 朝食 ほうれん草 バナナ',en:'green smoothie spinach banana 200ml',cal:110,p:2.5,f:0.5,c:25.5,per:200,fiber:3.0,iron:1.5,calcium:55,vitc:40,vitd:0,salt:0.1,serving:200,aa:{leu:0.08,ile:0.05,val:0.05,lys:0.06,met:0.02,thr:0.04,trp:0.01,his:0.03,score:0.75},fa:{sat:0.15,mufa:0.05,n3:0.45,n6:0.3,trans:0}},
  {name:'プロテインスムージー（200ml）',yomi:'プロテインスムージー',tags:'スムージー プロテイン 高タンパク 朝食',en:'protein smoothie whey banana 200ml',cal:230,p:20.0,f:3.0,c:32.0,per:200,fiber:1.5,iron:0.5,calcium:150,vitc:5,vitd:0.2,salt:0.2,serving:200,aa:{leu:.11,ile:.07,val:.06,lys:.10,met:.02,thr:.07,trp:.02,his:.02,score:1.09},fa:{sat:.20,mufa:.28,n3:.04,n6:.16,trans:.01}},
  {name:'アサイーボウル（1人前）',yomi:'アサイーボウル',tags:'アサイー ボウル スムージー トロピカル',en:'acai bowl 1 serving',cal:320,p:5.5,f:10.0,c:52.0,per:300,fiber:7.0,iron:2.0,calcium:80,vitc:20,vitd:0,salt:0.1,serving:300,aa:{leu:0.08,ile:0.05,val:0.05,lys:0.06,met:0.02,thr:0.04,trp:0.01,his:0.03,score:0.75},fa:{sat:0.2,mufa:0.55,n3:0.02,n6:0.15,trans:0}},
  {name:'ポキボウル（1人前）',yomi:'ポキボウル',tags:'ポキ ハワイアン まぐろ ご飯 アボカド',en:'poke bowl hawaiian tuna',cal:550,p:28.0,f:14.0,c:75.0,per:400,fiber:5.0,iron:3.0,calcium:55,vitc:15,vitd:3,salt:2.5,serving:400,fa:{sat:.22,mufa:.32,n3:.28,n6:.08,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},

  // ── コンビニ追加 ──
  {name:'コンビニ 豚汁（1食）',yomi:'コンビニトンジル',tags:'豚汁 コンビニ 汁物 野菜',en:'convenience store tonjiru pork miso soup',cal:130,p:6.5,f:5.0,c:15.5,per:250,fiber:2.5,iron:1.0,calcium:45,vitc:5,vitd:0.1,salt:2.0,serving:250,aa:{leu:0.09,ile:0.05,val:0.05,lys:0.09,met:0.03,thr:0.05,trp:0.01,his:0.03,score:0.98},fa:{sat:0.38,mufa:0.46,n3:0.01,n6:0.12,trans:0.01}},
  {name:'コンビニ コーンスープ（1食）',yomi:'コンビニコーンスープ',tags:'コーンスープ コンビニ スープ',en:'convenience store corn soup',cal:110,p:2.5,f:3.5,c:17.5,per:160,fiber:1.0,iron:0.3,calcium:40,vitc:2,vitd:0,salt:1.2,serving:160,aa:{leu:0.1,ile:0.06,val:0.07,lys:0.08,met:0.03,thr:0.05,trp:0.01,his:0.03,score:1.22},fa:{sat:0.45,mufa:0.3,n3:0.02,n6:0.2,trans:0.02}},
  {name:'コンビニ ミネストローネ（1食）',yomi:'コンビニミネストローネ',tags:'ミネストローネ コンビニ スープ 野菜',en:'convenience store minestrone',cal:85,p:3.5,f:2.0,c:13.5,per:200,fiber:3.0,iron:1.0,calcium:35,vitc:15,vitd:0,salt:1.5,serving:200,aa:{leu:0.08,ile:0.05,val:0.05,lys:0.06,met:0.02,thr:0.04,trp:0.01,his:0.03,score:0.75},fa:{sat:0.15,mufa:0.55,n3:0.05,n6:0.2,trans:0}},
  {name:'コンビニ プリン（1個）',yomi:'コンビニプリン',tags:'プリン コンビニ デザート 卵',en:'convenience store pudding custard',cal:110,p:3.0,f:4.5,c:14.5,per:85,fiber:0,iron:0.2,calcium:70,vitc:0,vitd:0.4,salt:0.2,serving:85,aa:{leu:0.09,ile:0.06,val:0.07,lys:0.09,met:0.03,thr:0.06,trp:0.02,his:0.03,score:1.13},fa:{sat:0.55,mufa:0.3,n3:0.01,n6:0.05,trans:0.02}},
  {name:'コンビニ ショートケーキ（1個）',yomi:'コンビニショートケーキ',tags:'ショートケーキ コンビニ デザート ケーキ',en:'convenience store strawberry shortcake',cal:285,p:4.5,f:12.5,c:38.5,per:100,fiber:0.5,iron:0.3,calcium:50,vitc:4,vitd:0.2,salt:0.2,serving:100,aa:{leu:0.09,ile:0.06,val:0.07,lys:0.09,met:0.03,thr:0.06,trp:0.02,his:0.03,score:1.13},fa:{sat:0.55,mufa:0.3,n3:0.01,n6:0.05,trans:0.02}},
  {name:'コンビニ 温泉卵（1個）',yomi:'コンビニオンセンタマゴ',tags:'温泉卵 コンビニ 卵 たまご',en:'convenience store onsen tamago soft cooked egg',cal:75,p:6.2,f:5.2,c:0.2,per:58,fiber:0,iron:0.9,calcium:26,vitc:0,vitd:1.9,salt:0.4,serving:58,aa:{leu:.09,ile:.06,val:.07,lys:.09,met:.03,thr:.06,trp:.02,his:.03,score:1.13},fa:{sat:0.3,mufa:0.42,n3:0.03,n6:0.19,trans:0.01}},
  {name:'コンビニ アーモンドフィッシュ（1袋）',yomi:'アーモンドフィッシュ',tags:'アーモンドフィッシュ コンビニ スナック カルシウム',en:'almond small fish snack bag',cal:155,p:8.5,f:8.5,c:11.5,per:30,fiber:1.0,iron:0.8,calcium:200,vitc:0,vitd:3,salt:0.5,serving:30,fa:{sat:.27,mufa:.25,n3:.28,n6:.05,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'コンビニ 納豆（3パック）',yomi:'コンビニナットウ',tags:'納豆 コンビニ 大豆 発酵',en:'convenience store natto 3 packs',cal:200,p:16.5,f:10.0,c:14.5,per:150,fiber:6.7,iron:4.5,calcium:120,vitc:0,vitd:0,salt:0,serving:150,fa:{sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00},aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.91}},

  // ── 外食チェーン追加 ──
  {name:'餃子の王将 餃子（6個）',yomi:'ギョウザノオウショウ',tags:'餃子 王将 外食 チェーン',en:'gyoza no ohsho dumplings 6pcs',cal:318,p:12.5,f:16.5,c:30.5,per:174,fiber:2.0,iron:1.5,calcium:30,vitc:3,vitd:0,salt:2.2,serving:174,fa:{sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'天丼てんや 天丼（並）',yomi:'テンヤテンドン',tags:'天丼 てんや 外食 天ぷら',en:'tenya tendon tempura bowl regular',cal:740,p:22.0,f:18.5,c:112.0,per:430,fiber:2.5,iron:1.8,calcium:90,vitc:5,vitd:1.5,salt:3.5,serving:430,fa:{sat:.20,mufa:.32,n3:.05,n6:.38,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'なか卯 親子丼（並）',yomi:'ナカウオヤコドン',tags:'なか卯 親子丼 外食 チェーン 鶏 卵',en:'nakayu oyakodon chicken egg bowl regular',cal:620,p:26.0,f:13.5,c:92.0,per:380,fiber:1.5,iron:1.8,calcium:65,vitc:4,vitd:1.0,salt:3.0,serving:380,fa:{sat:.31,mufa:.44,n3:.03,n6:.18,trans:.01},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08}},
  {name:'ゆで太郎 もりそば（並）',yomi:'ユデタロウモリソバ',tags:'ゆで太郎 そば もりそば 外食',en:'yudetaro mori soba cold noodles regular',cal:395,p:16.5,f:2.5,c:76.0,per:380,fiber:4.0,iron:2.0,calcium:40,vitc:0,vitd:0,salt:3.5,serving:380,aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},fa:{sat:0.25,mufa:0.3,n3:0.04,n6:0.3,trans:0.01}},
  {name:'ガスト ハンバーグステーキ（200g）',yomi:'ガストハンバーグ',tags:'ガスト ハンバーグ 外食 ファミレス',en:'gusto hamburger steak 200g',cal:460,p:26.0,f:28.0,c:22.0,per:300,fiber:2.0,iron:3.0,calcium:50,vitc:5,vitd:0.2,salt:2.5,serving:300,fa:{sat:.43,mufa:.44,n3:.01,n6:.08,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'リンガーハット 長崎ちゃんぽん',yomi:'リンガーハット',tags:'リンガーハット ちゃんぽん 外食 野菜',en:'ringerhut nagasaki champon noodles',cal:520,p:28.0,f:11.5,c:76.5,per:720,fiber:6.5,iron:3.5,calcium:180,vitc:40,vitd:0.5,salt:5.5,serving:720,fa:{sat:.30,mufa:.35,n3:.04,n6:.26,trans:.01},aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},

  // ── 魚介料理 ──
  {name:'海鮮丼（外食・1人前）',yomi:'カイセンドン',tags:'海鮮丼 どんぶり 刺身 外食',en:'kaisen don assorted seafood rice bowl',cal:560,p:30.0,f:5.5,c:95.0,per:430,fiber:1.5,iron:2.5,calcium:45,vitc:5,vitd:8,salt:2.5,serving:430,fa:{sat:.27,mufa:.25,n3:.28,n6:.05,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'アクアパッツァ（1人前）',yomi:'アクアパッツァ',tags:'アクアパッツァ イタリアン 白身魚 トマト',en:'acqua pazza italian fish tomato',cal:260,p:28.0,f:9.5,c:12.0,per:350,fiber:3.0,iron:1.5,calcium:60,vitc:20,vitd:5,salt:2.0,serving:350,fa:{sat:.28,mufa:.24,n3:.24,n6:.08,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'魚介クラムチャウダー（1杯）',yomi:'クラムチャウダー',tags:'クラムチャウダー スープ 貝 洋食',en:'clam chowder seafood soup',cal:220,p:10.5,f:10.5,c:22.0,per:280,fiber:2.0,iron:1.5,calcium:120,vitc:8,vitd:0.5,salt:2.5,serving:280,fa:{sat:.62,mufa:.28,n3:.01,n6:.02,trans:.03},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'刺身盛り合わせ（5点・1人前）',yomi:'サシミモリアワセ',tags:'刺身 盛り合わせ 刺し身 生魚 外食',en:'sashimi assorted 5 kinds',cal:225,p:35.0,f:4.5,c:1.5,per:180,fiber:0,iron:1.5,calcium:25,vitc:0,vitd:6,salt:0.5,serving:180,fa:{sat:.27,mufa:.25,n3:.28,n6:.05,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},
  {name:'えびのアヒージョ（1人前）',yomi:'エビアヒージョ',tags:'アヒージョ えび スペイン オリーブオイル',en:'gambas al ajillo shrimp garlic oil',cal:340,p:20.0,f:25.5,c:4.0,per:200,fiber:0.5,iron:1.0,calcium:65,vitc:3,vitd:0,salt:1.5,serving:200,fa:{sat:.14,mufa:.74,n3:.01,n6:.10,trans:.00},aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00}},

  // ── 発酵・乳酸菌飲料 ──
  {name:'ヤクルト（1本・65ml）',yomi:'ヤクルト',tags:'ヤクルト 乳酸菌 プロバイオティクス 腸活',en:'yakult probiotic drink 65ml',cal:50,p:0.8,f:0,c:11.5,per:65,fiber:0,iron:0,calcium:24,vitc:0,vitd:0,salt:0.1,serving:65},
  {name:'ヤクルト1000（1本・100ml）',yomi:'ヤクルトセン',tags:'ヤクルト1000 乳酸菌 プロバイオティクス 睡眠',en:'yakult 1000 probiotic drink 100ml',cal:68,p:1.2,f:0,c:15.0,per:100,fiber:0,iron:0,calcium:32,vitc:0,vitd:0,salt:0.1,serving:100,aa:{leu:0.1,ile:0.06,val:0.07,lys:0.08,met:0.03,thr:0.05,trp:0.01,his:0.03,score:1.22}},
  {name:'カルピス（希釈・コップ1杯200ml）',yomi:'カルピス',tags:'カルピス 乳酸菌 ドリンク 乳飲料',en:'calpis diluted drink 200ml',cal:76,p:0.8,f:0.2,c:17.0,per:200,fiber:0,iron:0,calcium:30,vitc:0,vitd:0,salt:0.1,serving:200},
  {name:'乳酸菌飲料（ビフィズス菌入り・100ml）',yomi:'ニュウサンキンインリョウ',tags:'乳酸菌 ビフィズス菌 腸活 プロバイオティクス',en:'lactic acid bacteria drink bifidus 100ml',cal:65,p:1.5,f:0.1,c:14.5,per:100,fiber:0,iron:0,calcium:50,vitc:0,vitd:0,salt:0.1,serving:100,aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22}},
  {name:'ドリンクヨーグルト（飲むヨーグルト・200ml）',yomi:'ノムヨーグルト',tags:'飲むヨーグルト 乳酸菌 乳製品 腸活',en:'drinking yogurt 200ml',cal:130,p:5.0,f:3.0,c:21.0,per:200,fiber:0,iron:0.1,calcium:210,vitc:2,vitd:0.2,salt:0.2,serving:200,aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22},fa:{sat:.62,mufa:.28,n3:.01,n6:.02,trans:.03}},

  // ── 機能性食品・サプリ追加 ──
  {name:'フィッシュオイル（DHA EPA・1粒）',yomi:'フィッシュオイル',tags:'フィッシュオイル DHA EPA オメガ3 サプリ',en:'fish oil DHA EPA capsule 1 piece',cal:9,p:0,f:1.0,c:0,per:1,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0,fa:{sat:.22,mufa:.11,n3:.42,n6:.02,trans:.00}},
  {name:'クリルオイル（1粒・500mg）',yomi:'クリルオイル',tags:'クリルオイル オキアミ オメガ3 サプリ',en:'krill oil capsule 500mg',cal:4,p:0,f:0.5,c:0,per:0.5,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0,fa:{sat:.22,mufa:.11,n3:.42,n6:.02,trans:.00}},
  {name:'マルチビタミン（1粒）',yomi:'マルチビタミン',tags:'マルチビタミン サプリ ビタミン ミネラル',en:'multivitamin supplement 1 tablet',cal:3,p:0.1,f:0,c:0.5,per:1,fiber:0,iron:5.0,calcium:100,vitc:60,vitd:5,salt:0},
  {name:'ビタミンC（1000mg・1粒）',yomi:'ビタミンシー',tags:'ビタミンC サプリ 抗酸化 免疫',en:'vitamin C 1000mg supplement',cal:4,p:0,f:0,c:1.0,per:1,fiber:0,iron:0,calcium:0,vitc:1000,vitd:0,salt:0},
  {name:'ビタミンD3（1粒）',yomi:'ビタミンデー',tags:'ビタミンD ビタミンD3 サプリ 骨 免疫',en:'vitamin D3 supplement',cal:2,p:0,f:0.2,c:0,per:1,fiber:0,iron:0,calcium:0,vitc:0,vitd:25,salt:0},
  {name:'亜鉛サプリ（1粒）',yomi:'アエンサプリ',tags:'亜鉛 サプリ ミネラル 免疫 テストステロン',en:'zinc supplement 1 tablet',cal:2,p:0,f:0,c:0.5,per:1,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0},
  {name:'マグネシウムサプリ（1粒）',yomi:'マグネシウム',tags:'マグネシウム サプリ ミネラル 筋肉 睡眠',en:'magnesium supplement 1 tablet',cal:2,p:0,f:0,c:0.5,per:1,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0},
  {name:'鉄サプリ（1粒）',yomi:'テツサプリ',tags:'鉄 鉄分 サプリ 貧血 女性',en:'iron supplement 1 tablet',cal:2,p:0,f:0,c:0.5,per:1,fiber:0,iron:10.0,calcium:0,vitc:0,vitd:0,salt:0},

  // ── 主食追加（特殊穀物） ──
  {name:'はと麦（茹で・100g）',yomi:'ハトムギ',tags:'はと麦 雑穀 肌 美容 食物繊維',en:'hatomugi job tears coix seed boiled 100g',cal:170,p:5.8,f:1.5,c:35.0,per:100,fiber:0.6,iron:0.5,calcium:7,vitc:0,vitd:0,salt:0,aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},fa:{sat:0.25,mufa:0.3,n3:0.04,n6:0.3,trans:0.01}},
  {name:'アマランサス（乾燥・大さじ1）',yomi:'アマランサス',tags:'アマランサス スーパーフード 雑穀 グルテンフリー',en:'amaranth seed dry tablespoon',cal:42,p:1.6,f:0.7,c:7.4,per:14,fiber:1.0,iron:0.9,calcium:18,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.02,thr:.04,trp:.01,his:.03,score:0.85},fa:{sat:0.15,mufa:0.25,n3:0.08,n6:0.45,trans:0}},
  {name:'玄米麺（茹で・100g）',yomi:'ゲンマイメン',tags:'玄米麺 グルテンフリー 低GI 麺',en:'brown rice noodles boiled 100g',cal:145,p:2.5,f:0.8,c:32.0,per:100,fiber:1.5,iron:0.5,calcium:8,vitc:0,vitd:0,salt:0,serving:150,aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},fa:{sat:0.25,mufa:0.3,n3:0.04,n6:0.3,trans:0.01}},
  {name:'そば茶（200ml）',yomi:'ソバチャ',tags:'そば茶 飲み物 ノンカフェイン ルチン',en:'buckwheat tea 200ml',cal:3,p:0.1,f:0,c:0.7,per:200,fiber:0,iron:0.1,calcium:2,vitc:0,vitd:0,salt:0,serving:200},

  // ── 調味料・たれ追加 ──
  {name:'テリヤキソース（大さじ1）',yomi:'テリヤキソース',tags:'照り焼き テリヤキ 調味料 たれ',en:'teriyaki sauce tablespoon',cal:28,p:1.0,f:0,c:6.5,per:18,fiber:0,iron:0.2,calcium:5,vitc:0,vitd:0,salt:1.0,aa:{leu:0.08,ile:0.05,val:0.05,lys:0.07,met:0.01,thr:0.04,trp:0.01,his:0.03,score:0.91}},
  {name:'マスタード（粒・小さじ1）',yomi:'マスタード',tags:'マスタード 粒マスタード 調味料',en:'whole grain mustard teaspoon',cal:10,p:0.5,f:0.6,c:0.8,per:5,fiber:0.4,iron:0.2,calcium:15,vitc:1,vitd:0,salt:0.3,fa:{sat:0.1,mufa:0.2,n3:0.1,n6:0.5,trans:0}},
  {name:'スリラチャソース（小さじ1）',yomi:'スリラチャ',tags:'スリラチャ 辛い タイ ホットソース',en:'sriracha hot sauce teaspoon',cal:6,p:0.1,f:0,c:1.5,per:5,fiber:0.1,iron:0.1,calcium:2,vitc:2,vitd:0,salt:0.5},
  {name:'酒粕（大さじ1）',yomi:'サカカス',tags:'酒粕 発酵 日本酒 調味料 甘酒',en:'sake lees tablespoon',cal:52,p:2.5,f:0.5,c:8.0,per:20,fiber:0.4,iron:0.1,calcium:5,vitc:0,vitd:0,salt:0,aa:{leu:0.08,ile:0.04,val:0.05,lys:0.04,met:0.02,thr:0.04,trp:0.01,his:0.02,score:0.59},fa:{sat:0.25,mufa:0.3,n3:0.04,n6:0.3,trans:0.01}},
  {name:'豆腐マヨネーズ（大さじ1）',yomi:'トウフマヨネーズ',tags:'豆腐マヨ 低脂肪 ヴィーガン マヨネーズ代替',en:'tofu mayo vegan mayonnaise tablespoon',cal:28,p:1.5,f:1.5,c:2.0,per:15,fiber:0,iron:0.2,calcium:15,vitc:0,vitd:0,salt:0.3,fa:{sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00},aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.91}},
  {name:'甜麺醤（テンメンジャン・小さじ1）',yomi:'テンメンジャン',tags:'甜麺醤 中華 調味料 回鍋肉',en:'tianmianjiang sweet bean paste teaspoon',cal:20,p:0.8,f:0.5,c:3.2,per:8,fiber:0.3,iron:0.1,calcium:5,vitc:0,vitd:0,salt:0.6,fa:{sat:0.14,mufa:0.24,n3:0.07,n6:0.52,trans:0}},

  // ── ヴィーガン・植物性タンパク ──
  {name:'豆腐ハンバーグ（1個）',yomi:'トウフハンバーグ',tags:'豆腐 ハンバーグ ヴィーガン 植物性',en:'tofu hamburger patty vegan',cal:165,p:9.5,f:7.5,c:16.5,per:150,fiber:2.0,iron:1.5,calcium:85,vitc:2,vitd:0,salt:1.2,fa:{sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00},aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.91}},
  {name:'大豆ミート（乾燥・30g）',yomi:'ダイズミート',tags:'大豆ミート 代替肉 ヴィーガン 植物性 高タンパク',en:'soy meat textured soy protein dry 30g',cal:105,p:16.5,f:2.0,c:8.5,per:30,fiber:3.5,iron:2.5,calcium:80,vitc:0,vitd:0,salt:0.2,serving:30,fa:{sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00},aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.91}},
  {name:'エンドウ豆プロテイン（30g）',yomi:'エンドウマメプロテイン',tags:'エンドウ豆 プロテイン 植物性 ヴィーガン',en:'pea protein powder 30g',cal:110,p:21.5,f:1.5,c:4.5,per:30,fiber:1.0,iron:3.5,calcium:30,vitc:0,vitd:0,salt:0.3,serving:30,aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.82},fa:{sat:0.2,mufa:0.28,n3:0.04,n6:0.16,trans:0.01}},
  {name:'ルウパ（ルッコラ・50g）',yomi:'ルッコラ',tags:'ルッコラ サラダ イタリアン 葉野菜 低カロリー',en:'arugula rocket 50g',cal:11,p:1.3,f:0.4,c:1.6,per:50,fiber:1.6,iron:0.7,calcium:80,vitc:30,vitd:0,salt:0,serving:50,aa:{leu:0.08,ile:0.05,val:0.05,lys:0.06,met:0.02,thr:0.04,trp:0.01,his:0.03,score:0.75}},
  {name:'ビーツ（生・100g）',yomi:'ビーツ',tags:'ビーツ 根菜 鉄分 硝酸塩 スポーツ',en:'beetroot beet raw 100g',cal:43,p:1.6,f:0.1,c:9.6,per:100,fiber:2.8,iron:0.8,calcium:16,vitc:5,vitd:0,salt:0.1,serving:100,aa:{leu:0.08,ile:0.05,val:0.05,lys:0.06,met:0.02,thr:0.04,trp:0.01,his:0.03,score:0.75}},
  {name:'ケール（生・50g）',yomi:'ケール',tags:'ケール スーパーフード 葉野菜 カルシウム',en:'kale raw 50g',cal:29,p:2.0,f:0.4,c:5.3,per:50,fiber:2.5,iron:0.7,calcium:75,vitc:60,vitd:0,salt:0.1,serving:50,aa:{leu:0.08,ile:0.05,val:0.05,lys:0.06,met:0.02,thr:0.04,trp:0.01,his:0.03,score:0.75}},
  {name:'チアプディング（1人前）',yomi:'チアプディング',tags:'チア シード プディング 朝食 低糖質',en:'chia seed pudding 1 serving',cal:185,p:5.5,f:10.5,c:18.5,per:150,fiber:9.5,iron:1.5,calcium:200,vitc:1,vitd:0.2,salt:0.1,serving:150,fa:{sat:.10,mufa:.07,n3:.60,n6:.20,trans:.00},aa:{leu:0.07,ile:0.04,val:0.05,lys:0.03,met:0.02,thr:0.03,trp:0.01,his:0.03,score:0.4}},

  // ── ビール・ハイボール・ワイン ──
  {name:'ビール缶（350ml）',yomi:'ビール',tags:'びーる アルコール 酒 缶',en:'beer can 350ml',cal:140,p:1.1,f:0,c:10.9,per:350,fiber:0,iron:0.1,calcium:11,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'ビール缶（500ml）',yomi:'ビール',tags:'びーる アルコール 酒 缶',en:'beer can 500ml',cal:200,p:1.5,f:0,c:15.5,per:500,fiber:0,iron:0.1,calcium:15,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'アサヒスーパードライ 350ml缶',yomi:'アサヒスーパードライ',tags:'ビール アサヒ スーパードライ アルコール',en:'asahi super dry beer 350ml',cal:147,p:1.4,f:0,c:10.9,per:350,fiber:0,iron:0.1,calcium:11,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'キリン一番搾り 350ml缶',yomi:'イチバンシボリ',tags:'ビール キリン 一番搾り アルコール',en:'kirin ichiban shibori beer 350ml',cal:140,p:1.4,f:0,c:10.5,per:350,fiber:0,iron:0.1,calcium:11,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'サッポロ黒ラベル 350ml缶',yomi:'クロラベル',tags:'ビール サッポロ 黒ラベル アルコール',en:'sapporo black label beer 350ml',cal:140,p:1.4,f:0,c:10.2,per:350,fiber:0,iron:0.1,calcium:11,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'ヱビスビール 350ml缶',yomi:'エビスビール',tags:'ビール サッポロ ヱビス エビス アルコール',en:'yebisu beer 350ml',cal:154,p:1.8,f:0,c:11.6,per:350,fiber:0,iron:0.1,calcium:14,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'ザ・プレミアムモルツ 350ml缶',yomi:'プレミアムモルツ',tags:'ビール サントリー プレモル アルコール',en:'premium malts beer 350ml suntory',cal:147,p:1.4,f:0,c:11.0,per:350,fiber:0,iron:0.1,calcium:11,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'発泡酒 350ml缶',yomi:'ハッポウシュ',tags:'ビール 発泡酒 アルコール',en:'happoshu low malt beer 350ml',cal:154,p:0.4,f:0,c:12.6,per:350,fiber:0,iron:0,calcium:7,vitc:0,vitd:0,salt:0},
  {name:'第三のビール 350ml缶',yomi:'ダイサンビール',tags:'ビール 第三 新ジャンル アルコール',en:'third category beer 350ml',cal:126,p:0.7,f:0,c:10.2,per:350,fiber:0,iron:0,calcium:7,vitc:0,vitd:0,salt:0},
  {name:'ハイボール缶（サントリー角 350ml）',yomi:'ハイボール カク',tags:'ハイボール ウイスキー サントリー 角 アルコール',en:'highball kaku suntory 350ml can',cal:154,p:0,f:0,c:10.5,per:350,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0},
  {name:'ハイボール缶（サントリー角 500ml）',yomi:'ハイボール カク',tags:'ハイボール ウイスキー サントリー 角 アルコール',en:'highball kaku suntory 500ml can',cal:220,p:0,f:0,c:15.0,per:500,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0},
  {name:'ハイボール缶（トリス 350ml）',yomi:'トリスハイボール',tags:'ハイボール トリス サントリー アルコール',en:'tris highball suntory 350ml',cal:133,p:0,f:0,c:7.7,per:350,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0},
  {name:'ハイボール缶（-196℃ レモン 350ml）',yomi:'マイナス196',tags:'チューハイ ハイボール サントリー レモン アルコール',en:'suntory minus196 lemon 350ml',cal:154,p:0,f:0,c:11.9,per:350,fiber:0,iron:0,calcium:0,vitc:9,vitd:0,salt:0},
  {name:'ハイボール（外食 グラス約200ml）',yomi:'ハイボール',tags:'ハイボール ウイスキー 外食 アルコール',en:'highball whisky glass restaurant',cal:88,p:0,f:0,c:6.0,per:200,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0},
  {name:'チューハイ レモン缶（350ml）',yomi:'チューハイ',tags:'チューハイ レモン アルコール サワー',en:'chuhai lemon can 350ml',cal:140,p:0,f:0,c:10.9,per:350,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0},
  {name:'ストロングゼロ（350ml）',yomi:'ストロングゼロ',tags:'チューハイ ストロング サントリー アルコール',en:'strong zero suntory 350ml',cal:98,p:0,f:0,c:0.5,per:350,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0},
  {name:'赤ワイン（グラス125ml）',yomi:'アカワイン',tags:'ワイン 赤 アルコール',en:'red wine glass 125ml',cal:91,p:0.1,f:0,c:1.7,per:125,fiber:0,iron:0.4,calcium:6,vitc:0,vitd:0,salt:0},
  {name:'白ワイン（グラス125ml）',yomi:'シロワイン',tags:'ワイン 白 アルコール',en:'white wine glass 125ml',cal:91,p:0.1,f:0,c:2.5,per:125,fiber:0,iron:0.3,calcium:9,vitc:0,vitd:0,salt:0},
  {name:'スパークリングワイン（グラス125ml）',yomi:'スパークリング シャンパン',tags:'ワイン シャンパン スパークリング アルコール',en:'sparkling wine champagne 125ml',cal:94,p:0.3,f:0,c:3.5,per:125,fiber:0,iron:0.4,calcium:10,vitc:0,vitd:0,salt:0},
  {name:'赤ワイン（ボトル750ml）',yomi:'アカワインボトル',tags:'ワイン 赤 ボトル アルコール',en:'red wine bottle 750ml',cal:548,p:0.8,f:0,c:10.2,per:750,fiber:0,iron:2.4,calcium:36,vitc:0,vitd:0,salt:0},
  {name:'白ワイン（ボトル750ml）',yomi:'シロワインボトル',tags:'ワイン 白 ボトル アルコール',en:'white wine bottle 750ml',cal:548,p:0.8,f:0,c:15.0,per:750,fiber:0,iron:1.8,calcium:54,vitc:0,vitd:0,salt:0},
  {name:'日本酒（1合180ml）',yomi:'ニホンシュ',tags:'にほんしゅ 日本酒 酒 アルコール',en:'sake rice wine 180ml',cal:185,p:0.7,f:0,c:8.2,per:180,fiber:0,iron:0,calcium:4,vitc:0,vitd:0,salt:0},
  {name:'焼酎（ロック 60ml）',yomi:'ショウチュウ',tags:'しょうちゅう 焼酎 酒 アルコール',en:'shochu spirits 60ml',cal:85,p:0,f:0,c:0,per:60,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0},
  {name:'梅酒（グラス100ml）',yomi:'ウメシュ',tags:'うめしゅ 梅酒 酒 アルコール',en:'umeshu plum wine 100ml',cal:155,p:0.1,f:0,c:20.7,per:100,fiber:0,iron:0.1,calcium:5,vitc:1,vitd:0,salt:0},

  // ── 追加バッチ：植物性ミルク ──
  {name:'アーモンドミルク（無糖）',yomi:'アーモンドミルク',tags:'あーもんどみるく 植物性ミルク 豆乳代替',en:'almond milk unsweetened',cal:15,p:0.5,f:1.2,c:0.6,per:200,fiber:0.3,iron:0.1,calcium:60,vitc:0,vitd:0,salt:0.05,aa:{leu:.07,ile:.04,val:.05,lys:.03,met:.02,thr:.03,trp:.01,his:.03,score:0.40},fa:{sat:.08,mufa:.66,n3:.00,n6:.22,trans:.00}},
  {name:'オーツミルク（無糖）',yomi:'オーツミルク',tags:'おーつみるく 植物性ミルク えん麦',en:'oat milk unsweetened',cal:90,p:1.4,f:3.0,c:14.0,per:200,fiber:1.6,iron:0.2,calcium:24,vitc:0,vitd:0,salt:0.1,aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},fa:{sat:.20,mufa:.30,n3:.05,n6:.35,trans:.01}},
  {name:'ココナッツミルク',yomi:'ココナッツミルク',tags:'ここなっつみるく 植物性ミルク エスニック',en:'coconut milk canned',cal:150,p:1.5,f:14.9,c:2.8,per:100,fiber:0,iron:1.0,calcium:16,vitc:1,vitd:0,salt:0,aa:{leu:.07,ile:.04,val:.04,lys:.03,met:.01,thr:.03,trp:.01,his:.02,score:0.40},fa:{sat:.86,mufa:.06,n3:.00,n6:.02,trans:.00}},
  {name:'ライスミルク（無糖）',yomi:'ライスミルク',tags:'らいすみるく 植物性ミルク 米',en:'rice milk unsweetened',cal:47,p:0.3,f:1.0,c:9.2,per:200,fiber:0.2,iron:0.1,calcium:24,vitc:0,vitd:0,salt:0.06,aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59},fa:{sat:.20,mufa:.30,n3:.05,n6:.35,trans:.01}},

  // ── 追加バッチ：チーズ ──
  {name:'チェダーチーズ',yomi:'チェダーチーズ',tags:'ちーず 乳製品',en:'cheddar cheese',cal:390,p:23.9,f:32.1,c:1.4,per:100,fiber:0,iron:0.3,calcium:740,vitc:0,vitd:0.8,salt:2.0,aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22},fa:{sat:.63,mufa:.27,n3:.01,n6:.02,trans:.03}},
  {name:'パルメザンチーズ（粉チーズ）',yomi:'パルメザンチーズ',tags:'ちーず 乳製品 粉チーズ',en:'parmesan cheese grated',cal:445,p:44.0,f:30.8,c:1.9,per:100,fiber:0,iron:0.4,calcium:1300,vitc:0,vitd:0.2,salt:3.8,aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22},fa:{sat:.63,mufa:.27,n3:.01,n6:.02,trans:.03},serving:6},
  {name:'スライスチーズ（1枚）',yomi:'スライスチーズ',tags:'ちーず 乳製品',en:'sliced processed cheese',cal:60,p:3.9,f:4.6,c:1.0,per:18,fiber:0,iron:0.1,calcium:126,vitc:0,vitd:0,salt:0.6,aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22},fa:{sat:.63,mufa:.27,n3:.01,n6:.02,trans:.03},serving:18},
  {name:'カマンベールチーズ',yomi:'カマンベールチーズ',tags:'ちーず 乳製品',en:'camembert cheese',cal:291,p:19.1,f:24.7,c:0.9,per:100,fiber:0,iron:0.2,calcium:460,vitc:0,vitd:0.2,salt:2.0,aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22},fa:{sat:.63,mufa:.27,n3:.01,n6:.02,trans:.03}},
  {name:'ブルーチーズ',yomi:'ブルーチーズ',tags:'ちーず 乳製品',en:'blue cheese',cal:349,p:18.8,f:29.0,c:1.0,per:100,fiber:0,iron:0.3,calcium:590,vitc:0,vitd:0.3,salt:3.8,aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22},fa:{sat:.63,mufa:.27,n3:.01,n6:.02,trans:.03}},

  // ── 追加バッチ：練り物（魚肉加工品） ──
  {name:'かまぼこ（1切れ）',yomi:'カマボコ',tags:'ねりもの 魚肉練り製品',en:'kamaboko fish cake',cal:47,p:6.0,f:0.3,c:5.3,per:50,fiber:0,iron:0.1,calcium:13,vitc:0,vitd:1,salt:1.3,aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:50},
  {name:'ちくわ（1本）',yomi:'チクワ',tags:'ねりもの 魚肉練り製品',en:'chikuwa fish cake tube',cal:60,p:6.5,f:0.6,c:7.4,per:30,fiber:0,iron:0.1,calcium:6,vitc:0,vitd:1,salt:1.1,aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},fa:{sat:.28,mufa:.24,n3:.24,n6:.08,trans:.00},serving:30},
  {name:'はんぺん（1/2枚）',yomi:'ハンペン',tags:'ねりもの 魚肉練り製品',en:'hanpen fish cake',cal:47,p:5.4,f:0.3,c:5.9,per:50,fiber:0,iron:0.2,calcium:8,vitc:0,vitd:1,salt:0.7,aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},serving:50},
  {name:'さつま揚げ（1枚）',yomi:'サツマアゲ',tags:'ねりもの 魚肉練り製品',en:'satsuma-age fried fish cake',cal:68,p:5.6,f:2.1,c:6.7,per:40,fiber:0,iron:0.4,calcium:19,vitc:0,vitd:1,salt:0.7,aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},fa:{sat:.20,mufa:.32,n3:.05,n6:.38,trans:.01},serving:40},

  // ── 追加バッチ：パン ──
  {name:'フランスパン（バゲット・3cm切り1枚）',yomi:'フランスパン',tags:'ぱん バゲット',en:'french bread baguette slice',cal:84,p:2.9,f:0.4,c:16.9,per:30,fiber:0.8,iron:0.2,calcium:5,vitc:0,vitd:0,salt:0.5,aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},fa:{sat:.20,mufa:.30,n3:.05,n6:.35,trans:.01},serving:30},
  {name:'ロールパン（1個）',yomi:'ロールパン',tags:'ぱん',en:'bread roll',cal:95,p:3.0,f:2.7,c:14.6,per:30,fiber:0.6,iron:0.2,calcium:11,vitc:0,vitd:0,salt:0.4,aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},fa:{sat:.20,mufa:.30,n3:.05,n6:.35,trans:.01},serving:30},

  // ── 追加バッチ：スプレッド・調味料 ──
  {name:'ピーナッツバター（大さじ1）',yomi:'ピーナッツバター',tags:'ぴーなっつばたー スプレッド ナッツ',en:'peanut butter',cal:100,p:4.2,f:8.4,c:3.5,per:16,fiber:1.0,iron:0.3,calcium:8,vitc:0,vitd:0,salt:0.1,aa:{leu:.07,ile:.04,val:.05,lys:.03,met:.01,thr:.03,trp:.01,his:.03,score:0.40},fa:{sat:.17,mufa:.46,n3:.00,n6:.32,trans:.00},serving:16},
  {name:'いちごジャム（大さじ1）',yomi:'イチゴジャム',tags:'じゃむ スプレッド',en:'strawberry jam',cal:54,p:0.1,f:0,c:13.5,per:21,fiber:0.2,iron:0.1,calcium:2,vitc:2,vitd:0,salt:0,serving:21},
  {name:'こしあん（大さじ2）',yomi:'コシアン',tags:'あんこ 和菓子',en:'sweet red bean paste smooth',cal:65,p:1.7,f:0.1,c:14.5,per:30,fiber:1.3,iron:0.4,calcium:5,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.72},serving:30},

  // ── 追加バッチ：野菜 ──
  {name:'たけのこ（水煮）',yomi:'タケノコ',tags:'たけのこ 野菜',en:'bamboo shoot boiled',cal:22,p:2.4,f:0.2,c:4.3,per:100,fiber:2.8,iron:0.4,calcium:16,vitc:5,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'春菊',yomi:'シュンギク',tags:'しゅんぎく 野菜 葉物',en:'chrysanthemum greens shungiku',cal:20,p:2.3,f:0.3,c:3.9,per:100,fiber:3.2,iron:1.7,calcium:120,vitc:19,vitd:0,salt:0.2,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'チンゲン菜',yomi:'チンゲンサイ',tags:'ちんげんさい 野菜 葉物',en:'bok choy',cal:9,p:0.6,f:0.1,c:2.0,per:100,fiber:1.2,iron:1.1,calcium:100,vitc:24,vitd:0,salt:0.1},
  {name:'カリフラワー（生）',yomi:'カリフラワー',tags:'かりふらわー 野菜',en:'cauliflower raw',cal:28,p:3.0,f:0.1,c:5.2,per:100,fiber:2.9,iron:0.6,calcium:24,vitc:81,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'みょうが',yomi:'ミョウガ',tags:'みょうが 薬味',en:'myoga japanese ginger',cal:12,p:0.9,f:0.1,c:2.6,per:100,fiber:2.1,iron:0.5,calcium:25,vitc:2,vitd:0,salt:0},

  // ── 追加バッチ：果物 ──
  {name:'柿',yomi:'カキ',tags:'かき 果物',en:'persimmon',cal:60,p:0.4,f:0.2,c:15.9,per:100,fiber:1.6,iron:0.2,calcium:9,vitc:70,vitd:0,salt:0},
  {name:'梨',yomi:'ナシ',tags:'なし 果物',en:'japanese pear',cal:43,p:0.3,f:0.1,c:11.3,per:100,fiber:0.9,iron:0,calcium:2,vitc:3,vitd:0,salt:0},
  {name:'さくらんぼ',yomi:'サクランボ',tags:'さくらんぼ チェリー 果物',en:'cherry',cal:64,p:1.0,f:0.2,c:15.2,per:100,fiber:1.2,iron:0.3,calcium:13,vitc:10,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'プルーン（ドライ）',yomi:'プルーン',tags:'ぷるーん ドライフルーツ 果物',en:'dried prune',cal:235,p:2.4,f:0.2,c:62.3,per:100,fiber:7.1,iron:1.0,calcium:57,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'干し柿',yomi:'ホシガキ',tags:'ほしがき ドライフルーツ 果物',en:'dried persimmon',cal:274,p:1.5,f:1.7,c:71.3,per:100,fiber:14.0,iron:0.6,calcium:27,vitc:2,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},fa:{sat:.20,mufa:.15,n3:.20,n6:.40,trans:.00}},

  // ── 追加バッチ：肉（部位追加） ──
  {name:'豚肩ロース（生）',yomi:'ブタカタロース',tags:'ぶた 肉',en:'pork shoulder loin raw',cal:237,p:17.1,f:19.2,c:0.1,per:100,fiber:0,iron:0.6,calcium:4,vitc:1,vitd:0.3,salt:0.1,aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:0.98},fa:{sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01}},
  {name:'鶏手羽先（生）',yomi:'トリテバサキ',tags:'とり 鶏 肉 手羽先',en:'chicken wing raw',cal:211,p:17.4,f:16.2,c:0,per:100,fiber:0,iron:0.6,calcium:14,vitc:1,vitd:0.4,salt:0.2,aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08},fa:{sat:.31,mufa:.44,n3:.03,n6:.18,trans:.01}},
  {name:'鶏手羽元（生）',yomi:'トリテバモト',tags:'とり 鶏 肉 手羽元',en:'chicken drumette raw',cal:175,p:18.2,f:12.8,c:0,per:100,fiber:0,iron:0.6,calcium:10,vitc:1,vitd:0.3,salt:0.1,aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08},fa:{sat:.31,mufa:.44,n3:.03,n6:.18,trans:.01}},
  {name:'牛カルビ（バラ肉・生）',yomi:'ギュウカルビ',tags:'ぎゅう 牛 肉 焼肉',en:'beef short rib raw',cal:454,p:11.0,f:44.4,c:0.1,per:100,fiber:0,iron:1.0,calcium:4,vitc:1,vitd:0,salt:0.1,aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00},fa:{sat:.47,mufa:.43,n3:.01,n6:.05,trans:.02}},
  {name:'牛サーロイン（生）',yomi:'ギュウサーロイン',tags:'ぎゅう 牛 肉 ステーキ',en:'beef sirloin raw',cal:298,p:16.5,f:25.8,c:0.4,per:100,fiber:0,iron:0.9,calcium:3,vitc:1,vitd:0,salt:0.1,aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00},fa:{sat:.47,mufa:.43,n3:.01,n6:.05,trans:.02}},

  // ── 追加バッチ：魚（種類追加） ──
  {name:'ぶり（生）',yomi:'ブリ',tags:'ぶり 魚',en:'yellowtail raw',cal:257,p:21.4,f:17.6,c:0.3,per:100,fiber:0,iron:1.3,calcium:5,vitc:2,vitd:8.0,salt:0.1,aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},fa:{sat:.24,mufa:.39,n3:.21,n6:.06,trans:.00}},
  {name:'しじみ（生）',yomi:'シジミ',tags:'しじみ 貝 魚介',en:'shijimi clam raw',cal:54,p:7.5,f:1.4,c:4.5,per:100,fiber:0,iron:8.3,calcium:240,vitc:2,vitd:0.2,salt:0.4,aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},fa:{sat:.28,mufa:.24,n3:.24,n6:.08,trans:.00}},
  {name:'ホッケ（生）',yomi:'ホッケ',tags:'ほっけ 魚 干物',en:'atka mackerel',cal:161,p:18.7,f:8.9,c:0.1,per:100,fiber:0,iron:0.6,calcium:12,vitc:1,vitd:5.0,salt:0.3,aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},fa:{sat:.25,mufa:.29,n3:.31,n6:.04,trans:.00}},

  // ── 追加バッチ：穀物粉・その他 ──
  {name:'白玉粉（大さじ2）',yomi:'シラタマコ',tags:'しらたまこ 米粉 和菓子材料',en:'shiratamako sweet rice flour',cal:69,p:1.3,f:0.2,c:16.2,per:18,fiber:0.1,iron:0.1,calcium:2,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59},serving:18},
  {name:'上新粉（大さじ2）',yomi:'ジョウシンコ',tags:'じょうしんこ 米粉 和菓子材料',en:'joshinko rice flour',cal:65,p:1.1,f:0.2,c:14.8,per:18,fiber:0.1,iron:0.1,calcium:1,vitc:0,vitd:0,salt:0,aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59},serving:18},
  {name:'焼き芋',yomi:'ヤキイモ',tags:'やきいも さつまいも 間食',en:'roasted sweet potato yaki-imo',cal:151,p:1.4,f:0.2,c:36.7,per:100,fiber:3.5,iron:0.6,calcium:36,vitc:23,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'ダークチョコレート（高カカオ・1片5g）',yomi:'ダークチョコレート',tags:'ちょこ 高カカオ おやつ',en:'dark chocolate high cacao',cal:29,p:0.6,f:2.1,c:2.1,per:5,fiber:0.6,iron:0.4,calcium:3,vitc:0,vitd:0,salt:0,fa:{sat:.55,mufa:.30,n3:.01,n6:.10,trans:.02},serving:5},
  {name:'エスプレッソ（1ショット・30ml）',yomi:'エスプレッソ',tags:'こーひー エスプレッソ',en:'espresso shot',cal:2,p:0.2,f:0,c:0.3,per:30,fiber:0,iron:0,calcium:2,vitc:0,vitd:0,salt:0,serving:30},
  {name:'カフェオレ（無糖・牛乳入り200ml）',yomi:'カフェオレ',tags:'こーひー カフェオレ',en:'cafe au lait unsweetened',cal:75,p:3.8,f:4.0,c:5.6,per:200,fiber:0,iron:0,calcium:132,vitc:0,vitd:0,salt:0.1,aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22},fa:{sat:.62,mufa:.28,n3:.01,n6:.02,trans:.03}},

  // ── 追加バッチ2：薬味・葉物野菜 ──
  {name:'大葉（青じそ・10枚）',yomi:'オオバ',tags:'おおば しそ 薬味 香味野菜',en:'shiso perilla leaf',cal:3,p:0.4,f:0.0,c:0.8,per:10,fiber:0.7,iron:0.2,calcium:23,vitc:3,vitd:0,salt:0,serving:10},
  {name:'モロヘイヤ（茹で）',yomi:'モロヘイヤ',tags:'もろへいや 野菜 葉物',en:'molokhia jute mallow boiled',cal:25,p:2.6,f:0.4,c:4.1,per:100,fiber:3.5,iron:0.9,calcium:170,vitc:6,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75}},
  {name:'空心菜炒め（1人前）',yomi:'クウシンサイイタメ',tags:'くうしんさい エスニック 野菜炒め',en:'stir-fried water spinach',cal:75,p:2.6,f:5.2,c:4.2,per:100,fiber:2.2,iron:1.6,calcium:78,vitc:15,vitd:0,salt:0.9,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},fa:{sat:.15,mufa:.29,n3:.07,n6:.47,trans:.00}},
  {name:'柚子果汁（小さじ1）',yomi:'ユズカジュウ',tags:'ゆず 柑橘 薬味',en:'yuzu juice',cal:1,p:0.0,f:0.0,c:0.4,per:5,fiber:0,iron:0,calcium:0,vitc:4,vitd:0,salt:0,serving:5},

  // ── 追加バッチ2：肉料理 ──
  {name:'つくね（1本）',yomi:'ツクネ',tags:'つくね 鶏 焼き鳥',en:'tsukune chicken meatball skewer',cal:65,p:5.4,f:4.0,c:2.0,per:30,fiber:0.1,iron:0.4,calcium:10,vitc:0,vitd:0.1,salt:0.4,aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08},fa:{sat:.31,mufa:.44,n3:.03,n6:.18,trans:.01},serving:30},
  {name:'レバニラ炒め（1人前）',yomi:'レバニライタメ',tags:'ればにら 豚 肉 中華',en:'stir-fried liver and chives',cal:320,p:20.0,f:20.0,c:12.0,per:200,fiber:2.0,iron:9.0,calcium:40,vitc:15,vitd:0.8,salt:2.5,aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:0.98},fa:{sat:.30,mufa:.35,n3:.03,n6:.25,trans:.01}},
  {name:'鶏の竜田揚げ（4個）',yomi:'トリノタツタアゲ',tags:'たつたあげ 鶏 揚げ物',en:'chicken tatsuta-age fried',cal:280,p:18.0,f:19.0,c:10.0,per:100,fiber:0.3,iron:0.7,calcium:10,vitc:0,vitd:0.1,salt:1.0,aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08},fa:{sat:.28,mufa:.42,n3:.03,n6:.20,trans:.01}},
  {name:'ロールキャベツ（1個）',yomi:'ロールキャベツ',tags:'ろーるきゃべつ 洋食 煮込み',en:'stuffed cabbage roll',cal:150,p:8.0,f:9.0,c:8.0,per:150,fiber:2.0,iron:1.0,calcium:35,vitc:20,vitd:0.1,salt:1.2,aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:0.98},fa:{sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01},serving:150},
  {name:'油淋鶏（ユーリンチー・1人前）',yomi:'ユーリンチー',tags:'ゆーりんち— 鶏 中華 揚げ物',en:'yurinchi fried chicken chinese sauce',cal:420,p:22.0,f:26.0,c:22.0,per:200,fiber:1.0,iron:1.0,calcium:20,vitc:5,vitd:0.2,salt:2.0,aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08},fa:{sat:.28,mufa:.42,n3:.03,n6:.20,trans:.01}},
  {name:'よだれ鶏（1人前）',yomi:'ヨダレドリ',tags:'よだれどり 鶏 中華 四川',en:'yodare-dori sichuan chicken',cal:280,p:26.0,f:16.0,c:8.0,per:150,fiber:0.8,iron:0.8,calcium:15,vitc:3,vitd:0.2,salt:2.5,aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08},fa:{sat:.25,mufa:.30,n3:.05,n6:.35,trans:.00}},

  // ── 追加バッチ2：魚介 ──
  {name:'ホタルイカ（ボイル）',yomi:'ホタルイカ',tags:'ほたるいか 魚介 珍味',en:'firefly squid boiled',cal:42,p:5.9,f:1.8,c:2.3,per:50,fiber:0,iron:0.4,calcium:8,vitc:1,vitd:0.6,salt:0.3,aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},fa:{sat:.30,mufa:.18,n3:.28,n6:.10,trans:.00},serving:50},
  {name:'あじの南蛮漬け（1人前）',yomi:'アジノナンバンヅケ',tags:'なんばんづけ あじ 魚 揚げ物',en:'nanban-zuke marinated fried horse mackerel',cal:220,p:14.0,f:11.0,c:14.0,per:120,fiber:0.8,iron:0.8,calcium:40,vitc:8,vitd:2.0,salt:1.3,aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},fa:{sat:.25,mufa:.30,n3:.15,n6:.20,trans:.01},serving:120},

  // ── 追加バッチ2：中華まん ──
  {name:'肉まん（豚まん・1個）',yomi:'ニクマン',tags:'にくまん ぶたまん 中華まん コンビニ',en:'pork bun nikuman',cal:220,p:7.5,f:6.5,c:33.0,per:80,fiber:1.5,iron:1.0,calcium:20,vitc:0,vitd:0.1,salt:1.0,aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:0.98},fa:{sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01},serving:80},
  {name:'あんまん（1個）',yomi:'アンマン',tags:'あんまん 中華まん コンビニ',en:'sweet bean bun anman',cal:230,p:5.0,f:3.0,c:46.0,per:80,fiber:2.0,iron:1.0,calcium:15,vitc:0,vitd:0,salt:0.2,aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.72},fa:{sat:.25,mufa:.30,n3:.04,n6:.30,trans:.01},serving:80},
  {name:'ピザまん（1個）',yomi:'ピザマン',tags:'ぴざまん 中華まん コンビニ',en:'pizza bun',cal:250,p:8.0,f:9.0,c:33.0,per:90,fiber:1.5,iron:0.8,calcium:60,vitc:1,vitd:0.2,salt:1.3,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},fa:{sat:.35,mufa:.35,n3:.02,n6:.20,trans:.02},serving:90},

  // ── 追加バッチ2：家庭の副菜・惣菜 ──
  {name:'きんぴらごぼう（1人前）',yomi:'キンピラゴボウ',tags:'きんぴら ごぼう 和食 副菜',en:'kinpira gobo braised burdock root',cal:90,p:1.5,f:4.5,c:11.0,per:70,fiber:3.5,iron:0.5,calcium:25,vitc:2,vitd:0,salt:0.8,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},fa:{sat:.15,mufa:.39,n3:.00,n6:.43,trans:.00},serving:70},
  {name:'大学芋（1人前）',yomi:'ダイガクイモ',tags:'だいがくいも さつまいも 揚げ物 おやつ',en:'daigaku-imo candied fried sweet potato',cal:220,p:1.0,f:6.0,c:40.0,per:100,fiber:2.3,iron:0.5,calcium:30,vitc:15,vitd:0,salt:0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},fa:{sat:.20,mufa:.32,n3:.05,n6:.38,trans:.01}},
  {name:'白和え（1人前）',yomi:'シラアエ',tags:'しらあえ 豆腐 和食 副菜',en:'shira-ae tofu dressed vegetables',cal:90,p:5.5,f:4.5,c:7.0,per:80,fiber:2.5,iron:1.2,calcium:90,vitc:8,vitd:0,salt:0.6,aa:{leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.91},fa:{sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00},serving:80},
  {name:'酢の物（きゅうりとわかめ・1人前）',yomi:'スノモノ',tags:'すのもの 和食 副菜',en:'sunomono cucumber wakame vinegar salad',cal:25,p:1.2,f:0.2,c:4.5,per:60,fiber:1.0,iron:0.3,calcium:20,vitc:5,vitd:0,salt:0.7,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},serving:60},
  {name:'ジャーマンポテト（1人前）',yomi:'ジャーマンポテト',tags:'じゃーまんぽてと 洋食 副菜',en:'german potato bacon saute',cal:220,p:4.5,f:12.0,c:22.0,per:150,fiber:2.5,iron:0.8,calcium:15,vitc:15,vitd:0.1,salt:1.0,aa:{leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},fa:{sat:.35,mufa:.35,n3:.02,n6:.20,trans:.01},serving:150},

  // ── 追加バッチ2：パスタ・洋食・エスニック ──
  {name:'カルボナーラ（1人前）',yomi:'カルボナーラ',tags:'ぱすた 洋食 卵 チーズ',en:'spaghetti carbonara',cal:650,p:22.0,f:30.0,c:65.0,per:300,fiber:3.0,iron:1.5,calcium:200,vitc:0,vitd:0.5,salt:3.0,aa:{leu:.09,ile:.06,val:.07,lys:.09,met:.03,thr:.06,trp:.02,his:.03,score:1.13},fa:{sat:.45,mufa:.30,n3:.02,n6:.15,trans:.02}},
  {name:'たらこスパゲッティ（1人前）',yomi:'タラコスパゲッティ',tags:'ぱすた 和風パスタ たらこ',en:'cod roe spaghetti tarako pasta',cal:480,p:18.0,f:14.0,c:68.0,per:300,fiber:3.0,iron:1.0,calcium:30,vitc:5,vitd:1.0,salt:3.0,aa:{leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},fa:{sat:.30,mufa:.35,n3:.05,n6:.25,trans:.01}},
  {name:'ロコモコ（1人前）',yomi:'ロコモコ',tags:'ろこもこ ハワイアン ハンバーグ 卵',en:'loco moco hawaiian',cal:650,p:28.0,f:35.0,c:55.0,per:400,fiber:3.0,iron:3.5,calcium:80,vitc:10,vitd:0.5,salt:2.5,aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00},fa:{sat:.35,mufa:.40,n3:.02,n6:.20,trans:.02}},
  {name:'タコライス（1人前）',yomi:'タコライス',tags:'たこらいす 沖縄 ひき肉',en:'taco rice okinawan',cal:600,p:22.0,f:25.0,c:65.0,per:400,fiber:4.0,iron:2.5,calcium:150,vitc:15,vitd:0.2,salt:2.3,aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00},fa:{sat:.35,mufa:.35,n3:.02,n6:.20,trans:.02}},
  {name:'カプレーゼ（1人前）',yomi:'カプレーゼ',tags:'かぷれーぜ イタリアン トマト モッツァレラ',en:'caprese salad tomato mozzarella',cal:220,p:11.0,f:17.0,c:5.0,per:120,fiber:1.5,iron:0.3,calcium:250,vitc:12,vitd:0,salt:1.0,aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22},fa:{sat:.55,mufa:.35,n3:.02,n6:.06,trans:.02},serving:120},
  {name:'きのこのリゾット（1人前）',yomi:'キノコノリゾット',tags:'りぞっと イタリアン 米',en:'mushroom risotto',cal:420,p:12.0,f:16.0,c:55.0,per:300,fiber:2.5,iron:1.0,calcium:120,vitc:3,vitd:0.5,salt:2.0,aa:{leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22},fa:{sat:.45,mufa:.30,n3:.02,n6:.15,trans:.02}},
  {name:'パニーニ（ハムチーズ・1個）',yomi:'パニーニ',tags:'ぱにーに イタリアン サンドイッチ',en:'panini ham cheese',cal:480,p:22.0,f:22.0,c:48.0,per:200,fiber:2.5,iron:1.5,calcium:250,vitc:2,vitd:0.2,salt:2.8,aa:{leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:0.98},fa:{sat:.35,mufa:.35,n3:.02,n6:.20,trans:.02},serving:200},

  // ── 追加バッチ2：漬物・飲み物 ──
  {name:'野沢菜漬け（1人前）',yomi:'ノザワナヅケ',tags:'のざわな 漬物 信州',en:'nozawana pickled greens',cal:6,p:0.6,f:0.1,c:1.2,per:30,fiber:0.6,iron:0.2,calcium:15,vitc:4,vitd:0,salt:0.8,serving:30},
  {name:'高菜漬け（1人前）',yomi:'タカナヅケ',tags:'たかな 漬物 九州',en:'takana pickled mustard greens',cal:10,p:0.9,f:0.2,c:1.7,per:30,fiber:0.8,iron:0.3,calcium:25,vitc:5,vitd:0,salt:1.2,serving:30},
  {name:'福神漬け（1人前）',yomi:'フクジンヅケ',tags:'ふくじんづけ 漬物 カレーの薬味',en:'fukujinzuke pickled vegetables',cal:20,p:0.4,f:0.1,c:4.6,per:15,fiber:0.5,iron:0.1,calcium:5,vitc:0,vitd:0,salt:0.8,serving:15},
  {name:'紅茶（ストレート・200ml）',yomi:'コウチャ',tags:'こうちゃ お茶 飲み物',en:'black tea unsweetened',cal:1,p:0.1,f:0,c:0.3,per:200,fiber:0,iron:0,calcium:2,vitc:0,vitd:0,salt:0},
  {name:'ウーロン茶（200ml）',yomi:'ウーロンチャ',tags:'うーろんちゃ お茶 飲み物',en:'oolong tea',cal:0,p:0,f:0,c:0,per:200,fiber:0,iron:0,calcium:4,vitc:0,vitd:0,salt:0},

  // ── 追加バッチ3：乾麺（ジャンル単位・銘柄不問） ──
  {name:'そば（二八・茹で）',yomi:'ソバニハチ',tags:'そば 二八そば 乾麺',en:'soba noodle nihachi 80% buckwheat boiled',cal:132,p:5.5,f:1.3,c:25.5,per:100,fiber:3.0,iron:1.1,calcium:12,vitc:0,vitd:0,salt:0,fa:{sat:.25,mufa:.30,n3:.04,n6:.30,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},serving:180},
  {name:'そば（十割・茹で）',yomi:'ソバジュウワリ',tags:'そば 十割そば 乾麺',en:'soba noodle juwari 100% buckwheat boiled',cal:135,p:6.0,f:1.8,c:25.0,per:100,fiber:3.5,iron:1.3,calcium:15,vitc:0,vitd:0,salt:0,fa:{sat:.25,mufa:.30,n3:.04,n6:.30,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},serving:180},
  {name:'そうめん（茹で）',yomi:'ソウメン',tags:'そうめん 乾麺 素麺',en:'somen noodle boiled',cal:127,p:3.5,f:0.4,c:26.0,per:100,fiber:0.9,iron:0.2,calcium:6,vitc:0,vitd:0,salt:0.2,fa:{sat:.25,mufa:.30,n3:.04,n6:.30,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},serving:200},
  {name:'ひやむぎ（茹で）',yomi:'ヒヤムギ',tags:'ひやむぎ 乾麺',en:'hiyamugi noodle boiled',cal:127,p:3.4,f:0.5,c:26.1,per:100,fiber:1.1,iron:0.2,calcium:6,vitc:0,vitd:0,salt:0.2,fa:{sat:.25,mufa:.30,n3:.04,n6:.30,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},serving:200},
  {name:'中華麺（生・蒸し）',yomi:'チュウカメン',tags:'ちゅうかめん 中華麺 ラーメン用',en:'chinese style noodle steamed',cal:162,p:4.7,f:0.6,c:34.4,per:100,fiber:2.6,iron:0.6,calcium:12,vitc:0,vitd:0,salt:0.4,fa:{sat:.25,mufa:.30,n3:.04,n6:.30,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},serving:150},
  {name:'マカロニ（茹で）',yomi:'マカロニ',tags:'まかろに 乾麺 パスタ',en:'macaroni boiled',cal:150,p:5.8,f:0.9,c:29.2,per:100,fiber:1.7,iron:0.7,calcium:8,vitc:0,vitd:0,salt:0,fa:{sat:.25,mufa:.30,n3:.04,n6:.30,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45}},
  {name:'ビーフン（茹で）',yomi:'ビーフン',tags:'びーふん 乾麺 米粉麺',en:'bee hoon rice vermicelli boiled',cal:109,p:1.9,f:0.3,c:25.0,per:100,fiber:0.9,iron:0.1,calcium:3,vitc:0,vitd:0,salt:0,fa:{sat:.20,mufa:.30,n3:.04,n6:.30,trans:.01},aa:{leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59}},

  // ── 追加バッチ3：袋麺（フレーバー・銘柄により栄養価が異なるため個別登録） ──
  {name:'マルちゃん正麺（味噌）',yomi:'マルチャンセイメンミソ',tags:'ラーメン 袋麺 東洋水産 マルちゃん みそ',en:'maruchan seimen miso ramen',cal:430,p:10.5,f:16.0,c:62.0,per:112,fiber:2.2,iron:1.1,calcium:60,vitc:0,vitd:0,salt:6.0,fa:{sat:.25,mufa:.30,n3:.04,n6:.30,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},serving:112},
  {name:'マルちゃん正麺（豚骨）',yomi:'マルチャンセイメントンコツ',tags:'ラーメン 袋麺 東洋水産 マルちゃん 豚骨',en:'maruchan seimen tonkotsu ramen',cal:450,p:10.2,f:18.0,c:60.0,per:112,fiber:2.0,iron:1.0,calcium:55,vitc:0,vitd:0,salt:5.8,fa:{sat:.25,mufa:.30,n3:.04,n6:.30,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},serving:112},
  {name:'マルちゃん正麺（塩）',yomi:'マルチャンセイメンシオ',tags:'ラーメン 袋麺 東洋水産 マルちゃん 塩',en:'maruchan seimen shio ramen',cal:400,p:9.0,f:13.0,c:60.0,per:100,fiber:2.0,iron:0.9,calcium:50,vitc:0,vitd:0,salt:5.5,fa:{sat:.25,mufa:.30,n3:.04,n6:.30,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},serving:100},
  {name:'サッポロ一番醤油味（サンヨー食品）',yomi:'サッポロイチバンショウユ',tags:'インスタントラーメン 袋麺 サッポロ 醤油',en:'sapporo ichiban shoyu ramen',cal:456,p:10.0,f:17.0,c:64.0,per:100,fiber:2.0,iron:1.1,calcium:80,vitc:0,vitd:0,salt:5.8,fa:{sat:.25,mufa:.30,n3:.04,n6:.30,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},serving:100},
  {name:'出前一丁（日清）',yomi:'デマエイッチョウ',tags:'インスタントラーメン 袋麺 日清',en:'demae itcho ramen nissin',cal:440,p:9.0,f:17.5,c:60.0,per:100,fiber:1.9,iron:1.0,calcium:70,vitc:0,vitd:0,salt:5.6,fa:{sat:.25,mufa:.30,n3:.04,n6:.30,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},serving:100},
  {name:'中華三昧 醤油（明星）',yomi:'チュウカザンマイショウユ',tags:'インスタントラーメン 袋麺 明星 醤油',en:'chuka sanmai shoyu ramen myojo',cal:420,p:9.5,f:14.0,c:62.0,per:105,fiber:2.0,iron:1.0,calcium:60,vitc:0,vitd:0,salt:5.5,fa:{sat:.25,mufa:.30,n3:.04,n6:.30,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},serving:105},
  {name:'ワンタンメン（エースコック）',yomi:'ワンタンメン',tags:'インスタントラーメン 袋麺 エースコック',en:'wantanmen ace cook',cal:430,p:9.5,f:14.5,c:65.0,per:99,fiber:2.0,iron:1.0,calcium:65,vitc:0,vitd:0,salt:6.0,fa:{sat:.25,mufa:.30,n3:.04,n6:.30,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},serving:99},
  {name:'ラ王 味噌（日清）',yomi:'ラオウミソ',tags:'ラーメン 袋麺 日清 味噌 生麺タイプ',en:'ramen raoh miso nissin',cal:410,p:10.5,f:13.0,c:60.0,per:118,fiber:2.5,iron:1.0,calcium:55,vitc:0,vitd:0,salt:5.8,fa:{sat:.25,mufa:.30,n3:.04,n6:.30,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},serving:118},
  {name:'ラ王 豚骨（日清）',yomi:'ラオウトンコツ',tags:'ラーメン 袋麺 日清 豚骨 生麺タイプ',en:'ramen raoh tonkotsu nissin',cal:420,p:10.2,f:14.0,c:58.0,per:118,fiber:2.3,iron:0.9,calcium:50,vitc:0,vitd:0,salt:5.9,fa:{sat:.25,mufa:.30,n3:.04,n6:.30,trans:.01},aa:{leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},serving:118},
];
LOCAL_DB.forEach(f => {
  f._search = normalize(f.name)+' '+normalize(f.yomi||'')+' '+normalize(f.tags||'')+' '+(f.en||'').toLowerCase();
  f._src = 'local';
});

// ── State ──
let entries = [], customFoods = [], comboFoods = [], exercises = [];
let userWeight = 65, statsPeriod = 'today', chartMode = 'raw';
let calChart = null, pfcChart = null;
let searchTimer = null, comboTimer = null, apiAbort = null;
let comboIngredients = [], editingId = null, activeAddMeal = null, exPanelOpen = false;
let calViewYear = new Date().getFullYear(), calViewMonth = new Date().getMonth();
let currentDate = toDateStr(new Date());
let ghToken = null, ghData = {}; // Google Health API
let deferredPrompt = null;
let profile = { sex:'male', age:30, height:170, weight:65, bf:null, activityFactor:1.2, temp:22 };

// Firebase state
let fbUser = null;   // 現在ログイン中のユーザー
let fbDb  = null;    // Firestore インスタンス
let fbAuth = null;   // Auth インスタンス
let fbSyncing = false;

// localStorage からローカルキャッシュ読み込み（オフライン時のフォールバック）
try { entries     = JSON.parse(localStorage.getItem('pfcEntries')    || '[]'); } catch(e) {}
try { customFoods = JSON.parse(localStorage.getItem('pfcCustomFoods')|| '[]'); } catch(e) {}
try { comboFoods  = JSON.parse(localStorage.getItem('pfcComboFoods') || '[]'); } catch(e) {}
try { exercises   = JSON.parse(localStorage.getItem('pfcExercises')  || '[]'); } catch(e) {}
try { userWeight  = parseFloat(localStorage.getItem('pfcWeight') || '65'); } catch(e) {}
try { ghToken     = localStorage.getItem('ghToken') || null; } catch(e) {}
try { ghData      = JSON.parse(localStorage.getItem('ghData') || '{}'); } catch(e) {}
try { const p = JSON.parse(localStorage.getItem('pfcProfile') || 'null'); if(p) profile = {...profile, ...p}; } catch(e) {}

function toDateStr(d) { return d.toISOString().split('T')[0]; }
function fmtDate(s) { const d = new Date(s+'T00:00:00'); return d.toLocaleDateString('ja-JP',{month:'long',day:'numeric',weekday:'short'}); }
function isToday(s) { return s === toDateStr(new Date()); }
function r1(n) { return Math.round(n*10)/10; }
function r2(n) { return Math.round(n*100)/100; }
function ri(n) { return Math.round(n); }

// ローカル保存（常に実行 — オフライン時のキャッシュ）
function saveLocal() {
  try { localStorage.setItem('pfcEntries',     JSON.stringify(entries));     } catch(e) {}
  try { localStorage.setItem('pfcExercises',   JSON.stringify(exercises));   } catch(e) {}
  try { localStorage.setItem('pfcCustomFoods', JSON.stringify(customFoods)); } catch(e) {}
  try { localStorage.setItem('pfcComboFoods',  JSON.stringify(comboFoods));  } catch(e) {}
}

// Firestore への保存（ログイン済みの場合）
// 全データを1ドキュメントにまとめて保存（シンプル設計）
async function saveToCloud() {
  if (!fbDb || !fbUser) return;
  try {
    const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    await setDoc(doc(fbDb, 'users', fbUser.uid), {
      entries,
      exercises,
      customFoods,
      comboFoods,
      profile,
      updatedAt: new Date().toISOString(),
    });
  } catch(e) { console.warn('Cloud save failed:', e); }
}

// ローカル＋クラウドへ同時保存
function save() { saveLocal(); saveToCloud(); }
function saveCustom() { saveLocal(); saveToCloud(); }
function saveExercises() { saveLocal(); saveToCloud(); }
function saveGhData() { try { localStorage.setItem('ghData', JSON.stringify(ghData)); } catch(e) {} }
function saveProfile() {
  profile.sex    = document.getElementById('pSex').value;
  profile.age    = parseInt(document.getElementById('pAge').value)    || 30;
  profile.height = parseFloat(document.getElementById('pHeight').value) || 170;
  profile.weight = parseFloat(document.getElementById('pWeight').value) || 65;
  const bf = parseFloat(document.getElementById('pBF').value);
  profile.bf   = isNaN(bf) ? null : bf;
  profile.temp = parseFloat(document.getElementById('pTemp').value) || 22;
  try { localStorage.setItem('pfcProfile', JSON.stringify(profile)); } catch(e) {}
  saveToCloud();
  renderBmrPreview();
}
function setGoalMode(mode) {
  profile.goalMode = mode;
  document.querySelectorAll('.goal-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  const customPanel = document.getElementById('customGoalPanel');
  if (customPanel) customPanel.style.display = mode === 'custom' ? 'block' : 'none';
  if (mode !== 'custom') {
    // プリセット時は自動計算値でプレビュー更新
    const g = goals();
    ['Cal','P','F','C'].forEach(k => {
      const el = document.getElementById('pGoal'+k);
      if (el) el.value = g[k.toLowerCase()];
    });
  }
  saveGoalSettings();
  renderBmrPreview();
}
function saveGoalSettings() {
  const mode = profile.goalMode || 'normal';
  if (mode === 'custom') {
    profile.customGoal = {
      cal: parseFloat(document.getElementById('pGoalCal').value) || calcTDEE(),
      p:   parseFloat(document.getElementById('pGoalP').value)   || 100,
      f:   parseFloat(document.getElementById('pGoalF').value)   || 60,
      c:   parseFloat(document.getElementById('pGoalC').value)   || 200,
    };
  }
  try { localStorage.setItem('pfcProfile', JSON.stringify(profile)); } catch(e) {}
  saveToCloud();
  renderBmrPreview();
}
function setActivity(el) {
  document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  profile.activityFactor = parseFloat(el.dataset.val);
  saveProfile();
}

function initGoalUI() {
  const mode = profile.goalMode || 'normal';
  document.querySelectorAll('.goal-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  const customPanel = document.getElementById('customGoalPanel');
  if (customPanel) customPanel.style.display = mode === 'custom' ? 'block' : 'none';
  const g = goals();
  ['Cal','P','F','C'].forEach(k => {
    const el = document.getElementById('pGoal'+k);
    if (el) el.value = (profile.customGoal && mode === 'custom') ? profile.customGoal[k.toLowerCase()] : g[k.toLowerCase()];
  });
  updateGoalModeDesc(mode);
  updateGoalPreview();
}
function updateGoalModeDesc(mode) {
  ['normal','recomp','custom'].forEach(m => {
    const el = document.querySelector('.goal-desc-'+m);
    if (el) el.style.display = m === mode ? '' : 'none';
  });
}
function updateGoalPreview() {
  const g = goals();
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('goalPreviewCal', g.cal);
  setEl('goalPreviewP',   g.p);
  setEl('goalPreviewF',   g.f);
  setEl('goalPreviewC',   g.c);
}
function initProfile() {
  const set = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
  set('pSex',    profile.sex);
  set('pAge',    profile.age);
  set('pHeight', profile.height);
  set('pWeight', profile.weight);
  set('pBF',     profile.bf ?? '');
  set('pTemp',   profile.temp);
  document.querySelectorAll('.toggle-btn[data-val]').forEach(b => {
    b.classList.toggle('active', parseFloat(b.dataset.val) === profile.activityFactor);
  });
  renderBmrPreview();
}
function renderBmrPreview() {
  const el = document.getElementById('bmrPreview');
  if (!el) return;
  const tdee = calcTDEE();
  const bmr  = Math.round(tdee / (profile.activityFactor || 1.2));
  const g    = goals();
  const modeLabel = { normal:'通常', recomp:'低脂質リコンプ', custom:'カスタム' }[profile.goalMode || 'normal'];
  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;margin-bottom:10px">
      <div style="background:var(--bg);border-radius:8px;padding:8px 10px">
        <div style="color:var(--text-sub);font-size:10px">基礎代謝 (BMR)</div>
        <div style="font-weight:700;font-size:16px">${bmr} <span style="font-size:10px;font-weight:400">kcal</span></div>
      </div>
      <div style="background:var(--bg);border-radius:8px;padding:8px 10px">
        <div style="color:var(--text-sub);font-size:10px">推定TDEE</div>
        <div style="font-weight:700;font-size:16px">${tdee} <span style="font-size:10px;font-weight:400">kcal</span></div>
      </div>
    </div>
    <div style="font-size:11px;color:var(--text-sub);margin-bottom:4px">現在の目標（${modeLabel}プリセット）</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;text-align:center;font-size:11px">
      <div style="background:var(--bg);border-radius:6px;padding:5px 2px"><div style="color:var(--text-sub);font-size:9px">kcal</div><div style="font-weight:600">${g.cal}</div></div>
      <div style="background:#e3f0ff;border-radius:6px;padding:5px 2px"><div style="color:#3266ad;font-size:9px">P(g)</div><div style="font-weight:600;color:#1a1d23">${g.p}</div></div>
      <div style="background:#fff3e0;border-radius:6px;padding:5px 2px"><div style="color:#a06a1a;font-size:9px">F(g)</div><div style="font-weight:600;color:#1a1d23">${g.f}</div></div>
      <div style="background:#e8f5e9;border-radius:6px;padding:5px 2px"><div style="color:#2f7d3a;font-size:9px">C(g)</div><div style="font-weight:600;color:#1a1d23">${g.c}</div></div>
    </div>`;
  updateGoalPreview();
}

// ── PWA ──
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredPrompt = e;
  document.getElementById('install-banner').style.display = 'flex';
});
document.getElementById('install-btn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  document.getElementById('install-banner').style.display = 'none';
});
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ── Header ──
function updateHeader() {
  const d = new Date();
  document.getElementById('headerDate').textContent = d.toLocaleDateString('ja-JP',{month:'long',day:'numeric',weekday:'long'});
}
updateHeader();

// ── Helpers ──
function getAllFoods() {
  return [
    ...LOCAL_DB,
    ...customFoods.map(f => ({...f, _search: normalize(f.name), _src:'custom'})),
    ...comboFoods.map(f => ({...f, _search: normalize(f.name), _src:'combo'})),
  ];
}
function calcTDEE() {
  const w = profile.weight || userWeight || 65;
  const h = profile.height || 170;
  const age = profile.age || 30;
  const isMale = profile.sex !== 'female';
  const act = profile.activityFactor || 1.2;
  const bmr = isMale
    ? 10*w + 6.25*h - 5*age + 5
    : 10*w + 6.25*h - 5*age - 161;
  return Math.round(bmr * act);
}
function goals() {
  // カスタム目標が有効な場合はそちらを優先
  if (profile.goalMode === 'custom' && profile.customGoal) {
    return { ...profile.customGoal };
  }
  const tdee = calcTDEE();
  const w = profile.weight || userWeight || 65;
  if (profile.goalMode === 'recomp') {
    // 低脂質リコンププリセット: 通常タンパク・低脂質・カロリー維持
    const p = r1(w * 1.6);
    const f = r1(tdee * 0.15 / 9);
    const c = r1((tdee - p*4 - f*9) / 4);
    return { cal: tdee, p, f, c };
  }
  // 通常プリセット (デフォルト)
  const p = r1(w * 1.6);
  const f = r1(tdee * 0.25 / 9);
  const c = r1((tdee - p*4 - f*9) / 4);
  return { cal: tdee, p, f, c };
}
function sumEntries(list) {
  return list.reduce((a,e) => ({
    cal:a.cal+e.cal, p:a.p+e.p, f:a.f+e.f, c:a.c+e.c,
    fiber:a.fiber+(e.fiber||0), iron:a.iron+(e.iron||0), calcium:a.calcium+(e.calcium||0),
    vitc:a.vitc+(e.vitc||0), vitd:a.vitd+(e.vitd||0), salt:a.salt+(e.salt||0),
  }), {cal:0,p:0,f:0,c:0,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0});
}
function getDayEntries(d) { return entries.filter(e => e.date === d); }

// ── Date ──
function updateDateHeader() {
  document.getElementById('dateLabel').textContent = fmtDate(currentDate);
  const tod = isToday(currentDate);
  document.getElementById('todayBadge').style.display = tod ? 'inline' : 'none';
  document.getElementById('todayBtn').style.display = tod ? 'none' : 'block';
}
function changeDate(d) {
  const dt = new Date(currentDate+'T00:00:00'); dt.setDate(dt.getDate()+d);
  currentDate = toDateStr(dt); activeAddMeal = null; editingId = null; exPanelOpen = false;
  const panel = document.getElementById('exerciseAddPanel'); if(panel) panel.style.display='none';
  const btn   = document.getElementById('exAddBtn');          if(btn)   btn.textContent='＋ 追加';
  updateDateHeader(); renderRecord(); renderCalendar();
}
function goToday() {
  currentDate = toDateStr(new Date()); calViewYear = new Date().getFullYear(); calViewMonth = new Date().getMonth();
  activeAddMeal = null; editingId = null; exPanelOpen = false;
  const panel = document.getElementById('exerciseAddPanel'); if(panel) panel.style.display='none';
  const btn   = document.getElementById('exAddBtn');          if(btn)   btn.textContent='＋ 追加';
  updateDateHeader(); renderRecord(); renderCalendar();
}
function jumpToDate(d) {
  currentDate = d; calViewYear = parseInt(d.split('-')[0]); calViewMonth = parseInt(d.split('-')[1])-1;
  activeAddMeal = null; editingId = null; updateDateHeader(); renderRecord(); closeCalendar();
}

// ── Calendar ──
function toggleCalendar(e) {
  e.stopPropagation();
  const ol = document.getElementById('calOverlay');
  if (ol.classList.contains('open')) { closeCalendar(); return; }
  const rect = document.getElementById('dateDisplay').getBoundingClientRect();
  const popup = document.getElementById('calPopup');
  popup.style.top = (rect.bottom+4)+'px';
  popup.style.left = Math.max(4, rect.left)+'px';
  calViewYear = parseInt(currentDate.split('-')[0]); calViewMonth = parseInt(currentDate.split('-')[1])-1;
  renderCalendar(); ol.classList.add('open');
}
function closeCalendar() { document.getElementById('calOverlay').classList.remove('open'); }
function closeCalIfOutside(e) { if (e.target === document.getElementById('calOverlay')) closeCalendar(); }
function calPrev() { calViewMonth--; if (calViewMonth<0){calViewMonth=11;calViewYear--;} renderCalendar(); }
function calNext() { calViewMonth++; if (calViewMonth>11){calViewMonth=0;calViewYear++;} renderCalendar(); }
const CAL_MEALS = ['朝食','昼食','夕食'];
function renderCalendar() {
  const y=calViewYear, m=calViewMonth, fd=new Date(y,m,1).getDay(), dim=new Date(y,m+1,0).getDate(), tod=toDateStr(new Date());
  document.getElementById('calMonth').textContent = `${y}年${m+1}月`;
  let html = '';
  ['日','月','火','水','木','金','土'].forEach(d => { html += `<div class="cal-dow">${d}</div>`; });
  for (let i=0; i<fd; i++) { const dd=new Date(y,m,-(fd-1-i)); html += `<div class="cal-day other-month"><div class="cal-num">${dd.getDate()}</div></div>`; }
  for (let d=1; d<=dim; d++) {
    const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const de=getDayEntries(ds), ms=CAL_MEALS.map(m=>de.some(e=>e.meal===m)), cnt=ms.filter(Boolean).length;
    const sel=ds===currentDate, t=ds===tod;
    const fill=cnt>0?`<div class="cal-fill" style="height:${Math.round(cnt/3*100)}%;background:#3266ad;opacity:.2"></div>`:'';
    const dots=`<div class="cal-dots">${ms.map((f,i)=>`<div class="cal-dot${f?' filled':''}" title="${CAL_MEALS[i]}"></div>`).join('')}</div>`;
    html += `<div class="cal-day${sel?' selected':''}${t?' today-day':''}" onclick="jumpToDate('${ds}')">${fill}<div class="cal-num">${d}</div>${dots}</div>`;
  }
  document.getElementById('calGrid').innerHTML = html;
}

// ── 実質栄養価計算 ──
// DIT（食事誘発性熱産生）: P=25-30%, C=6-8%, F=2-4%
// 食物繊維NET補正: 食物繊維は消化吸収されないため実質カロリー = fiber * 2kcal/g（大腸発酵分）として扱い
//                  通常計算されている炭水化物 * 4kcal から fiber * 4kcal を引いて fiber * 2kcal を足す
//                  → 実質 fiber * 2kcal の節約
function calcNetCalories(s) {
  // ① DIT補正（安静時代謝で消費されるエネルギー）
  const ditP = s.p * 4 * 0.27;   // タンパク質: 27%消費
  const ditC = s.c * 4 * 0.07;   // 炭水化物: 7%消費
  const ditF = s.f * 9 * 0.03;   // 脂質: 3%消費
  const ditTotal = ditP + ditC + ditF;

  // ② 食物繊維NETカロリー補正
  // 食物繊維は不溶性は0kcal、可溶性は約2kcal/gで大腸で発酵
  // 標準成分表では炭水化物に含めて4kcal/gで計算されているため差分を補正
  const fiberAdj = (s.fiber || 0) * 2; // 4kcal→2kcalへの補正分（差引き2kcal節約/g）

  const grossCal  = s.cal;
  const netCal    = Math.round(grossCal - ditTotal - fiberAdj);
  const reduction = Math.round(ditTotal + fiberAdj);

  return {
    grossCal,
    netCal,
    ditTotal: Math.round(ditTotal),
    ditP:     Math.round(ditP),
    ditC:     Math.round(ditC),
    ditF:     Math.round(ditF),
    fiberAdj: Math.round(fiberAdj),
    reduction,
  };
}

function renderNetCard(s) {
  const badge = document.getElementById('netCalBadge');
  const card  = document.getElementById('netCard');
  if (!card) return;

  if (s.cal <= 0) {
    if (badge) badge.textContent = '';
    card.innerHTML = '';
    return;
  }

  const n = calcNetCalories(s);
  if (badge) badge.textContent = `→ 実質 ${n.netCal} kcal`;

  card.innerHTML = `
    <div class="card" style="padding:10px 12px;font-size:12px">
      <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px;flex-wrap:wrap">
        <span style="color:var(--text-sub)">表示カロリー</span>
        <span style="font-size:16px;font-weight:700">${n.grossCal}</span>
        <span style="color:var(--text-sub)">kcal</span>
        <span style="color:var(--text-sub)">→</span>
        <span style="color:var(--text-sub)">実質カロリー</span>
        <span style="font-size:20px;font-weight:700;color:var(--accent)">${n.netCal}</span>
        <span style="color:var(--text-sub)">kcal</span>
        <span style="background:#e8f5e9;color:#2e7d32;border-radius:6px;padding:2px 7px;font-size:11px;font-weight:600">▼ ${n.reduction} kcal 節約</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:8px">
        <div style="background:var(--bg);border-radius:8px;padding:7px 10px">
          <div style="color:var(--text-sub);font-size:10px;margin-bottom:3px">DIT（食事誘発性熱産生）</div>
          <div style="font-weight:700;font-size:14px">▼ ${n.ditTotal} kcal</div>
          <div style="font-size:10px;color:var(--text-sub);margin-top:3px;line-height:1.6">
            P: ▼${n.ditP} / C: ▼${n.ditC} / F: ▼${n.ditF}
          </div>
        </div>
        <div style="background:var(--bg);border-radius:8px;padding:7px 10px">
          <div style="color:var(--text-sub);font-size:10px;margin-bottom:3px">食物繊維NET補正</div>
          <div style="font-weight:700;font-size:14px">▼ ${n.fiberAdj} kcal</div>
          <div style="font-size:10px;color:var(--text-sub);margin-top:3px;line-height:1.6">
            繊維 ${r1(s.fiber||0)}g × 2 kcal節約/g
          </div>
        </div>
      </div>
      <div style="font-size:10px;color:var(--text-sub);line-height:1.6;border-top:1px solid var(--border);padding-top:6px">
        DIT: P×27% / C×7% / F×3% を消化に消費と推定。食物繊維は腸内発酵で約2kcal/g（表示値4kcal/gとの差を補正）。あくまで推定値です。
      </div>
    </div>`;
}


// ── Toast & Ripple ──
function showToast(msg, duration = 2000) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.classList.remove('toast-action');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), duration);
}
// 削除操作など、取り消し可能にしたい通知用（「元に戻す」ボタン付き）
function showUndoToast(msg, onUndo, duration = 5000) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  clearTimeout(el._timer);
  el.innerHTML = `<span>${msg}</span><button type="button" class="toast-undo-btn">元に戻す</button>`;
  el.classList.add('show', 'toast-action');
  const btn = el.querySelector('.toast-undo-btn');
  const finish = () => { el.classList.remove('show', 'toast-action'); };
  btn.onclick = (ev) => { ev.stopPropagation(); clearTimeout(el._timer); finish(); onUndo(); };
  el._timer = setTimeout(finish, duration);
}
document.addEventListener('click', e => {
  const btn = e.target.closest('.btn, .meal-add-btn, .nav-btn, .seasoning-btn, .toggle-btn, .period-tab, .chart-tab, .ri');
  if (!btn) return;
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2;
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX-rect.left-size/2}px;top:${e.clientY-rect.top-size/2}px`;
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
}, true);

// ── Record ──
// ── 記録の異常値チェック（1日を見返す際にまとめて表示） ──
function levenshtein(a, b) {
  const dp = [];
  for (let i = 0; i <= a.length; i++) dp.push([i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j-1], dp[i-1][j], dp[i][j-1]);
    }
  }
  return dp[a.length][b.length];
}

function detectAnomalies(date) {
  const list = getDayEntries(date);
  const issues = [];

  list.forEach(e => {
    const amt = e.amount || 0;
    const cal = e.cal || 0;
    if (amt <= 0) {
      issues.push({ sev: 'high', msg: `「${e.name}」の量が0以下になっています` });
      return;
    }
    // 物理的に不可能なカロリー密度（純脂質でも約9kcal/g）
    const density = cal / amt;
    if (density > 9.5) {
      issues.push({ sev: 'high', msg: `「${e.name}」: ${r1(amt)}gで${ri(cal)}kcalは密度が高すぎます（${density.toFixed(1)}kcal/g）。桁や単位の入力ミスの可能性があります` });
    }
    // カロリーとPFCから逆算した値の整合性
    const calcCal = (e.p||0)*4 + (e.f||0)*9 + (e.c||0)*4;
    if (cal > 50 && calcCal > 0) {
      const diffRatio = Math.abs(cal - calcCal) / cal;
      if (diffRatio > 0.4) {
        issues.push({ sev: 'mid', msg: `「${e.name}」: カロリー(${ri(cal)}kcal)とP・F・Cから計算した値(${ri(calcCal)}kcal)が大きくずれています` });
      }
    }
    // 単品として極端な量
    if (cal > 2500) issues.push({ sev: 'mid', msg: `「${e.name}」が${ri(cal)}kcalと、1品にしては非常に多い量です` });
    if ((e.p||0) > 150) issues.push({ sev: 'mid', msg: `「${e.name}」のタンパク質が${r1(e.p)}gと非常に多い量です` });
    if ((e.salt||0) > 15) issues.push({ sev: 'mid', msg: `「${e.name}」の食塩相当量が${r1(e.salt)}gと非常に多い量です` });
  });

  // 同じ食事内で、名前が酷似した別記録（合算されなかった重複の可能性）
  const mealGroups = {};
  list.forEach(e => { (mealGroups[e.meal] = mealGroups[e.meal] || []).push(e); });
  Object.values(mealGroups).forEach(group => {
    for (let i = 0; i < group.length; i++) {
      for (let j = i+1; j < group.length; j++) {
        const a = normFoodName(group[i].name), b = normFoodName(group[j].name);
        if (!a || !b || a === b) continue;
        const longer = Math.max(a.length, b.length);
        if (longer < 3) continue;
        const similarity = 1 - levenshtein(a, b) / longer;
        const isSubstr = a.includes(b) || b.includes(a);
        if (similarity > 0.7 || isSubstr) {
          issues.push({ sev: 'low', msg: `「${group[i].name}」と「${group[j].name}」は似た名前で別々に記録されています（重複の可能性）` });
        }
      }
    }
  });

  return issues;
}

function renderAnomalyCard(date) {
  const el = document.getElementById('anomalyCard');
  if (!el) return;
  const issues = detectAnomalies(date);
  if (!issues.length) { el.innerHTML = ''; return; }
  const sevOrder = { high: 0, mid: 1, low: 2 };
  issues.sort((a, b) => sevOrder[a.sev] - sevOrder[b.sev]);
  const sevIcon = { high: '🔴', mid: '🟠', low: '🟡' };
  el.innerHTML = `
    <div class="card" style="padding:11px 13px;margin-bottom:8px;border:1.5px solid #f0ad4e55;background:linear-gradient(135deg,#fff8ec,#fffdf9)">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;font-weight:700;font-size:13px;color:#a06a1a">
        ⚠️ 記録の確認事項（${issues.length}件）
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${issues.map(i => `
          <div style="display:flex;gap:6px;align-items:flex-start;font-size:12px;line-height:1.5;color:#4b3a1a">
            <span>${sevIcon[i.sev]}</span><span style="flex:1">${i.msg}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

function renderRecord() {
  const list = getDayEntries(currentDate);
  const s = sumEntries(list);
  const g = goals();
  const exToday = exercises.filter(e => e.date === currentDate);
  const exCal = exToday.reduce((a, e) => a + (e.cal || 0), 0);
  const remain = g.cal - s.cal + exCal;
  const remainColor = remain >= 0 ? 'var(--accent)' : '#c0392b';

  // ── タンパク質吸収補正 ──
  const absP = r1(calcAbsorbedProtein(list));

  // ── 異常値チェック ──
  renderAnomalyCard(currentDate);

  // ── 実質栄養価 ──
  renderNetCard(s);
  // ── 脂肪酸プロファイル ──
  renderFattyAcidPanel(list);

  // ── エネルギー収支カード ──
  document.getElementById('balanceCard').innerHTML = `
    <div class="card" style="padding:10px 12px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:0;margin-bottom:7px">
        <div style="flex:1;min-width:0">
          <div style="font-size:10px;color:var(--text-sub)">摂取</div>
          <div style="font-size:20px;font-weight:700;letter-spacing:-.5px">${ri(s.cal)}<span style="font-size:11px;font-weight:400;color:var(--text-sub);margin-left:2px">kcal</span></div>
        </div>
        ${exCal > 0 ? `<div style="font-size:11px;color:var(--text-sub);padding:0 6px">+🏃${ri(exCal)}</div>` : ''}
        <div style="font-size:18px;color:var(--text-sub);padding:0 6px">/</div>
        <div style="flex:1;min-width:0;text-align:right">
          <div style="font-size:10px;color:var(--text-sub)">目標</div>
          <div style="font-size:20px;font-weight:700;letter-spacing:-.5px">${ri(g.cal)}<span style="font-size:11px;font-weight:400;color:var(--text-sub);margin-left:2px">kcal</span></div>
        </div>
        <div style="padding-left:10px;text-align:right;min-width:64px">
          <div style="font-size:10px;color:var(--text-sub)">${remain >= 0 ? 'あと' : '超過'}</div>
          <div style="font-size:18px;font-weight:700;color:${remainColor};letter-spacing:-.5px">${ri(Math.abs(remain))}<span style="font-size:10px;font-weight:400;margin-left:1px">kcal</span></div>
        </div>
      </div>
      <div style="height:6px;border-radius:3px;background:var(--border);overflow:hidden">
        <div style="height:100%;border-radius:3px;background:${s.cal > g.cal ? 'var(--red)' : 'var(--accent)'};width:${Math.min((s.cal+exCal)/g.cal*100,100).toFixed(1)}%;transition:width .4s cubic-bezier(.4,0,.2,1)"></div>
      </div>
    </div>`;

  // ── エネルギー内訳 ──
  const bmr_disp = ri(g.cal / (profile.activityFactor || 1.2));
  const pCalPct = s.cal > 0 ? ri(s.p*4/s.cal*100) : 0;
  const fCalPct = s.cal > 0 ? ri(s.f*9/s.cal*100) : 0;
  const cCalPct = s.cal > 0 ? ri(s.c*4/s.cal*100) : 0;
  document.getElementById('energyBreakdown').innerHTML = `
    <div style="font-size:11px;color:var(--text-sub);margin-bottom:6px">
      推定TDEE ${ri(g.cal)} kcal（BMR ${bmr_disp} kcal × 活動係数 ${profile.activityFactor || 1.2}）
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;text-align:center">
      <div style="background:#e3f0ff;border-radius:8px;padding:7px 4px">
        <div style="font-size:10px;color:#3266ad;font-weight:600">タンパク質</div>
        <div style="font-weight:700;color:#1a1d23">${r1(s.p)}g</div>
        <div style="font-size:10px;color:#2a6f4f;font-weight:600">吸収量 ${absP}g</div>
        <div style="font-size:10px;color:#4b5568">${ri(s.p*4)} kcal (${pCalPct}%)</div>
        <div style="font-size:10px;color:#4b5568">目標 ${g.p}g</div>
      </div>
      <div style="background:#fff3e0;border-radius:8px;padding:7px 4px">
        <div style="font-size:10px;color:#a06a1a;font-weight:600">脂質</div>
        <div style="font-weight:700;color:#1a1d23">${r1(s.f)}g</div>
        <div style="font-size:10px;color:#4b5568">${ri(s.f*9)} kcal (${fCalPct}%)</div>
        <div style="font-size:10px;color:#4b5568">目標 ${g.f}g</div>
      </div>
      <div style="background:#e8f5e9;border-radius:8px;padding:7px 4px">
        <div style="font-size:10px;color:#2f7d3a;font-weight:600">炭水化物</div>
        <div style="font-weight:700;color:#1a1d23">${r1(s.c)}g</div>
        <div style="font-size:10px;color:#4b5568">${ri(s.c*4)} kcal (${cCalPct}%)</div>
        <div style="font-size:10px;color:#4b5568">目標 ${g.c}g</div>
      </div>
    </div>`;

  document.getElementById('recMetrics').innerHTML = `
    <div class="mc"><div class="mc-label">カロリー</div><div class="mc-value">${ri(s.cal)}</div><div class="mc-unit">kcal</div></div>
    <div class="mc" style="position:relative"><div class="mc-label">タンパク質</div><div class="mc-value">${r1(s.p)}</div><div class="mc-unit">g</div><div style="font-size:9px;color:var(--accent);font-weight:600;margin-top:1px">吸収 ${absP}g</div></div>
    <div class="mc"><div class="mc-label">脂質</div><div class="mc-value">${r1(s.f)}</div><div class="mc-unit">g</div></div>
    <div class="mc"><div class="mc-label">炭水化物</div><div class="mc-value">${r1(s.c)}</div><div class="mc-unit">g</div></div>`;
  const pcal=s.p*4, fcal=s.f*9, ccal=s.c*4, tot=pcal+fcal+ccal||1;
  document.getElementById('recBarP').style.width=(pcal/tot*100)+'%';
  document.getElementById('recBarF').style.width=(fcal/tot*100)+'%';
  document.getElementById('recBarC').style.width=(ccal/tot*100)+'%';

  let microHtml = '';
  MICRO_KEYS.forEach(k => {
    const g=MICRO_GOALS[k], val=r1(s[k]||0);
    const pct=Math.min(val/g.goal*100,100);
    const over=!g.reverse&&val>g.goal;
    const color=g.reverse?(val>g.goal?'#c0392b':g.color):(over?'#c0392b':g.color);
    microHtml += `<div class="micro-item"><div class="micro-label">${g.label}</div>
      <div class="micro-bar-track"><div class="micro-bar-fill" style="width:${pct}%;background:${color}"></div></div>
      <div class="micro-val">${val}<span class="micro-unit"> ${g.unit}/${g.goal}</span></div></div>`;
  });
  document.getElementById('microGrid').innerHTML = microHtml;

  const grouped = {}; MEALS_ORDER.forEach(m=>{grouped[m]=[]});
  list.forEach(e=>{(grouped[e.meal]||grouped['間食']).push(e)});
  let html = '';
  MEALS_ORDER.forEach(meal => {
    const items=grouped[meal]||[], ms=sumEntries(items), meta=MEAL_META[meal], isAdding=activeAddMeal===meal;
    html += `<div class="meal-block"><div class="meal-block-header">
      <div class="meal-block-left">
        <div class="meal-icon" style="background:${meta.bg}">${meta.icon}</div>
        <div><div class="meal-name">${meal}</div><div class="meal-sub">${items.length?ri(ms.cal)+' kcal / P'+r1(ms.p)+' F'+r1(ms.f)+' C'+r1(ms.c):'未記録'}</div></div>
      </div>
      <button class="meal-add-btn${isAdding?' active-add':''}" onclick="toggleAddPanel('${meal}')">${isAdding?'✕ 閉じる':'＋ 追加'}</button>
    </div>`;
    if (items.length) {
      html += `<div class="meal-items">`;
      items.forEach(e => {
        if (editingId === e.id) {
          // 編集フォーム用に100g基準値をstoreする
          window._editBase = window._editBase || {};
          window._editBase[e.id] = {cal:e.cal,p:e.p,f:e.f,c:e.c,fiber:e.fiber||0,iron:e.iron||0,calcium:e.calcium||0,vitc:e.vitc||0,vitd:e.vitd||0,salt:e.salt||0,per:e.amount};
          html += `<div class="edit-form" id="editForm_${e.id}">
            <div class="row" style="margin-bottom:5px"><div class="field" style="flex:3"><label>食品名</label><input type="text" id="en${e.id}" value="${e.name}"></div><div class="field" style="flex:1.2"><label>量(g)</label><input type="number" id="ea${e.id}" value="${e.amount}" min="1" oninput="recalcEdit(${e.id})"></div></div>
            <div class="row" style="margin-bottom:5px"><div class="field"><label>kcal</label><input type="number" id="ec${e.id}" value="${r1(e.cal)}" step="0.1"></div><div class="field"><label>P</label><input type="number" id="ep${e.id}" value="${r1(e.p)}" step="0.1"></div><div class="field"><label>F</label><input type="number" id="ef${e.id}" value="${r1(e.f)}" step="0.1"></div><div class="field"><label>C</label><input type="number" id="ecc${e.id}" value="${r1(e.c)}" step="0.1"></div></div>
            <div class="row" style="margin-bottom:5px"><div class="field"><label>食物繊維</label><input type="number" id="efib${e.id}" value="${r1(e.fiber||0)}" step="0.1"></div><div class="field"><label>鉄(mg)</label><input type="number" id="efe${e.id}" value="${r1(e.iron||0)}" step="0.1"></div><div class="field"><label>Ca(mg)</label><input type="number" id="eca${e.id}" value="${r1(e.calcium||0)}" step="0.1"></div></div>
            <div class="row" style="margin-bottom:5px"><div class="field"><label>VitC</label><input type="number" id="evc${e.id}" value="${r1(e.vitc||0)}" step="0.1"></div><div class="field"><label>VitD</label><input type="number" id="evd${e.id}" value="${r1(e.vitd||0)}" step="0.1"></div><div class="field"><label>塩分</label><input type="number" id="esl${e.id}" value="${r2(e.salt||0)}" step="0.01"></div></div>
            <div class="row" style="margin-bottom:0"><div class="field"><label>タイミング</label><select id="em${e.id}">${MEALS_ORDER.map(m=>`<option${e.meal===m?' selected':''}>${m}</option>`).join('')}</select></div>
            <button class="btn btn-primary btn-sm" onclick="saveEdit(${e.id})" style="height:32px;margin-top:auto">保存</button>
            <button class="btn btn-sm" onclick="cancelEdit()" style="height:32px;margin-top:auto">取消</button></div>
          </div>`;
        } else {
          html += `<div class="log-item"><div><div class="li-name">${e.name}</div><div class="li-detail">${e.amount}g｜P${r1(e.p)} F${r1(e.f)} C${r1(e.c)}${e.fiber?'｜繊'+r1(e.fiber):''}${e.vitd?'｜D'+r1(e.vitd)+'μg':''}</div></div>
          <div class="li-right"><div class="li-cal">${ri(e.cal)}</div>
          <button class="btn btn-sm btn-ghost" onclick="startEdit(${e.id})" style="padding:2px 6px">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteEntry(${e.id})" style="padding:6px 10px">✕</button></div></div>`;
        }
      });
      html += `</div>`;
    }
    if (isAdding) {
      html += `<div class="add-panel" id="addPanel_${meal}">
        <div class="search-wrap">
          <input type="text" id="addSearch_${meal}" placeholder="いわし、chicken, egg…" oninput="onAddSearch(this.value,'${meal}')" autocomplete="off">
          <div class="search-icon-box" id="addSearchIcon_${meal}"><svg viewBox="0 0 16 16"><circle cx="6.5" cy="6.5" r="4"/><line x1="10" y1="10" x2="14" y2="14"/></svg></div>
          <div class="spin-box" id="addSpinner_${meal}"><div class="spinner"></div></div>
        </div>
        <div class="results-box" id="addResultsBox_${meal}"></div>
        <div class="row" style="margin-bottom:6px"><div class="field" style="flex:3"><label>食品名</label><input type="text" id="addName_${meal}" placeholder="食品名"></div><div class="field" style="flex:1.4"><label style="display:flex;align-items:center;justify-content:space-between">量 <span style="display:flex;gap:2px" id="unitToggle_${meal}"><button type="button" onclick="setAmtUnit('${meal}','g')" id="unitG_${meal}" style="font-size:9px;padding:1px 5px;border-radius:3px;border:1px solid var(--accent);background:var(--accent);color:#fff;cursor:pointer">g</button><button type="button" onclick="setAmtUnit('${meal}','serving')" id="unitS_${meal}" style="font-size:9px;padding:1px 5px;border-radius:3px;border:1px solid var(--border);background:var(--bg);color:var(--text-sub);cursor:pointer">人前</button></span></label><input type="number" id="addAmt_${meal}" value="100" min="0.1" step="0.1" oninput="recalcAdd('${meal}')" style="width:100%"></div></div>
        <div id="amtQuickPick_${meal}" style="display:none;flex-wrap:wrap;gap:4px;margin-bottom:6px"></div>
        <div class="macro-row">
          <div class="field"><label>kcal</label><input type="number" id="addCal_${meal}" placeholder="0" step="0.1"></div>
          <div class="field"><label>P(g)</label><input type="number" id="addP_${meal}" placeholder="0" step="0.1"></div>
          <div class="field"><label>F(g)</label><input type="number" id="addF_${meal}" placeholder="0" step="0.1"></div>
          <div class="field"><label>C(g)</label><input type="number" id="addC_${meal}" placeholder="0" step="0.1"></div>
        </div>
        <div class="macro-row">
          <div class="field"><label>食物繊維(g)</label><input type="number" id="addFib_${meal}" placeholder="0" step="0.1"></div>
          <div class="field"><label>鉄(mg)</label><input type="number" id="addFe_${meal}" placeholder="0" step="0.1"></div>
          <div class="field"><label>Ca(mg)</label><input type="number" id="addCa_${meal}" placeholder="0" step="0.1"></div>
          <div class="field"><label>VitC(mg)</label><input type="number" id="addVc_${meal}" placeholder="0" step="0.1"></div>
          <div class="field"><label>VitD(μg)</label><input type="number" id="addVd_${meal}" placeholder="0" step="0.1"></div>
          <div class="field"><label>塩分(g)</label><input type="number" id="addSalt_${meal}" placeholder="0" step="0.01"></div>
        </div>
        <button class="btn btn-primary btn-block" onclick="addEntry('${meal}')">追加する</button>
        <div id="addMsg_${meal}" class="status-msg"></div>
      </div>`;
    }
    html += `</div>`;
  });
  document.getElementById('mealBlocks').innerHTML = html;
  if (activeAddMeal) setTimeout(() => { const el = document.getElementById('addSearch_'+activeAddMeal); if(el) el.focus(); }, 30);
  renderExerciseItems();
}

// ── Search ──
function searchScore(food, query) {
  const q=query.toLowerCase().trim(); if(!q) return 0;
  const s=food._search||'', nameNorm=normalize(food.name), qNorm=normalize(q);
  if (nameNorm===qNorm||s.startsWith(qNorm)) return 100;
  if (nameNorm.includes(qNorm)) return 90;
  if (s.includes(qNorm)) return 70;
  const en=(food.en||'').toLowerCase();
  if (en===q) return 85; if (en.startsWith(q)) return 80; if (en.includes(q)) return 65;
  let qi=0; for(let i=0;i<s.length&&qi<qNorm.length;i++) if(s[i]===qNorm[qi]) qi++;
  if (qi===qNorm.length) return 30;
  return 0;
}
function localSearch(q) {
  if (!q.trim()) return [];
  return getAllFoods().map(f=>({...f,_score:searchScore(f,q)})).filter(f=>f._score>0).sort((a,b)=>b._score-a._score).slice(0,9);
}
async function apiSearch(q) {
  if (apiAbort) apiAbort.abort(); apiAbort = new AbortController();
  try {
    const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&fields=product_name,product_name_ja,nutriments&page_size=5&lc=ja,en`,{signal:apiAbort.signal});
    const data = await res.json();
    return (data.products||[]).filter(p=>(p.product_name||p.product_name_ja)&&(p.nutriments||{})['energy-kcal_100g']!=null).map(p=>{
      const n=p.nutriments||{};
      const entry = {name:p.product_name_ja||p.product_name||'不明',cal:r1(n['energy-kcal_100g']||0),p:r1(n['proteins_100g']||0),f:r1(n['fat_100g']||0),c:r1(n['carbohydrates_100g']||0),per:100,
        fiber:r1(n['fiber_100g']||0),iron:r1(n['iron_100g']!=null?n['iron_100g']*1000:0),calcium:r1(n['calcium_100g']!=null?n['calcium_100g']*1000:0),
        vitc:r1(n['vitamin-c_100g']!=null?n['vitamin-c_100g']*1000:0),vitd:r1(n['vitamin-d_100g']!=null?n['vitamin-d_100g']*1000000:0),salt:r1(n['salt_100g']||0),_src:'api'};
      return enrichFoodProfile(entry);
    });
  } catch(e) { return e.name==='AbortError'?null:[]; }
}

const SRC_LABEL = {local:'内蔵',custom:'カスタム',combo:'複合',api:'外部'};
function showSp(spId, iconId, on) {
  const sp=document.getElementById(spId), ic=document.getElementById(iconId);
  if(sp) sp.style.display=on?'flex':'none'; if(ic) ic.style.display=on?'none':'flex';
}
function renderResultsFor(local, api, loading, meal) {
  const box=document.getElementById('addResultsBox_'+meal); if(!box) return;
  let html='';
  if(local.length){html+=`<div class="rs-label">内蔵・カスタムDB</div>`;html+=local.map((f,i)=>`<div class="ri" onclick="selectAddResult(${i},'local','${meal}')"><div><div class="ri-name">${f.name}<span class="badge badge-${f._src||'local'}">${SRC_LABEL[f._src||'local']}</span></div><div class="ri-sub">${f.per}gあたり P${f.p} F${f.f} C${f.c}${f.fiber?' 繊'+f.fiber:''}</div></div><div class="ri-cal">${f.cal}kcal</div></div>`).join('')}
  if(loading){html+=`<div class="rs-label">Open Food Facts 検索中…</div><div class="no-result"><div class="spinner" style="display:inline-block"></div></div>`}
  else if(api&&api.length){html+=`<div class="rs-label">Open Food Facts</div>`;html+=api.map((f,i)=>`<div class="ri" onclick="selectAddResult(${i},'api','${meal}')"><div><div class="ri-name">${f.name.length>26?f.name.slice(0,26)+'…':f.name}<span class="badge badge-api">外部</span></div><div class="ri-sub">100gあたり P${f.p} F${f.f} C${f.c}${f.fiber?' 繊'+f.fiber:''}</div></div><div class="ri-cal">${f.cal}kcal</div></div>`).join('')}
  else if(!loading&&!local.length){html+=`<div class="no-result">見つかりませんでした</div>`}
  box.innerHTML=html; box._local=local; box._api=api; box.style.display='block';
}
if (!window._addBase) window._addBase = {};
function onAddSearch(q, meal) {
  clearTimeout(searchTimer); const box=document.getElementById('addResultsBox_'+meal);
  if(!q.trim()){if(box)box.style.display='none';return}
  renderResultsFor(localSearch(q),[],true,meal); showSp('addSpinner_'+meal,'addSearchIcon_'+meal,true);
  searchTimer=setTimeout(async()=>{const api=await apiSearch(q);showSp('addSpinner_'+meal,'addSearchIcon_'+meal,false);if(api!==null)renderResultsFor(localSearch(q),api,false,meal)},600);
}
function selectAddResult(i, src, meal) {
  const box=document.getElementById('addResultsBox_'+meal); if(!box) return;
  const f=src==='local'?box._local[i]:box._api[i]; if(!f) return;
  window._addBase[meal]={...f};

  // ── 検索結果タップ＝即登録。量やその他の栄養素はあとで記録欄のインライン編集で調整する ──
  const per = f.per || 100;
  const amt = f.serving || per;
  const r   = amt / per;
  const newEntry = {
    id: Date.now() + Math.random(),
    date: currentDate,
    meal,
    name:    f.name,
    amount:  amt,
    cal:     r1((f.cal||0)*r),
    p:       r1((f.p||0)*r),
    f:       r1((f.f||0)*r),
    c:       r1((f.c||0)*r),
    fiber:   r1((f.fiber||0)*r),
    iron:    r2((f.iron||0)*r),
    calcium: r1((f.calcium||0)*r),
    vitc:    r1((f.vitc||0)*r),
    vitd:    r2((f.vitd||0)*r),
    salt:    r2((f.salt||0)*r),
    fa:      f.fa || null,
    aa:      f.aa || null,
  };
  if (!newEntry.fa || !newEntry.aa) enrichFoodProfile(newEntry);
  const { entry, merged } = addOrMergeEntry(newEntry);
  save();

  box.style.display='none';
  document.getElementById('addSearch_'+meal).value='';
  const cont = document.getElementById('amtQuickPick_'+meal);
  if (cont) cont.style.display = 'none';

  // 追加した項目をすぐインライン編集できるように開く（量や栄養素の微調整用）
  editingId = entry.id;
  renderRecord();
  renderCalendar();
  showToast(merged ? `✅「${f.name}」は既存の記録に合算しました。量を編集できます` : `✅「${f.name}」を登録しました。量を編集できます`);
  setTimeout(() => {
    const el = document.getElementById('editForm_' + entry.id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 60);
}
// ── 調味料クイック登録 ──
// 小さじ1 = 約5ml（油類・液体）/調味料によって重量が異なる
const SEASONING_MASTER = {
  '醤油（濃口）小さじ1':   { name:'醤油（濃口）小さじ1',   amount:6,  cal:4,   p:0.5, f:0,   c:0.6, fiber:0,   iron:0.1, calcium:2,  vitc:0,   vitd:0, salt:0.9 },
  '味噌（米みそ）小さじ1': { name:'味噌（米みそ）小さじ1',  amount:6,  cal:12,  p:0.7, f:0.4, c:1.3, fiber:0.3, iron:0.2, calcium:8,  vitc:0,   vitd:0, salt:0.7 },
  '鶏ガラスープの素小さじ1':{ name:'鶏ガラスープの素小さじ1',amount:3,  cal:7,   p:0.6, f:0.2, c:0.8, fiber:0,   iron:0.1, calcium:3,  vitc:0,   vitd:0, salt:1.3 },
  '米油小さじ1':           { name:'米油小さじ1',           amount:4,  cal:37,  p:0,   f:4.0, c:0,   fiber:0,   iron:0,   calcium:0,  vitc:0,   vitd:0, salt:0   },
  'みりん小さじ1':         { name:'みりん小さじ1',         amount:6,  cal:14,  p:0,   f:0,   c:3.1, fiber:0,   iron:0,   calcium:0,  vitc:0,   vitd:0, salt:0   },
  'にんにく小さじ1':       { name:'にんにく小さじ1',       amount:5,  cal:7,   p:0.3, f:0,   c:1.4, fiber:0.3, iron:0,   calcium:1,  vitc:0.6, vitd:0, salt:0   },
  '白だし小さじ1':         { name:'白だし小さじ1',         amount:6,  cal:7,   p:0.4, f:0,   c:1.4, fiber:0,   iron:0.1, calcium:3,  vitc:0,   vitd:0, salt:1.0 },
  'カレー粉小さじ1':       { name:'カレー粉小さじ1',       amount:2,  cal:7,   p:0.3, f:0.3, c:1.0, fiber:0.6, iron:0.3, calcium:5,  vitc:0,   vitd:0, salt:0   },
};

let _seasoningMsgTimer = null;
function addSeasoning(key) {
  const s = SEASONING_MASTER[key];
  if (!s) return;
  const meal = document.getElementById('seasoningMeal')?.value || '昼食';
  const { merged } = addOrMergeEntry({
    id: Date.now() + Math.random(),
    date: currentDate,
    meal,
    name:    s.name,
    amount:  s.amount,
    cal:     s.cal,
    p:       s.p,
    f:       s.f,
    c:       s.c,
    fiber:   s.fiber,
    iron:    s.iron,
    calcium: s.calcium,
    vitc:    s.vitc,
    vitd:    s.vitd,
    salt:    s.salt,
  });
  save();
  renderRecord();
  showToast(merged ? `✅ ${s.name}を${meal}に合算しました` : `✅ ${s.name}を${meal}に追加`);
}


function openCopyDayModal() {
  const modal = document.getElementById('copyDayModal');
  if (!modal) return;
  // デフォルト: 昨日
  const yesterday = new Date(currentDate + 'T00:00:00');
  yesterday.setDate(yesterday.getDate() - 1);
  const input = document.getElementById('copyFromDate');
  if (input) input.value = toDateStr(yesterday);
  const destLabel = document.getElementById('copyDestLabel');
  if (destLabel) destLabel.textContent = dateLabel(currentDate);
  modal.style.display = 'flex';
  updateCopyDayPreview();
}
function closeCopyDayModal() {
  const modal = document.getElementById('copyDayModal');
  if (modal) modal.style.display = 'none';
  const msg = document.getElementById('copyDayMsg');
  if (msg) msg.textContent = '';
}
function updateCopyDayPreview() {
  const input = document.getElementById('copyFromDate');
  const preview = document.getElementById('copyDayPreview');
  if (!input || !preview) return;
  const fromDate = input.value;
  if (!fromDate) { preview.textContent = '日付を選択してください'; return; }
  const fromEntries = entries.filter(e => e.date === fromDate);
  const fromEx      = exercises.filter(e => e.date === fromDate);
  if (!fromEntries.length && !fromEx.length) {
    preview.textContent = `${dateLabel(fromDate)} の記録はありません`;
    return;
  }
  const s = sumEntries(fromEntries);
  const mealCounts = MEALS_ORDER.map(m => {
    const cnt = fromEntries.filter(e => e.meal === m).length;
    return cnt ? `${m}${cnt}品` : null;
  }).filter(Boolean).join(' / ');
  preview.innerHTML = `
    <div style="font-weight:600;margin-bottom:3px">${dateLabel(fromDate)}</div>
    <div>${mealCounts || '食事なし'}　合計 ${ri(s.cal)} kcal</div>
    ${fromEx.length ? `<div>運動: ${fromEx.map(e=>e.name).join('、')} (消費${ri(fromEx.reduce((a,e)=>a+(e.cal||0),0))}kcal)</div>` : ''}
  `;
}
function executeCopyDay() {
  const input     = document.getElementById('copyFromDate');
  const overwrite = document.getElementById('copyOverwrite')?.checked;
  const copyEx    = document.getElementById('copyExercise')?.checked;
  const msg       = document.getElementById('copyDayMsg');
  const fromDate  = input?.value;
  if (!fromDate) { if(msg){msg.className='status-msg status-err';msg.textContent='コピー元の日付を選んでください';} return; }
  if (fromDate === currentDate) { if(msg){msg.className='status-msg status-err';msg.textContent='コピー元とコピー先が同じ日付です';} return; }

  const fromEntries = entries.filter(e => e.date === fromDate);
  const fromEx      = exercises.filter(e => e.date === fromDate);
  if (!fromEntries.length && !fromEx.length) {
    if(msg){msg.className='status-msg status-err';msg.textContent='コピー元に記録がありません';}
    return;
  }

  // バックアップ
  takeAiBackup(`${dateLabel(fromDate)}→${dateLabel(currentDate)}コピー前`);

  // 食事コピー
  if (overwrite) entries = entries.filter(e => e.date !== currentDate);
  const now = Date.now();
  fromEntries.forEach((e, i) => {
    entries.push({ ...e, id: now + i, date: currentDate });
  });

  // 運動コピー
  if (copyEx) {
    if (overwrite) exercises = exercises.filter(e => e.date !== currentDate);
    fromEx.forEach((e, i) => {
      exercises.push({ ...e, id: now + 10000 + i, date: currentDate });
    });
  }

  save();
  saveExercises();
  renderRecord();
  renderCalendar();
  renderExerciseItems();

  const copied = fromEntries.length + (copyEx ? fromEx.length : 0);
  if(msg){msg.className='status-msg status-ok';msg.textContent=`✅ ${copied}件をコピーしました`;}
  setTimeout(() => closeCopyDayModal(), 1200);
}

// ── 食品登録 量クイック選択 ──
// 単位モード管理 (g / serving)
if (!window._amtUnit) window._amtUnit = {};

function setAmtUnit(meal, unit) {
  window._amtUnit[meal] = unit;
  const base = window._addBase?.[meal];
  const serving = base?.serving || base?.per || 100;

  // ボタンスタイル切り替え
  const gBtn = document.getElementById('unitG_'+meal);
  const sBtn = document.getElementById('unitS_'+meal);
  if (gBtn) {
    gBtn.style.background = unit === 'g' ? 'var(--accent)' : 'var(--bg)';
    gBtn.style.color      = unit === 'g' ? '#fff' : 'var(--text-sub)';
    gBtn.style.borderColor= unit === 'g' ? 'var(--accent)' : 'var(--border)';
  }
  if (sBtn) {
    sBtn.style.background = unit === 'serving' ? 'var(--accent)' : 'var(--bg)';
    sBtn.style.color      = unit === 'serving' ? '#fff' : 'var(--text-sub)';
    sBtn.style.borderColor= unit === 'serving' ? 'var(--accent)' : 'var(--border)';
  }

  const inp = document.getElementById('addAmt_'+meal);
  if (!inp) return;

  if (unit === 'serving') {
    inp.step = '0.5';
    inp.min  = '0.1';
    inp.value = '1';
    inp.placeholder = '人前';
  } else {
    inp.step = '1';
    inp.min  = '1';
    inp.value = serving;
    inp.placeholder = 'g';
  }
  recalcAdd(meal);
  // クイックピッカーも更新
  showAmtQuickPicker(meal, false);
}

function showAmtQuickPicker(meal, toggle = true) {
  const base    = window._addBase?.[meal];
  const cont    = document.getElementById('amtQuickPick_'+meal);
  if (!cont) return;

  const unit    = window._amtUnit?.[meal] || 'g';
  const serving = base?.serving || base?.per || 100;
  const per     = base?.per || 100;

  let buttons = [];
  if (unit === 'serving' && base?.serving) {
    // 人前モード: 0.5/1/1.5/2/3人前
    [0.5, 1, 1.5, 2, 3].forEach(n => {
      const gVal = Math.round(serving * n * 10) / 10;
      const label = n === Math.floor(n) ? `${n}人前` : `${n}人前`;
      buttons.push(`<button onclick="setAddAmtServing('${meal}',${n})"
        style="font-size:11px;padding:3px 9px;border:1px solid var(--border);border-radius:6px;
        background:${n===1?'var(--accent)':'var(--bg)'};color:${n===1?'#fff':'var(--text)'};cursor:pointer;white-space:nowrap">
        ${label}<span style="font-size:9px;opacity:.7;margin-left:3px">${gVal}g</span></button>`);
    });
  } else {
    // gモード: per値軸の選択肢
    const candidates = new Set([per]);
    [50, 100, 150, 200, 250, 300].forEach(v => candidates.add(v));
    if (serving && serving !== per) candidates.add(serving);
    if (per !== 100) [Math.round(per*0.5), Math.round(per*2)].forEach(v => v>0 && candidates.add(v));
    [...candidates].filter(v=>v>0).sort((a,b)=>a-b).forEach(v => {
      const isStar = v === (serving || per);
      buttons.push(`<button onclick="setAddAmt('${meal}',${v})"
        style="font-size:11px;padding:3px 8px;border:1px solid var(--border);border-radius:6px;
        background:${isStar?'var(--accent)':'var(--bg)'};color:${isStar?'#fff':'var(--text)'};cursor:pointer;white-space:nowrap">
        ${v}g${isStar?' ★':''}</button>`);
    });
  }

  cont.innerHTML = buttons.join('');
  if (toggle) {
    cont.style.display = cont.style.display === 'none' ? 'flex' : 'none';
  } else {
    if (cont.style.display !== 'none') cont.style.display = 'flex';
  }
}

function setAddAmtServing(meal, servings) {
  const base    = window._addBase?.[meal];
  const serving = base?.serving || base?.per || 100;
  const gVal    = Math.round(serving * servings * 10) / 10;
  const inp     = document.getElementById('addAmt_'+meal);
  if (inp) { inp.value = servings; }
  recalcAdd(meal);
}

function setAddAmt(meal, val) {
  const el = document.getElementById('addAmt_'+meal);
  if (el) { el.value = val; recalcAdd(meal); }
  const cont = document.getElementById('amtQuickPick_'+meal);
  if (cont) cont.style.display = 'none';
}


function fillAddMacros(f, amt, meal) {
  const r=amt/(f.per||100);
  const set=(id,val)=>{const el=document.getElementById(id+'_'+meal);if(el)el.value=r1(val*r)};
  set('addCal',f.cal);set('addP',f.p);set('addF',f.f);set('addC',f.c);
  set('addFib',f.fiber||0);set('addFe',f.iron||0);set('addCa',f.calcium||0);set('addVc',f.vitc||0);set('addVd',f.vitd||0);
  const se=document.getElementById('addSalt_'+meal); if(se) se.value=r2((f.salt||0)*r);
}
function recalcAdd(meal) {
  const bn = window._addBase && window._addBase[meal]; if(!bn) return;
  const unit    = window._amtUnit?.[meal] || 'g';
  const rawVal  = parseFloat(document.getElementById('addAmt_'+meal)?.value) || 0;
  if (rawVal <= 0) return;
  const serving = bn.serving || bn.per || 100;
  const amtG    = unit === 'serving' ? rawVal * serving : rawVal;
  fillAddMacros(bn, amtG, meal);
}
// ── 重複食品のマージ登録 ──
// 同じ日付・食事区分・食品名（トリム＋大小文字無視）の記録が既にある場合は
// 新規エントリを追加せず、既存エントリへ数量・栄養価を加算する。
function normFoodName(n) { return (n || '').trim().toLowerCase().replace(/\s+/g, ''); }
function findDuplicateEntry(date, meal, name, excludeId) {
  const key = normFoodName(name);
  if (!key) return null;
  return entries.find(e =>
    e.date === date && e.meal === meal &&
    normFoodName(e.name) === key &&
    (excludeId == null || e.id !== excludeId)
  ) || null;
}
function addOrMergeEntry(newEntry, excludeId) {
  const dup = findDuplicateEntry(newEntry.date, newEntry.meal, newEntry.name, excludeId);
  if (dup) {
    dup.amount  = r1((dup.amount  || 0) + (newEntry.amount  || 0));
    dup.cal     = r1((dup.cal     || 0) + (newEntry.cal     || 0));
    dup.p       = r1((dup.p       || 0) + (newEntry.p       || 0));
    dup.f       = r1((dup.f       || 0) + (newEntry.f       || 0));
    dup.c       = r1((dup.c       || 0) + (newEntry.c       || 0));
    dup.fiber   = r1((dup.fiber   || 0) + (newEntry.fiber   || 0));
    dup.iron    = r2((dup.iron    || 0) + (newEntry.iron    || 0));
    dup.calcium = r1((dup.calcium || 0) + (newEntry.calcium || 0));
    dup.vitc    = r1((dup.vitc    || 0) + (newEntry.vitc    || 0));
    dup.vitd    = r2((dup.vitd    || 0) + (newEntry.vitd    || 0));
    dup.salt    = r2((dup.salt    || 0) + (newEntry.salt    || 0));
    if (!dup.fa && newEntry.fa) dup.fa = newEntry.fa;
    if (!dup.aa && newEntry.aa) dup.aa = newEntry.aa;
    if (!dup._fa && newEntry._fa) dup._fa = newEntry._fa;
    return { entry: dup, merged: true };
  }
  entries.push(newEntry);
  return { entry: newEntry, merged: false };
}

function gv(id) { return parseFloat(document.getElementById(id).value)||0; }
function addEntry(meal) {
  const nameEl=document.getElementById('addName_'+meal);
  const name=nameEl?nameEl.value.trim():'';
  const msg=document.getElementById('addMsg_'+meal);
  if(!name){if(msg){msg.className='status-msg status-err';msg.textContent='食品名を入力してください'}return}
  const newEntry = {id:Date.now(),date:currentDate,name,meal,
    cal:gv('addCal_'+meal),p:gv('addP_'+meal),f:gv('addF_'+meal),c:gv('addC_'+meal),
    amount: (() => {
      const unit = window._amtUnit?.[meal] || 'g';
      const raw  = parseFloat(document.getElementById('addAmt_'+meal)?.value) || 1;
      const base = window._addBase?.[meal];
      if (unit === 'serving' && base?.serving) return Math.round(raw * base.serving * 10) / 10;
      return raw || 100;
    })(),
    fiber:gv('addFib_'+meal),iron:gv('addFe_'+meal),calcium:gv('addCa_'+meal),vitc:gv('addVc_'+meal),vitd:gv('addVd_'+meal),salt:gv('addSalt_'+meal),
    fa: window._addBase?.[meal]?.fa || null,
    aa: window._addBase?.[meal]?.aa || null,
    _fa: window._addBase?.[meal]?.fa || null,
  };
  // faもaaも未設定なら名前から推定
  if (!newEntry.fa || !newEntry.aa) enrichFoodProfile(newEntry);
  const { merged } = addOrMergeEntry(newEntry);
  save(); renderRecord(); renderCalendar();
  setTimeout(()=>{const m=document.getElementById('addMsg_'+meal);if(m){m.className='status-msg status-ok';m.textContent=merged?`「${name}」は既に記録済みのため数量を合算しました`:`「${name}」を追加しました`;setTimeout(()=>{if(m)m.textContent=''},2200)}},30);
}
function toggleAddPanel(meal){activeAddMeal=activeAddMeal===meal?null:meal;editingId=null;renderRecord()}
function startEdit(id){editingId=id;renderRecord()}
function recalcEdit(id) {
  const base = window._editBase && window._editBase[id];
  if (!base) return;
  const amt = parseFloat(document.getElementById('ea'+id).value) || 0;
  if (amt <= 0) return;
  const r = amt / (base.per || 100);
  const set = (elId, val, dec) => {
    const el = document.getElementById(elId+id);
    if (el) el.value = dec === 2 ? r2(val*r) : r1(val*r);
  };
  set('ec', base.cal);
  set('ep', base.p);
  set('ef', base.f);
  set('ecc', base.c);
  set('efib', base.fiber);
  set('efe', base.iron);
  set('eca', base.calcium);
  set('evc', base.vitc);
  set('evd', base.vitd);
  set('esl', base.salt, 2);
}
function cancelEdit(){if(window._editBase)window._editBase={};editingId=null;renderRecord()}
function saveEdit(id) {
  const idx=entries.findIndex(e=>e.id===id); if(idx===-1) return;
  entries[idx]={...entries[idx],name:document.getElementById('en'+id).value.trim()||entries[idx].name,amount:parseFloat(document.getElementById('ea'+id).value)||entries[idx].amount,
    cal:parseFloat(document.getElementById('ec'+id).value)||0,p:parseFloat(document.getElementById('ep'+id).value)||0,f:parseFloat(document.getElementById('ef'+id).value)||0,c:parseFloat(document.getElementById('ecc'+id).value)||0,
    fiber:parseFloat(document.getElementById('efib'+id).value)||0,iron:parseFloat(document.getElementById('efe'+id).value)||0,calcium:parseFloat(document.getElementById('eca'+id).value)||0,
    vitc:parseFloat(document.getElementById('evc'+id).value)||0,vitd:parseFloat(document.getElementById('evd'+id).value)||0,salt:parseFloat(document.getElementById('esl'+id).value)||0,
    meal:document.getElementById('em'+id).value};
  save(); editingId=null; renderRecord(); renderCalendar();
}
function deleteEntry(id){
  const idx = entries.findIndex(e=>e.id===id);
  if (idx === -1) return;
  const removed = entries[idx];
  entries.splice(idx,1);
  if(editingId===id)editingId=null;
  save();renderRecord();renderCalendar();
  showUndoToast(`「${removed.name}」を削除しました`, () => {
    entries.splice(Math.min(idx, entries.length), 0, removed);
    save(); renderRecord(); renderCalendar();
  });
}

// ── Exercise ──
const EXERCISE_TYPES = {
  '3.5': 'ウォーキング',
  '7.0': 'ジョギング',
  '8.0': 'ランニング',
  '6.0': 'サイクリング',
  '8.0s': '水泳',
  '4.5': '筋トレ',
  '3.0': 'ヨガ・ストレッチ',
  '6.0b': 'バドミントン',
  '7.0t': 'テニス',
  '0': 'その他',
};

function toggleExercisePanel() {
  exPanelOpen = !exPanelOpen;
  const panel = document.getElementById('exerciseAddPanel');
  const btn   = document.getElementById('exAddBtn');
  if (panel) panel.style.display = exPanelOpen ? 'block' : 'none';
  if (btn)   btn.textContent      = exPanelOpen ? '✕ 閉じる' : '＋ 追加';
  if (exPanelOpen) onExTypeChange();
}

function onExTypeChange() {
  const sel = document.getElementById('exType');
  const manualRow = document.getElementById('exManualRow');
  if (!sel || !manualRow) return;
  manualRow.style.display = sel.value === '0' ? 'flex' : 'none';
}

function addExercise() {
  const sel  = document.getElementById('exType');
  const mins = parseFloat(document.getElementById('exMinutes').value) || 0;
  const msg  = document.getElementById('exMsg');

  if (!sel) return;
  const mets = parseFloat(sel.value);
  const isManual = sel.value === '0';

  let burnedCal = 0;
  let exName    = '';

  if (isManual) {
    burnedCal = parseFloat(document.getElementById('exManualCal').value) || 0;
    exName    = (document.getElementById('exManualName').value || '').trim() || 'その他';
  } else {
    if (mins <= 0) {
      if (msg) { msg.className='status-msg status-err'; msg.textContent='時間を入力してください'; }
      return;
    }
    // 消費カロリー = METs × 体重(kg) × 時間(h)
    const weight = profile.weight || userWeight || 65;
    burnedCal = r1(mets * weight * (mins / 60));
    // select の表示テキストから種目名を取得
    exName = sel.options[sel.selectedIndex].text.replace(/（.*）/, '').trim();
  }

  if (burnedCal <= 0) {
    if (msg) { msg.className='status-msg status-err'; msg.textContent='消費カロリーを入力してください'; }
    return;
  }

  exercises.push({
    id: Date.now(),
    date: currentDate,
    name: exName,
    minutes: mins,
    cal: burnedCal,
  });
  saveExercises();
  renderExerciseItems();

  // フォームリセット
  document.getElementById('exMinutes').value = '30';
  const manualCal  = document.getElementById('exManualCal');
  const manualName = document.getElementById('exManualName');
  if (manualCal)  manualCal.value  = '';
  if (manualName) manualName.value = '';

  if (msg) {
    msg.className = 'status-msg status-ok';
    msg.textContent = `「${exName}」を追加しました（${burnedCal} kcal）`;
    setTimeout(() => { if (msg) msg.textContent = ''; }, 2000);
  }
}

function deleteExercise(id) {
  const idx = exercises.findIndex(e => e.id === id);
  if (idx === -1) return;
  const removed = exercises[idx];
  exercises.splice(idx, 1);
  saveExercises();
  renderExerciseItems();
  showUndoToast(`「${removed.name}」を削除しました`, () => {
    exercises.splice(Math.min(idx, exercises.length), 0, removed);
    saveExercises(); renderExerciseItems();
  });
}

function renderExerciseItems() {
  const dayEx  = exercises.filter(e => e.date === currentDate);
  const items  = document.getElementById('exerciseItems');
  const sub    = document.getElementById('exerciseSub');
  const totalCal = dayEx.reduce((a, e) => a + (e.cal || 0), 0);

  if (sub) sub.textContent = dayEx.length ? `${ri(totalCal)} kcal 消費` : '未記録';

  if (!items) return;
  if (!dayEx.length) { items.innerHTML = ''; return; }

  items.innerHTML = `<div class="meal-items">${
    dayEx.map(e =>
      `<div class="log-item">
        <div>
          <div class="li-name">${e.name}</div>
          <div class="li-detail">${e.minutes ? e.minutes + '分' : ''}　消費 ${ri(e.cal)} kcal</div>
        </div>
        <div class="li-right">
          <div class="li-cal" style="color:#e91e63">${ri(e.cal)}</div>
          <button class="btn btn-sm btn-danger" onclick="deleteExercise(${e.id})" style="padding:6px 10px">✕</button>
        </div>
      </div>`
    ).join('')
  }</div>`;
}

// ── Copy ──
function renderCopyPanel() {
  const filter=document.getElementById('copyFilter').value;
  const days=[...new Set(entries.map(e=>e.date))].filter(d=>d!==currentDate).sort((a,b)=>b.localeCompare(a)).slice(0,14);
  const cont=document.getElementById('copyPanel');
  if(!days.length){cont.innerHTML=`<div style="font-size:12px;color:var(--text-sub);padding:8px 0">記録がありません</div>`;return}
  let html='';
  days.forEach(d=>{
    const grouped={};MEALS_ORDER.forEach(m=>{grouped[m]=[]});
    getDayEntries(d).filter(e=>!filter||e.meal===filter).forEach(e=>{(grouped[e.meal]||grouped['間食']).push(e)});
    MEALS_ORDER.forEach(meal=>{
      const mitems=grouped[meal];if(!mitems||!mitems.length||(filter&&meal!==filter))return;
      const ms=sumEntries(mitems);
      html+=`<div class="copy-item"><div class="ci-header"><span class="ci-title">${fmtDate(d)} — ${meal}（${ri(ms.cal)}kcal）</span><button class="btn btn-sm btn-primary" onclick="copyMeal('${d}','${meal}')">コピー</button></div>${mitems.map(e=>`<div class="ci-food">${e.name}（${e.amount}g）${ri(e.cal)}kcal</div>`).join('')}</div>`;
    });
  });
  cont.innerHTML=html||`<div style="font-size:12px;color:var(--text-sub);padding:8px 0">該当なし</div>`;
}
function copyMeal(date, meal) {
  const target=document.getElementById('copyTarget').value;
  getDayEntries(date).filter(e=>e.meal===meal).forEach(e=>entries.push({...e,id:Date.now()+Math.random(),date:currentDate,meal:target}));
  save(); renderRecord(); renderCalendar();
}

// ── Stats ──
// ── 食品プロファイル自動付与 ──
// 外部API・AI・手動登録食品に fa/aa を自動推定して付与する
const AA_PROFILES_MAP = {
  whey:    {leu:.11,ile:.07,val:.06,lys:.10,met:.02,thr:.07,trp:.02,his:.02,score:1.09},
  egg:     {leu:.09,ile:.06,val:.07,lys:.09,met:.03,thr:.06,trp:.02,his:.03,score:1.13},
  chicken: {leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.08},
  beef:    {leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:1.00},
  pork:    {leu:.09,ile:.05,val:.05,lys:.09,met:.03,thr:.05,trp:.01,his:.03,score:0.98},
  fish:    {leu:.09,ile:.05,val:.05,lys:.10,met:.03,thr:.05,trp:.01,his:.03,score:1.00},
  milk:    {leu:.10,ile:.06,val:.07,lys:.08,met:.03,thr:.05,trp:.01,his:.03,score:1.22},
  casein:  {leu:.09,ile:.06,val:.06,lys:.08,met:.03,thr:.04,trp:.01,his:.03,score:1.07},
  soy:     {leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.91},
  wheat:   {leu:.07,ile:.04,val:.04,lys:.02,met:.02,thr:.03,trp:.01,his:.02,score:0.45},
  rice:    {leu:.08,ile:.04,val:.05,lys:.04,met:.02,thr:.04,trp:.01,his:.02,score:0.59},
  legume:  {leu:.08,ile:.05,val:.05,lys:.07,met:.01,thr:.04,trp:.01,his:.03,score:0.72},
  nut:     {leu:.07,ile:.04,val:.05,lys:.03,met:.02,thr:.03,trp:.01,his:.03,score:0.40},
  mixed:   {leu:.08,ile:.05,val:.05,lys:.06,met:.02,thr:.04,trp:.01,his:.03,score:0.75},
};
const AA_PAT_MAP = [
  [/ホエイ|whey|WPC|WPI/i,                                          'whey'],
  [/カゼイン|casein/i,                                               'casein'],
  [/卵|たまご|タマゴ|目玉焼き|ゆで卵|スクランブル|玉子|オムレツ/i,  'egg'],
  [/鶏|チキン|ささみ|焼き鳥|唐揚げ|から揚げ|ファミチキ/i,           'chicken'],
  [/牛|ビーフ|ハンバーグ|牛丼|ワッパー/i,                           'beef'],
  [/豚|ポーク|とんかつ|メンチ|ウインナー|ソーセージ|ベーコン|ハム|餃子|シュウマイ/i, 'pork'],
  [/さば|さんま|いわし|まぐろ|マグロ|ツナ|鮭|サーモン|あじ|ぶり|えび|いか|ほたて|あさり|カニ|シーフード/i, 'fish'],
  [/牛乳|ミルク|ヨーグルト|チーズ|乳/i,                             'milk'],
  [/豆腐|納豆|豆乳|大豆|えだまめ|きな粉/i,                          'soy'],
  [/ご飯|白米|玄米|おにぎり|寿司|チャーハン/i,                      'rice'],
  [/パン|うどん|パスタ|スパゲッティ|ラーメン|そば|麺|ピザ|クッキー/i,'wheat'],
  [/レンズ豆|ひよこ豆|黒豆|インゲン|あずき/i,                       'legume'],
  [/アーモンド|くるみ|ピーナッツ|ナッツ|ごま/i,                     'nut'],
];
const FA_PAT_MAP = [
  [/米油/i,                    {sat:.17,mufa:.42,n3:.01,n6:.35,trans:.01}],
  [/オリーブ/i,                {sat:.14,mufa:.74,n3:.01,n6:.10,trans:.00}],
  [/ごま油/i,                  {sat:.15,mufa:.39,n3:.00,n6:.43,trans:.00}],
  [/えごま|亜麻仁/i,           {sat:.09,mufa:.19,n3:.57,n6:.14,trans:.00}],
  [/バター/i,                  {sat:.63,mufa:.27,n3:.01,n6:.03,trans:.04}],
  [/マーガリン/i,              {sat:.22,mufa:.44,n3:.06,n6:.24,trans:.04}],
  [/マヨネーズ/i,              {sat:.12,mufa:.35,n3:.06,n6:.44,trans:.01}],
  [/サラダ油|キャノーラ|菜種/i,{sat:.15,mufa:.29,n3:.07,n6:.47,trans:.00}],
  [/さば|鯖/i,                 {sat:.25,mufa:.29,n3:.31,n6:.04,trans:.00}],
  [/さんま/i,                  {sat:.22,mufa:.42,n3:.22,n6:.03,trans:.00}],
  [/いわし|オイルサーディン/i, {sat:.25,mufa:.27,n3:.31,n6:.05,trans:.00}],
  [/まぐろ|マグロ|ツナ/i,      {sat:.28,mufa:.18,n3:.38,n6:.05,trans:.00}],
  [/鮭|サーモン/i,             {sat:.22,mufa:.32,n3:.32,n6:.08,trans:.00}],
  [/ぶり/i,                    {sat:.24,mufa:.39,n3:.21,n6:.06,trans:.00}],
  [/えび|いか/i,               {sat:.30,mufa:.18,n3:.28,n6:.10,trans:.00}],
  [/ほたて|あさり|カニ/i,      {sat:.28,mufa:.24,n3:.24,n6:.08,trans:.00}],
  [/鶏もも|唐揚げ|から揚げ|焼き鳥/i,{sat:.31,mufa:.44,n3:.03,n6:.18,trans:.01}],
  [/鶏むね|ささみ|サラダチキン/i,    {sat:.28,mufa:.40,n3:.02,n6:.22,trans:.01}],
  [/豚|ポーク|とんかつ|ベーコン|ハム|ウインナー|ソーセージ|餃子/i, {sat:.38,mufa:.46,n3:.01,n6:.12,trans:.01}],
  [/牛|ビーフ|ハンバーグ/i,    {sat:.47,mufa:.43,n3:.01,n6:.05,trans:.02}],
  [/卵|たまご|目玉焼き|ゆで卵|スクランブル/i, {sat:.30,mufa:.42,n3:.03,n6:.19,trans:.01}],
  [/牛乳|ミルク/i,             {sat:.62,mufa:.28,n3:.01,n6:.02,trans:.03}],
  [/チーズ/i,                  {sat:.63,mufa:.27,n3:.01,n6:.02,trans:.03}],
  [/ヨーグルト/i,              {sat:.60,mufa:.30,n3:.01,n6:.03,trans:.02}],
  [/豆腐|納豆|豆乳|大豆/i,     {sat:.14,mufa:.24,n3:.07,n6:.52,trans:.00}],
  [/くるみ/i,                  {sat:.08,mufa:.15,n3:.13,n6:.58,trans:.00}],
  [/アーモンド/i,              {sat:.08,mufa:.66,n3:.00,n6:.22,trans:.00}],
  [/ピーナッツ/i,              {sat:.17,mufa:.46,n3:.00,n6:.32,trans:.00}],
  [/ごま（炒り）/i,            {sat:.15,mufa:.38,n3:.00,n6:.42,trans:.00}],
  [/プロテイン/i,              {sat:.20,mufa:.28,n3:.04,n6:.16,trans:.01}],
  [/天ぷら|フライ|揚げ|コロッケ|たこ焼き/i, {sat:.20,mufa:.32,n3:.05,n6:.38,trans:.01}],
  [/バーガー|マクドナルド|KFC|ポテト/i,      {sat:.32,mufa:.38,n3:.03,n6:.22,trans:.02}],
  [/ピザ/i,                    {sat:.35,mufa:.35,n3:.02,n6:.20,trans:.02}],
  [/カレー/i,                  {sat:.30,mufa:.35,n3:.03,n6:.25,trans:.01}],
  [/ラーメン|パスタ|うどん|そば|焼きそば/i, {sat:.25,mufa:.30,n3:.04,n6:.30,trans:.01}],
];

// 食品名から fa/aa を推定して付与
function enrichFoodProfile(entry) {
  const name = entry.name || '';
  // fa 推定
  if (!entry.fa && (entry.f || 0) >= 0.5) {
    for (const [pat, prof] of FA_PAT_MAP) {
      if (pat.test(name)) { entry.fa = prof; break; }
    }
  }
  // aa 推定（タンパク質1g以上）
  if (!entry.aa && (entry.p || 0) >= 1.0) {
    let aaKey = 'mixed';
    for (const [pat, key] of AA_PAT_MAP) {
      if (pat.test(name)) { aaKey = key; break; }
    }
    entry.aa = AA_PROFILES_MAP[aaKey];
  }
  return entry;
}


// 各カテゴリの脂肪酸比率（脂質g全体に対する割合）
// sat=飽和, mufa=一価不飽和(ω9主体), pufa_n3=ω3, pufa_n6=ω6, pufa_n9=ω9(リノレイン酸以外の一価)
// 参考: 日本食品標準成分表2020 脂肪酸組成
const FATTY_ACID_PROFILES = [
  // ── 油脂類 ──
  { pat:/米油|こめあぶら/i,          label:'米油',         sat:.17, mufa:.42, n3:.01, n6:.35, n9:.04, trans:.01 },
  { pat:/オリーブ|olive/i,           label:'オリーブ油',   sat:.14, mufa:.74, n3:.01, n6:.10, n9:.00, trans:.00 },
  { pat:/ごま油|セサミ|sesame/i,     label:'ごま油',       sat:.15, mufa:.39, n3:.00, n6:.43, n9:.02, trans:.00 },
  { pat:/サラダ油|大豆油|キャノーラ|菜種/i, label:'サラダ油', sat:.15, mufa:.29, n3:.07, n6:.47, n9:.02, trans:.00 },
  { pat:/バター|butter/i,            label:'バター',       sat:.63, mufa:.27, n3:.01, n6:.03, n9:.01, trans:.04 },
  { pat:/マーガリン|margarine/i,     label:'マーガリン',   sat:.22, mufa:.44, n3:.06, n6:.24, n9:.00, trans:.04 },
  { pat:/ラード|豚脂/i,              label:'ラード',       sat:.39, mufa:.45, n3:.00, n6:.11, n9:.05, trans:.00 },
  { pat:/ヘット|牛脂/i,              label:'牛脂',         sat:.51, mufa:.43, n3:.01, n6:.03, n9:.01, trans:.01 },
  { pat:/ココナッツ|coconut/i,       label:'ココナッツ油', sat:.88, mufa:.06, n3:.00, n6:.02, n9:.04, trans:.00 },
  { pat:/えごま|亜麻|フラックス|linseed|flax/i, label:'えごま油', sat:.09, mufa:.19, n3:.57, n6:.14, n9:.01, trans:.00 },
  { pat:/くるみ|ウォールナッツ|walnut/i, label:'くるみ',  sat:.08, mufa:.15, n3:.13, n6:.58, n9:.06, trans:.00 },
  { pat:/アーモンド|almond/i,        label:'アーモンド',   sat:.08, mufa:.66, n3:.00, n6:.22, n9:.04, trans:.00 },
  // ── 魚類（EPA/DHA豊富 → ω3高） ──
  { pat:/さば|鯖|mackerel/i,         label:'さば',         sat:.25, mufa:.29, n3:.31, n6:.04, n9:.09, trans:.00 },
  { pat:/さんま|秋刀魚/i,            label:'さんま',       sat:.22, mufa:.42, n3:.22, n6:.03, n9:.09, trans:.00 },
  { pat:/いわし|鰯|sardine/i,        label:'いわし',       sat:.25, mufa:.27, n3:.31, n6:.05, n9:.10, trans:.00 },
  { pat:/まぐろ|マグロ|ツナ|tuna/i,  label:'まぐろ',       sat:.28, mufa:.18, n3:.38, n6:.05, n9:.08, trans:.00 },
  { pat:/鮭|さけ|サーモン|salmon/i,  label:'鮭',           sat:.22, mufa:.32, n3:.32, n6:.08, n9:.04, trans:.00 },
  { pat:/ぶり|鰤|yellowtail/i,       label:'ぶり',         sat:.24, mufa:.39, n3:.21, n6:.06, n9:.08, trans:.00 },
  { pat:/えび|海老|shrimp/i,         label:'えび',         sat:.30, mufa:.18, n3:.28, n6:.10, n9:.12, trans:.00 },
  { pat:/いか|烏賊|squid/i,          label:'いか',         sat:.31, mufa:.22, n3:.26, n6:.07, n9:.12, trans:.00 },
  // ── 肉類 ──
  { pat:/鶏もも|鶏モモ/i,            label:'鶏もも',       sat:.31, mufa:.44, n3:.03, n6:.18, n9:.03, trans:.01 },
  { pat:/鶏むね|鶏胸|ささみ|チキン|chicken/i, label:'鶏むね', sat:.28, mufa:.40, n3:.02, n6:.22, n9:.06, trans:.01 },
  { pat:/豚ロース|豚バラ|豚ひき|ポーク|pork/i, label:'豚肉', sat:.38, mufa:.46, n3:.01, n6:.12, n9:.02, trans:.01 },
  { pat:/牛ロース|牛バラ|牛ひき|ビーフ|beef/i, label:'牛肉', sat:.47, mufa:.43, n3:.01, n6:.05, n9:.02, trans:.02 },
  { pat:/ベーコン|ハム|ソーセージ|ウインナー/i, label:'加工肉', sat:.36, mufa:.44, n3:.01, n6:.12, n9:.03, trans:.02 },
  // ── 卵・乳製品 ──
  { pat:/卵|たまご|タマゴ|egg/i,      label:'卵',           sat:.30, mufa:.42, n3:.03, n6:.19, n9:.04, trans:.01 },
  { pat:/牛乳|ミルク|milk/i,          label:'牛乳',         sat:.62, mufa:.28, n3:.01, n6:.02, n9:.05, trans:.03 },
  { pat:/チーズ|cheese/i,             label:'チーズ',       sat:.63, mufa:.27, n3:.01, n6:.02, n9:.03, trans:.03 },
  { pat:/ヨーグルト|yogurt/i,         label:'ヨーグルト',   sat:.60, mufa:.30, n3:.01, n6:.03, n9:.04, trans:.02 },
  // ── 大豆・ナッツ ──
  { pat:/豆腐|とうふ|大豆|soy|tofu/i, label:'大豆製品',    sat:.14, mufa:.24, n3:.07, n6:.52, n9:.03, trans:.00 },
  { pat:/納豆/i,                       label:'納豆',         sat:.13, mufa:.22, n3:.07, n6:.54, n9:.04, trans:.00 },
  // ── デフォルト（分類不明） ──
];
// デフォルト（日本の食事平均的な脂肪酸比率）
const FA_DEFAULT = { sat:.30, mufa:.35, n3:.04, n6:.26, n9:.04, trans:.01 };

const FA_GOALS = {
  sat:  { label:'飽和脂肪酸',    short:'飽和',   color:'#e57373', ideal:'〜30%', goodFn: v => v <= 30 },
  mufa: { label:'一価不飽和(ω9)',short:'ω9/MUFA',color:'#81c784', ideal:'35〜45%', goodFn: v => v >= 30 && v <= 50 },
  n3:   { label:'多価不飽和 ω3', short:'ω3',     color:'#64b5f6', ideal:'5〜10%', goodFn: v => v >= 3 && v <= 15 },
  n6:   { label:'多価不飽和 ω6', short:'ω6',     color:'#ffb74d', ideal:'25〜40%', goodFn: v => v >= 15 && v <= 45 },
  trans:{ label:'トランス脂肪酸',short:'トランス',color:'#ef9a9a', ideal:'〜1%',  goodFn: v => v <= 1 },
};

function classifyFattyAcid(name) {
  for (const prof of FATTY_ACID_PROFILES) {
    if (prof.pat.test(name)) return prof;
  }
  return null;
}

function calcFattyAcids(list) {
  const totals = { sat:0, mufa:0, n3:0, n6:0, trans:0 };
  let totalFat = 0;

  list.forEach(e => {
    const fatG = e.f || 0;
    if (fatG < 0.5) return; // 脂質0.5g未満スキップ
    totalFat += fatG;

    // ① エントリに直接faフィールドがある場合（LOCAL_DB紐付き）優先
    let prof = e._fa || null;

    // ② パターンマッチ（手動入力・カスタム食品）
    if (!prof) {
      for (const p of FATTY_ACID_PROFILES) {
        if (p.pat.test(e.name)) { prof = p; break; }
      }
    }
    if (!prof) prof = FA_DEFAULT;

    totals.sat   += fatG * (prof.sat   || 0);
    totals.mufa  += fatG * (prof.mufa  || 0);
    totals.n3    += fatG * (prof.n3    || 0);
    totals.n6    += fatG * (prof.n6    || 0);
    totals.trans += fatG * (prof.trans || 0);
  });

  if (totalFat < 0.5) return null;

  const pct = {};
  Object.keys(totals).forEach(k => { pct[k] = r1(totals[k] / totalFat * 100); });
  const n3n6ratio = totals.n6 > 0 ? r1(totals.n3 / totals.n6) : 0;
  const abs = {};
  return { pct, abs, totalFat: r1(totalFat), n3n6ratio };
}

function renderFattyAcidPanel(list) {
  const el = document.getElementById('fattyAcidPanel');
  if (!el) return;

  // 脂質0.5g未満の食品をスキップ理由として記録
  const skipped = list.filter(e => (e.f || 0) < 0.5).map(e => e.name);
  const data = calcFattyAcids(list);

  if (!data || data.totalFat < 0.5) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text-sub);padding:4px 0">脂質の記録が少ないため推定できません（目安: 5g以上）</div>';
    return;
  }

  const { pct, abs, totalFat, n3n6ratio } = data;

  // DB紐付き件数 / パターンマッチ件数 / デフォルト件数をカウント
  let dbCount = 0, patCount = 0, defCount = 0;
  list.forEach(e => {
    if ((e.f || 0) < 0.5) return;
    if (e._fa) dbCount++;
    else {
      let matched = false;
      for (const p of FATTY_ACID_PROFILES) { if (p.pat.test(e.name)) { matched = true; break; } }
      if (matched) patCount++; else defCount++;
    }
  });

  const bars = ['sat','mufa','n3','n6','trans'].map(k => {
    const g    = FA_GOALS[k];
    const v    = pct[k];
    const good = g.goodFn(v);
    const barW = Math.min(v, 80);
    return `
      <div style="margin-bottom:7px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px">
          <span style="font-size:11px;font-weight:600">${g.label}</span>
          <span style="display:flex;align-items:baseline;gap:5px">
            <span style="font-size:13px;font-weight:700;color:${good ? 'var(--green)' : 'var(--amber)'}">${v}%</span>
            <span style="font-size:10px;color:var(--text-sub)">${abs[k]}g</span>
            <span style="font-size:9px;color:var(--text-sub)">目標${g.ideal}</span>
            <span style="font-size:11px">${good ? '✓' : '△'}</span>
          </span>
        </div>
        <div style="height:8px;border-radius:4px;background:var(--border);overflow:hidden">
          <div style="height:100%;border-radius:4px;width:${barW}%;background:${g.color};transition:width .5s cubic-bezier(.4,0,.2,1)"></div>
        </div>
      </div>`;
  }).join('');

  const ratioColor   = n3n6ratio >= 0.2 ? 'var(--green)' : n3n6ratio >= 0.1 ? 'var(--amber)' : 'var(--red)';
  const ratioComment = n3n6ratio >= 0.25
    ? '理想的なバランスです'
    : n3n6ratio >= 0.1
    ? 'ω3をもう少し増やすと◎（青魚・えごま油など）'
    : 'ω6過多です。ω3源（青魚・亜麻仁・くるみ）を意識して摂りましょう';

  // 精度インジケーター
  const total = dbCount + patCount + defCount || 1;
  const accuracy = Math.round((dbCount + patCount) / total * 100);
  const accColor = accuracy >= 80 ? 'var(--green)' : accuracy >= 50 ? 'var(--amber)' : 'var(--red)';

  el.innerHTML = `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:11px 12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:4px">
        <div style="font-size:10px;color:var(--text-sub)">脂質総量 ${totalFat}g を分析</div>
        <div style="display:flex;gap:4px;font-size:9px;flex-wrap:wrap">
          ${dbCount > 0 ? `<span style="background:var(--green-light);color:var(--green);border-radius:4px;padding:1px 5px;font-weight:600">DB紐付き ${dbCount}品</span>` : ''}
          ${patCount > 0 ? `<span style="background:var(--accent-light);color:var(--accent);border-radius:4px;padding:1px 5px;font-weight:600">パターン ${patCount}品</span>` : ''}
          ${defCount > 0 ? `<span style="background:var(--amber-light);color:#c67c00;border-radius:4px;padding:1px 5px;font-weight:600">推定平均 ${defCount}品</span>` : ''}
          <span style="background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:1px 5px;color:${accColor};font-weight:600">精度 ${accuracy}%</span>
        </div>
      </div>
      ${bars}
      <div style="margin-top:10px;padding:9px 11px;background:var(--surface);border-radius:8px;border:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:11px;font-weight:600">ω3 : ω6 比率</span>
          <span style="font-size:15px;font-weight:700;color:${ratioColor}">1 : ${n3n6ratio > 0 ? r1(1/n3n6ratio) : '∞'}</span>
        </div>
        <div style="font-size:11px;color:var(--text-sub)">${ratioComment}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px">理想比率: ω3:ω6 = 1:4〜1:5 程度</div>
      </div>
      ${skipped.length ? `<div style="font-size:10px;color:var(--text-muted);margin-top:6px">脂質0.5g未満のためスキップ: ${skipped.slice(0,5).join('、')}${skipped.length > 5 ? '…他' : ''}</div>` : ''}
      <div style="font-size:10px;color:var(--text-sub);margin-top:8px;line-height:1.6;padding-top:6px;border-top:1px solid var(--border)">
        ⚠ 食品名・DB紐付きからの推定値です。調理法・産地・ブランドにより実際の比率は異なります。
      </div>
    </div>`;
}



let metaCompMode = 'fat'; // fat / mixed / custom

function toggleMetaHelp() {
  const el = document.getElementById('metaHelp');
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function setMetaCompMode(mode, el) {
  metaCompMode = mode;
  document.querySelectorAll('.meta-comp-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  const customPanel = document.getElementById('metaCustomComp');
  if (customPanel) customPanel.style.display = mode === 'custom' ? 'block' : 'none';
  calcMetabolism();
}

function initMetaInputs() {
  // デフォルト: 直近30日
  const to   = new Date(currentDate + 'T00:00:00');
  const from = new Date(to); from.setDate(from.getDate() - 29);
  const toEl   = document.getElementById('metaTo');
  const fromEl = document.getElementById('metaFrom');
  if (toEl   && !toEl.value)   toEl.value   = toDateStr(to);
  if (fromEl && !fromEl.value) fromEl.value  = toDateStr(from);
  // 体重はプロフィールからプリセット
  const wFrom = document.getElementById('metaWFrom');
  const wTo   = document.getElementById('metaWTo');
  if (wFrom && !wFrom.value) wFrom.value = profile.weight || '';
  if (wTo   && !wTo.value)   wTo.value   = profile.weight || '';
}

function calcMetabolism() {
  const fromStr = document.getElementById('metaFrom')?.value;
  const toStr   = document.getElementById('metaTo')?.value;
  const wFrom   = parseFloat(document.getElementById('metaWFrom')?.value);
  const wTo     = parseFloat(document.getElementById('metaWTo')?.value);
  const result  = document.getElementById('metaResult');
  if (!result) return;

  if (!fromStr || !toStr || isNaN(wFrom) || isNaN(wTo)) {
    result.innerHTML = '<div style="font-size:12px;color:var(--text-sub);padding:8px 0">すべての項目を入力してください</div>';
    return;
  }
  if (fromStr >= toStr) {
    result.innerHTML = '<div style="font-size:12px;color:var(--red)">終了日は開始日より後にしてください</div>';
    return;
  }

  // 期間内の記録を集計
  const fromD = new Date(fromStr + 'T00:00:00');
  const toD   = new Date(toStr   + 'T00:00:00');
  const days  = Math.round((toD - fromD) / 86400000) + 1;

  // 記録のある日のみカウント（記録がない日は除外してTDEE計算を歪めない）
  const recordedDates = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(fromD); d.setDate(d.getDate() + i);
    const ds = toDateStr(d);
    if (entries.some(e => e.date === ds)) recordedDates.push(ds);
  }
  const recordedDays = recordedDates.length;

  if (recordedDays === 0) {
    result.innerHTML = '<div style="font-size:12px;color:var(--text-sub);padding:8px 0">この期間に食事記録がありません</div>';
    return;
  }

  const totalCal = recordedDates.reduce((sum, ds) => sum + sumEntries(getDayEntries(ds)).cal, 0);
  const avgCal   = totalCal / recordedDays;

  // 体重変化 → kcal換算
  const weightDelta = wTo - wFrom; // 増加なら正
  // 体組成モードで1kgあたりのkcalを決定
  let kcalPerKg;
  if (metaCompMode === 'fat') {
    kcalPerKg = 7200;
  } else if (metaCompMode === 'mixed') {
    kcalPerKg = (7200 + 4500) / 2; // 5850
  } else {
    const fatRatio = (parseInt(document.getElementById('metaFatRatio')?.value) || 100) / 100;
    kcalPerKg = 7200 * fatRatio + 4500 * (1 - fatRatio);
  }

  // 実績TDEE = (摂取合計 - 体重変化によるエネルギー変動) / 記録日数
  // 体重増加 → 余剰カロリーがあった → 実TDEEは低い
  const actualTDEE = (totalCal - weightDelta * kcalPerKg) / recordedDays;
  const settingTDEE = calcTDEE();
  const delta = actualTDEE - settingTDEE;
  const deltaAbs = Math.abs(Math.round(delta));

  // 代謝変動の方向
  const isUp   = delta > 50;
  const isDown = delta < -50;
  const isNeut = !isUp && !isDown;
  const deltaColor = isUp ? 'var(--green)' : isDown ? 'var(--red)' : 'var(--text-sub)';
  const deltaLabel = isUp ? '⬆ 代謝亢進' : isDown ? '⬇ 代謝低下' : '→ ほぼ変化なし';
  const deltaDesc  = isUp
    ? `計算値より約${deltaAbs}kcal/日多く消費しています。運動習慣・筋肉量増加・NEAT増加などが考えられます。`
    : isDown
    ? `計算値より約${deltaAbs}kcal/日少ない消費です。食事制限による代謝適応・活動量低下などが考えられます。`
    : `計算値とほぼ一致しています（誤差${deltaAbs}kcal以内）。`;

  // 信頼度（記録日数・期間に基づく）
  const confidence = recordedDays >= 21 ? '高' : recordedDays >= 10 ? '中' : '低';
  const confColor  = recordedDays >= 21 ? 'var(--green)' : recordedDays >= 10 ? 'var(--amber)' : 'var(--red)';

  result.innerHTML = `
    <!-- 主要結果 -->
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;margin-bottom:10px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
        <div style="text-align:center;padding:8px;background:var(--surface);border-radius:8px;border:1px solid var(--border)">
          <div style="font-size:10px;color:var(--text-sub)">実績TDEE（推定）</div>
          <div style="font-size:22px;font-weight:700;letter-spacing:-.5px">${Math.round(actualTDEE)}</div>
          <div style="font-size:10px;color:var(--text-sub)">kcal/日</div>
        </div>
        <div style="text-align:center;padding:8px;background:var(--surface);border-radius:8px;border:1px solid var(--border)">
          <div style="font-size:10px;color:var(--text-sub)">設定TDEE（計算値）</div>
          <div style="font-size:22px;font-weight:700;letter-spacing:-.5px">${settingTDEE}</div>
          <div style="font-size:10px;color:var(--text-sub)">kcal/日</div>
        </div>
      </div>
      <div style="text-align:center;padding:10px;background:var(--surface);border-radius:8px;border:1px solid var(--border)">
        <div style="font-size:12px;color:var(--text-sub);margin-bottom:4px">代謝変動</div>
        <div style="font-size:26px;font-weight:700;color:${deltaColor};letter-spacing:-.5px">
          ${isNeut ? '±0' : (isUp ? '+' : '−') + deltaAbs}
          <span style="font-size:13px;font-weight:400">kcal/日</span>
        </div>
        <div style="font-size:12px;font-weight:600;color:${deltaColor};margin-top:2px">${deltaLabel}</div>
      </div>
    </div>

    <!-- 詳細 -->
    <div style="font-size:11px;color:var(--text-sub);line-height:1.7;margin-bottom:10px;background:var(--surface2);border-radius:8px;padding:10px;border:1px solid var(--border)">
      ${deltaDesc}
    </div>

    <!-- 内訳 -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;font-size:11px;margin-bottom:8px">
      <div style="background:var(--surface2);border-radius:8px;padding:7px;text-align:center;border:1px solid var(--border)">
        <div style="color:var(--text-sub);font-size:9px">記録日数</div>
        <div style="font-weight:700;font-size:15px">${recordedDays}<span style="font-size:9px;font-weight:400">日</span></div>
        <div style="color:var(--text-sub);font-size:9px">/ ${days}日間</div>
      </div>
      <div style="background:var(--surface2);border-radius:8px;padding:7px;text-align:center;border:1px solid var(--border)">
        <div style="color:var(--text-sub);font-size:9px">平均摂取</div>
        <div style="font-weight:700;font-size:15px">${Math.round(avgCal)}<span style="font-size:9px;font-weight:400">kcal</span></div>
        <div style="color:var(--text-sub);font-size:9px">/ 日</div>
      </div>
      <div style="background:var(--surface2);border-radius:8px;padding:7px;text-align:center;border:1px solid var(--border)">
        <div style="color:var(--text-sub);font-size:9px">体重変化</div>
        <div style="font-weight:700;font-size:15px;color:${weightDelta < 0 ? 'var(--green)' : weightDelta > 0 ? 'var(--red)' : 'var(--text-sub)'}">${weightDelta >= 0 ? '+' : ''}${r1(weightDelta)}<span style="font-size:9px;font-weight:400">kg</span></div>
        <div style="color:var(--text-sub);font-size:9px">≈ ${Math.round(Math.abs(weightDelta)*kcalPerKg)}kcal</div>
      </div>
    </div>

    <!-- 信頼度 -->
    <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-sub)">
      <span>推定信頼度：</span>
      <span style="font-weight:700;color:${confColor}">${confidence}</span>
      <span>（${recordedDays}日分の記録）</span>
      ${recordedDays < 10 ? '<span style="color:var(--amber)">⚠ 10日以上の記録で精度が上がります</span>' : ''}
    </div>`;
}

function renderMetabolismSection() {
  initMetaInputs();
  calcMetabolism();
}


// 食品カテゴリ別パラメータ
const AMINO_PARAMS = {
  // 動物性（肉・魚・卵）: 速い吸収、高ロイシン
  animal:  { absRate: 9,  leucineRatio: 0.09, peakMin: 60,  halfLife: 110 },
  // 乳製品（チーズ・ヨーグルト・牛乳）: 中速、中ロイシン
  dairy:   { absRate: 6,  leucineRatio: 0.10, peakMin: 90,  halfLife: 150 },
  // 大豆・豆類: やや遅い
  soy:     { absRate: 5,  leucineRatio: 0.08, peakMin: 90,  halfLife: 130 },
  // その他植物性: 遅い、低ロイシン
  plant:   { absRate: 4,  leucineRatio: 0.06, peakMin: 120, halfLife: 140 },
  // プロテインパウダー（ホエイ相当）
  whey:    { absRate: 10, leucineRatio: 0.11, peakMin: 45,  halfLife: 90  },
};

const ANIMAL_PAT  = /鶏|豚|牛|羊|ささみ|チキン|ポーク|ビーフ|ラム|ひき肉|合いびき|ベーコン|ハム|ソーセージ|ウインナー|いわし|さば|さんま|あじ|さけ|鮭|サーモン|まぐろ|マグロ|ツナ|えび|いか|ほたて|あさり|カニ|ぶり|たい|鯛|たら|焼き鳥|唐揚げ|から揚げ|ハンバーグ|卵|たまご|タマゴ|ゆで卵|目玉焼き|スクランブル|チキン|プロテイン.*動物|animal|chicken|pork|beef|fish|salmon|tuna|egg/i;
const DAIRY_PAT   = /牛乳|ミルク|チーズ|ヨーグルト|ホエイ|カゼイン|プロテイン(?!.*大豆)|milk|cheese|yogurt|whey|casein/i;
const SOY_PAT     = /大豆|豆腐|納豆|豆乳|枝豆|おから|テンペ|soy|tofu|natto/i;
const WHEY_PAT    = /ホエイ|ウェイ|WPC|WPI|whey/i;

function classifyProteinSource(name) {
  if (WHEY_PAT.test(name))  return 'whey';
  if (DAIRY_PAT.test(name)) return 'dairy';
  if (ANIMAL_PAT.test(name)) return 'animal';
  if (SOY_PAT.test(name))   return 'soy';
  return 'plant';
}

// 食事1回分のアミノ酸時系列を生成（minutesOffset=食事時刻の0時からの分数）
// 返値: 分→相対濃度 のMap（0〜1440分）
function calcAminoTimeSeries(entries, minutesOffset) {
  // 食品ごとに分類してタンパク質量と吸収パラメータを集計
  const groups = { animal:0, dairy:0, soy:0, plant:0, whey:0 };
  entries.forEach(e => {
    const src = classifyProteinSource(e.name);
    groups[src] += (e.p || 0);
  });

  const RESOLUTION = 5; // 5分刻み
  const totalMinutes = 1440;
  const curve = new Array(Math.ceil(totalMinutes / RESOLUTION)).fill(0);

  Object.entries(groups).forEach(([src, protein]) => {
    if (protein <= 0) return;
    const p = AMINO_PARAMS[src];
    // 吸収時間 = protein / absRate (時間) → 分
    const absorptionDuration = (protein / p.absRate) * 60;
    // ピーク時刻（食事時刻 + peakMin）
    const peakMinOffset = minutesOffset + p.peakMin;
    // ピーク濃度 = protein * leucineRatio（ロイシン量g）をそのまま使う
    const peakLeucine = protein * p.leucineRatio;

    // 上昇フェーズ: 食事時刻 → ピーク
    // 減衰フェーズ: ピーク → halfLifeに従って指数減衰
    for (let i = 0; i < curve.length; i++) {
      const t = i * RESOLUTION; // 現在の分
      const dt = t - minutesOffset; // 食事後経過分
      if (dt < 0) continue;

      let conc = 0;
      if (dt <= p.peakMin) {
        // 上昇: 線形
        conc = peakLeucine * (dt / p.peakMin);
      } else {
        // 減衰: 指数
        const decayT = dt - p.peakMin;
        conc = peakLeucine * Math.exp(-Math.log(2) * decayT / p.halfLife);
      }
      curve[i] += conc;
    }
  });

  return curve;
}

// 食事時刻の保存キー
function aminoTimeKey(date) { return 'aminoTimes_' + date; }
function loadAminoTimes(date) {
  try { return JSON.parse(localStorage.getItem(aminoTimeKey(date)) || '{}'); } catch { return {}; }
}
function saveAminoTimes(date, times) {
  try { localStorage.setItem(aminoTimeKey(date), JSON.stringify(times)); } catch {}
}

let aminoChartInstance = null;

function toggleAminoHelp() {
  const el = document.getElementById('aminoHelp');
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function renderAminoInputs() {
  const cont = document.getElementById('aminoTimeInputs');
  if (!cont) return;
  const times = loadAminoTimes(currentDate);
  const meals = ['朝食','昼食','夕食','間食'];
  cont.innerHTML = meals.map(meal => {
    const mealEntries = getDayEntries(currentDate).filter(e => e.meal === meal);
    if (!mealEntries.length) return '';
    const totalP = r1(mealEntries.reduce((a,e) => a + (e.p||0), 0));
    const leucineApprox = r1(mealEntries.reduce((a,e) => {
      const src = classifyProteinSource(e.name);
      return a + (e.p||0) * AMINO_PARAMS[src].leucineRatio;
    }, 0));
    return `<div style="display:flex;align-items:center;gap:8px;background:var(--surface2);border:1px solid var(--border);border-radius:9px;padding:8px 11px">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600">${meal}</div>
        <div style="font-size:10px;color:var(--text-sub)">P ${totalP}g　ロイシン約 ${leucineApprox}g</div>
      </div>
      <input type="time" value="${times[meal]||''}" onchange="onAminoTimeChange('${meal}',this.value)"
        style="font-size:13px;padding:5px 8px;border:1.5px solid var(--border);border-radius:7px;background:var(--surface);color:var(--text);width:100px">
    </div>`;
  }).filter(Boolean).join('');
  if (!cont.innerHTML) cont.innerHTML = '<div style="font-size:12px;color:var(--text-sub);padding:6px 0">今日の食事記録がありません</div>';
}

function onAminoTimeChange(meal, value) {
  const times = loadAminoTimes(currentDate);
  if (value) times[meal] = value; else delete times[meal];
  saveAminoTimes(currentDate, times);
  renderAminoChart();
}

function renderAminoChart() {
  const canvas = document.getElementById('aminoChart');
  const summary = document.getElementById('aminoSummary');
  if (!canvas) return;

  const times = loadAminoTimes(currentDate);
  const RESOLUTION = 5;
  const points = Math.ceil(1440 / RESOLUTION);
  const combined = new Array(points).fill(0);

  const MPS_THRESHOLD = 2.5; // ロイシン2.5g以上でMPS促進

  let hasData = false;
  Object.entries(times).forEach(([meal, timeStr]) => {
    if (!timeStr) return;
    const [h, m] = timeStr.split(':').map(Number);
    const minutesOffset = h * 60 + m;
    const mealEntries = getDayEntries(currentDate).filter(e => e.meal === meal);
    if (!mealEntries.length) return;
    hasData = true;
    const curve = calcAminoTimeSeries(mealEntries, minutesOffset);
    curve.forEach((v, i) => { combined[i] += v; });
  });

  // ラベル（1時間刻み表示）
  const labels = Array.from({length: points}, (_, i) => {
    const totalMin = i * RESOLUTION;
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    return m === 0 ? `${h}:00` : '';
  });

  // MPS閾値ライン、バックグラウンドレベル（ベースライン = 0.3g相当）
  const baseline = 0.3;
  const data = combined.map(v => r1(Math.max(v + baseline, baseline)));

  // Chart描画
  if (aminoChartInstance) { aminoChartInstance.destroy(); aminoChartInstance = null; }
  const ctx = canvas.getContext('2d');
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#3266ad';

  // グラデーション
  const grad = ctx.createLinearGradient(0, 0, 0, 180);
  grad.addColorStop(0, 'rgba(50,102,173,.35)');
  grad.addColorStop(1, 'rgba(50,102,173,.02)');

  aminoChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '血中アミノ酸（ロイシン換算g）',
          data,
          borderColor: '#3266ad',
          backgroundColor: grad,
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        {
          label: `MPS促進閾値 (${MPS_THRESHOLD}g)`,
          data: new Array(points).fill(MPS_THRESHOLD),
          borderColor: '#e91e63',
          borderWidth: 1.5,
          borderDash: [5, 4],
          pointRadius: 0,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 600 },
      plugins: {
        legend: { display: true, labels: { font: { size: 10 }, boxWidth: 14, padding: 8 } },
        tooltip: {
          callbacks: {
            title: items => {
              const idx = items[0].dataIndex;
              const totalMin = idx * RESOLUTION;
              const h = Math.floor(totalMin / 60) % 24;
              const m = String(totalMin % 60).padStart(2,'0');
              return `${h}:${m}`;
            },
            label: item => item.datasetIndex === 0
              ? `ロイシン換算: ${item.raw}g`
              : `閾値: ${item.raw}g`,
          },
        },
      },
      scales: {
        x: {
          ticks: { font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12, color: '#6b7280' },
          grid: { color: 'rgba(0,0,0,.05)' },
        },
        y: {
          min: 0,
          ticks: { font: { size: 9 }, color: '#6b7280', callback: v => v + 'g' },
          grid: { color: 'rgba(0,0,0,.05)' },
          title: { display: true, text: 'ロイシン換算 (g)', font: { size: 9 }, color: '#6b7280' },
        },
      },
    },
  });

  // サマリー計算
  if (!summary) return;
  if (!hasData) {
    summary.innerHTML = '<div style="font-size:12px;color:var(--text-sub);grid-column:span 2;padding:4px 0">食事時刻を入力するとサマリーが表示されます</div>';
    return;
  }
  const peak = Math.max(...data);
  // MPS閾値を超えている時間（分）
  const mpsMinutes = data.filter(v => v >= MPS_THRESHOLD).length * RESOLUTION;
  // 今この瞬間の濃度
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nowIdx = Math.floor(nowMin / RESOLUTION);
  const nowVal = data[Math.min(nowIdx, data.length-1)] || 0;
  // 総ロイシン（各食事の推定量）
  const totalLeucine = r1(getDayEntries(currentDate).reduce((a,e) => {
    const src = classifyProteinSource(e.name);
    return a + (e.p||0) * AMINO_PARAMS[src].leucineRatio;
  }, 0));

  const card = (label, val, unit, sub, color='var(--accent)') => `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:9px;padding:9px 11px">
      <div style="font-size:10px;color:var(--text-sub);margin-bottom:2px">${label}</div>
      <div style="font-size:18px;font-weight:700;color:${color}">${val}<span style="font-size:11px;font-weight:400;color:var(--text-sub);margin-left:2px">${unit}</span></div>
      <div style="font-size:10px;color:var(--text-sub);margin-top:2px">${sub}</div>
    </div>`;

  summary.innerHTML =
    card('ピーク濃度', r1(peak), 'g', 'ロイシン換算') +
    card('現在の推定値', r1(nowVal), 'g', now.getHours()+':'+String(now.getMinutes()).padStart(2,'0')+'時点', nowVal >= MPS_THRESHOLD ? 'var(--green)' : 'var(--text-sub)') +
    card('MPS促進時間', mpsMinutes, '分', `閾値${MPS_THRESHOLD}g以上の時間`, mpsMinutes > 0 ? 'var(--green)' : 'var(--text-sub)') +
    card('1日ロイシン合計', totalLeucine, 'g', '推定値（食品別係数による）');
}

function renderAminoSection() {
  renderAminoInputs();
  renderAminoChart();
}


function getAvg(period) {
  const today=new Date(); today.setHours(0,0,0,0);
  const days=period==='today'?[toDateStr(new Date())]:Array.from({length:period==='7d'?7:period==='30d'?30:90},(_,i)=>{const d=new Date(today);d.setDate(d.getDate()-i);return toDateStr(d)});
  const wd=days.filter(d=>getDayEntries(d).length>0); if(!wd.length) return null;
  const tot=wd.map(d=>sumEntries(getDayEntries(d))); const n=wd.length;
  const avg={days:n};
  ['cal','p','f','c','fiber','iron','calcium','vitc','vitd','salt'].forEach(k=>{avg[k]=r1(tot.reduce((a,t)=>a+(t[k]||0),0)/n)});
  return avg;
}
function goalBar(label, actual, target, unit, color, reverse=false) {
  const pct=Math.min(actual/target*100,100), over=actual>target;
  const col=reverse?(over?'#c0392b':color):(over?'#c0392b':color);
  return `<div class="goal-bar-wrap"><div class="goal-bar-label"><span>${label}</span><span style="font-weight:500;color:${over&&!reverse?'#c0392b':'var(--text)'}">${actual}${unit}<span style="font-weight:400;color:var(--text-sub)"> / ${target}${unit}</span></span></div><div class="goal-bar-track"><div class="goal-bar-fill" style="width:${pct}%;background:${col}"></div></div><div style="font-size:10px;text-align:right;margin-top:2px;color:${over&&!reverse?'#c0392b':'var(--text-sub)'}"> ${over?`+${r1(actual-target)}${unit} オーバー`:`あと ${r1(target-actual)}${unit}`}</div></div>`;
}
function renderStats() {
  const g=goals(), avg=getAvg(statsPeriod), s=avg||{cal:0,p:0,f:0,c:0,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0};
  // 統計期間の吸収タンパク質（平均）
  const statsDays = (() => {
    const now = new Date(); const days = statsPeriod==='today'?1:statsPeriod==='7d'?7:statsPeriod==='30d'?30:90;
    const dates = Array.from({length:days},(_,i)=>{const d=new Date(now);d.setDate(d.getDate()-i);return toDateStr(d);});
    return dates;
  })();
  const statsAbsP = statsDays.length > 0
    ? r1(statsDays.reduce((sum,date) => {
        const dayList = entries.filter(e=>e.date===date);
        return sum + calcAbsorbedProtein(dayList);
      }, 0) / (avg?.days || 1))
    : 0;
  const lbl=statsPeriod==='today'?'今日':statsPeriod==='7d'?`週平均(${avg?avg.days:'0'}日)`:statsPeriod==='30d'?`月平均(${avg?avg.days:'0'}日)`:`3ヶ月平均(${avg?avg.days:'0'}日)`;
  const score=avg?Math.round(Math.min(s.cal/g.cal,1)*25+Math.min(statsAbsP/g.p,1)*35+Math.min(s.f/g.f,1)*20+Math.min(s.c/g.c,1)*20):0;
  document.getElementById('goalBars').innerHTML = avg ? `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <span style="font-size:11px;color:var(--text-sub)">${lbl}</span>
      <span style="font-size:26px;font-weight:600;color:${score>=80?'#2e7d32':score>=60?'#e8a838':'#c0392b'}">${score}<span style="font-size:12px;color:var(--text-sub)">/100</span></span>
    </div>
    <div style="margin-bottom:10px;font-size:11px;color:var(--text-sub)">体重 <input type="number" value="${userWeight}" min="30" max="200" step="0.5" oninput="userWeight=parseFloat(this.value)||65;localStorage.setItem('pfcWeight',userWeight);renderStats()" style="width:50px;font-size:12px;padding:2px 5px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text)"> kg → タンパク質目標 ${g.p}g</div>
    <div style="font-size:11px;font-weight:600;color:var(--text-sub);margin-bottom:8px">PFC・カロリー</div>
    ${goalBar('カロリー',ri(s.cal),g.cal,'kcal','#3266ad')}${goalBar('タンパク質（摂取）',r1(s.p),g.p,'g','#3266ad')}${goalBar('タンパク質（吸収補正）',statsAbsP,g.p,'g','#3266ad')}${goalBar('脂質',r1(s.f),g.f,'g','#e8a838')}${goalBar('炭水化物',r1(s.c),g.c,'g','#4caf50')}
    <div style="font-size:11px;font-weight:600;color:var(--text-sub);margin:12px 0 8px">ビタミン・ミネラル・食物繊維</div>
    ${goalBar('食物繊維',r1(s.fiber),21,'g','#8bc34a')}${goalBar('鉄',r1(s.iron),7,'mg','#e91e63')}${goalBar('カルシウム',ri(s.calcium),700,'mg','#03a9f4')}${goalBar('ビタミンC',ri(s.vitc),100,'mg','#ff9800')}${goalBar('ビタミンD',r1(s.vitd),8.5,'μg','#ffd600')}${goalBar('塩分',r1(s.salt),7.5,'g','#9e9e9e',true)}
  ` : `<div style="text-align:center;padding:2rem;color:var(--text-sub);font-size:13px">この期間の記録がありません</div>`;
  renderCharts();
}
function getLast(n) { return Array.from({length:n},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(n-1-i));return toDateStr(d)}); }
function renderCharts() {
  const n=statsPeriod==='90d'?90:statsPeriod==='30d'?30:7;
  const days=getLast(n);
  const labels=days.map(d=>{const dt=new Date(d+'T00:00:00');return`${dt.getMonth()+1}/${dt.getDate()}`});
  const skip=n>30?Math.ceil(n/12):1;
  const g=goals();
  const baseOpts={responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{font:{size:10}},grid:{color:'rgba(128,128,128,.1)'}},x:{ticks:{font:{size:10},callback:(_,i)=>i%skip===0?labels[i]:''}}}};
  if(calChart) calChart.destroy();
  calChart=new Chart(document.getElementById('calChart'),{type:'bar',data:{labels,datasets:[{label:'摂取',data:days.map(d=>ri(sumEntries(getDayEntries(d)).cal)),backgroundColor:'#3266ad',borderRadius:2},{type:'line',label:'目標',data:days.map(()=>g.cal),borderColor:'#c0392b',borderDash:[4,3],borderWidth:1.5,pointRadius:0,fill:false}]},options:{...baseOpts,plugins:{legend:{display:false}}}});
  if(pfcChart) pfcChart.destroy();
  pfcChart=new Chart(document.getElementById('pfcChart'),{type:'line',data:{labels,datasets:[
    {label:'P',data:days.map(d=>r1(sumEntries(getDayEntries(d)).p)),borderColor:'#3266ad',backgroundColor:'transparent',tension:.3,pointRadius:0,borderWidth:2},
    {label:'F',data:days.map(d=>r1(sumEntries(getDayEntries(d)).f)),borderColor:'#e8a838',backgroundColor:'transparent',tension:.3,pointRadius:0,borderWidth:2,borderDash:[5,3]},
    {label:'C',data:days.map(d=>r1(sumEntries(getDayEntries(d)).c)),borderColor:'#4caf50',backgroundColor:'transparent',tension:.3,pointRadius:0,borderWidth:2,borderDash:[2,2]},
    {label:'P目標',data:days.map(()=>g.p),borderColor:'rgba(50,102,173,.3)',borderDash:[3,3],borderWidth:1,pointRadius:0,fill:false},
  ]},options:{...baseOpts,plugins:{legend:{position:'bottom',labels:{font:{size:10},boxWidth:8,padding:8}}}}});
  renderAminoSection();
  renderMetabolismSection();
}

// ── CSV ──
const CSV_HEADERS = ['date','meal','name','amount','cal','p','f','c','fiber','iron','calcium','vitc','vitd','salt'];
function exportCSV() {
  const from=document.getElementById('csvFrom').value, to=document.getElementById('csvTo').value;
  let data=[...entries];
  if(from) data=data.filter(e=>e.date>=from);
  if(to) data=data.filter(e=>e.date<=to);
  data=data.sort((a,b)=>a.date.localeCompare(b.date)||MEALS_ORDER.indexOf(a.meal)-MEALS_ORDER.indexOf(b.meal));
  const rows=[CSV_HEADERS.join(','),...data.map(e=>[e.date,e.meal,`"${(e.name||'').replace(/"/g,'""')}"`,e.amount||0,r1(e.cal||0),r1(e.p||0),r1(e.f||0),r1(e.c||0),r1(e.fiber||0),r1(e.iron||0),ri(e.calcium||0),ri(e.vitc||0),r1(e.vitd||0),r2(e.salt||0)].join(','))];
  const blob=new Blob(['\uFEFF'+rows.join('\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`pfc_export_${toDateStr(new Date())}.csv`; a.click(); URL.revokeObjectURL(url);
}
function importCSV() {
  const text=document.getElementById('csvImportArea').value.trim();
  const msg=document.getElementById('csvImportMsg');
  if(!text){msg.className='status-msg status-err';msg.textContent='CSVデータを入力してください';return}
  const lines=text.split('\n').map(l=>l.trim()).filter(Boolean);
  const header=lines[0].toLowerCase().split(',').map(h=>h.trim().replace(/^"|"$/g,''));
  const idxOf=k=>header.indexOf(k);
  let count=0, skip=0;
  for(let i=1;i<lines.length;i++){
    try{
      const cols=parseCsvLine(lines[i]);
      const date=(cols[idxOf('date')]||'').trim().replace(/^"|"$/g,'');
      const meal=(cols[idxOf('meal')]||'').trim().replace(/^"|"$/g,'');
      const name=(cols[idxOf('name')]||'').trim().replace(/^"|"$/g,'');
      if(!date||!name||!MEALS_ORDER.includes(meal)){skip++;continue}
      const entry={id:Date.now()+i+Math.random(),date,meal,name,
        amount:parseFloat(cols[idxOf('amount')])||100, cal:parseFloat(cols[idxOf('cal')])||0, p:parseFloat(cols[idxOf('p')])||0,
        f:parseFloat(cols[idxOf('f')])||0, c:parseFloat(cols[idxOf('c')])||0,
        fiber:parseFloat(cols[idxOf('fiber')])||0, iron:parseFloat(cols[idxOf('iron')])||0,
        calcium:parseFloat(cols[idxOf('calcium')])||0, vitc:parseFloat(cols[idxOf('vitc')])||0,
        vitd:parseFloat(cols[idxOf('vitd')])||0, salt:parseFloat(cols[idxOf('salt')])||0};
      const dup=entries.some(e=>e.date===entry.date&&e.meal===entry.meal&&e.name===entry.name&&e.amount===entry.amount);
      if(!dup){entries.push(entry);count++}else skip++;
    }catch(err){skip++}
  }
  save();
  if(count>0){msg.className='status-msg status-ok';msg.textContent=`${count}件をインポートしました（スキップ: ${skip}件）`}
  else{msg.className='status-msg status-err';msg.textContent=`インポートできませんでした（スキップ: ${skip}件）`}
  renderRecord(); renderCalendar();
}
function parseCsvLine(line) {
  const result=[]; let cur='', inQ=false;
  for(let i=0;i<line.length;i++){
    if(line[i]==='"'){if(inQ&&line[i+1]==='"'){cur+='"';i++}else inQ=!inQ}
    else if(line[i]===','&&!inQ){result.push(cur);cur=''}
    else cur+=line[i];
  }
  result.push(cur); return result;
}

// ── Custom foods ──
function setCustomMode(mode) {
  document.getElementById('csSinglePanel').style.display=mode==='single'?'block':'none';
  document.getElementById('csComboPanel').style.display=mode==='combo'?'block':'none';
  document.getElementById('csTabSingle').className='btn'+(mode==='single'?' btn-primary':'');
  document.getElementById('csTabCombo').className='btn'+(mode==='combo'?' btn-success':'');
  if(mode==='single') renderCustomFoodList(); else renderComboFoodList();
}
function saveCustomFood() {
  const name=document.getElementById('csFoodName').value.trim(); const msg=document.getElementById('csSaveMsg');
  if(!name){msg.className='status-msg status-err';msg.textContent='食品名を入力してください';return}
  customFoods.push({id:Date.now(),name,cal:gv('csCal'),p:gv('csP'),f:gv('csF'),c:gv('csC'),per:gv('csPer')||100,
    fiber:gv('csFib'),iron:gv('csFe'),calcium:gv('csCa'),vitc:gv('csVc'),vitd:gv('csVd'),salt:gv('csSalt')});
  saveCustom(); msg.className='status-msg status-ok'; msg.textContent=`「${name}」を登録しました`;
  ['csFoodName','csCal','csP','csF','csC','csFib','csFe','csCa','csVc','csVd','csSalt'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('csPer').value='100'; renderCustomFoodList(); setTimeout(()=>{msg.textContent=''},2500);
}
function deleteCustomFood(id){
  const idx = customFoods.findIndex(f=>f.id===id);
  if (idx === -1) return;
  const removed = customFoods[idx];
  customFoods.splice(idx,1);
  saveCustom();renderCustomFoodList();
  showUndoToast(`「${removed.name}」をDBから削除しました`, () => {
    customFoods.splice(Math.min(idx, customFoods.length), 0, removed);
    saveCustom(); renderCustomFoodList();
  });
}
function renderCustomFoodList() {
  const cont=document.getElementById('customFoodList');
  if(!customFoods.length){cont.innerHTML=`<div style="font-size:12px;color:var(--text-sub);padding:8px 0">まだ登録がありません</div>`;return}
  cont.innerHTML=customFoods.map(f=>`<div class="custom-item"><div><div style="font-weight:500">${f.name}</div><div style="font-size:10px;color:var(--text-sub)">${f.per}gあたり ${f.cal}kcal P${f.p} F${f.f} C${f.c}${f.fiber?' 繊'+f.fiber:''}</div></div><button class="btn btn-sm btn-danger" onclick="deleteCustomFood(${f.id})">✕</button></div>`).join('');
}

// ── Combo foods ──
function onComboSearch(q) {
  clearTimeout(comboTimer); const box=document.getElementById('comboResultsBox');
  if(!q.trim()){box.style.display='none';return}
  const local=localSearch(q); renderComboResults(local,[],true); showSp('comboSpinner','comboSearchIcon',true);
  comboTimer=setTimeout(async()=>{const api=await apiSearch(q);showSp('comboSpinner','comboSearchIcon',false);if(api!==null)renderComboResults(local,api,false)},600);
}
function renderComboResults(local, api, loading) {
  const box=document.getElementById('comboResultsBox'); let html='';
  if(local.length){html+=`<div class="rs-label">内蔵・カスタムDB</div>`;html+=local.map((f,i)=>`<div class="ri" onclick="addComboIngredient(${i},'local')"><div><div class="ri-name">${f.name}<span class="badge badge-${f._src||'local'}">${SRC_LABEL[f._src||'local']}</span></div><div class="ri-sub">${f.per}gあたり P${f.p} F${f.f} C${f.c}</div></div><div class="ri-cal">${f.cal}kcal</div></div>`).join('')}
  if(loading){html+=`<div class="rs-label">Open Food Facts 検索中…</div><div class="no-result"><div class="spinner" style="display:inline-block"></div></div>`}
  else if(api&&api.length){html+=`<div class="rs-label">Open Food Facts</div>`;html+=api.map((f,i)=>`<div class="ri" onclick="addComboIngredient(${i},'api')"><div><div class="ri-name">${f.name.length>26?f.name.slice(0,26)+'…':f.name}<span class="badge badge-api">外部</span></div><div class="ri-sub">100gあたり P${f.p} F${f.f} C${f.c}</div></div><div class="ri-cal">${f.cal}kcal</div></div>`).join('')}
  else if(!loading&&!local.length){html+=`<div class="no-result">見つかりませんでした</div>`}
  box.innerHTML=html; box._local=local; box._api=api; box.style.display='block';
}
function addComboIngredient(i, src) {
  const box=document.getElementById('comboResultsBox'); const f=src==='local'?box._local[i]:box._api[i]; if(!f) return;
  const r=100/(f.per||100);
  comboIngredients.push({...f,amount:100,_cal:r1(f.cal*r),_p:r1(f.p*r),_f:r1(f.f*r),_c:r1(f.c*r),
    _fiber:r1((f.fiber||0)*r),_iron:r1((f.iron||0)*r),_calcium:r1((f.calcium||0)*r),
    _vitc:r1((f.vitc||0)*r),_vitd:r1((f.vitd||0)*r),_salt:r2((f.salt||0)*r)});
  box.style.display='none'; document.getElementById('comboSearch').value=''; showSp('comboSpinner','comboSearchIcon',false); renderComboIngredients();
}
function updateComboAmt(i, val) {
  const f=comboIngredients[i], amt=parseFloat(val)||100, r=amt/(f.per||100);
  comboIngredients[i]={...f,amount:amt,_cal:r1(f.cal*r),_p:r1(f.p*r),_f:r1(f.f*r),_c:r1(f.c*r),
    _fiber:r1((f.fiber||0)*r),_iron:r1((f.iron||0)*r),_calcium:r1((f.calcium||0)*r),
    _vitc:r1((f.vitc||0)*r),_vitd:r1((f.vitd||0)*r),_salt:r2((f.salt||0)*r)};
  renderComboIngredients();
}
function removeComboIngredient(i){comboIngredients.splice(i,1);renderComboIngredients()}
function renderComboIngredients() {
  const cont=document.getElementById('comboIngredients');
  if(!comboIngredients.length){cont.innerHTML=`<div style="font-size:12px;color:var(--text-sub);padding:4px 0">食材を検索して追加してください</div>`;document.getElementById('comboTotal').textContent='';return}
  cont.innerHTML=comboIngredients.map((f,i)=>`<div class="combo-ingredient"><span style="font-weight:500;flex:1">${f.name}</span><input type="number" value="${f.amount}" min="1" style="width:50px;font-size:12px;padding:2px 5px;border:1px solid var(--border);border-radius:7px;background:var(--surface);color:var(--text);margin:0 6px" oninput="updateComboAmt(${i},this.value)"><span style="font-size:10px;color:var(--text-sub);margin-right:5px">g</span><button class="btn btn-sm btn-danger" onclick="removeComboIngredient(${i})">✕</button></div>`).join('');
  const tot=comboIngredients.reduce((a,f)=>({cal:a.cal+f._cal,p:a.p+f._p,f:a.f+f._f,c:a.c+f._c,fiber:a.fiber+f._fiber,iron:a.iron+f._iron,calcium:a.calcium+f._calcium}),{cal:0,p:0,f:0,c:0,fiber:0,iron:0,calcium:0});
  document.getElementById('comboTotal').textContent=`合計 ${ri(tot.cal)}kcal P${r1(tot.p)} F${r1(tot.f)} C${r1(tot.c)} 繊${r1(tot.fiber)}g`;
}
function editComboFood(id) {
  const f = comboFoods.find(f => f.id === id);
  if (!f) return;
  // 編集対象をフォームに展開
  document.getElementById('comboName').value = f.name;
  // 食材リストを復元
  comboIngredients = (f.ingredients || []).map(ing => {
    const r = 100 / (ing.per || 100);
    return {
      ...ing,
      per: ing.per || 100,
      amount: ing.amount,
      _cal:     r1((ing.cal     || 0) * r),
      _p:       r1((ing.p       || 0) * r),
      _f:       r1((ing.f       || 0) * r),
      _c:       r1((ing.c       || 0) * r),
      _fiber:   r1((ing.fiber   || 0) * r),
      _iron:    r1((ing.iron    || 0) * r),
      _calcium: r1((ing.calcium || 0) * r),
      _vitc:    r1((ing.vitc    || 0) * r),
      _vitd:    r1((ing.vitd    || 0) * r),
      _salt:    r2((ing.salt    || 0) * r),
    };
  });
  renderComboIngredients();
  // 保存ボタンを「更新」モードにする
  const btn = document.getElementById('comboSaveBtn');
  const msg = document.getElementById('comboSaveMsg');
  btn.textContent = '更新';
  btn.dataset.editId = id;
  msg.textContent = `「${f.name}」を編集中`;
  msg.className = 'status-msg status-ok';
  // フォームまでスクロール
  document.getElementById('csComboPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function saveComboFood() {
  const name = document.getElementById('comboName').value.trim();
  const msg  = document.getElementById('comboSaveMsg');
  const btn  = document.getElementById('comboSaveBtn');
  if (!name) { msg.className='status-msg status-err'; msg.textContent='複合食品名を入力してください'; return }
  if (!comboIngredients.length) { msg.className='status-msg status-err'; msg.textContent='食材を追加してください'; return }

  const tot = comboIngredients.reduce((a,f) => ({
    cal: a.cal+f._cal, p: a.p+f._p, f: a.f+f._f, c: a.c+f._c,
    fiber: a.fiber+f._fiber, iron: a.iron+f._iron, calcium: a.calcium+f._calcium,
    vitc: a.vitc+(f._vitc||0), vitd: a.vitd+(f._vitd||0), salt: a.salt+(f._salt||0),
  }), {cal:0,p:0,f:0,c:0,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0});
  const totalAmt = comboIngredients.reduce((a,f) => a + f.amount, 0);
  const sc = v => r1(v / totalAmt * 100);

  const editId = btn.dataset.editId ? Number(btn.dataset.editId) : null;

  const foodData = {
    id: editId || Date.now(),
    name, per: 100,
    cal: sc(tot.cal), p: sc(tot.p), f: sc(tot.f), c: sc(tot.c),
    fiber: sc(tot.fiber), iron: sc(tot.iron), calcium: sc(tot.calcium),
    vitc: sc(tot.vitc), vitd: sc(tot.vitd), salt: r2(tot.salt / totalAmt * 100),
    ingredients: comboIngredients.map(f => ({
      name: f.name, amount: f.amount,
      per: f.per || 100, cal: f.cal, p: f.p, f: f.f, c: f.c,
      fiber: f.fiber||0, iron: f.iron||0, calcium: f.calcium||0,
      vitc: f.vitc||0, vitd: f.vitd||0, salt: f.salt||0,
    })),
    _src: 'combo',
  };

  if (editId) {
    comboFoods = comboFoods.map(f => f.id === editId ? foodData : f);
    msg.textContent = `「${name}」を更新しました`;
  } else {
    comboFoods.push(foodData);
    msg.textContent = `「${name}」を登録しました`;
  }

  // フォームリセット
  btn.textContent = '登録';
  delete btn.dataset.editId;
  comboIngredients = [];
  document.getElementById('comboName').value = '';
  renderComboIngredients();
  saveCustom();
  msg.className = 'status-msg status-ok';
  renderComboFoodList();
  setTimeout(() => { msg.textContent = ''; }, 2500);
}

function renderComboFoodList() {
  const cont = document.getElementById('comboFoodList');
  if (!comboFoods.length) {
    cont.innerHTML = `<div style="font-size:12px;color:var(--text-sub);padding:8px 0">まだ登録がありません</div>`;
    return;
  }
  cont.innerHTML = comboFoods.map(f =>
    `<div class="custom-item">
      <div style="flex:1;min-width:0">
        <div style="font-weight:500">${f.name}</div>
        <div style="font-size:10px;color:var(--text-sub)">100gあたり ${f.cal}kcal P${f.p} F${f.f} C${f.c}${f.fiber?' 繊'+f.fiber:''}</div>
        <div style="font-size:10px;color:var(--text-sub)">${(f.ingredients||[]).map(i=>`${i.name}(${i.amount}g)`).join('、')}</div>
      </div>
      <button class="btn btn-sm" onclick="editComboFood(${f.id})"
        style="background:#e8f0fe;color:#3266ad;border:none;margin-right:4px;padding:3px 8px">編集</button>
      <button class="btn btn-sm btn-danger" onclick="deleteComboFood(${f.id})">✕</button>
    </div>`
  ).join('');
}

// ── Google Health API ──
// REST API (health.googleapis.com/v4/) + OAuth 2.0
// スコープ: activity_and_fitness, health_metrics_and_measurements, sleep
// 取得: 歩数・消費カロリー・安静時心拍数・体重

async function connectGoogleHealth() {
  try {
    const res = await fetch('/.netlify/functions/google-health-auth-start');
    if (!res.ok) throw new Error('auth start failed');
    const { authUrl } = await res.json();
    window.location.href = authUrl;
  } catch(e) {
    alert('Google Health連携の開始に失敗しました。\nNetlifyの環境変数（GOOGLE_HEALTH_CLIENT_ID）を確認してください。');
  }
}

(function checkGoogleHealthCallback() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('gh_token');
  const err   = params.get('gh_error');
  if (err) {
    console.warn('Google Health auth error:', err);
    history.replaceState({}, '', window.location.pathname);
    return;
  }
  if (token) {
    ghToken = token;
    localStorage.setItem('ghToken', token);
    history.replaceState({}, '', window.location.pathname);
    renderGhStatus();
    syncGoogleHealth();
  }
})();

async function syncGoogleHealth() {
  if (!ghToken) return;
  try {
    const res = await fetch(
      `/.netlify/functions/google-health-daily?date=${currentDate}&token=${encodeURIComponent(ghToken)}`
    );
    if (!res.ok) throw new Error('sync failed');
    const data = await res.json();
    if (data.updatedToken && data.updatedToken !== ghToken) {
      ghToken = data.updatedToken;
      localStorage.setItem('ghToken', ghToken);
    }
    ghData[currentDate] = data;
    saveGhData();
    document.getElementById('garminSyncBtn').style.display = 'flex';
    renderRecord();
  } catch(e) { console.warn('Google Health sync:', e); }
}

function renderGhStatus() {
  const btn    = document.getElementById('garminConnectBtn');
  const status = document.getElementById('garminStatus');
  if (ghToken) {
    btn.textContent = '再接続';
    const lastDate = Object.keys(ghData).sort().pop();
    const d = lastDate ? ghData[lastDate] : null;
    status.innerHTML =
      `<span style="color:var(--green);font-weight:600">✓ 接続済み</span>` +
      (d ? `<br><span style="font-size:11px;margin-top:4px;display:block">
        最終同期: ${lastDate}　歩数: ${(d.steps||0).toLocaleString()}歩　
        消費: ${d.activeCalories||0} kcal
        ${d.restingHeartRate ? `　心拍: ${d.restingHeartRate} bpm` : ''}
        ${d.weight ? `　体重: ${d.weight} kg` : ''}
      </span>` : '');
    document.getElementById('garminSyncBtn').style.display = 'flex';
  } else {
    btn.textContent = '連携する';
    status.textContent = '未接続';
  }
}

// ── Firebase 初期化・認証・同期 ──
// Firebase設定は index.html の <script> で window.FIREBASE_CONFIG として注入
async function initFirebase() {
  try {
    const cfg = window.FIREBASE_CONFIG;
    if (!cfg || !cfg.apiKey) return; // 未設定時はローカルのみ

    const { initializeApp }    = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
                                = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    const { getFirestore }     = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    const app = initializeApp(cfg);
    fbAuth = getAuth(app);
    fbDb   = getFirestore(app);

    // 認証状態の監視
    onAuthStateChanged(fbAuth, async user => {
      fbUser = user;
      renderAuthUI();
      if (user) {
        await pullFromCloud(); // ログイン時にクラウドからデータを取得
        renderRecord();
        renderCalendar();
      }
    });

    // Googleログインボタン
    window._fbSignIn = async () => {
      try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(fbAuth, provider);
      } catch(e) {
        console.error('Sign in failed:', e);
        if (e.code === 'auth/unauthorized-domain') {
          alert(
            'ログインエラー: このドメインがFirebaseに承認されていません。\n\n' +
            '【解決方法】\n' +
            'Firebase Console > Authentication > Settings >\n' +
            '「承認済みドメイン」に以下を追加してください：\n\n' +
            window.location.hostname
          );
        } else if (e.code === 'auth/popup-blocked') {
          alert('ポップアップがブロックされました。ブラウザのポップアップ許可設定を確認してください。');
        } else {
          alert('ログインに失敗しました: ' + (e.message || e.code));
        }
      }
    };

    // ログアウトボタン
    window._fbSignOut = async () => {
      await signOut(fbAuth);
      renderAuthUI();
    };

  } catch(e) {
    console.warn('Firebase init failed:', e);
  }
}

// Firestoreからデータを取得してローカルにマージ
async function pullFromCloud() {
  if (!fbDb || !fbUser || fbSyncing) return;
  fbSyncing = true;
  try {
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const snap = await getDoc(doc(fbDb, 'users', fbUser.uid));
    if (snap.exists()) {
      const data = snap.data();
      // クラウドデータで上書き（最新が優先）
      if (data.entries)     { entries     = data.entries;     saveLocal(); }
      if (data.exercises)   { exercises   = data.exercises;   saveLocal(); }
      if (data.customFoods) { customFoods = data.customFoods; saveLocal(); }
      if (data.comboFoods)  { comboFoods  = data.comboFoods;  saveLocal(); }
      if (data.profile)     { profile = { ...profile, ...data.profile }; localStorage.setItem('pfcProfile', JSON.stringify(profile)); }
    } else {
      // 初回ログイン：ローカルデータをクラウドにアップロード
      await saveToCloud();
    }
  } catch(e) {
    console.warn('Cloud pull failed:', e);
  } finally {
    fbSyncing = false;
  }
}

// 認証UIを描画（ヘッダーのユーザー情報 & ログインボタン）
function renderAuthUI() {
  const el = document.getElementById('authArea');
  if (!el) return;
  if (fbUser) {
    const photo = fbUser.photoURL
      ? `<img src="${fbUser.photoURL}" style="width:28px;height:28px;border-radius:50%;border:2px solid rgba(255,255,255,.5)" alt="">`
      : `<span style="font-size:18px">👤</span>`;
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px">
        ${photo}
        <div>
          <div style="font-size:11px;font-weight:600;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${fbUser.displayName||fbUser.email}</div>
          <div style="font-size:9px;opacity:.7">クラウド同期中</div>
        </div>
        <button onclick="_fbSignOut()" style="background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:6px;padding:4px 8px;font-size:10px;cursor:pointer">ログアウト</button>
      </div>`;
  } else if (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey) {
    el.innerHTML = `
      <button onclick="_fbSignIn()" style="display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.9);border:none;color:#333;border-radius:8px;padding:6px 10px;font-size:11px;cursor:pointer;font-weight:500">
        <svg width="14" height="14" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Googleでログイン
      </button>`;
  } else {
    el.innerHTML = `<span style="font-size:10px;opacity:.6">ローカル保存モード</span>`;
  }
}

// ── Tab switch ──
function switchTab(t) {
  ['record','stats','custom','csv','profile','garmin','ai'].forEach(id => {
    document.getElementById('panel-'+id).classList.toggle('active', id===t);
    document.getElementById('nav-'+id).classList.toggle('active', id===t);
  });
  if (t==='record') { renderRecord(); renderCalendar(); }
  if (t==='stats') renderStats();
  if (t==='custom') setCustomMode('single');
  if (t==='csv') {
    const today=toDateStr(new Date()), month=today.slice(0,7)+'-01';
    document.getElementById('csvFrom').value=month;
    document.getElementById('csvTo').value=today;
  }
  if (t==='profile') { initProfile(); initGoalUI(); }
  if (t==='garmin')  renderGhStatus();
  if (t==='ai') initAiChat();
}

// ── AI Chat ──
let aiHistory = [];
let aiInitDone = false;

// ── AI バックアップ（最大10世代） ──
const AI_BACKUP_MAX = 10;
let aiBackups = []; // [{label, entries, timestamp}, ...]

function takeAiBackup(label) {
  aiBackups.push({
    label,
    entries: JSON.parse(JSON.stringify(entries)),
    timestamp: new Date().toISOString(),
  });
  if (aiBackups.length > AI_BACKUP_MAX) aiBackups.shift();
  renderAiBackupList();
}

function restoreAiBackup(idx) {
  const bk = aiBackups[idx];
  if (!bk) return;
  entries = JSON.parse(JSON.stringify(bk.entries));
  save(); renderRecord(); renderCalendar();
  appendAiMessage('ai', `♻️ バックアップを復元しました\n「${bk.label}」（${fmtBackupTime(bk.timestamp)}）`);
  renderAiBackupList();
}

function deleteAiBackup(idx) {
  aiBackups.splice(idx, 1);
  renderAiBackupList();
}

function fmtBackupTime(iso) {
  const d = new Date(iso);
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function renderAiBackupList() {
  const cont = document.getElementById('aiBackupList');
  if (!cont) return;
  if (!aiBackups.length) {
    cont.innerHTML = '<div style="font-size:11px;color:var(--text-sub);padding:6px 0">バックアップはまだありません</div>';
    return;
  }
  cont.innerHTML = [...aiBackups].reverse().map((bk, ri) => {
    const idx = aiBackups.length - 1 - ri;
    return `<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid var(--border)">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${bk.label}</div>
        <div style="font-size:10px;color:var(--text-sub)">${fmtBackupTime(bk.timestamp)}　${bk.entries.length}件</div>
      </div>
      <button onclick="restoreAiBackup(${idx})" style="background:#e8f0fe;color:#3266ad;border:none;border-radius:7px;padding:4px 9px;font-size:11px;cursor:pointer;white-space:nowrap">復元</button>
      <button onclick="deleteAiBackup(${idx})" style="background:none;border:none;color:var(--text-sub);font-size:14px;cursor:pointer;padding:2px 4px">✕</button>
    </div>`;
  }).join('');
}

function handleAiKey(e) {
  if (e.key !== 'Enter') return;
  // スマホ（ソフトキーボード）判定: pointerの細かさ or maxTouchPoints
  const isMobile = navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches;
  if (isMobile) {
    // スマホ: Enterは常に改行（送信はボタンのみ）
    return;
  }
  // PC: Shift+Enterで改行、Enterで送信
  if (!e.shiftKey) {
    e.preventDefault();
    sendAiMessage();
  }
}

function resetAiChat() {
  aiHistory = [];
  const box = document.getElementById('aiChatBox');
  if (box) box.innerHTML = '';
  appendAiMessage('ai', '会話をリセットしました。新たな質問や操作をどうぞ。');
}
function initAiChat() {
  if (aiInitDone) return;
  aiInitDone = true;
  renderAiBackupList();
  appendAiMessage('ai',
    'こんにちは！食事記録のアシスタントです🍽️\n\n' +
    '【できること】\n' +
    '・「朝食に卵とご飯を食べた」→ 自動で栄養計算＆登録\n' +
    '・「今週の昼食を全部サラダチキンで登録して」→ 複数日まとめて操作\n' +
    '・「昨日の夕食を削除して」→ 記録の削除\n' +
    '・「今週の記録を教えて」→ 記録の読み取り＆集計\n\n' +
    '操作前に自動でバックアップを保存します。\n' +
    '誤操作した場合は下のバックアップ一覧から復元できます。\n\n' +
    '⚠️ 栄養データはAI推定値です。目安としてご利用ください。'
  );
}

function appendAiMessage(role, text) {
  const box = document.getElementById('aiChatBox');
  if (!box) return;
  const isAi = role === 'ai';
  const div = document.createElement('div');
  div.style.cssText = `
    max-width: 88%;
    align-self: ${isAi ? 'flex-start' : 'flex-end'};
    background: ${isAi ? 'var(--surface)' : 'var(--accent)'};
    color: ${isAi ? 'var(--text)' : '#fff'};
    border-radius: ${isAi ? '4px 14px 14px 14px' : '14px 4px 14px 14px'};
    padding: 9px 12px;
    font-size: 13px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
    border: ${isAi ? '1px solid var(--border)' : 'none'};
  `;
  div.textContent = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  return div;
}

function appendAiThinking() {
  const box = document.getElementById('aiChatBox');
  if (!box) return null;
  const div = document.createElement('div');
  div.style.cssText = `
    align-self: flex-start;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px 14px 14px 14px;
    padding: 9px 14px;
    font-size: 18px;
    letter-spacing: 4px;
  `;
  div.textContent = '●○○';
  let frame = 0;
  div._timer = setInterval(() => {
    const dots = ['●○○','●●○','●●●','○●●','○○●','○○○'];
    div.textContent = dots[frame++ % dots.length];
  }, 300);
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  return div;
}

// 日付ユーティリティ
function getWeekDates(baseDate) {
  // baseDate の週（月〜日）の日付リストを返す
  const d = new Date(baseDate + 'T00:00:00');
  const day = d.getDay(); // 0=日
  const monday = new Date(d); monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({length: 7}, (_, i) => {
    const dd = new Date(monday); dd.setDate(monday.getDate() + i); return toDateStr(dd);
  });
}
function getLastNDates(n, base) {
  const ref = new Date((base || currentDate) + 'T00:00:00');
  return Array.from({length: n}, (_, i) => {
    const d = new Date(ref); d.setDate(ref.getDate() - (n - 1 - i)); return toDateStr(d);
  });
}
function dateLabel(ds) {
  const d = new Date(ds + 'T00:00:00');
  const dow = ['日','月','火','水','木','金','土'][d.getDay()];
  return `${d.getMonth()+1}/${d.getDate()}(${dow})`;
}

// 全記録のサマリーをAIに渡す文字列を生成
function buildFullContext() {
  const lines = [];
  const TODAY = currentDate;
  const RECENT_DAYS = 14; // 詳細表示する直近日数

  // ── プロフィール ──
  const sexLabel = profile.sex === 'male' ? '男性' : '女性';
  const actLabel = ({1.2:'座位中心',1.375:'軽い運動',1.55:'中程度',1.725:'激しい運動',1.9:'非常に激しい'})[String(profile.activityFactor)] || String(profile.activityFactor);
  lines.push('【プロフィール】');
  lines.push(`性別:${sexLabel} 年齢:${profile.age} 身長:${profile.height}cm 体重:${profile.weight}kg 活動:${actLabel}`);

  // ── 目標値 ──
  const g = goals();
  lines.push(`【目標】cal:${g.cal} P:${g.p} F:${g.f} C:${g.c}`);

  // ── カスタム食品DB（名前のみ・トークン節約） ──
  if (customFoods.length) {
    lines.push('【カスタム食品】' + customFoods.map(f => f.name).join('、'));
  }

  // ── 食事記録 ──
  // 直近14日：食品レベルの詳細（id付き）
  // それ以前：日次サマリーのみ
  const recentCutoff = (() => {
    const d = new Date(TODAY + 'T00:00:00');
    d.setDate(d.getDate() - RECENT_DAYS + 1);
    return toDateStr(d);
  })();

  const grouped = {};
  entries.forEach(e => {
    if (!grouped[e.date]) grouped[e.date] = {};
    if (!grouped[e.date][e.meal]) grouped[e.date][e.meal] = [];
    grouped[e.date][e.meal].push(e);
  });

  const allDates = Object.keys(grouped).sort();
  const recentDates = allDates.filter(d => d >= recentCutoff);
  const oldDates    = allDates.filter(d => d <  recentCutoff);

  if (recentDates.length) {
    lines.push(`【食事記録 直近${RECENT_DAYS}日（詳細）】`);
    recentDates.forEach(date => {
      const dayEntries = entries.filter(e => e.date === date);
      const s = sumEntries(dayEntries);
      lines.push(`${dateLabel(date)} [${Math.round(s.cal)}kcal P${r1(s.p)} F${r1(s.f)} C${r1(s.c)}]`);
      Object.entries(grouped[date]).forEach(([meal, foods]) => {
        lines.push(`  ${meal}: ${foods.map(e => `${e.name}(${e.amount}g,${Math.round(e.cal)}kcal,id:${e.id})`).join('、')}`);
      });
    });
  }

  if (oldDates.length) {
    lines.push('【食事記録 過去分（日次サマリー）】');
    oldDates.forEach(date => {
      const dayEntries = entries.filter(e => e.date === date);
      const s = sumEntries(dayEntries);
      lines.push(`${date} ${Math.round(s.cal)}kcal P${r1(s.p)} F${r1(s.f)} C${r1(s.c)}`);
    });
  }

  if (!entries.length) lines.push('【食事記録】なし');

  // ── 運動記録 ──
  if (exercises.length) {
    const recentEx = exercises.filter(e => e.date >= recentCutoff);
    const oldEx    = exercises.filter(e => e.date <  recentCutoff);
    if (recentEx.length) {
      lines.push('【運動記録 直近】');
      const exGrouped = {};
      recentEx.forEach(e => { (exGrouped[e.date] = exGrouped[e.date]||[]).push(e); });
      Object.entries(exGrouped).sort().forEach(([d, exs]) => {
        lines.push(`${dateLabel(d)}: ${exs.map(e=>`${e.name}(${e.minutes||'?'}分,消費${Math.round(e.cal)}kcal,id:${e.id})`).join('、')}`);
      });
    }
    if (oldEx.length) {
      const totalOldCal = Math.round(oldEx.reduce((a,e)=>a+(e.cal||0),0));
      lines.push(`【運動記録 過去分】${oldEx.length}件 合計消費${totalOldCal}kcal`);
    }
  }

  return lines.join('\n');
}

// コマンド実行エンジン
function executeAiCommands(commands, backupLabel) {
  // 変更前にバックアップを保存
  takeAiBackup(backupLabel || 'AI操作');
  const log = [];
  let changed = false;

  commands.forEach(cmd => {
    // ── ADD ──
    if (cmd.type === 'add') {
      const dates = cmd.dates || [cmd.date || currentDate];
      const meal  = ['朝食','昼食','夕食','間食'].includes(cmd.meal) ? cmd.meal : '間食';
      dates.forEach(date => {
        (cmd.items || [cmd]).forEach(item => {
          if (!item.name) return;
          const aiEntry = {
            id: Date.now() + Math.random(),
            date, meal,
            name:    item.name,
            amount:  parseFloat(item.amount)  || 100,
            cal:     parseFloat(item.cal)     || 0,
            p:       parseFloat(item.p)       || 0,
            f:       parseFloat(item.f)       || 0,
            c:       parseFloat(item.c)       || 0,
            fiber:   parseFloat(item.fiber)   || 0,
            iron:    parseFloat(item.iron)    || 0,
            calcium: parseFloat(item.calcium) || 0,
            vitc:    parseFloat(item.vitc)    || 0,
            vitd:    parseFloat(item.vitd)    || 0,
            salt:    parseFloat(item.salt)    || 0,
          };
          enrichFoodProfile(aiEntry);
          addOrMergeEntry(aiEntry);
        });
        log.push(`✅ ${dateLabel(date)} ${meal}に登録`);
      });
      changed = true;
    }

    // ── DELETE_BY_ID ──
    else if (cmd.type === 'delete_by_id') {
      const ids = Array.isArray(cmd.ids) ? cmd.ids : [cmd.id];
      const before = entries.length;
      entries = entries.filter(e => !ids.includes(e.id));
      log.push(`🗑️ ${before - entries.length}件削除`);
      changed = true;
    }

    // ── DELETE_BY_DATE_MEAL ──
    else if (cmd.type === 'delete_by_date_meal') {
      const dates = cmd.dates || [cmd.date];
      const meal  = cmd.meal || null;
      const before = entries.length;
      entries = entries.filter(e => {
        if (!dates.includes(e.date)) return true;
        if (meal && e.meal !== meal) return true;
        return false;
      });
      log.push(`🗑️ ${before - entries.length}件削除（${dates.map(dateLabel).join('、')} ${meal||'全食事'}）`);
      changed = true;
    }

    // ── REPLACE ──（指定日時のmealを全削除→新規追加）
    else if (cmd.type === 'replace') {
      const dates = cmd.dates || [cmd.date || currentDate];
      const meal  = ['朝食','昼食','夕食','間食'].includes(cmd.meal) ? cmd.meal : '間食';
      dates.forEach(date => {
        const before = entries.length;
        entries = entries.filter(e => !(e.date === date && e.meal === meal));
        const removed = before - entries.length;
        (cmd.items || []).forEach(item => {
          if (!item.name) return;
          const aiEntry = {
            id: Date.now() + Math.random(),
            date, meal,
            name:    item.name,
            amount:  parseFloat(item.amount)  || 100,
            cal:     parseFloat(item.cal)     || 0,
            p:       parseFloat(item.p)       || 0,
            f:       parseFloat(item.f)       || 0,
            c:       parseFloat(item.c)       || 0,
            fiber:   parseFloat(item.fiber)   || 0,
            iron:    parseFloat(item.iron)    || 0,
            calcium: parseFloat(item.calcium) || 0,
            vitc:    parseFloat(item.vitc)    || 0,
            vitd:    parseFloat(item.vitd)    || 0,
            salt:    parseFloat(item.salt)    || 0,
          };
          enrichFoodProfile(aiEntry);
          addOrMergeEntry(aiEntry);
        });
        log.push(`🔄 ${dateLabel(date)} ${meal}を置き換え（旧${removed}件→新${cmd.items.length}件）`);
      });
      changed = true;
    }
    // ── ADD_CUSTOM_FOOD ──（カスタム食品DBへの登録）
    else if (cmd.type === 'add_custom_food') {
      const foods = Array.isArray(cmd.foods) ? cmd.foods : [cmd];
      foods.forEach(food => {
        if (!food.name) return;
        const per = parseFloat(food.per) || 100;
        customFoods.push({
          id:      Date.now() + Math.random(),
          name:    food.name,
          per,
          cal:     parseFloat(food.cal)     || 0,
          p:       parseFloat(food.p)       || 0,
          f:       parseFloat(food.f)       || 0,
          c:       parseFloat(food.c)       || 0,
          fiber:   parseFloat(food.fiber)   || 0,
          iron:    parseFloat(food.iron)    || 0,
          calcium: parseFloat(food.calcium) || 0,
          vitc:    parseFloat(food.vitc)    || 0,
          vitd:    parseFloat(food.vitd)    || 0,
          salt:    parseFloat(food.salt)    || 0,
          _src:    'ai',
        });
        log.push(`📦 カスタム食品「${food.name}」を登録（${per}gあたり ${Math.round(food.cal)}kcal）`);
      });
      saveCustom();
      changed = true;
    }

    // ── REGISTER_LOGGED_FOOD ──（既に記録済みの食事エントリを、その記録値そのままカスタム食品DBに登録）
    else if (cmd.type === 'register_logged_food') {
      const items = Array.isArray(cmd.items) ? cmd.items
        : (cmd.entry_ids || cmd.ids || []).map(id => ({ entry_id: id }));
      items.forEach(item => {
        const entryId = item.entry_id ?? item.id;
        const src = entries.find(e => e.id === entryId);
        if (!src) { log.push(`⚠️ id:${entryId} の記録が見つかりません`); return; }
        const name = (item.as_name || src.name || '').trim();
        if (!name) return;
        // 既に同名のカスタム食品があれば重複登録しない
        if (customFoods.some(f => normFoodName(f.name) === normFoodName(name))) {
          log.push(`ℹ️ 「${name}」は既にカスタム食品DBに登録済みです`);
          return;
        }
        const scale = 100 / (src.amount || 100);
        customFoods.push({
          id:      Date.now() + Math.random(),
          name,
          per:     100,
          cal:     r1((src.cal     || 0) * scale),
          p:       r1((src.p       || 0) * scale),
          f:       r1((src.f       || 0) * scale),
          c:       r1((src.c       || 0) * scale),
          fiber:   r1((src.fiber   || 0) * scale),
          iron:    r2((src.iron    || 0) * scale),
          calcium: r1((src.calcium || 0) * scale),
          vitc:    r1((src.vitc    || 0) * scale),
          vitd:    r2((src.vitd    || 0) * scale),
          salt:    r2((src.salt    || 0) * scale),
          fa:      src.fa || null,
          aa:      src.aa || null,
          _src:    'log',
        });
        log.push(`📦 「${name}」を記録済みデータ(100gあたり ${r1((src.cal||0)*scale)}kcal)からDBに登録`);
      });
      saveCustom();
      changed = true;
    }

    // ── DELETE_CUSTOM_FOOD ──（カスタム食品DBからの削除）
    else if (cmd.type === 'delete_custom_food') {
      const names = Array.isArray(cmd.names) ? cmd.names : [cmd.name];
      const before = customFoods.length;
      customFoods = customFoods.filter(f => !names.includes(f.name));
      saveCustom();
      log.push(`🗑️ カスタム食品 ${before - customFoods.length}件削除`);
      changed = true;
    }
  });
  return log;
}

async function sendAiMessage() {
  const inp = document.getElementById('aiInput');
  const btn = document.getElementById('aiSendBtn');
  const text = inp ? inp.value.trim() : '';
  if (!text) return;

  inp.value = '';
  inp.disabled = true;
  btn.disabled = true;

  appendAiMessage('user', text);
  aiHistory.push({ role: 'user', content: text });

  const thinking = appendAiThinking();

  // コンテキスト構築（送信のたびに最新データを全件渡す）
  const today = currentDate;
  const weekDates = getWeekDates(today);
  const dbSample  = LOCAL_DB.slice(0, 60).map(f => f.name).join('、');
  const fullCtx = buildFullContext();

  const systemPrompt = `あなたは日本語の栄養管理アプリの操作AIです。
ユーザーの指示を解釈し、必要に応じて記録の追加・削除・置き換えを行います。
以下は送信時点の最新内部データです。質問・操作・アドバイスの判断に必ず活用してください。

【現在日時】今日: ${today}（${dateLabel(today)}）
【今週の日付】${weekDates.map(d => `${dateLabel(d)} ${d}`).join(' / ')}

${fullCtx}

【標準食品DB例】${dbSample} など

【食事タイミング】朝食 / 昼食 / 夕食 / 間食

━━━━━━━━━━━━━━━━━━━━━━
【操作コマンド仕様】
操作が必要な場合は必ず末尾に \`\`\`json ブロックを出力してください。
JSONブロックは必ず \`\`\`json で始め \`\`\` で終わること。他の形式は使用不可。

コマンド種別:

1. add — 今日または指定日の食事記録に食品を追加
{
  "commands": [{
    "type": "add",
    "dates": ["${today}"],
    "meal": "昼食",
    "items": [{"name": "食品名", "amount": 100, "cal": 168, "p": 2.5, "f": 0.3, "c": 37.1, "fiber": 0.3, "iron": 0.1, "calcium": 3, "vitc": 0, "vitd": 0, "salt": 0}]
  }],
  "backup_label": "朝食追加",
  "message": "ユーザーへの返答"
}

2. delete_by_id — IDを指定して削除（コンテキストのidフィールドを使用）
{
  "commands": [{"type": "delete_by_id", "ids": [1234567890]}],
  "backup_label": "夕食削除",
  "message": "削除しました"
}

3. delete_by_date_meal — 日付×食事タイミングで一括削除
{
  "commands": [{"type": "delete_by_date_meal", "dates": ["${today}"], "meal": "昼食"}],
  "backup_label": "昼食一括削除",
  "message": "削除しました"
}

4. replace — 指定日時の既存記録を全削除して新内容で置き換え
{
  "commands": [{"type": "replace", "dates": ["${today}"], "meal": "昼食", "items": [...]}],
  "backup_label": "昼食を置き換え",
  "message": "置き換えました"
}

5. add_custom_food — カスタム食品DBに食品を登録（食事記録への追加とは別・検索DBに保存。栄養成分は推定または表示値を使用）
{
  "commands": [{
    "type": "add_custom_food",
    "foods": [{
      "name": "サントリー角ハイボール缶350ml",
      "per": 350,
      "cal": 154, "p": 0, "f": 0, "c": 10.5,
      "fiber": 0, "iron": 0, "calcium": 0, "vitc": 0, "vitd": 0, "salt": 0
    }]
  }],
  "backup_label": "カスタム食品登録",
  "message": "カスタム食品DBに登録しました。次回から食品検索で見つかります。"
}

6. register_logged_food — 【現在日時】以下のコンテキストに既にある食事記録（id付き）を、その記録済みの栄養値そのまま100gあたりに換算してカスタム食品DBに登録（栄養値を推定し直さない・改めてお願いされた食品名と一致するidをコンテキストから探して使う）
{
  "commands": [{
    "type": "register_logged_food",
    "items": [{"entry_id": 1234567890, "as_name": "省略可・DB登録名を変えたい場合のみ指定"}]
  }],
  "backup_label": "記録済み食品をDB登録",
  "message": "登録しました"
}

7. delete_custom_food — カスタム食品DBから削除
{
  "commands": [{"type": "delete_custom_food", "names": ["食品名"]}],
  "backup_label": "カスタム食品削除",
  "message": "削除しました"
}

【コマンド選択の判断基準（重要）】
- 「〇〇を食べた」「〇〇を追加して」→ add（食事記録に追加）
- 「（今日/昨日/〇月〇日の）朝食/昼食/夕食の〇〇を食品DBに登録して」「さっき記録した〇〇を保存して」など、既に記録済みの食品を指す依頼 → register_logged_food（コンテキストの食事記録からid付きで該当項目を探し、その id を entry_id に使う。栄養値は絶対に自分で計算し直さない）
- まだ記録されていない食品を新しくDBに登録したい依頼（「〇〇という商品をDBに登録して」等）→ add_custom_food（栄養値を推定して入力）
- 「〇〇を削除して」→ 対象がid特定できれば delete_by_id、できなければ delete_by_date_meal
- 「〇〇に変えて」「〇〇で置き換えて」→ replace
- 「今週の〇〇を全部〇〇にして」→ replace を dates に全日付列挙して1コマンドで

【必須ルール・よくある誤りの防止】
- dates は必ず配列で指定。「今日」でも ["${today}"] と明示する
- meal は必ず「朝食」「昼食」「夕食」「間食」のいずれか。省略・空文字・null 禁止
- items の栄養素（cal/p/f/c）は必ず推定値を入れる。全て0はNG
- amount は必ず正の数値。単位はg（人前ではなくg換算で記入）
- 複数の食品を同じ meal に追加する場合は items 配列を使い、コマンドは1つにまとめる
- add と add_custom_food を混同しない。食べた記録は add、DBへの保存は add_custom_food
- register_logged_food の entry_id は必ずコンテキストの食事記録に実在する id を使う。id が見つからない・該当日が直近14日の詳細範囲外の場合は無理に実行せず、message で「id特定できないため対応できません」と案内する
- "今週" は ${weekDates[0]}〜${weekDates[6]}（${weekDates.length}日間）
- "昨日" は ${getLastNDates(2)[0]}、"一昨日" は ${getLastNDates(3)[0]}
- 記録の読み取り・質問・雑談のみの場合は commands 不要、message だけ返す
- 未来の日付には操作しない（予定記録はユーザーに確認する）

【backup_labelルール】
- 操作内容を10文字以内で端的に表す日本語ラベルを必ず付ける
- 例）「朝食に卵追加」「昨日夕食削除」「今週昼食を置換」

【対応範囲外の操作について】
以下はこのアプリで対応できない操作です。該当する場合は操作を行わず、
できない理由と代替手段をmessageのみで返してください（JSONブロック不要）:
- 体重・プロフィール情報の変更（→「設定」タブで手動変更を案内）
- グラフや統計の操作（表示のみで変更不可）
- 15日以上前の記録（コンテキスト外のため参照・操作不可）
- 運動記録の追加・削除（→「記録」タブの運動ブロックで手動操作を案内）
- アプリの設定変更・外部サービス連携操作

【カスタム食品登録のルール】
- 既に記録した食事から登録したい場合は register_logged_food（記録値そのまま使う・最も正確）
- まだ記録していない新しい商品を登録したい場合は add_custom_food（per は商品1個・1食分・100g など最も使いやすい単位を選ぶ。栄養成分表示がある場合はその数値を使用、なければ標準的な値を推定）
- 登録後は「記録タブの食品検索から追加できます」と案内する
━━━━━━━━━━━━━━━━━━━━━━`;

  try {
    const res = await fetch('/.netlify/functions/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: systemPrompt,
        messages: aiHistory,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `サーバーエラー (${res.status})`);
    }
    const rawText = (data.content || []).map(b => b.text || '').join('');

    // JSONブロック抽出（Geminiは```json以外の形式でも返すことがある）
    let parsed      = null;
    let displayText = rawText;

    // 複数のパターンを試みる
    const jsonPatterns = [
      /```json\s*([\s\S]*?)```/,   // 標準: ```json ... ```
      /```\s*(\{[\s\S]*?\})\s*```/, // ``` { ... } ```
      /(\{[\s\S]*"commands"[\s\S]*?\})\s*$/m, // 末尾のJSONオブジェクト
      /(\{[\s\S]*"items"[\s\S]*?\})\s*$/m,    // itemsキーを含むJSON
    ];

    for (const pat of jsonPatterns) {
      const m = rawText.match(pat);
      if (m) {
        try {
          parsed = JSON.parse(m[1].trim());
          displayText = parsed.message || rawText.replace(pat, '').trim();
          break;
        } catch(e) { /* 次のパターンを試す */ }
      }
    }

    // 旧形式（items配列）のフォールバック対応
    if (parsed && !parsed.commands && Array.isArray(parsed.items)) {
      // 旧itemsフォーマットをcommands形式に変換
      parsed = {
        commands: [{
          type: 'add',
          dates: [currentDate],
          meal: parsed.items[0]?.meal || '昼食',
          items: parsed.items,
        }],
        message: parsed.message || '',
        backup_label: '食品追加',
      };
    }

    if (thinking) { clearInterval(thinking._timer); thinking.remove(); }
    const historyContent = rawText.replace(/```json[\s\S]*?```/g, '[操作コマンド実行済み]').trim();
    aiHistory.push({ role: 'assistant', content: historyContent });
    if (aiHistory.length > 20) aiHistory = aiHistory.slice(aiHistory.length - 20);

    // コマンド実行
    if (parsed && Array.isArray(parsed.commands) && parsed.commands.length > 0) {
      const backupLabel = parsed.backup_label || 'AI操作';
      const opLog = executeAiCommands(parsed.commands, backupLabel);
      const replyText = (displayText ? displayText + '\n\n' : '') + opLog.join('\n');
      appendAiMessage('ai', replyText);
    } else {
      appendAiMessage('ai', displayText || '応答を取得できませんでした。');
    }

  } catch(err) {
    if (thinking) { clearInterval(thinking._timer); thinking.remove(); }
    const msg = err.message || String(err);
    const hint = msg.includes('GEMINI_API_KEY')
      ? msg
      : `通信エラーが発生しました。\n${msg}`;
    appendAiMessage('ai', hint);
    aiHistory.pop();
  }

  inp.disabled = false;
  btn.disabled = false;
  inp.focus();
}

document.addEventListener('click', e => {
  const cb = document.getElementById('comboResultsBox');
  if (cb && !cb.contains(e.target) && e.target !== document.getElementById('comboSearch')) cb.style.display = 'none';
  MEALS_ORDER.forEach(meal => {
    const box=document.getElementById('addResultsBox_'+meal);
    const inp=document.getElementById('addSearch_'+meal);
    if (box && !box.contains(e.target) && e.target !== inp) box.style.display = 'none';
  });
});

// ── Init ──
updateDateHeader();
renderCalendar();
renderRecord();
renderExerciseItems();
renderAuthUI();
initFirebase(); // Firebase設定がある場合に認証・同期を開始
