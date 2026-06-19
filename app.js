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
];
LOCAL_DB.forEach(f => {
  f._search = normalize(f.name)+' '+normalize(f.yomi||'')+' '+normalize(f.tags||'')+' '+(f.en||'').toLowerCase();
  f._src = 'local';
});

// ── State ──
let entries = [], customFoods = [], comboFoods = [];
let userWeight = 65, statsPeriod = 'today';
let calChart = null, pfcChart = null;
let searchTimer = null, comboTimer = null, apiAbort = null;
let comboIngredients = [], editingId = null, activeAddMeal = null;
let calViewYear = new Date().getFullYear(), calViewMonth = new Date().getMonth();
let currentDate = toDateStr(new Date());
let ghToken = null, ghData = {}; // Google Health API
let deferredPrompt = null;

try { entries = JSON.parse(localStorage.getItem('pfcEntries') || '[]'); } catch(e) {}
try { customFoods = JSON.parse(localStorage.getItem('pfcCustomFoods') || '[]'); } catch(e) {}
try { comboFoods = JSON.parse(localStorage.getItem('pfcComboFoods') || '[]'); } catch(e) {}
try { userWeight = parseFloat(localStorage.getItem('pfcWeight') || '65'); } catch(e) {}
try { ghToken = localStorage.getItem('ghToken') || null; } catch(e) {}
try { ghData = JSON.parse(localStorage.getItem('ghData') || '{}'); } catch(e) {}

