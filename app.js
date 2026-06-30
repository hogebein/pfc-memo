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
  // 食品ごとに吸収率を適用して合計
  return list.reduce((sum, e) => {
    const rate = P_ABS_HIGH_PATTERN.test(e.name) ? P_ABS_HIGH : P_ABS_LOW;
    return sum + (e.p || 0) * rate;
  }, 0);
}



// ── 内蔵DB ──
const LOCAL_DB = [
  {name:'白米（炊飯）',yomi:'ハクマイ',tags:'ごはん こめ',en:'white rice cooked rice',cal:168,p:2.5,f:0.3,c:37.1,per:100,fiber:0.3,iron:0.1,calcium:3,vitc:0,vitd:0,salt:0},
  {name:'玄米（炊飯）',yomi:'ゲンマイ',tags:'ごはん こめ',en:'brown rice',cal:165,p:2.8,f:1.0,c:35.6,per:100,fiber:1.4,iron:0.6,calcium:7,vitc:0,vitd:0,salt:0},
  {name:'ご飯（茶碗1杯）',yomi:'ゴハン',tags:'こめ めし',en:'cooked rice bowl',cal:269,p:4.0,f:0.5,c:59.4,per:160,fiber:0.5,iron:0.2,calcium:5,vitc:0,vitd:0,salt:0},
  {name:'食パン',yomi:'ショクパン',tags:'ぱん',en:'bread white bread',cal:248,p:8.9,f:4.1,c:44.4,per:100,fiber:2.3,iron:0.5,calcium:29,vitc:0,vitd:0,salt:1.2},
  {name:'うどん（茹で）',yomi:'ウドン',tags:'',en:'udon noodle',cal:105,p:2.6,f:0.4,c:21.6,per:100,fiber:0.8,iron:0.2,calcium:9,vitc:0,vitd:0,salt:0.3},
  {name:'そば（茹で）',yomi:'ソバ',tags:'',en:'soba buckwheat noodle',cal:130,p:4.8,f:1.0,c:26.0,per:100,fiber:2.0,iron:0.8,calcium:9,vitc:0,vitd:0,salt:0},
  {name:'パスタ（茹で）',yomi:'パスタ',tags:'スパゲッティ',en:'pasta spaghetti',cal:149,p:5.8,f:0.9,c:29.2,per:100,fiber:1.5,iron:0.7,calcium:7,vitc:0,vitd:0,salt:0},
  {name:'オートミール',yomi:'オートミール',tags:'えんばく',en:'oatmeal oats',cal:380,p:13.7,f:5.7,c:69.1,per:100,fiber:9.4,iron:3.9,calcium:47,vitc:0,vitd:0,salt:0},
  {name:'鶏むね肉（皮なし）',yomi:'トリムネニク',tags:'チキン',en:'chicken breast skinless',cal:108,p:22.3,f:1.5,c:0,per:100,fiber:0,iron:0.3,calcium:4,vitc:3,vitd:0.1,salt:0.1},
  {name:'鶏もも肉（皮あり）',yomi:'トリモモニク',tags:'チキン',en:'chicken thigh',cal:190,p:17.3,f:13.0,c:0,per:100,fiber:0,iron:0.4,calcium:5,vitc:2,vitd:0.4,salt:0.2},
  {name:'ささみ',yomi:'ササミ',tags:'とり チキン',en:'chicken tenderloin',cal:98,p:23.0,f:0.8,c:0,per:100,fiber:0,iron:0.3,calcium:3,vitc:3,vitd:0,salt:0.1},
  {name:'豚ロース',yomi:'ブタロース',tags:'ぽーく',en:'pork loin',cal:263,p:19.3,f:19.2,c:0.2,per:100,fiber:0,iron:0.5,calcium:4,vitc:1,vitd:0.4,salt:0.1},
  {name:'豚バラ',yomi:'ブタバラ',tags:'ぽーく',en:'pork belly',cal:395,p:14.4,f:35.4,c:0.1,per:100,fiber:0,iron:0.4,calcium:4,vitc:1,vitd:0.3,salt:0.1},
  {name:'牛もも肉',yomi:'ウシモモニク',tags:'ビーフ',en:'beef round steak',cal:182,p:21.2,f:10.2,c:0.4,per:100,fiber:0,iron:2.7,calcium:4,vitc:1,vitd:0.1,salt:0.1},
  {name:'牛ひき肉',yomi:'ウシヒキニク',tags:'ひき ビーフ',en:'ground beef',cal:272,p:17.1,f:21.1,c:0.3,per:100,fiber:0,iron:2.4,calcium:5,vitc:1,vitd:0.1,salt:0.1},
  {name:'合いびき肉',yomi:'アイビキニク',tags:'ひき',en:'mixed ground meat',cal:257,p:17.4,f:19.0,c:0.3,per:100,fiber:0,iron:1.5,calcium:5,vitc:1,vitd:0.2,salt:0.1},
  {name:'ベーコン',yomi:'ベーコン',tags:'',en:'bacon',cal:405,p:12.9,f:39.1,c:0.3,per:100,fiber:0,iron:0.4,calcium:5,vitc:15,vitd:0.5,salt:2.0},
  {name:'ウインナー',yomi:'ウインナー',tags:'ソーセージ',en:'sausage wiener',cal:321,p:11.5,f:28.5,c:3.3,per:100,fiber:0,iron:0.7,calcium:9,vitc:11,vitd:0.3,salt:1.9},
  {name:'いわし（マイワシ）',yomi:'イワシ',tags:'',en:'sardine iwashi',cal:177,p:19.2,f:9.2,c:0.2,per:100,fiber:0,iron:2.1,calcium:74,vitc:0,vitd:32,salt:0.2},
  {name:'いわし缶（水煮）',yomi:'イワシカン',tags:'いわし 缶詰',en:'canned sardine',cal:136,p:20.3,f:5.6,c:0.1,per:100,fiber:0,iron:2.6,calcium:320,vitc:0,vitd:27,salt:0.8},
  {name:'さば（マサバ）',yomi:'サバ',tags:'',en:'mackerel saba',cal:247,p:20.6,f:16.8,c:0.3,per:100,fiber:0,iron:1.2,calcium:6,vitc:1,vitd:11,salt:0.3},
  {name:'さば缶（水煮）',yomi:'サバカン',tags:'さば 缶詰',en:'canned mackerel',cal:174,p:20.9,f:10.7,c:0.2,per:100,fiber:0,iron:1.7,calcium:260,vitc:0,vitd:11,salt:0.9},
  {name:'さば缶（味噌煮）',yomi:'サバカンミソ',tags:'さば 缶詰 みそ',en:'canned mackerel miso',cal:210,p:16.3,f:13.9,c:6.6,per:100,fiber:0.5,iron:1.5,calcium:200,vitc:0,vitd:9,salt:1.2},
  {name:'さんま',yomi:'サンマ',tags:'',en:'pacific saury',cal:318,p:17.4,f:25.6,c:0.1,per:100,fiber:0,iron:1.4,calcium:28,vitc:0,vitd:19,salt:0.3},
  {name:'あじ（マアジ）',yomi:'アジ',tags:'',en:'horse mackerel aji',cal:126,p:20.7,f:4.5,c:0.1,per:100,fiber:0,iron:0.6,calcium:66,vitc:0,vitd:8,salt:0.3},
  {name:'サーモン（養殖）',yomi:'サーモン',tags:'鮭 しゃけ さけ',en:'salmon',cal:204,p:20.1,f:12.8,c:0.1,per:100,fiber:0,iron:0.4,calcium:14,vitc:5,vitd:15,salt:0.1},
  {name:'鮭（シロサケ）',yomi:'サケ',tags:'さけ しゃけ',en:'salmon sake',cal:133,p:22.3,f:4.1,c:0.1,per:100,fiber:0,iron:0.5,calcium:14,vitc:5,vitd:32,salt:0.2},
  {name:'マグロ（赤身）',yomi:'マグロ',tags:'ツナ まぐろ',en:'tuna maguro lean',cal:115,p:26.4,f:1.4,c:0.1,per:100,fiber:0,iron:1.1,calcium:5,vitc:2,vitd:4,salt:0.1},
  {name:'マグロ（トロ）',yomi:'マグロトロ',tags:'まぐろ',en:'tuna fatty toro',cal:344,p:20.1,f:27.5,c:0.1,per:100,fiber:0,iron:1.6,calcium:7,vitc:2,vitd:18,salt:0.1},
  {name:'えび',yomi:'エビ',tags:'海老',en:'shrimp prawn ebi',cal:83,p:18.4,f:0.3,c:0.7,per:100,fiber:0,iron:0.7,calcium:67,vitc:0,vitd:0,salt:0.6},
  {name:'いか',yomi:'イカ',tags:'烏賊',en:'squid ika',cal:83,p:17.9,f:0.8,c:0.1,per:100,fiber:0,iron:0.1,calcium:11,vitc:1,vitd:0,salt:0.5},
  {name:'ツナ缶（水煮）',yomi:'ツナカン',tags:'まぐろ 缶詰',en:'canned tuna water',cal:71,p:16.0,f:0.7,c:0.1,per:100,fiber:0,iron:0.5,calcium:6,vitc:0,vitd:3,salt:0.4},
  {name:'ツナ缶（油漬け）',yomi:'ツナカンアブラ',tags:'まぐろ 缶詰',en:'canned tuna oil',cal:267,p:14.5,f:21.7,c:0.1,per:100,fiber:0,iron:0.5,calcium:5,vitc:0,vitd:3,salt:0.4},
  {name:'卵',yomi:'タマゴ',tags:'えっぐ たまご',en:'egg',cal:151,p:12.3,f:10.3,c:0.3,per:100,fiber:0,iron:1.8,calcium:51,vitc:0,vitd:3.8,salt:0.3},
  {name:'牛乳',yomi:'ギュウニュウ',tags:'ミルク',en:'milk',cal:67,p:3.3,f:3.8,c:4.8,per:100,fiber:0,iron:0,calcium:110,vitc:1,vitd:0.3,salt:0.1},
  {name:'低脂肪乳',yomi:'テイシボウニュウ',tags:'ミルク',en:'low fat milk',cal:46,p:3.8,f:1.0,c:5.5,per:100,fiber:0,iron:0,calcium:130,vitc:1,vitd:0.3,salt:0.1},
  {name:'ヨーグルト（無糖）',yomi:'ヨーグルト',tags:'',en:'yogurt plain unsweetened',cal:62,p:3.6,f:3.0,c:4.9,per:100,fiber:0,iron:0,calcium:120,vitc:1,vitd:0,salt:0.1},
  {name:'ギリシャヨーグルト',yomi:'ギリシャヨーグルト',tags:'ヨーグルト',en:'greek yogurt',cal:83,p:8.7,f:3.0,c:4.0,per:100,fiber:0,iron:0,calcium:100,vitc:0,vitd:0,salt:0.1},
  {name:'チーズ（プロセス）',yomi:'チーズ',tags:'',en:'cheese processed',cal:339,p:22.7,f:26.0,c:1.3,per:100,fiber:0,iron:0.3,calcium:630,vitc:0,vitd:0.2,salt:2.8},
  {name:'カッテージチーズ',yomi:'カッテージチーズ',tags:'チーズ',en:'cottage cheese',cal:105,p:13.3,f:4.5,c:1.9,per:100,fiber:0,iron:0.1,calcium:55,vitc:0,vitd:0,salt:0.7},
  {name:'バター',yomi:'バター',tags:'',en:'butter',cal:745,p:0.5,f:81.0,c:0.2,per:100,fiber:0,iron:0,calcium:14,vitc:0,vitd:0,salt:1.9},
  {name:'豆腐（木綿）',yomi:'モメンドウフ',tags:'とうふ',en:'tofu firm',cal:72,p:6.6,f:4.2,c:1.6,per:100,fiber:0.4,iron:1.5,calcium:93,vitc:0,vitd:0,salt:0},
  {name:'豆腐（絹ごし）',yomi:'キヌゴシドウフ',tags:'とうふ',en:'tofu silken soft',cal:56,p:4.9,f:3.0,c:2.0,per:100,fiber:0.3,iron:1.2,calcium:75,vitc:0,vitd:0,salt:0},
  {name:'納豆',yomi:'ナットウ',tags:'',en:'natto fermented soybean',cal:200,p:16.5,f:10.0,c:10.7,per:100,fiber:6.7,iron:3.3,calcium:90,vitc:13,vitd:0,salt:0},
  {name:'大豆（乾燥）',yomi:'ダイズ',tags:'まめ 豆',en:'soybean dried',cal:417,p:35.3,f:19.0,c:28.2,per:100,fiber:17.1,iron:9.4,calcium:240,vitc:0,vitd:0,salt:0},
  {name:'小豆（乾燥）',yomi:'アズキ',tags:'あずき まめ 豆',en:'azuki red bean adzuki',cal:339,p:20.3,f:2.2,c:59.6,per:100,fiber:24.2,iron:5.4,calcium:70,vitc:0,vitd:0,salt:0},
  {name:'ひよこ豆（茹で）',yomi:'ヒヨコマメ',tags:'ガルバンゾー まめ 豆',en:'chickpea garbanzo',cal:171,p:9.5,f:2.5,c:27.4,per:100,fiber:11.6,iron:2.6,calcium:45,vitc:0,vitd:0,salt:0},
  {name:'レンズ豆（茹で）',yomi:'レンズマメ',tags:'まめ 豆',en:'lentil',cal:130,p:11.0,f:0.8,c:21.2,per:100,fiber:9.0,iron:2.9,calcium:27,vitc:2,vitd:0,salt:0},
  {name:'黒豆（茹で）',yomi:'クロマメ',tags:'まめ 豆',en:'black bean black soybean',cal:174,p:13.0,f:3.9,c:24.2,per:100,fiber:11.0,iron:2.9,calcium:130,vitc:0,vitd:0,salt:0},
  {name:'えだまめ',yomi:'エダマメ',tags:'まめ 豆',en:'edamame green soybean',cal:135,p:11.5,f:6.1,c:8.8,per:100,fiber:5.0,iron:2.5,calcium:76,vitc:27,vitd:0,salt:0},
  {name:'きな粉',yomi:'キナコ',tags:'きなこ 大豆',en:'kinako soy flour roasted',cal:437,p:36.7,f:25.7,c:28.5,per:100,fiber:15.4,iron:8.0,calcium:190,vitc:0,vitd:0,salt:0},
  {name:'豆乳（無調整）',yomi:'トウニュウ',tags:'まめ 大豆 ミルク',en:'soy milk unsweetened',cal:46,p:3.6,f:2.0,c:3.1,per:100,fiber:0.2,iron:1.2,calcium:15,vitc:0,vitd:0,salt:0},
  {name:'インゲン豆（茹で）',yomi:'インゲンマメ',tags:'まめ 豆 いんげん',en:'kidney bean green bean',cal:143,p:8.5,f:0.9,c:24.8,per:100,fiber:19.6,iron:3.2,calcium:130,vitc:0,vitd:0,salt:0},
  {name:'ブロッコリー',yomi:'ブロッコリー',tags:'',en:'broccoli',cal:33,p:4.3,f:0.5,c:5.2,per:100,fiber:4.4,iron:1.0,calcium:38,vitc:120,vitd:0,salt:0},
  {name:'ほうれん草',yomi:'ホウレンソウ',tags:'',en:'spinach',cal:20,p:2.2,f:0.4,c:3.1,per:100,fiber:2.8,iron:2.0,calcium:49,vitc:35,vitd:0,salt:0},
  {name:'小松菜',yomi:'コマツナ',tags:'菜っ葉',en:'komatsuna japanese mustard spinach',cal:14,p:1.5,f:0.2,c:2.4,per:100,fiber:1.9,iron:2.8,calcium:170,vitc:39,vitd:0,salt:0},
  {name:'キャベツ',yomi:'キャベツ',tags:'',en:'cabbage',cal:23,p:1.3,f:0.2,c:5.2,per:100,fiber:1.8,iron:0.3,calcium:43,vitc:41,vitd:0,salt:0},
  {name:'白菜',yomi:'ハクサイ',tags:'',en:'napa cabbage chinese cabbage',cal:14,p:0.8,f:0.1,c:3.2,per:100,fiber:1.3,iron:0.3,calcium:43,vitc:19,vitd:0,salt:0},
  {name:'玉ねぎ',yomi:'タマネギ',tags:'',en:'onion',cal:37,p:1.0,f:0.1,c:8.8,per:100,fiber:1.6,iron:0.2,calcium:21,vitc:8,vitd:0,salt:0},
  {name:'長ねぎ',yomi:'ナガネギ',tags:'ねぎ',en:'leek green onion negi',cal:34,p:1.4,f:0.3,c:8.3,per:100,fiber:2.5,iron:0.3,calcium:36,vitc:14,vitd:0,salt:0},
  {name:'にんにく',yomi:'ニンニク',tags:'ガーリック',en:'garlic',cal:136,p:6.4,f:0.9,c:27.5,per:100,fiber:6.2,iron:0.8,calcium:14,vitc:12,vitd:0,salt:0},
  {name:'しょうが',yomi:'ショウガ',tags:'ジンジャー',en:'ginger',cal:30,p:0.9,f:0.3,c:6.6,per:100,fiber:2.1,iron:0.5,calcium:19,vitc:2,vitd:0,salt:0},
  {name:'にんじん',yomi:'ニンジン',tags:'キャロット',en:'carrot',cal:39,p:0.7,f:0.1,c:9.3,per:100,fiber:2.8,iron:0.2,calcium:28,vitc:6,vitd:0,salt:0.1},
  {name:'じゃがいも',yomi:'ジャガイモ',tags:'ポテト',en:'potato',cal:76,p:1.6,f:0.1,c:17.6,per:100,fiber:1.3,iron:0.4,calcium:4,vitc:35,vitd:0,salt:0},
  {name:'さつまいも',yomi:'サツマイモ',tags:'',en:'sweet potato',cal:132,p:1.2,f:0.2,c:31.5,per:100,fiber:2.2,iron:0.6,calcium:47,vitc:29,vitd:0,salt:0},
  {name:'かぼちゃ',yomi:'カボチャ',tags:'パンプキン',en:'pumpkin kabocha squash',cal:91,p:1.9,f:0.3,c:20.6,per:100,fiber:3.5,iron:0.5,calcium:15,vitc:43,vitd:0,salt:0},
  {name:'トマト',yomi:'トマト',tags:'',en:'tomato',cal:20,p:0.7,f:0.1,c:4.7,per:100,fiber:1.0,iron:0.2,calcium:7,vitc:15,vitd:0,salt:0},
  {name:'アボカド',yomi:'アボカド',tags:'',en:'avocado',cal:187,p:2.1,f:17.5,c:6.2,per:100,fiber:5.6,iron:0.7,calcium:9,vitc:15,vitd:0,salt:0},
  {name:'ピーマン',yomi:'ピーマン',tags:'',en:'green pepper bell pepper',cal:22,p:0.9,f:0.2,c:5.1,per:100,fiber:2.3,iron:0.4,calcium:11,vitc:76,vitd:0,salt:0},
  {name:'パプリカ（赤）',yomi:'パプリカ',tags:'ピーマン',en:'red bell pepper paprika',cal:30,p:1.0,f:0.2,c:7.2,per:100,fiber:1.6,iron:0.4,calcium:7,vitc:170,vitd:0,salt:0},
  {name:'もやし',yomi:'モヤシ',tags:'',en:'bean sprouts moyashi',cal:15,p:1.7,f:0.1,c:2.6,per:100,fiber:1.3,iron:0.3,calcium:23,vitc:8,vitd:0,salt:0},
  {name:'ごぼう',yomi:'ゴボウ',tags:'',en:'burdock gobo',cal:65,p:1.8,f:0.1,c:15.4,per:100,fiber:5.7,iron:0.7,calcium:46,vitc:3,vitd:0,salt:0},
  {name:'れんこん',yomi:'レンコン',tags:'蓮根',en:'lotus root renkon',cal:66,p:1.9,f:0.1,c:15.5,per:100,fiber:2.0,iron:0.5,calcium:20,vitc:48,vitd:0,salt:0},
  {name:'しいたけ',yomi:'シイタケ',tags:'きのこ',en:'shiitake mushroom',cal:25,p:3.0,f:0.4,c:6.4,per:100,fiber:4.2,iron:0.3,calcium:2,vitc:0,vitd:0.4,salt:0},
  {name:'えのきたけ',yomi:'エノキ',tags:'きのこ えのき',en:'enoki mushroom',cal:34,p:2.7,f:0.2,c:7.6,per:100,fiber:3.9,iron:1.1,calcium:5,vitc:0,vitd:0.9,salt:0},
  {name:'まいたけ',yomi:'マイタケ',tags:'きのこ',en:'maitake mushroom',cal:22,p:2.0,f:0.5,c:4.4,per:100,fiber:3.5,iron:0.2,calcium:4,vitc:0,vitd:4.9,salt:0},
  {name:'しめじ',yomi:'シメジ',tags:'きのこ',en:'shimeji mushroom',cal:26,p:2.7,f:0.5,c:5.0,per:100,fiber:3.0,iron:0.5,calcium:2,vitc:0,vitd:0.5,salt:0},
  {name:'バナナ',yomi:'バナナ',tags:'',en:'banana',cal:86,p:1.1,f:0.2,c:22.5,per:100,fiber:1.1,iron:0.3,calcium:6,vitc:16,vitd:0,salt:0},
  {name:'りんご',yomi:'リンゴ',tags:'アップル',en:'apple',cal:61,p:0.2,f:0.2,c:15.5,per:100,fiber:1.5,iron:0,calcium:4,vitc:6,vitd:0,salt:0},
  {name:'みかん',yomi:'ミカン',tags:'オレンジ',en:'mandarin orange tangerine',cal:46,p:0.7,f:0.1,c:11.0,per:100,fiber:1.0,iron:0.1,calcium:21,vitc:35,vitd:0,salt:0},
  {name:'いちご',yomi:'イチゴ',tags:'',en:'strawberry',cal:34,p:0.9,f:0.1,c:8.5,per:100,fiber:1.4,iron:0.3,calcium:17,vitc:62,vitd:0,salt:0},
  {name:'米油',yomi:'コメアブラ',tags:'こめ 油 あぶら',en:'rice bran oil rice oil',cal:921,p:0,f:100,c:0,per:100,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0},
  {name:'オリーブオイル',yomi:'オリーブオイル',tags:'油 あぶら',en:'olive oil',cal:921,p:0,f:100,c:0,per:100,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0},
  {name:'ごま油',yomi:'ゴマアブラ',tags:'油 あぶら',en:'sesame oil',cal:921,p:0,f:100,c:0,per:100,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0},
  {name:'サラダ油',yomi:'サラダアブラ',tags:'油 あぶら',en:'vegetable oil salad oil',cal:921,p:0,f:100,c:0,per:100,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0},
  {name:'亜麻仁油',yomi:'アマニアブラ',tags:'油',en:'flaxseed oil linseed oil',cal:900,p:0,f:100,c:0,per:100,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0},
  {name:'味噌（米みそ）',yomi:'ミソ',tags:'みそ 調味料',en:'miso paste rice miso',cal:192,p:12.5,f:6.0,c:21.9,per:100,fiber:4.9,iron:3.4,calcium:130,vitc:0,vitd:0,salt:12.4},
  {name:'醤油（濃口）',yomi:'ショウユ',tags:'しょうゆ 調味料',en:'soy sauce shoyu',cal:71,p:7.7,f:0,c:10.1,per:100,fiber:0,iron:1.7,calcium:29,vitc:0,vitd:0,salt:14.5},
  {name:'砂糖（上白糖）',yomi:'サトウ',tags:'さとう 調味料',en:'sugar white sugar',cal:391,p:0,f:0,c:99.3,per:100,fiber:0,iron:0,calcium:1,vitc:0,vitd:0,salt:0},
  {name:'マヨネーズ',yomi:'マヨネーズ',tags:'マヨ',en:'mayonnaise mayo',cal:703,p:1.4,f:76.0,c:2.8,per:100,fiber:0,iron:0.3,calcium:17,vitc:0,vitd:0,salt:1.9},
  {name:'ごま（炒り）',yomi:'ゴマ',tags:'セサミ',en:'sesame seeds',cal:605,p:19.8,f:54.2,c:18.5,per:100,fiber:10.8,iron:9.9,calcium:1200,vitc:0,vitd:0,salt:0},
  {name:'アーモンド',yomi:'アーモンド',tags:'ナッツ',en:'almond',cal:608,p:19.6,f:51.8,c:19.7,per:100,fiber:11.0,iron:3.7,calcium:260,vitc:0,vitd:0,salt:0},
  {name:'くるみ',yomi:'クルミ',tags:'ナッツ',en:'walnut',cal:674,p:14.6,f:68.8,c:11.7,per:100,fiber:7.5,iron:2.7,calcium:85,vitc:0,vitd:0,salt:0},
  {name:'ピーナッツ',yomi:'ピーナッツ',tags:'らっかせい 落花生 ナッツ',en:'peanut',cal:585,p:25.4,f:49.4,c:18.6,per:100,fiber:7.4,iron:1.6,calcium:50,vitc:0,vitd:0,salt:0},
  {name:'チアシード',yomi:'チアシード',tags:'',en:'chia seed',cal:486,p:19.8,f:30.7,c:42.1,per:100,fiber:34.4,iron:7.7,calcium:631,vitc:1.6,vitd:0,salt:0},
  {name:'プロテイン（1杯）',yomi:'プロテイン',tags:'ホエイ カゼイン',en:'protein whey protein shake',cal:120,p:25.0,f:1.5,c:4.0,per:30,fiber:0.5,iron:1.0,calcium:150,vitc:0,vitd:0,salt:0.2},
  {name:'コーヒー（ブラック）',yomi:'コーヒー',tags:'',en:'coffee black coffee',cal:4,p:0.3,f:0,c:0.7,per:100,fiber:0,iron:0.1,calcium:2,vitc:0,vitd:0,salt:0},
  {name:'オレンジジュース',yomi:'オレンジジュース',tags:'みかん ジュース',en:'orange juice',cal:45,p:0.7,f:0.1,c:10.4,per:100,fiber:0.2,iron:0.1,calcium:8,vitc:42,vitd:0,salt:0},
  {name:'スポーツドリンク',yomi:'スポーツドリンク',tags:'ポカリ アクエリアス',en:'sports drink energy drink',cal:21,p:0,f:0,c:5.1,per:100,fiber:0,iron:0,calcium:2,vitc:0,vitd:0,salt:0.1},
  // ── 麺類・ラーメン ──
  {name:'インスタントラーメン（日清チキンラーメン）',yomi:'チキンラーメン',tags:'ラーメン インスタント 日清',en:'chicken ramen instant noodle',cal:453,p:10.5,f:17.5,c:63.5,per:85,fiber:2.2,iron:1.5,calcium:50,vitc:0,vitd:0,salt:5.5},
  {name:'インスタントラーメン（マルちゃん正麺醤油）',yomi:'マルチャンセイメン',tags:'ラーメン インスタント 東洋水産 マルちゃん',en:'maruchan seimen soy sauce ramen',cal:468,p:11.5,f:17.8,c:65.2,per:100,fiber:2.0,iron:1.2,calcium:45,vitc:0,vitd:0,salt:5.8},
  {name:'カップヌードル（日清）',yomi:'カップヌードル',tags:'カップラーメン インスタント 日清',en:'cup noodle nissin',cal:351,p:10.5,f:14.6,c:44.5,per:78,fiber:1.5,iron:1.0,calcium:120,vitc:0,vitd:0,salt:4.9},
  {name:'カップヌードルシーフード（日清）',yomi:'カップヌードルシーフード',tags:'カップラーメン インスタント 日清 シーフード',en:'cup noodle seafood nissin',cal:322,p:9.0,f:11.5,c:46.0,per:75,fiber:1.4,iron:0.8,calcium:100,vitc:0,vitd:0,salt:4.5},
  {name:'どん兵衛きつねうどん（日清）',yomi:'ドンベエ',tags:'カップうどん インスタント 日清',en:'donbei kitsune udon nissin',cal:362,p:9.0,f:6.5,c:68.5,per:96,fiber:2.0,iron:1.1,calcium:130,vitc:0,vitd:0,salt:5.9},
  {name:'赤いきつね（東洋水産）',yomi:'アカイキツネ',tags:'カップうどん マルちゃん インスタント',en:'akai kitsune udon maruchan',cal:446,p:12.0,f:6.3,c:84.5,per:103,fiber:2.5,iron:1.3,calcium:150,vitc:0,vitd:0,salt:6.0},
  {name:'緑のたぬき（東洋水産）',yomi:'ミドリノタヌキ',tags:'カップそば マルちゃん インスタント',en:'midori no tanuki soba maruchan',cal:440,p:12.5,f:7.0,c:83.0,per:101,fiber:2.8,iron:1.5,calcium:130,vitc:0,vitd:0,salt:5.6},
  {name:'チャルメラ醤油ラーメン（明星）',yomi:'チャルメラ',tags:'インスタントラーメン 明星',en:'charumera shoyu ramen myojo',cal:440,p:10.0,f:16.5,c:63.0,per:90,fiber:1.8,iron:1.2,calcium:80,vitc:0,vitd:0,salt:5.3},
  {name:'サッポロ一番塩ラーメン（サンヨー食品）',yomi:'サッポロイチバンシオ',tags:'インスタントラーメン サッポロ',en:'sapporo ichiban shio ramen',cal:451,p:10.2,f:17.2,c:63.8,per:90,fiber:1.8,iron:1.0,calcium:85,vitc:0,vitd:0,salt:5.5},
  {name:'サッポロ一番みそラーメン（サンヨー食品）',yomi:'サッポロイチバンミソ',tags:'インスタントラーメン サッポロ みそ',en:'sapporo ichiban miso ramen',cal:463,p:10.8,f:18.0,c:64.5,per:90,fiber:2.0,iron:1.1,calcium:90,vitc:0,vitd:0,salt:5.8},
  {name:'ラ王醤油（日清）',yomi:'ラオウショウユ',tags:'インスタントラーメン 日清 ラ王',en:'ra-ou shoyu ramen nissin',cal:452,p:12.5,f:16.0,c:64.5,per:95,fiber:2.0,iron:1.2,calcium:90,vitc:0,vitd:0,salt:5.5},
  {name:'うまかっちゃん（ハウス食品）',yomi:'ウマカッチャン',tags:'インスタントラーメン ハウス 豚骨 九州',en:'umakachan hakata tonkotsu ramen house',cal:448,p:10.5,f:18.0,c:60.5,per:90,fiber:1.5,iron:0.8,calcium:70,vitc:0,vitd:0,salt:5.2},

  // ── コンビニ・外食 ──
  {name:'おにぎり 鮭（セブン・ローソン・ファミマ）',yomi:'オニギリサケ',tags:'おにぎり コンビニ 鮭 しゃけ',en:'onigiri salmon rice ball',cal:192,p:5.3,f:1.8,c:38.5,per:105,fiber:0.5,iron:0.3,calcium:10,vitc:1,vitd:5,salt:1.1},
  {name:'おにぎり ツナマヨ（コンビニ）',yomi:'オニギリツナマヨ',tags:'おにぎり コンビニ ツナ マヨ',en:'onigiri tuna mayo rice ball',cal:232,p:5.5,f:6.0,c:38.5,per:113,fiber:0.5,iron:0.2,calcium:8,vitc:0,vitd:1,salt:1.4},
  {name:'おにぎり 梅（コンビニ）',yomi:'オニギリウメ',tags:'おにぎり コンビニ 梅',en:'onigiri ume plum rice ball',cal:177,p:3.5,f:0.5,c:38.5,per:103,fiber:0.5,iron:0.2,calcium:6,vitc:0,vitd:0,salt:1.3},
  {name:'サンドイッチ ミックス（コンビニ）',yomi:'サンドイッチ',tags:'サンド コンビニ',en:'sandwich mix convenience store',cal:255,p:10.5,f:10.5,c:30.5,per:150,fiber:1.8,iron:0.8,calcium:65,vitc:3,vitd:0.2,salt:1.8},
  {name:'チキン南蛮弁当（コンビニ）',yomi:'チキンナンバンベントウ',tags:'弁当 コンビニ チキン',en:'chicken nanban bento lunch box',cal:710,p:28.0,f:22.0,c:97.0,per:430,fiber:3.5,iron:1.5,calcium:70,vitc:5,vitd:0.5,salt:3.5},
  {name:'のり弁当（コンビニ）',yomi:'ノリベントウ',tags:'弁当 コンビニ のり',en:'nori bento lunch box',cal:680,p:18.0,f:20.0,c:100.0,per:400,fiber:2.5,iron:1.2,calcium:80,vitc:2,vitd:1,salt:3.2},
  {name:'幕の内弁当（コンビニ）',yomi:'マクノウチベントウ',tags:'弁当 コンビニ',en:'makunouchi bento lunch box',cal:620,p:22.0,f:18.0,c:87.0,per:450,fiber:3.0,iron:1.5,calcium:90,vitc:5,vitd:0.5,salt:3.5},
  {name:'ファミマ ファミチキ',yomi:'ファミチキ',tags:'ファミリーマート チキン 揚げ物 コンビニ',en:'famichiki fried chicken familymart',cal:245,p:14.5,f:14.5,c:14.5,per:95,fiber:0.3,iron:0.5,calcium:8,vitc:0,vitd:0.1,salt:1.2},
  {name:'セブン ブラックサンダー（有楽製菓）',yomi:'ブラックサンダー',tags:'チョコ お菓子',en:'black thunder chocolate bar',cal:170,p:1.8,f:7.5,c:24.5,per:44,fiber:0.8,iron:0.5,calcium:25,vitc:0,vitd:0,salt:0.2},

  // ── 牛丼・丼もの ──
  {name:'牛丼 並盛（吉野家）',yomi:'ギュウドンナミモリヨシノヤ',tags:'吉野家 牛丼 どんぶり 外食',en:'yoshinoya gyudon beef bowl regular',cal:666,p:26.0,f:22.0,c:87.0,per:360,fiber:2.0,iron:2.5,calcium:70,vitc:3,vitd:0.2,salt:2.5},
  {name:'牛丼 並盛（すき家）',yomi:'ギュウドンナミモリスキヤ',tags:'すき家 牛丼 どんぶり 外食',en:'sukiya gyudon beef bowl regular',cal:699,p:25.0,f:22.5,c:92.0,per:380,fiber:2.0,iron:2.5,calcium:75,vitc:3,vitd:0.2,salt:2.8},
  {name:'牛丼 並盛（松屋）',yomi:'ギュウドンナミモリマツヤ',tags:'松屋 牛丼 どんぶり 外食',en:'matsuya gyudon beef bowl regular',cal:658,p:27.0,f:19.5,c:88.0,per:360,fiber:2.5,iron:2.8,calcium:80,vitc:3,vitd:0.2,salt:2.6},
  {name:'親子丼',yomi:'オヤコドン',tags:'どんぶり 卵 鶏',en:'oyakodon chicken egg bowl',cal:650,p:28.0,f:15.0,c:92.0,per:400,fiber:1.5,iron:1.8,calcium:80,vitc:5,vitd:1.0,salt:3.0},
  {name:'カツ丼',yomi:'カツドン',tags:'どんぶり とんかつ 豚',en:'katsudon pork cutlet bowl',cal:850,p:30.0,f:30.0,c:105.0,per:500,fiber:2.0,iron:2.0,calcium:80,vitc:3,vitd:0.5,salt:3.5},
  {name:'天丼',yomi:'テンドン',tags:'どんぶり 天ぷら えび',en:'tendon tempura bowl',cal:720,p:20.0,f:18.0,c:108.0,per:420,fiber:2.0,iron:1.5,calcium:80,vitc:3,vitd:1.5,salt:3.2},

  // ── ファストフード ──
  {name:'ビッグマック（マクドナルド）',yomi:'ビッグマック',tags:'マクドナルド マック バーガー ハンバーガー',en:'big mac mcdonalds hamburger',cal:525,p:27.0,f:27.5,c:45.0,per:214,fiber:2.5,iron:4.0,calcium:230,vitc:3,vitd:0.3,salt:2.5},
  {name:'マックフライポテト M（マクドナルド）',yomi:'マックフライポテト',tags:'マクドナルド マック ポテト フライドポテト',en:'mcdonalds french fries medium',cal:410,p:4.5,f:19.5,c:54.0,per:135,fiber:4.0,iron:0.8,calcium:15,vitc:12,vitd:0,salt:1.0},
  {name:'チーズバーガー（マクドナルド）',yomi:'チーズバーガー',tags:'マクドナルド マック バーガー',en:'cheeseburger mcdonalds',cal:305,p:16.5,f:12.0,c:33.0,per:116,fiber:1.5,iron:2.5,calcium:170,vitc:1,vitd:0.2,salt:1.8},
  {name:'てりやきマックバーガー（マクドナルド）',yomi:'テリヤキマックバーガー',tags:'マクドナルド マック てりやき',en:'teriyaki burger mcdonalds',cal:494,p:18.5,f:22.0,c:56.0,per:194,fiber:2.0,iron:2.0,calcium:100,vitc:1,vitd:0.2,salt:2.5},
  {name:'ワッパー（バーガーキング）',yomi:'ワッパー',tags:'バーガーキング ハンバーガー バーガー',en:'whopper burger king hamburger',cal:617,p:29.0,f:33.0,c:55.0,per:260,fiber:2.5,iron:4.5,calcium:120,vitc:5,vitd:0.3,salt:1.8},
  {name:'ゾンビメガ盛りバーガー（モスバーガー）',yomi:'モスバーガー',tags:'モス バーガー',en:'mos burger',cal:420,p:20.0,f:18.5,c:43.5,per:185,fiber:2.0,iron:2.5,calcium:100,vitc:5,vitd:0.2,salt:2.0},
  {name:'チキンフィレオ（マクドナルド）',yomi:'チキンフィレオ',tags:'マクドナルド マック チキン フィレオ',en:'mcchicken fillet o fish mcdonalds',cal:466,p:23.5,f:17.5,c:53.0,per:192,fiber:1.5,iron:1.5,calcium:80,vitc:2,vitd:0.2,salt:2.5},
  {name:'フィレオフィッシュ（マクドナルド）',yomi:'フィレオフィッシュ',tags:'マクドナルド マック フィッシュ',en:'filet o fish mcdonalds',cal:329,p:14.5,f:14.0,c:36.5,per:145,fiber:1.5,iron:1.0,calcium:120,vitc:0,vitd:0.5,salt:1.5},
  {name:'カーネルオリジナルチキン（KFC）',yomi:'ケンタッキー',tags:'KFC ケンタッキーフライドチキン フライドチキン',en:'kfc fried chicken original',cal:237,p:17.3,f:14.0,c:11.5,per:126,fiber:0.3,iron:0.7,calcium:15,vitc:0,vitd:0.2,salt:1.6},

  // ── 寿司・和食 ──
  {name:'にぎり寿司 まぐろ（1貫）',yomi:'ニギリマグロ',tags:'すし 寿司 まぐろ',en:'sushi nigiri tuna',cal:47,p:4.0,f:0.3,c:7.0,per:30,fiber:0.1,iron:0.2,calcium:2,vitc:0,vitd:0.5,salt:0.3},
  {name:'にぎり寿司 サーモン（1貫）',yomi:'ニギリサーモン',tags:'すし 寿司 サーモン 鮭',en:'sushi nigiri salmon',cal:54,p:3.5,f:1.8,c:7.0,per:30,fiber:0.1,iron:0.1,calcium:3,vitc:0.5,vitd:2,salt:0.3},
  {name:'にぎり寿司 えび（1貫）',yomi:'ニギリエビ',tags:'すし 寿司 えび 海老',en:'sushi nigiri shrimp',cal:41,p:3.5,f:0.1,c:6.8,per:30,fiber:0.1,iron:0.1,calcium:5,vitc:0,vitd:0,salt:0.3},
  {name:'にぎり寿司 いくら（1貫）',yomi:'ニギリイクラ',tags:'すし 寿司 いくら',en:'sushi nigiri salmon roe ikura',cal:54,p:4.5,f:1.5,c:6.5,per:30,fiber:0,iron:0.3,calcium:8,vitc:0,vitd:3,salt:0.5},
  {name:'にぎり寿司 うに（1貫）',yomi:'ニギリウニ',tags:'すし 寿司 うに',en:'sushi nigiri sea urchin uni',cal:48,p:3.5,f:0.8,c:7.0,per:30,fiber:0,iron:0.3,calcium:6,vitc:1,vitd:0,salt:0.4},
  {name:'にぎり寿司 玉子（1貫）',yomi:'ニギリタマゴ',tags:'すし 寿司 たまご 卵',en:'sushi nigiri egg tamagoyaki',cal:55,p:3.0,f:1.8,c:7.0,per:30,fiber:0,iron:0.3,calcium:10,vitc:0,vitd:0.3,salt:0.5},
  {name:'巻き寿司 鉄火巻（6切）',yomi:'テッカマキ',tags:'すし 寿司 まきずし まぐろ',en:'sushi tekka maki tuna roll',cal:240,p:12.0,f:1.5,c:46.0,per:150,fiber:0.8,iron:1.0,calcium:20,vitc:0,vitd:2,salt:1.5},
  {name:'巻き寿司 かっぱ巻（6切）',yomi:'カッパマキ',tags:'すし 寿司 まきずし きゅうり',en:'sushi kappa maki cucumber roll',cal:195,p:4.5,f:0.5,c:42.0,per:140,fiber:1.0,iron:0.4,calcium:15,vitc:2,vitd:0,salt:1.2},
  {name:'ちらし寿司',yomi:'チラシズシ',tags:'すし 寿司 ちらし',en:'chirashi sushi scattered sushi',cal:580,p:22.0,f:10.5,c:95.0,per:350,fiber:2.0,iron:2.0,calcium:80,vitc:3,vitd:5,salt:2.8},
  {name:'稲荷寿司（2個）',yomi:'イナリズシ',tags:'すし 寿司 いなり いなりずし',en:'inari sushi tofu pocket',cal:260,p:6.5,f:5.5,c:46.0,per:130,fiber:1.5,iron:1.0,calcium:60,vitc:0,vitd:0,salt:1.5},
  {name:'天ぷら盛り合わせ（外食）',yomi:'テンプラモリアワセ',tags:'てんぷら 天ぷら 揚げ物',en:'tempura assorted',cal:480,p:16.0,f:25.0,c:48.0,per:250,fiber:2.5,iron:1.5,calcium:80,vitc:5,vitd:1,salt:1.5},
  {name:'とんかつ定食',yomi:'トンカツテイショク',tags:'とんかつ 揚げ物 定食 豚',en:'tonkatsu set meal pork cutlet',cal:870,p:38.0,f:32.0,c:98.0,per:500,fiber:3.5,iron:2.5,calcium:100,vitc:5,vitd:0.5,salt:3.5},
  {name:'ラーメン（醤油 外食）',yomi:'ラーメンショウユ',tags:'らーめん ラーメン 外食 醤油',en:'ramen shoyu restaurant',cal:490,p:20.0,f:12.0,c:74.0,per:700,fiber:3.0,iron:2.0,calcium:80,vitc:3,vitd:0.3,salt:5.5},
  {name:'ラーメン（豚骨 外食）',yomi:'ラーメントンコツ',tags:'らーめん ラーメン 外食 豚骨',en:'ramen tonkotsu restaurant',cal:580,p:24.0,f:22.0,c:70.0,per:700,fiber:2.5,iron:2.0,calcium:120,vitc:2,vitd:0.3,salt:6.0},
  {name:'ラーメン（味噌 外食）',yomi:'ラーメンミソ',tags:'らーめん ラーメン 外食 みそ 味噌',en:'ramen miso restaurant',cal:550,p:22.0,f:18.0,c:73.0,per:700,fiber:3.5,iron:2.5,calcium:100,vitc:5,vitd:0.3,salt:6.5},
  {name:'つけ麺（外食）',yomi:'ツケメン',tags:'らーめん ラーメン 外食',en:'tsukemen dipping ramen',cal:720,p:30.0,f:18.0,c:107.0,per:550,fiber:4.0,iron:2.5,calcium:80,vitc:2,vitd:0.3,salt:5.0},

  // ── カレー・パスタ・洋食 ──
  {name:'カレーライス（家庭）',yomi:'カレーライス',tags:'カレー らいす',en:'curry rice japanese curry',cal:723,p:20.0,f:18.5,c:116.0,per:500,fiber:4.5,iron:2.5,calcium:80,vitc:10,vitd:0.2,salt:3.0},
  {name:'ビーフカレー レトルト（ハウス バーモントカレー）',yomi:'バーモントカレー',tags:'カレー レトルト ハウス',en:'vermont curry house retort',cal:211,p:7.0,f:9.0,c:26.5,per:200,fiber:2.5,iron:1.5,calcium:30,vitc:3,vitd:0,salt:2.8},
  {name:'スパゲッティ ナポリタン',yomi:'スパゲッティナポリタン',tags:'パスタ ナポリタン',en:'spaghetti napolitan pasta',cal:530,p:16.5,f:16.0,c:79.0,per:400,fiber:4.0,iron:2.0,calcium:55,vitc:20,vitd:0,salt:3.5},
  {name:'スパゲッティ ボロネーゼ',yomi:'スパゲッティボロネーゼ',tags:'パスタ ミートソース',en:'spaghetti bolognese meat sauce',cal:610,p:26.0,f:21.0,c:76.0,per:420,fiber:4.0,iron:3.0,calcium:70,vitc:10,vitd:0.2,salt:3.0},
  {name:'ピザ マルゲリータ（1枚）',yomi:'ピザマルゲリータ',tags:'ぴざ ピザ イタリアン',en:'pizza margherita',cal:760,p:32.0,f:26.0,c:100.0,per:400,fiber:4.0,iron:3.5,calcium:350,vitc:15,vitd:0.5,salt:4.0},
  {name:'ハンバーグ 定食',yomi:'ハンバーグ',tags:'はんばーぐ 外食 定食',en:'hamburger steak teishoku set',cal:740,p:33.0,f:34.0,c:72.0,per:450,fiber:3.5,iron:3.5,calcium:100,vitc:8,vitd:0.3,salt:3.5},
  {name:'エビフライ（3本）',yomi:'エビフライ',tags:'えびふらい 揚げ物 えび',en:'ebi fry fried shrimp',cal:290,p:18.5,f:15.0,c:22.0,per:165,fiber:1.0,iron:0.8,calcium:50,vitc:0,vitd:0,salt:1.5},
  {name:'コロッケ（1個）',yomi:'コロッケ',tags:'ころっけ 揚げ物 じゃがいも',en:'korokke croquette potato',cal:200,p:5.5,f:11.0,c:21.5,per:100,fiber:1.5,iron:0.5,calcium:20,vitc:15,vitd:0,salt:0.8},

  // ── 缶詰・加工品 ──
  {name:'コーン缶（クリームスタイル）',yomi:'コーンカン',tags:'とうもろこし 缶詰 コーン',en:'canned corn cream style',cal:77,p:1.7,f:0.5,c:17.2,per:100,fiber:1.8,iron:0.3,calcium:4,vitc:5,vitd:0,salt:0.5},
  {name:'コーン缶（ホールカーネル）',yomi:'コーンカンホール',tags:'とうもろこし 缶詰 コーン',en:'canned corn whole kernel',cal:82,p:2.3,f:0.8,c:16.5,per:100,fiber:2.2,iron:0.4,calcium:3,vitc:6,vitd:0,salt:0.3},
  {name:'焼き鳥缶（タレ）',yomi:'ヤキトリカン',tags:'焼き鳥 缶詰 とり',en:'canned yakitori chicken teriyaki',cal:170,p:17.5,f:8.5,c:6.5,per:100,fiber:0,iron:0.8,calcium:10,vitc:0,vitd:0.2,salt:1.5},
  {name:'やきとり缶（塩）',yomi:'ヤキトリカンシオ',tags:'焼き鳥 缶詰 とり 塩',en:'canned yakitori chicken salt',cal:155,p:18.5,f:8.0,c:1.5,per:100,fiber:0,iron:0.7,calcium:8,vitc:0,vitd:0.2,salt:1.2},
  {name:'カニ缶（ズワイガニ）',yomi:'カニカン',tags:'かに 蟹 缶詰',en:'canned crab snow crab',cal:70,p:14.5,f:0.8,c:0.3,per:100,fiber:0,iron:0.5,calcium:75,vitc:0,vitd:0,salt:1.8},
  {name:'あさり水煮缶',yomi:'アサリカン',tags:'あさり 貝 缶詰',en:'canned clam asari',cal:74,p:14.0,f:1.5,c:1.5,per:100,fiber:0,iron:25,calcium:90,vitc:3,vitd:0,salt:1.0},
  {name:'ホタテ缶（水煮）',yomi:'ホタテカン',tags:'ほたて 貝 缶詰',en:'canned scallop',cal:88,p:19.5,f:0.8,c:1.5,per:100,fiber:0,iron:1.0,calcium:18,vitc:0,vitd:0,salt:0.9},
  {name:'オイルサーディン缶（いわし油漬け）',yomi:'オイルサーディン',tags:'いわし 缶詰 オイル',en:'oil sardine canned',cal:350,p:17.0,f:30.0,c:0.3,per:100,fiber:0,iron:2.0,calcium:350,vitc:0,vitd:25,salt:0.8},
  {name:'トマト缶（ホール）',yomi:'トマトカン',tags:'とまと 缶詰 イタリアン',en:'canned tomato whole',cal:24,p:1.2,f:0.2,c:4.5,per:100,fiber:1.2,iron:0.5,calcium:12,vitc:15,vitd:0,salt:0.3},
  {name:'トマト缶（カット）',yomi:'トマトカンカット',tags:'とまと 缶詰',en:'canned diced tomato',cal:24,p:1.2,f:0.2,c:4.5,per:100,fiber:1.2,iron:0.5,calcium:12,vitc:15,vitd:0,salt:0.3},
  {name:'大豆水煮缶',yomi:'ダイズスイニカン',tags:'だいず 大豆 缶詰 豆',en:'canned soybean water',cal:124,p:10.5,f:5.0,c:9.5,per:100,fiber:7.0,iron:2.5,calcium:75,vitc:0,vitd:0,salt:0.5},
  {name:'ミックスビーンズ缶',yomi:'ミックスビーンズ',tags:'豆 缶詰 ミックス',en:'canned mixed beans',cal:133,p:8.5,f:1.5,c:22.0,per:100,fiber:9.5,iron:2.0,calcium:50,vitc:0,vitd:0,salt:0.5},

  // ── 粉類・乾物 ──
  {name:'薄力粉（小麦粉）',yomi:'ハクリキコ',tags:'こむぎこ 小麦粉 薄力 ケーキ',en:'cake flour soft wheat flour',cal:368,p:8.3,f:1.5,c:75.8,per:100,fiber:2.5,iron:0.6,calcium:20,vitc:0,vitd:0,salt:0},
  {name:'強力粉（小麦粉）',yomi:'キョウリキコ',tags:'こむぎこ 小麦粉 強力 パン',en:'bread flour strong wheat flour',cal:365,p:11.8,f:1.5,c:71.7,per:100,fiber:2.7,iron:0.9,calcium:17,vitc:0,vitd:0,salt:0},
  {name:'片栗粉',yomi:'カタクリコ',tags:'でんぷん 澱粉 とろみ',en:'katakuriko potato starch cornstarch',cal:338,p:0.1,f:0.1,c:81.6,per:100,fiber:0,iron:0.1,calcium:4,vitc:0,vitd:0,salt:0},
  {name:'天ぷら粉',yomi:'テンプラコ',tags:'こむぎこ 小麦粉 てんぷら 天ぷら',en:'tempura flour batter mix',cal:352,p:8.0,f:1.5,c:72.0,per:100,fiber:2.0,iron:0.8,calcium:80,vitc:0,vitd:0,salt:0.5},
  {name:'パン粉',yomi:'パンコ',tags:'ぱんこ ブレッドクラム',en:'panko bread crumbs',cal:373,p:13.5,f:4.5,c:73.0,per:100,fiber:2.8,iron:0.7,calcium:31,vitc:0,vitd:0,salt:1.0},
  {name:'春雨（乾燥）',yomi:'ハルサメ',tags:'はるさめ',en:'harusame glass noodles dried',cal:345,p:0.2,f:0.4,c:85.2,per:100,fiber:1.4,iron:1.5,calcium:20,vitc:0,vitd:0,salt:0},
  {name:'海苔（焼き）',yomi:'ノリ',tags:'のり 焼き海苔 海苔',en:'nori seaweed roasted',cal:188,p:41.4,f:3.7,c:44.3,per:100,fiber:31.2,iron:11.4,calcium:280,vitc:210,vitd:0,salt:1.3},
  {name:'わかめ（乾燥）',yomi:'ワカメ',tags:'わかめ 海藻',en:'wakame seaweed dried',cal:186,p:16.1,f:5.6,c:39.0,per:100,fiber:32.7,iron:6.1,calcium:780,vitc:27,vitd:0,salt:8.3},
  {name:'ひじき（乾燥）',yomi:'ヒジキ',tags:'ひじき 海藻',en:'hijiki seaweed dried',cal:180,p:10.6,f:3.2,c:52.0,per:100,fiber:51.8,iron:6.2,calcium:1000,vitc:0,vitd:0,salt:4.7},
  {name:'かつおぶし',yomi:'カツオブシ',tags:'かつおぶし 鰹節 出汁 だし',en:'katsuobushi dried bonito flakes',cal:356,p:75.7,f:2.9,c:0.8,per:100,fiber:0,iron:9.0,calcium:57,vitc:0,vitd:17,salt:0.3},

  // ── お菓子・デザート ──
  {name:'ポテトチップス（カルビー うすしお）',yomi:'ポテトチップス',tags:'お菓子 スナック カルビー',en:'potato chips calbee lightly salted',cal:536,p:5.3,f:33.3,c:54.7,per:100,fiber:3.3,iron:0.8,calcium:18,vitc:40,vitd:0,salt:0.6},
  {name:'コーンスナック（カルビーかっぱえびせん）',yomi:'カッパエビセン',tags:'お菓子 スナック カルビー えび',en:'kappa ebisen calbee shrimp snack',cal:488,p:10.5,f:18.5,c:68.5,per:100,fiber:1.3,iron:0.5,calcium:200,vitc:0,vitd:0,salt:1.8},
  {name:'チョコレート（明治ミルクチョコ）',yomi:'ミルクチョコレート',tags:'お菓子 チョコ 明治',en:'milk chocolate meiji',cal:558,p:7.0,f:33.0,c:60.0,per:100,fiber:2.5,iron:2.4,calcium:200,vitc:0,vitd:0,salt:0.1},
  {name:'ビスケット（森永マリー）',yomi:'ビスケット',tags:'お菓子 クッキー ビスケット 森永',en:'biscuit marie morinaga',cal:463,p:6.6,f:16.5,c:73.5,per:100,fiber:1.8,iron:0.7,calcium:50,vitc:0,vitd:0,salt:0.8},
  {name:'おかき（亀田製菓）',yomi:'オカキ',tags:'お菓子 せんべい おかき 米',en:'okaki rice cracker kameda',cal:426,p:7.3,f:8.5,c:79.0,per:100,fiber:1.0,iron:0.5,calcium:15,vitc:0,vitd:0,salt:1.5},
  {name:'プリン（江崎グリコ プッチンプリン）',yomi:'プッチンプリン',tags:'お菓子 デザート プリン グリコ',en:'pudding glico pucchin',cal:99,p:2.7,f:2.7,c:16.1,per:68,fiber:0,iron:0.1,calcium:60,vitc:0,vitd:0.3,salt:0.2},
  {name:'カップアイスクリーム（明治エッセルスーパーカップ）',yomi:'スーパーカップ',tags:'アイス アイスクリーム 明治',en:'super cup ice cream meiji',cal:374,p:6.5,f:20.0,c:43.0,per:200,fiber:0,iron:0.1,calcium:175,vitc:1,vitd:0.3,salt:0.3},
  {name:'どら焼き（1個）',yomi:'ドラヤキ',tags:'お菓子 和菓子 どら焼き あんこ',en:'dorayaki japanese pancake red bean',cal:271,p:5.5,f:4.0,c:54.0,per:100,fiber:2.5,iron:1.0,calcium:30,vitc:0,vitd:0.3,salt:0.4},

  // ── 調味料・ソース ──
  {name:'ウスターソース（ブルドッグ）',yomi:'ウスターソース',tags:'ソース 調味料 ブルドッグ',en:'worcestershire sauce',cal:117,p:1.0,f:0.1,c:27.8,per:100,fiber:0.5,iron:1.7,calcium:36,vitc:0,vitd:0,salt:8.4},
  {name:'お好み焼きソース（オタフク）',yomi:'オコノミヤキソース',tags:'ソース 調味料 オタフク',en:'okonomiyaki sauce otafuku',cal:131,p:1.6,f:0.1,c:31.0,per:100,fiber:0.8,iron:0.8,calcium:28,vitc:2,vitd:0,salt:5.5},
  {name:'焼肉のたれ（市販）',yomi:'ヤキニクノタレ',tags:'たれ 調味料 焼肉',en:'yakiniku sauce bbq sauce',cal:135,p:3.5,f:1.0,c:29.0,per:100,fiber:0.5,iron:0.8,calcium:30,vitc:2,vitd:0,salt:8.0},
  {name:'ポン酢（市販）',yomi:'ポンズ',tags:'ぽんず 調味料 さっぱり',en:'ponzu sauce citrus soy',cal:44,p:2.8,f:0,c:8.0,per:100,fiber:0,iron:0.5,calcium:12,vitc:5,vitd:0,salt:7.0},
  {name:'だし（顆粒 ほんだし）',yomi:'ホンダシ',tags:'ほんだし 出汁 だし 味の素',en:'hondashi instant dashi bonito',cal:227,p:28.5,f:2.5,c:23.5,per:100,fiber:0,iron:1.5,calcium:60,vitc:0,vitd:0,salt:41},
  {name:'めんつゆ（ストレート）',yomi:'メンツユ',tags:'めんつゆ つゆ 調味料',en:'mentsuyu noodle soup base',cal:44,p:2.2,f:0,c:8.5,per:100,fiber:0,iron:0.5,calcium:8,vitc:0,vitd:0,salt:3.0},
  {name:'ケチャップ（カゴメ）',yomi:'ケチャップ',tags:'トマトケチャップ 調味料 カゴメ',en:'ketchup tomato catsup kagome',cal:119,p:1.7,f:0.2,c:27.5,per:100,fiber:1.8,iron:0.7,calcium:18,vitc:12,vitd:0,salt:3.3},
  {name:'マカロニサラダ（市販・惣菜）',yomi:'マカロニサラダ',tags:'サラダ 惣菜 パスタ',en:'macaroni salad deli',cal:198,p:3.5,f:13.5,c:17.0,per:100,fiber:0.8,iron:0.3,calcium:15,vitc:2,vitd:0,salt:1.2},
  {name:'ポテトサラダ（市販・惣菜）',yomi:'ポテトサラダ',tags:'サラダ 惣菜 ポテト じゃがいも',en:'potato salad deli',cal:142,p:2.3,f:8.5,c:15.0,per:100,fiber:1.2,iron:0.3,calcium:12,vitc:18,vitd:0,salt:1.0},

  // ── 飲み物 ──
  {name:'コーラ（コカ・コーラ）',yomi:'コーラ',tags:'コーラ ジュース 炭酸 コカコーラ',en:'coca cola coke soda',cal:45,p:0,f:0,c:11.3,per:100,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0},
  {name:'野菜ジュース（カゴメ）',yomi:'ヤサイジュース',tags:'野菜ジュース カゴメ ジュース',en:'vegetable juice kagome',cal:44,p:1.1,f:0.1,c:9.5,per:100,fiber:1.0,iron:0.3,calcium:12,vitc:50,vitd:0,salt:0.3},
  {name:'豆乳（マルサン調製豆乳）',yomi:'チョウセイトウニュウ',tags:'とうにゅう 豆乳 大豆 マルサン',en:'soymilk adjusted soy milk marusan',cal:64,p:3.5,f:3.0,c:6.5,per:100,fiber:0.3,iron:0.5,calcium:30,vitc:0,vitd:0,salt:0.2},
  {name:'麦茶（ストレート）',yomi:'ムギチャ',tags:'むぎちゃ 麦茶 茶',en:'mugicha barley tea',cal:1,p:0.1,f:0,c:0.3,per:100,fiber:0,iron:0,calcium:2,vitc:0,vitd:0,salt:0},
  {name:'エナジードリンク（レッドブル 250ml）',yomi:'レッドブル',tags:'エナジードリンク カフェイン レッドブル',en:'red bull energy drink',cal:110,p:1.0,f:0,c:27.5,per:250,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0.2},

  // ── 惣菜・加工食品 ──
  {name:'餃子（冷凍 味の素）',yomi:'ギョウザ',tags:'ぎょうざ 餃子 冷凍 味の素',en:'gyoza frozen dumplings ajinomoto',cal:232,p:9.5,f:11.0,c:25.5,per:138,fiber:2.0,iron:1.0,calcium:25,vitc:3,vitd:0,salt:2.0},
  {name:'シュウマイ（冷凍 崎陽軒）',yomi:'シュウマイ',tags:'しゅうまい 焼売 崎陽軒',en:'shumai steamed dumpling kiyoken',cal:205,p:10.5,f:8.5,c:22.0,per:120,fiber:1.0,iron:0.8,calcium:30,vitc:2,vitd:0,salt:1.5},
  {name:'唐揚げ（鶏もも）',yomi:'カラアゲ',tags:'からあげ 唐揚げ とり 揚げ物',en:'karaage fried chicken thigh',cal:250,p:18.0,f:16.5,c:8.5,per:130,fiber:0.3,iron:0.6,calcium:10,vitc:3,vitd:0.3,salt:1.5},
  {name:'メンチカツ',yomi:'メンチカツ',tags:'めんちかつ 揚げ物 ひき肉',en:'menchi katsu fried minced meat cutlet',cal:270,p:12.5,f:17.5,c:17.0,per:130,fiber:1.5,iron:1.5,calcium:25,vitc:3,vitd:0,salt:1.3},
  {name:'春巻き（1本）',yomi:'ハルマキ',tags:'はるまき 春巻 揚げ物',en:'harumaki spring roll fried',cal:180,p:5.5,f:9.5,c:18.5,per:80,fiber:1.0,iron:0.6,calcium:15,vitc:3,vitd:0,salt:0.8},
  {name:'ハンバーグ（冷凍 びっくりドンキー風）',yomi:'ハンバーグ',tags:'はんばーぐ 冷凍 惣菜',en:'hamburger steak frozen',cal:220,p:12.5,f:15.5,c:8.5,per:130,fiber:0.8,iron:1.5,calcium:25,vitc:1,vitd:0.1,salt:1.2},
  {name:'たこ焼き（6個）',yomi:'タコヤキ',tags:'たこやき たこ 大阪',en:'takoyaki octopus ball',cal:310,p:11.5,f:14.0,c:34.5,per:180,fiber:1.0,iron:0.8,calcium:50,vitc:1,vitd:0.5,salt:2.5},
  {name:'お好み焼き（1枚）',yomi:'オコノミヤキ',tags:'おこのみやき 大阪 関西',en:'okonomiyaki japanese pancake',cal:540,p:22.0,f:22.0,c:62.0,per:350,fiber:3.0,iron:2.0,calcium:120,vitc:10,vitd:0.5,salt:3.5},
  {name:'焼きそば（1人前）',yomi:'ヤキソバ',tags:'やきそば 焼きそば 麺',en:'yakisoba stir fried noodles',cal:510,p:15.5,f:16.0,c:76.0,per:350,fiber:3.5,iron:1.5,calcium:50,vitc:15,vitd:0,salt:3.5},
  {name:'チャーハン（1人前）',yomi:'チャーハン',tags:'ちゃーはん 炒飯 ライス',en:'chahan fried rice',cal:560,p:16.0,f:18.5,c:83.0,per:350,fiber:1.5,iron:1.0,calcium:25,vitc:3,vitd:0.2,salt:3.0},

  // ── フレッシュ野菜・サラダ ──
  {name:'グリーンサラダ（外食）',yomi:'グリーンサラダ',tags:'サラダ 野菜 外食',en:'green salad restaurant',cal:25,p:1.5,f:0.3,c:5.0,per:100,fiber:2.0,iron:0.5,calcium:40,vitc:20,vitd:0,salt:0.3},
  {name:'シーザーサラダ（ドレッシング付き）',yomi:'シーザーサラダ',tags:'サラダ 外食',en:'caesar salad with dressing',cal:180,p:5.5,f:14.0,c:10.0,per:200,fiber:2.5,iron:0.8,calcium:120,vitc:15,vitd:0.2,salt:1.5},
  {name:'ドレッシング フレンチ（カロリーハーフ）',yomi:'フレンチドレッシング',tags:'ドレッシング サラダ',en:'french dressing low calorie',cal:100,p:0.5,f:8.0,c:6.5,per:100,fiber:0,iron:0.1,calcium:5,vitc:1,vitd:0,salt:1.5},
  {name:'ゆで卵（1個）',yomi:'ユデタマゴ',tags:'たまご 卵 ゆでたまご',en:'boiled egg hard boiled',cal:91,p:7.7,f:6.2,c:0.3,per:60,fiber:0,iron:1.1,calcium:31,vitc:0,vitd:2.3,salt:0.2},
  {name:'目玉焼き（1個）',yomi:'メダマヤキ',tags:'たまご 卵 目玉焼き',en:'fried egg sunny side up',cal:102,p:7.5,f:7.8,c:0.1,per:60,fiber:0,iron:1.1,calcium:28,vitc:0,vitd:2.3,salt:0.4},
  {name:'スクランブルエッグ（2個）',yomi:'スクランブルエッグ',tags:'たまご 卵 スクランブル',en:'scrambled eggs',cal:192,p:14.5,f:14.5,c:1.0,per:120,fiber:0,iron:2.2,calcium:56,vitc:0,vitd:4.6,salt:0.8},
  // ── ビール・ハイボール・ワイン ──
  {name:'ビール缶（350ml）',yomi:'ビール',tags:'びーる アルコール 酒 缶',en:'beer can 350ml',cal:140,p:1.1,f:0,c:10.9,per:350,fiber:0,iron:0.1,calcium:11,vitc:0,vitd:0,salt:0},
  {name:'ビール缶（500ml）',yomi:'ビール',tags:'びーる アルコール 酒 缶',en:'beer can 500ml',cal:200,p:1.5,f:0,c:15.5,per:500,fiber:0,iron:0.1,calcium:15,vitc:0,vitd:0,salt:0},
  {name:'アサヒスーパードライ 350ml缶',yomi:'アサヒスーパードライ',tags:'ビール アサヒ スーパードライ アルコール',en:'asahi super dry beer 350ml',cal:147,p:1.4,f:0,c:10.9,per:350,fiber:0,iron:0.1,calcium:11,vitc:0,vitd:0,salt:0},
  {name:'キリン一番搾り 350ml缶',yomi:'イチバンシボリ',tags:'ビール キリン 一番搾り アルコール',en:'kirin ichiban shibori beer 350ml',cal:140,p:1.4,f:0,c:10.5,per:350,fiber:0,iron:0.1,calcium:11,vitc:0,vitd:0,salt:0},
  {name:'サッポロ黒ラベル 350ml缶',yomi:'クロラベル',tags:'ビール サッポロ 黒ラベル アルコール',en:'sapporo black label beer 350ml',cal:140,p:1.4,f:0,c:10.2,per:350,fiber:0,iron:0.1,calcium:11,vitc:0,vitd:0,salt:0},
  {name:'ヱビスビール 350ml缶',yomi:'エビスビール',tags:'ビール サッポロ ヱビス エビス アルコール',en:'yebisu beer 350ml',cal:154,p:1.8,f:0,c:11.6,per:350,fiber:0,iron:0.1,calcium:14,vitc:0,vitd:0,salt:0},
  {name:'ザ・プレミアムモルツ 350ml缶',yomi:'プレミアムモルツ',tags:'ビール サントリー プレモル アルコール',en:'premium malts beer 350ml suntory',cal:147,p:1.4,f:0,c:11.0,per:350,fiber:0,iron:0.1,calcium:11,vitc:0,vitd:0,salt:0},
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
      <div style="background:#e3f0ff;border-radius:6px;padding:5px 2px"><div style="color:#3266ad;font-size:9px">P(g)</div><div style="font-weight:600">${g.p}</div></div>
      <div style="background:#fff3e0;border-radius:6px;padding:5px 2px"><div style="color:#e8a838;font-size:9px">F(g)</div><div style="font-weight:600">${g.f}</div></div>
      <div style="background:#e8f5e9;border-radius:6px;padding:5px 2px"><div style="color:#4caf50;font-size:9px">C(g)</div><div style="font-weight:600">${g.c}</div></div>
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
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), duration);
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
function renderRecord() {
  const list = getDayEntries(currentDate);
  const s = sumEntries(list);
  const g = goals();
  const exToday = exercises.filter(e => e.date === currentDate);
  const exCal = exToday.reduce((a, e) => a + (e.cal || 0), 0);
  const remain = g.cal - s.cal + exCal;
  const remainColor = remain >= 0 ? 'var(--accent)' : '#c0392b';

  // タンパク質吸収補正
  const absP = r1(calcAbsorbedProtein(list));

  // ── 実質栄養価 ──
  renderNetCard(s);

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
        <div style="font-weight:700">${r1(s.p)}g</div>
        <div style="font-size:10px;color:var(--accent);font-weight:600">吸収量 ${absP}g</div>
        <div style="font-size:10px;color:var(--text-sub)">${ri(s.p*4)} kcal (${pCalPct}%)</div>
        <div style="font-size:10px;color:var(--text-sub)">目標 ${g.p}g</div>
      </div>
      <div style="background:#fff3e0;border-radius:8px;padding:7px 4px">
        <div style="font-size:10px;color:#e8a838;font-weight:600">脂質</div>
        <div style="font-weight:700">${r1(s.f)}g</div>
        <div style="font-size:10px;color:var(--text-sub)">${ri(s.f*9)} kcal (${fCalPct}%)</div>
        <div style="font-size:10px;color:var(--text-sub)">目標 ${g.f}g</div>
      </div>
      <div style="background:#e8f5e9;border-radius:8px;padding:7px 4px">
        <div style="font-size:10px;color:#4caf50;font-weight:600">炭水化物</div>
        <div style="font-weight:700">${r1(s.c)}g</div>
        <div style="font-size:10px;color:var(--text-sub)">${ri(s.c*4)} kcal (${cCalPct}%)</div>
        <div style="font-size:10px;color:var(--text-sub)">目標 ${g.c}g</div>
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
          html += `<div class="edit-form">
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
          <button class="btn btn-sm btn-danger" onclick="deleteEntry(${e.id})" style="padding:2px 6px">✕</button></div></div>`;
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
        <div class="row" style="margin-bottom:6px"><div class="field" style="flex:3"><label>食品名</label><input type="text" id="addName_${meal}" placeholder="食品名"></div><div class="field" style="flex:1.2"><label>量(g) <button type="button" onclick="showAmtQuickPicker('${meal}')" style="font-size:10px;padding:1px 5px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text-sub);cursor:pointer;vertical-align:middle">▾</button></label><input type="number" id="addAmt_${meal}" value="100" min="1" oninput="recalcAdd('${meal}')"></div></div>
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
      return {name:p.product_name_ja||p.product_name||'不明',cal:r1(n['energy-kcal_100g']||0),p:r1(n['proteins_100g']||0),f:r1(n['fat_100g']||0),c:r1(n['carbohydrates_100g']||0),per:100,
        fiber:r1(n['fiber_100g']||0),iron:r1(n['iron_100g']!=null?n['iron_100g']*1000:0),calcium:r1(n['calcium_100g']!=null?n['calcium_100g']*1000:0),
        vitc:r1(n['vitamin-c_100g']!=null?n['vitamin-c_100g']*1000:0),vitd:r1(n['vitamin-d_100g']!=null?n['vitamin-d_100g']*1000000:0),salt:r1(n['salt_100g']||0),_src:'api'};
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
  document.getElementById('addName_'+meal).value=f.name;
  document.getElementById('addAmt_'+meal).value=f.per;
  fillAddMacros(f,f.per,meal); box.style.display='none'; document.getElementById('addSearch_'+meal).value='';
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
  entries.push({
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
  showToast(`✅ ${s.name}を${meal}に追加`);
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
function showAmtQuickPicker(meal) {
  const base = window._addBase?.[meal];
  const cont = document.getElementById('amtQuickPick_'+meal);
  if (!cont) return;
  // per値（標準量）を軸に選択肢を生成
  const per  = base?.per || 100;
  const candidates = new Set([per]);
  // 50g刻みの前後 + 100g単位
  [50, 100, 150, 200, 250, 300].forEach(v => candidates.add(v));
  if (per !== 100) [Math.round(per*0.5), Math.round(per*2)].forEach(v => v>0 && candidates.add(v));
  const sorted = [...candidates].filter(v=>v>0).sort((a,b)=>a-b);
  cont.innerHTML = sorted.map(v =>
    `<button onclick="setAddAmt('${meal}',${v})" style="font-size:11px;padding:3px 8px;border:1px solid var(--border);border-radius:6px;background:${v===per?'var(--accent)':'var(--bg)'};color:${v===per?'#fff':'var(--text)'};cursor:pointer;white-space:nowrap">${v}g${v===per?' ★':''}</button>`
  ).join('');
  cont.style.display = cont.style.display === 'none' ? 'flex' : 'none';
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
  const bn=window._addBase&&window._addBase[meal]; if(!bn) return;
  const amt=parseFloat(document.getElementById('addAmt_'+meal).value)||0;
  if(amt>0) fillAddMacros(bn,amt,meal);
}
function gv(id) { return parseFloat(document.getElementById(id).value)||0; }
function addEntry(meal) {
  const nameEl=document.getElementById('addName_'+meal);
  const name=nameEl?nameEl.value.trim():'';
  const msg=document.getElementById('addMsg_'+meal);
  if(!name){if(msg){msg.className='status-msg status-err';msg.textContent='食品名を入力してください'}return}
  entries.push({id:Date.now(),date:currentDate,name,meal,
    cal:gv('addCal_'+meal),p:gv('addP_'+meal),f:gv('addF_'+meal),c:gv('addC_'+meal),amount:gv('addAmt_'+meal)||100,
    fiber:gv('addFib_'+meal),iron:gv('addFe_'+meal),calcium:gv('addCa_'+meal),vitc:gv('addVc_'+meal),vitd:gv('addVd_'+meal),salt:gv('addSalt_'+meal)});
  save(); renderRecord(); renderCalendar();
  setTimeout(()=>{const m=document.getElementById('addMsg_'+meal);if(m){m.className='status-msg status-ok';m.textContent=`「${name}」を追加しました`;setTimeout(()=>{if(m)m.textContent=''},1800)}},30);
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
function deleteEntry(id){entries=entries.filter(e=>e.id!==id);if(editingId===id)editingId=null;save();renderRecord();renderCalendar()}

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
  exercises = exercises.filter(e => e.id !== id);
  saveExercises();
  renderExerciseItems();
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
          <button class="btn btn-sm btn-danger" onclick="deleteExercise(${e.id})" style="padding:2px 6px">✕</button>
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
// ── 代謝変動推定 ──
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
function deleteCustomFood(id){customFoods=customFoods.filter(f=>f.id!==id);saveCustom();renderCustomFoodList()}
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
          entries.push({
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
          });
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
          entries.push({
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
          });
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

コマンド種別:

1. add — 記録を追加
{
  "commands": [{
    "type": "add",
    "dates": ["2025-06-16", "2025-06-17"],
    "meal": "昼食",
    "items": [{"name": "食品名", "amount": 100, "cal": 168, "p": 2.5, "f": 0.3, "c": 37.1, "fiber": 0.3, "iron": 0.1, "calcium": 3, "vitc": 0, "vitd": 0, "salt": 0}]
  }],
  "backup_label": "朝食追加",
  "message": "ユーザーへの返答"
}

2. delete_by_id — IDを指定して削除
{
  "commands": [{"type": "delete_by_id", "ids": [1234567890]}],
  "backup_label": "夕食削除",
  "message": "削除しました"
}

3. delete_by_date_meal — 日付×食事タイミングで一括削除
{
  "commands": [{"type": "delete_by_date_meal", "dates": ["2025-06-16"], "meal": "昼食"}],
  "backup_label": "昼食一括削除",
  "message": "削除しました"
}

4. replace — 指定日時の記録を全削除して新しい内容で置き換え
{
  "commands": [{"type": "replace", "dates": ["2025-06-16", "2025-06-17"], "meal": "昼食", "items": [...]}],
  "backup_label": "今週昼食を置き換え",
  "message": "置き換えました"
}

【backup_labelルール】
- 操作内容を10文字以内で端的に表す日本語ラベルを必ず付ける
- 例）「朝食に卵追加」「昨日夕食削除」「今週昼食を置換」

【重要ルール】
- "今週"は ${weekDates[0]}〜${weekDates[6]} の7日間
- "昨日"は ${getLastNDates(2)[0]}、"一昨日"は ${getLastNDates(3)[0]}
- 栄養素は日本食品標準成分表の標準値を推定して必ず入れる
- 量が不明なら一般的な1人前を推定
- 複数日にまたがる操作はdatesに全日付を列挙する
- 記録の読み取り・質問のみの場合はcommands不要、messageだけ返す

5. add_custom_food — カスタム食品DBに食品を登録（記録への追加とは別）
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

6. delete_custom_food — カスタム食品DBから削除
{
  "commands": [{"type": "delete_custom_food", "names": ["食品名"]}],
  "backup_label": "カスタム食品削除",
  "message": "削除しました"
}

【対応範囲外の操作について】
以下はこのアプリで対応できない操作です。該当する場合は操作を行わず、
できない理由と代替手段をmessageのみで返してください（JSONブロック不要）:
- 体重・プロフィール情報の変更（→「設定」タブで手動変更を案内）
- グラフや統計の操作（表示のみで変更不可）
- 15日以上前の記録（コンテキスト外のため参照・操作不可）
- 運動記録の追加・削除（→「記録」タブの運動ブロックで手動操作を案内）
- アプリの設定変更・外部サービス連携操作

【カスタム食品登録のルール】
- 「〇〇を食品DBに登録して」「〇〇を食品として保存して」などの依頼は add_custom_food を使用
- per は商品1個・1食分・100g など最も使いやすい単位を選ぶ
- 栄養成分表示がある場合はその数値を使用、なければ標準的な値を推定
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

    // JSONブロック抽出
    const jsonMatch = rawText.match(/```json\s*([\s\S]*?)```/);
    let parsed      = null;
    let displayText = rawText;

    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[1].trim());
        displayText = parsed.message || rawText.replace(/```json[\s\S]*?```/g, '').trim();
      } catch(e) {}
    }

    if (thinking) { clearInterval(thinking._timer); thinking.remove(); }
    // JSONブロックを除いた短縮版を履歴に保存（トークン節約）
    const historyContent = rawText.replace(/```json[\s\S]*?```/g, '[操作コマンド実行済み]').trim();
    aiHistory.push({ role: 'assistant', content: historyContent });
    // 会話履歴が長くなりすぎたら古いものを削除（直近10往復まで）
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
