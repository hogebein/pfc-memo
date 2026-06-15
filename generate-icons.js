#!/usr/bin/env node
// generate-icons.js
// node generate-icons.js で icons/ に192px・512pxのPNGを生成します
// 事前に: npm install canvas

const { createCanvas } = require('canvas');
const fs = require('fs');

if (!fs.existsSync('icons')) fs.mkdirSync('icons');

function drawIcon(size) {
  const c = createCanvas(size, size);
  const ctx = c.getContext('2d');
  const r = size * 0.15;

  // 背景
  ctx.fillStyle = '#3266ad';
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, r);
  ctx.fill();

  // テキスト
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${size * 0.28}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PFC', size / 2, size * 0.38);

  ctx.font = `${size * 0.16}px sans-serif`;
  ctx.fillText('メモ', size / 2, size * 0.66);

  return c.toBuffer('image/png');
}

fs.writeFileSync('icons/icon-192.png', drawIcon(192));
fs.writeFileSync('icons/icon-512.png', drawIcon(512));
console.log('Icons generated: icons/icon-192.png, icons/icon-512.png');