function toDateStr(d) { return d.toISOString().split('T')[0]; }
function fmtDate(s) { const d = new Date(s+'T00:00:00'); return d.toLocaleDateString('ja-JP',{month:'long',day:'numeric',weekday:'short'}); }
function isToday(s) { return s === toDateStr(new Date()); }
function r1(n) { return Math.round(n*10)/10; }
function r2(n) { return Math.round(n*100)/100; }
function ri(n) { return Math.round(n); }
function save() { try { localStorage.setItem('pfcEntries', JSON.stringify(entries)); } catch(e) {} }
function saveCustom() { try { localStorage.setItem('pfcCustomFoods', JSON.stringify(customFoods)); localStorage.setItem('pfcComboFoods', JSON.stringify(comboFoods)); } catch(e) {} }
function saveGhData() { try { localStorage.setItem('ghData', JSON.stringify(ghData)); } catch(e) {} }

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
function goals() {
  const p = r1(userWeight*1.6), cal = 2000, f = r1(cal*0.25/9), c = r1((cal-p*4-f*9)/4);
  return {cal, p, f, c};
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
  currentDate = toDateStr(dt); activeAddMeal = null; editingId = null;
  updateDateHeader(); renderRecord(); renderCalendar();
}
function goToday() {
  currentDate = toDateStr(new Date()); calViewYear = new Date().getFullYear(); calViewMonth = new Date().getMonth();
  activeAddMeal = null; editingId = null; updateDateHeader(); renderRecord(); renderCalendar();
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

// ── Record ──
function renderRecord() {
  const list = getDayEntries(currentDate);
  const s = sumEntries(list);
  document.getElementById('recMetrics').innerHTML = `
    <div class="mc"><div class="mc-label">カロリー</div><div class="mc-value">${ri(s.cal)}</div><div class="mc-unit">kcal</div></div>
    <div class="mc"><div class="mc-label">タンパク質</div><div class="mc-value">${r1(s.p)}</div><div class="mc-unit">g</div></div>
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
          html += `<div class="edit-form">
            <div class="row" style="margin-bottom:5px"><div class="field" style="flex:3"><label>食品名</label><input type="text" id="en${e.id}" value="${e.name}"></div><div class="field" style="flex:1.2"><label>量(g)</label><input type="number" id="ea${e.id}" value="${e.amount}" min="1"></div></div>
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
        <div class="row" style="margin-bottom:6px"><div class="field" style="flex:3"><label>食品名</label><input type="text" id="addName_${meal}" placeholder="食品名"></div><div class="field" style="flex:1.2"><label>量(g)</label><input type="number" id="addAmt_${meal}" value="100" min="1" oninput="recalcAdd('${meal}')"></div></div>
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
function cancelEdit(){editingId=null;renderRecord()}
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
function setPeriod(p, el) { statsPeriod=p; document.querySelectorAll('.period-tab').forEach(t=>t.classList.remove('active')); el.classList.add('active'); renderStats(); }
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
  const lbl=statsPeriod==='today'?'今日':statsPeriod==='7d'?`週平均(${avg?avg.days:'0'}日)`:statsPeriod==='30d'?`月平均(${avg?avg.days:'0'}日)`:`3ヶ月平均(${avg?avg.days:'0'}日)`;
  const score=avg?Math.round(Math.min(s.cal/g.cal,1)*25+Math.min(s.p/g.p,1)*35+Math.min(s.f/g.f,1)*20+Math.min(s.c/g.c,1)*20):0;
  document.getElementById('goalBars').innerHTML = avg ? `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <span style="font-size:11px;color:var(--text-sub)">${lbl}</span>
      <span style="font-size:26px;font-weight:600;color:${score>=80?'#2e7d32':score>=60?'#e8a838':'#c0392b'}">${score}<span style="font-size:12px;color:var(--text-sub)">/100</span></span>
    </div>
    <div style="margin-bottom:10px;font-size:11px;color:var(--text-sub)">体重 <input type="number" value="${userWeight}" min="30" max="200" step="0.5" oninput="userWeight=parseFloat(this.value)||65;localStorage.setItem('pfcWeight',userWeight);renderStats()" style="width:50px;font-size:12px;padding:2px 5px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text)"> kg → タンパク質目標 ${g.p}g</div>
    <div style="font-size:11px;font-weight:600;color:var(--text-sub);margin-bottom:8px">PFC・カロリー</div>
    ${goalBar('カロリー',ri(s.cal),g.cal,'kcal','#3266ad')}${goalBar('タンパク質',r1(s.p),g.p,'g','#3266ad')}${goalBar('脂質',r1(s.f),g.f,'g','#e8a838')}${goalBar('炭水化物',r1(s.c),g.c,'g','#4caf50')}
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
function saveComboFood() {
  const name=document.getElementById('comboName').value.trim(); const msg=document.getElementById('comboSaveMsg');
  if(!name){msg.className='status-msg status-err';msg.textContent='複合食品名を入力してください';return}
  if(!comboIngredients.length){msg.className='status-msg status-err';msg.textContent='食材を追加してください';return}
  const tot=comboIngredients.reduce((a,f)=>({cal:a.cal+f._cal,p:a.p+f._p,f:a.f+f._f,c:a.c+f._c,fiber:a.fiber+f._fiber,iron:a.iron+f._iron,calcium:a.calcium+f._calcium,vitc:a.vitc+(f._vitc||0),vitd:a.vitd+(f._vitd||0),salt:a.salt+(f._salt||0)}),{cal:0,p:0,f:0,c:0,fiber:0,iron:0,calcium:0,vitc:0,vitd:0,salt:0});
  const totalAmt=comboIngredients.reduce((a,f)=>a+f.amount,0);
  const sc=v=>r1(v/totalAmt*100);
  comboFoods.push({id:Date.now(),name,per:100,cal:sc(tot.cal),p:sc(tot.p),f:sc(tot.f),c:sc(tot.c),fiber:sc(tot.fiber),iron:sc(tot.iron),calcium:sc(tot.calcium),vitc:sc(tot.vitc),vitd:sc(tot.vitd),salt:r2(tot.salt/totalAmt*100),ingredients:comboIngredients.map(f=>({name:f.name,amount:f.amount})),_src:'combo'});
  saveCustom(); msg.className='status-msg status-ok'; msg.textContent=`「${name}」を登録しました`;
  comboIngredients=[]; document.getElementById('comboName').value=''; renderComboIngredients(); renderComboFoodList(); setTimeout(()=>{msg.textContent=''},2500);
}
function deleteComboFood(id){comboFoods=comboFoods.filter(f=>f.id!==id);saveCustom();renderComboFoodList()}
function renderComboFoodList() {
  const cont=document.getElementById('comboFoodList');
  if(!comboFoods.length){cont.innerHTML=`<div style="font-size:12px;color:var(--text-sub);padding:8px 0">まだ登録がありません</div>`;return}
  cont.innerHTML=comboFoods.map(f=>`<div class="custom-item"><div><div style="font-weight:500">${f.name}</div><div style="font-size:10px;color:var(--text-sub)">100gあたり ${f.cal}kcal P${f.p} F${f.f} C${f.c}${f.fiber?' 繊'+f.fiber:''}</div><div style="font-size:10px;color:var(--text-sub)">${(f.ingredients||[]).map(i=>`${i.name}(${i.amount}g)`).join('、')}</div></div><button class="btn btn-sm btn-danger" onclick="deleteComboFood(${f.id})">✕</button></div>`).join('');
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

// ── Tab switch ──
function switchTab(t) {
  ['record','stats','custom','csv','profile','garmin'].forEach(id => {
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
  if (t==='profile') initProfile();
  if (t==='garmin')  renderGhStatus();
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
updateDateHeader(); renderCalendar(); renderRecord();
