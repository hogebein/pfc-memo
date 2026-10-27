// 記録タブの検索欄へのフォーカス（開いた直後の1回だけ／再描画で奪わない／入力途中の文字は残す）のテスト。
// 実行: npm install --no-save jsdom && node tests/search-focus.test.js
const { loadApp, makeT, sleep } = require('./harness');
const { w, errs } = loadApp(); const t = makeT(); const ev = s => w.eval(s); const $ = id => w.document.getElementById(id);
let focusLog = []; const origFocus = w.HTMLElement.prototype.focus; w.HTMLElement.prototype.focus = function (...a) { focusLog.push(this.id || this.tagName); return origFocus.apply(this, a); };
const searchFocused = () => focusLog.filter(id => /^addSearch_/.test(id)).length; const activeId = () => (w.document.activeElement && w.document.activeElement.id) || '';
setTimeout(async () => {
  try {
    const D = ev('currentDate');
    const base = [{ id: 1, date: D, meal: '朝食', time: '08:00', name: 'テストご飯', amount: 150, cal: 240, p: 3.75, f: 0.45, c: 52.5 }, { id: 2, date: D, meal: '朝食', time: '08:10', name: 'テスト卵', amount: 50, cal: 75, p: 6, f: 5, c: 0.2 }, { id: 3, date: D, meal: '昼食', time: '12:00', name: 'テストオーツ', amount: 40, cal: 152, p: 5, f: 2, c: 27 }];
    const foods = [{ id: 11, name: 'テストご飯', per: 100, cal: 160, p: 2.5, f: 0.3, c: 35, serving: 150 }, { id: 12, name: 'テスト卵', per: 100, cal: 150, p: 12, f: 10, c: 0.3 }];
    const setup = () => { ev(`customFoods=${JSON.stringify(foods)};comboFoods=[];entries=${JSON.stringify(base)};saveLocal();activeAddMeal=null;editingId=null;_focusAddSearchMeal=null;closeAmountSheet();window.localStorage.setItem('pfcAmountSheet','instant');`); w.switchTab('record'); ev('renderRecord()'); focusLog = []; };
    const openPanel = async meal => { w.toggleAddPanel(meal); await sleep(60); };
    const quiet = async (label, fn, wait = 80) => { focusLog = []; fn(); await sleep(wait); const box = $('addResultsBox_朝食'); t(`${label}: search field not focused`, searchFocused() === 0 && !/^addSearch_/.test(activeId())); t(`${label}: quick-pick dropdown not popped up`, !box || box.style.display !== 'block'); };
    // ── 開いた直後は1回だけフォーカス ──
    setup(); await openPanel('朝食'); t('open panel: search focused once', searchFocused() === 1 && activeId() === 'addSearch_朝食'); t('open panel: quick picks may show on explicit open', true);
    // フォーカスを外した（キーボードを閉じた）状態で、あらゆる再描画経路を通す
    const blur = () => { const el = $('addSearch_朝食'); if (el) el.blur(); const box = $('addResultsBox_朝食'); if (box) box.style.display = 'none'; focusLog = []; };
    blur(); t('panel still open after blur', ev('activeAddMeal') === '朝食');
    await quiet('direct re-render', () => ev('renderRecord()'));
    await quiet('tab switch away and back', () => { w.switchTab('stats'); w.switchTab('record'); });
    await quiet('register a food (instant mode)', () => { const box = $('addResultsBox_朝食'); box._local = [ev("getAllFoods().find(f=>f.name==='テスト卵')")]; box._qty = null; w.selectAddResult(0, '朝食'); });
    await quiet('register via search quantity', () => { const box = $('addResultsBox_朝食'); box._local = [ev("getAllFoods().find(f=>f.name==='テストご飯')")]; box._qty = { q: 'テストご飯', num: 100, unit: '' }; w.selectAddResult(0, '朝食'); });
    await quiet('change amount (sheet apply)', () => { w.openAmountSheetForEntry(1); w.asMultiply(2); w.confirmAmountSheet(); });
    await quiet('undo from toast', () => { const u = $('toast').querySelector('.toast-undo-btn'); if (u) u.click(); });
    await quiet('duplicate entry', () => w.duplicateEntry(1));
    await quiet('group entries (drag drop)', () => w.groupEntries(2, 1));
    await quiet('toggle group open', () => w.toggleGroupOpen(1));
    await quiet('ungroup', () => w.ungroupEntry(1));
    await quiet('delete entry', () => w.deleteEntry(ev('entries[0].id')));
    await quiet('undo delete', () => { const u = $('toast').querySelector('.toast-undo-btn'); if (u) u.click(); });
    await quiet('set meal time', () => { const f = $('mealTimeSet_朝食'); if (f) f.value = '09:00'; w.setMealTime('朝食', '09:00'); });
    await quiet('cloud foreground refresh', () => ev('refreshViewsAfterCloud()'));
    await quiet('apply cloud data', () => ev(`applyCloudData({entries:${JSON.stringify(base)},updatedAt:'2099'});refreshViewsAfterCloud()`));
    await quiet('Google Health daily steps', () => ev(`dailyActivity={};setDailySteps?setDailySteps('${D}',5000):renderRecord()`));
    await quiet('copy day / meal', () => { if (typeof w.copyMeal === 'function') { try { w.copyMeal('朝食'); } catch (e) {} } ev('renderRecord()'); });
    t('panel is still open through all of the above', ev('activeAddMeal') === '朝食');
    // ── 再度「＋追加」: 閉じて開くと、またフォーカス ──
    ev('activeAddMeal=null'); await openPanel('昼食'); t('opening another meal focuses its search', searchFocused() === 1 && activeId() === 'addSearch_昼食');
    focusLog = []; ev('renderRecord()'); await sleep(80); t('one-shot: next re-render does not focus again (field still focused → kept, not re-requested)', searchFocused() <= 1);
    $('addSearch_昼食').blur(); focusLog = []; ev('renderRecord()'); await sleep(80); t('after blur: re-render does not focus', searchFocused() === 0);
    // ── 入力途中は維持される ──
    setup(); await openPanel('朝食'); { const el = $('addSearch_朝食'); el.value = 'テスト'; w.onAddSearch('テスト', '朝食'); el.setSelectionRange(1, 3); focusLog = []; ev('renderRecord()'); await sleep(80);
      const el2 = $('addSearch_朝食'); t('typing: field keeps focus after re-render', activeId() === 'addSearch_朝食' && el2.value === 'テスト'); t('typing: caret/selection restored', el2.selectionStart === 1 && el2.selectionEnd === 3);
      t('typing: result list restored', $('addResultsBox_朝食').style.display === 'block' && /テスト/.test($('addResultsBox_朝食').textContent)); }
    // 入力はあるが別の場所を触った（フォーカスなし）→ 文字と候補は残り、フォーカスは奪わない
    $('addSearch_朝食').blur(); focusLog = []; ev('renderRecord()'); await sleep(80); t('typed but blurred: text kept, no focus', $('addSearch_朝食').value === 'テスト' && searchFocused() === 0 && $('addResultsBox_朝食').style.display === 'block');
    // 登録後は入力がクリアされ、フォーカスもしない
    { const box = $('addResultsBox_朝食'); box._local = [ev("getAllFoods().find(f=>f.name==='テスト卵')")]; box._qty = null; focusLog = []; w.selectAddResult(0, '朝食'); await sleep(80); t('after registering: input cleared, results closed, no focus', $('addSearch_朝食').value === '' && searchFocused() === 0 && $('addResultsBox_朝食').style.display !== 'block'); }
    // ── 他の入力欄を操作中は奪わない ──
    setup(); { const other = w.document.createElement('input'); other.type = 'text'; other.id = 'otherField'; w.document.body.appendChild(other); w.toggleAddPanel('朝食'); other.focus(); await sleep(80); t('another text field in use is not stolen on open', activeId() === 'otherField'); other.remove(); }
    // ── 数量シートを開いている間は奪わない ──
    setup(); await openPanel('朝食'); $('addSearch_朝食').blur(); w.openAmountSheetForEntry(1); focusLog = []; ev('renderRecord()'); await sleep(80); t('amount sheet open: no focus', searchFocused() === 0); w.closeAmountSheet();
    setup(); w.toggleAddPanel('朝食'); w.openAmountSheetForEntry(1); await sleep(80); t('open request is dropped while the sheet is open', searchFocused() === 0); w.closeAmountSheet();
    // ── 記録タブが見えていないときは、再描画してもフォーカスしない ──
    setup(); ev("activeAddMeal='朝食'"); w.switchTab('stats'); focusLog = []; ev('_focusAddSearchMeal=\'朝食\';renderRecord()'); await sleep(80); t('record tab hidden: never focus', searchFocused() === 0); t('one-shot flag is cleared', ev('_focusAddSearchMeal') === null);
    // ── 閉じる（✕）・日付移動 ──
    setup(); await openPanel('朝食'); focusLog = []; w.toggleAddPanel('朝食'); await sleep(60); t('close panel: no focus', searchFocused() === 0 && ev('activeAddMeal') === null || ev('activeAddMeal') === '朝食');
    // ── 既存の動作（検索・クイック選択）に影響がない ──
    setup(); w.toggleAddPanel('朝食'); await sleep(60); t('quick picks appear on the explicit focus (existing behavior)', $('addSearch_朝食') && ev('typeof onAddSearchFocus')==='function');
  } catch (err) { console.log('EXC', err.stack.split('\n').slice(0, 6).join(' | ')); process.exitCode = 1; }
  t.done(errs);
}, 800);
