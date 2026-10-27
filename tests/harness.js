// jsdom でアプリ(index.html + foods-db.js + app.js)を読み込む簡易ハーネス。使う前に: npm install --no-save jsdom
const { JSDOM, VirtualConsole } = require('jsdom'); const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
function loadApp(opts = {}) {
  let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const inl = f => () => '<script>' + fs.readFileSync(path.join(root, f), 'utf8').replace(/<\/script>/g, '<\\/script>') + '</script>';
  html = html.replace(/<script src="https:[^>]*><\/script>/g, '').replace(/<script src="foods-db.js"><\/script>/, inl('foods-db.js')).replace(/<script src="app.js"><\/script>/, inl('app.js'));
  const errs = []; const vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push(e.message));
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true, virtualConsole: vc, beforeParse(w) {
    w.Chart = function () { return { destroy() {}, update() {} }; }; w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {} });
    w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {};
    // jsdom には canvas が無いため、統計タブのグラフ描画（getContext）を何もしない関数に差し替える
    const ctx = new Proxy(function () {}, { get: (t, k) => k === 'measureText' ? () => ({ width: 0 }) : (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : (k === 'canvas' ? {} : () => {})), set: () => true });
    w.HTMLCanvasElement.prototype.getContext = () => ctx;
    if (opts.beforeParse) opts.beforeParse(w);
  } });
  return { w: dom.window, errs };
}
function makeT() { let ok = 0, ng = 0; const t = (n, c) => { c ? ok++ : (ng++, console.log('FAIL', n)); }; t.done = errs => { console.log(`pass ${ok} fail ${ng}`); console.log('page errors:', errs && errs.length ? errs.slice(0, 4) : 'none'); process.exit(ng || (errs && errs.length) ? 1 : 0); }; return t; }
module.exports = { loadApp, makeT, sleep: ms => new Promise(r => setTimeout(r, ms)) };
