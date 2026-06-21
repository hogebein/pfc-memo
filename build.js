// build.js — Netlifyビルド時に実行
// sw.js の __BUILD_TS__ をビルド時刻のタイムスタンプに置き換える
const fs = require('fs');

const ts = Date.now().toString();
const sw = fs.readFileSync('sw.js', 'utf8').replace('__BUILD_TS__', ts);
fs.writeFileSync('sw.js', sw);

console.log(`[build] sw.js cache version: pfc-memo-${ts}`);
