#!/usr/bin/env node
// scripts/validate-food-db.js
//
// 他のLLMに生成してもらった食品データを foods-db.js に取り込む前にチェックするスクリプト。
//
// 使い方:
//   1. LLMの出力（食品オブジェクトの配列、または1行ずつの断片）を新しいファイルに保存する
//      例: /tmp/new-foods.js
//        [
//          {name:'○○', ...},
//          {name:'△△', ...},
//        ]
//   2. 実行:
//        node scripts/validate-food-db.js /tmp/new-foods.js
//   3. 問題がなければ、出力された配列の中身を foods-db.js の `];` の直前に貼り付ける
//
const fs = require('fs');
const path = require('path');

const target = process.argv[2];
if (!target) {
  console.error('使い方: node scripts/validate-food-db.js <新しい食品データのファイル>');
  process.exit(1);
}

// ── 新規データの読み込み ──
let newFoods;
try {
  const raw = fs.readFileSync(target, 'utf8');
  // eslint-disable-next-line no-eval
  newFoods = eval(raw);
  if (!Array.isArray(newFoods)) throw new Error('配列（[...]）である必要があります');
} catch (e) {
  console.error('❌ 構文エラー・読み込み失敗:', e.message);
  process.exit(1);
}
console.log(`読み込み: ${newFoods.length}件`);

// ── 既存DBの読み込み（重複チェック用） ──
const dbPath = path.join(__dirname, '..', 'foods-db.js');
let existingNames = [];
try {
  const src = fs.readFileSync(dbPath, 'utf8').replace('const LOCAL_DB', 'global.LOCAL_DB');
  // eslint-disable-next-line no-eval
  eval(src);
  existingNames = LOCAL_DB.map(f => normName(f.name));
} catch (e) {
  console.warn('⚠️ 既存DB(foods-db.js)の読み込みに失敗。重複チェックはスキップします:', e.message);
}

function normName(n) { return (n || '').trim().toLowerCase().replace(/\s+/g, ''); }

// ── 必須フィールドチェック ──
const REQUIRED = ['name', 'yomi', 'tags', 'en', 'cal', 'p', 'f', 'c', 'per'];
const errors = [];
const warnings = [];
const seenNewNames = new Set();

newFoods.forEach((food, i) => {
  const tag = `#${i + 1} "${food.name || '(名前なし)'}"`;

  // 必須フィールド
  REQUIRED.forEach(key => {
    if (food[key] === undefined || food[key] === null || food[key] === '') {
      errors.push(`${tag}: 必須フィールド "${key}" が欠けています`);
    }
  });

  // 数値フィールドの妥当性（NaN・負数チェック）
  ['cal','p','f','c','per','fiber','iron','calcium','vitc','vitd','vita','vite','vitk','iodine','salt'].forEach(key => {
    if (food[key] !== undefined && (isNaN(food[key]) || food[key] < 0)) {
      errors.push(`${tag}: "${key}" が数値として不正です (${food[key]})`);
    }
  });

  // 重複チェック（新規データ内 + 既存DB）
  const norm = normName(food.name);
  if (seenNewNames.has(norm)) {
    errors.push(`${tag}: 新規データ内で名前が重複しています`);
  }
  seenNewNames.add(norm);
  if (existingNames.includes(norm)) {
    warnings.push(`${tag}: 既存DBに同名の食品が既にあります（意図的でなければ確認してください）`);
  }

  // fa/aa の閾値チェック（f>=0.5g/100gならfa必須、p>=1g/100gならaa必須）
  const per = food.per || 100;
  const fPer100 = (food.f || 0) * 100 / per;
  const pPer100 = (food.p || 0) * 100 / per;
  if (fPer100 >= 0.5 && !food.fa) {
    warnings.push(`${tag}: 脂質${fPer100.toFixed(1)}g/100g相当なのに fa（脂肪酸比率）が未設定です`);
  }
  if (pPer100 >= 1.0 && !food.aa) {
    warnings.push(`${tag}: タンパク質${pPer100.toFixed(1)}g/100g相当なのに aa（アミノ酸スコア）が未設定です`);
  }

  // fa/aaの内訳が大きく破綻していないか（合計が0や極端な値でないか）
  if (food.fa) {
    const faSum = (food.fa.sat||0)+(food.fa.mufa||0)+(food.fa.n3||0)+(food.fa.n6||0)+(food.fa.trans||0);
    if (faSum < 0.3 || faSum > 1.3) warnings.push(`${tag}: fa の合計が${faSum.toFixed(2)}で不自然です（通常0.8〜1.0程度）`);
  }
  if (food.aa && food.aa.score !== undefined && (food.aa.score < 0 || food.aa.score > 1.5)) {
    warnings.push(`${tag}: aa.score が${food.aa.score}で不自然です（通常0.4〜1.3程度）`);
  }

  // カロリーとPFCの整合性（既存アプリの異常値チェックと同じ考え方。食物繊維は4kcal/gで計算しない）
  const calcCal = (food.p||0)*4 + (food.f||0)*9 + Math.max(0, (food.c||0) - (food.fiber||0))*4;
  if ((food.cal||0) > 20 && calcCal > (food.cal||0) * 1.3) {
    warnings.push(`${tag}: P・F・Cから計算したカロリー(${calcCal.toFixed(0)}kcal)が記録値(${food.cal}kcal)を大きく超えています`);
  }
});

console.log(`\n=== 結果 ===`);
console.log(`エラー: ${errors.length}件 / 警告: ${warnings.length}件\n`);

if (errors.length) {
  console.log('❌ エラー（取り込み前に必ず修正してください）');
  errors.forEach(e => console.log('  ' + e));
  console.log();
}
if (warnings.length) {
  console.log('⚠️ 警告（内容を確認の上、問題なければそのまま取り込み可）');
  warnings.forEach(w => console.log('  ' + w));
  console.log();
}
if (!errors.length && !warnings.length) {
  console.log('✅ 問題は見つかりませんでした。foods-db.js に取り込んで構いません。');
}

process.exit(errors.length ? 1 : 0);
