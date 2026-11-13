// 【アーカイブ】単体では実行できない断片です。当時の app.js（2026-11-03時点・数量シート版）から抜き出したものです。
// 再利用するときは README.md の「戻し方」を参照してください。

// 記録の行を左にスワイプすると「複製」「削除」が出る操作（✕ボタンの代わり）。行マークアップ側に .sw-actions が必要（integration-notes.md 参照）。
// ── 記録の行を左にスワイプ → 「複製」「削除」を表示（押し間違えやすい✕ボタンの代わり）──
const SW = { row: null, x: 0, y: 0, decided: null, open: null };
function swipeClose() { if (SW.open) { SW.open.classList.remove('sw-open'); SW.open = null; } }
function swipeOpen(row) { if (SW.open && SW.open !== row) SW.open.classList.remove('sw-open'); row.classList.add('sw-open'); SW.open = row; DRAG.suppressUntil = Date.now() + 350; }
function bindEntrySwipe() {
  const root = document.getElementById('mealBlocks'); if (!root) return;
  root.addEventListener('touchstart', ev => { if (!ev.touches || ev.touches.length !== 1) return; const t = ev.touches[0]; SW.row = dragRowFromEvent(ev); SW.x = t.clientX; SW.y = t.clientY; SW.decided = null; }, { passive: true });
  document.addEventListener('touchmove', ev => {
    if (!SW.row || DRAG.active) return; const t = ev.touches && ev.touches[0]; if (!t) return;
    const dx = t.clientX - SW.x, dy = t.clientY - SW.y;
    if (SW.decided === null) { if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.5) SW.decided = 'h'; else if (Math.abs(dy) > 14) SW.decided = 'v'; }   // 縦に動いたらスクロール
    if (SW.decided === 'h') { if (dx < -50) { swipeOpen(SW.row); SW.row = null; } else if (dx > 50 && SW.row.classList.contains('sw-open')) { swipeClose(); SW.row = null; } }
  }, { passive: true });
  document.addEventListener('touchend', () => { SW.row = null; }); document.addEventListener('touchcancel', () => { SW.row = null; });
  document.addEventListener('click', ev => { if (Date.now() < DRAG.suppressUntil) return; if (SW.open && !(ev.target.closest && ev.target.closest('.sw-actions'))) swipeClose(); }, true);   // 他の場所をタップしたら閉じる
}

// 初期化: bindEntrySwipe(); を bindEntryDrag(); の次に呼ぶ。CSS は sheet-swipe-units.css の .sw-* と .log-item { touch-action: pan-y }。
