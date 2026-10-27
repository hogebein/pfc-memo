// AIプロンプトの雛形（チャット欄へコピー・複数登録・編集・並べ替え・削除・初期化・クラウド同期）のテスト。
// 実行: npm install --no-save jsdom && node tests/prompt-templates.test.js
const { loadApp, makeT, sleep } = require('./harness');
const { w, errs } = loadApp(); const t = makeT(); const ev = s => w.eval(s); const $ = id => w.document.getElementById(id);
setTimeout(async () => {
  try {
    w.confirm = () => true;
    let sent = 0; w.fetch = async () => { sent++; return { ok: true, status: 200, json: async () => ({ content: [{ text: 'ok' }] }) }; };
    const chips = () => [...$('promptChips').querySelectorAll('.prompt-chip')]; const titles = () => ev('promptTemplates.map(t=>t.title)'); const undo = () => $('toast').querySelector('.toast-undo-btn').click();
    const stored = () => JSON.parse(w.localStorage.getItem('pfcPromptTemplates') || 'null');
    // ── 旧ボタンの撤去と初期の雛形 ──
    t('old instant-send buttons removed', !/週の分析|今日のチェック|1ヶ月の傾向/.test(w.document.body.innerHTML) && typeof w.sendQuickAiPrompt === 'undefined');
    const d = ev('DEFAULT_PROMPT_TEMPLATES'); t('defaults: several useful templates', d.length >= 8 && chips().length === d.length);
    t('defaults: registration templates included', d.some(x => /食品を登録/.test(x.title)) && d.some(x => /成分表示/.test(x.title)) && d.some(x => /複合食品/.test(x.title)) && d.some(x => /記録/.test(x.title)));
    t('defaults: unique ids/titles, within limits', new Set(d.map(x => x.id)).size === d.length && new Set(d.map(x => x.title)).size === d.length && d.every(x => x.title.length <= 24 && x.text.length <= 2000 && x.text.trim()));
    t('defaults: none mention analysis prompts', !d.some(x => /週の分析|1ヶ月の傾向|今日のチェック/.test(x.title + x.text)));
    // ── タップでチャット欄にコピー（送信しない）──
    const inp = $('aiInput'); inp.value = '';
    const first = chips()[0]; first.click(); await sleep(20);
    t('tap copies template text into the input', inp.value === d[0].text); t('tap does not send', sent === 0 && !$('aiChatBox').children.length);
    const m = /【[^】]*】/.exec(d[0].text); t('first 【…】 is selected for typing', inp.selectionStart === m.index && inp.selectionEnd === m.index + m[0].length && inp.value.slice(inp.selectionStart, inp.selectionEnd) === m[0]);
    // 入力済みなら改行して追加
    inp.value = '既に書いた文章'; chips()[3].click(); t('append after existing text with newline', inp.value === '既に書いた文章\n' + d[3].text);
    const m3 = /【[^】]*】/.exec(d[3].text), off = '既に書いた文章\n'.length; t('selection offset accounts for prefix', inp.selectionStart === off + m3.index);
    // 【】が無い雛形はカーソルを末尾に
    ev(`promptTemplates.push({id:'x1',title:'固定',text:'固定の文章です'});renderPromptTemplates()`); inp.value = ''; chips().find(c => c.textContent === '固定').click(); t('no placeholder: caret at end', inp.value === '固定の文章です' && inp.selectionStart === inp.value.length && inp.selectionEnd === inp.value.length);
    ev(`promptTemplates=promptTemplates.filter(t=>t.id!=='x1');renderPromptTemplates()`);
    // 送信すると入力欄はクリアされる（雛形の送信は通常の送信と同じ）
    inp.value = chips()[0].textContent ? d[0].text : ''; await w.sendAiMessage(); await sleep(30); t('sending works as usual and clears input', sent >= 1 && inp.value === '');
    // ── 管理画面 ──
    t('manager closed by default', $('promptMgr').innerHTML === ''); w.togglePromptMgr(); t('manager opens with list', /プロンプトの雛形/.test($('promptMgr').textContent) && $('promptMgr').querySelectorAll('.fd-bulk-row').length === d.length);
    // 追加
    w.editPromptTemplate('new'); t('new form shown', !!$('ptTitle') && !!$('ptText'));
    $('ptTitle').value = ''; $('ptText').value = '本文'; w.savePromptTemplateForm(); t('validation: title required', /名前を入力/.test($('ptMsg').textContent) && titles().length === d.length);
    $('ptTitle').value = '自作'; $('ptText').value = '   '; w.savePromptTemplateForm(); t('validation: text required', /文章を入力/.test($('ptMsg').textContent));
    $('ptTitle').value = '📦 自作の雛形'; $('ptText').value = '【食品】を登録して\n2行目'; w.savePromptTemplateForm();
    t('added at the end + chip appears', titles()[titles().length - 1] === '📦 自作の雛形' && chips().length === d.length + 1 && stored().length === d.length + 1);
    // 編集
    const id = ev('promptTemplates[promptTemplates.length-1].id'); w.editPromptTemplate(id); t('edit form prefilled', $('ptTitle').value === '📦 自作の雛形' && /2行目/.test($('ptText').value));
    $('ptTitle').value = '📦 改名'; $('ptText').value = '変更後'; w.savePromptTemplateForm(); t('edit saved', ev(`promptTemplates.find(t=>t.id==='${id}').title`) === '📦 改名' && ev(`promptTemplates.find(t=>t.id==='${id}').text`) === '変更後' && stored().find(x => x.id === id).text === '変更後');
    w.editPromptTemplate(id); w.cancelPromptEdit(); t('cancel keeps data', ev(`promptTemplates.find(t=>t.id==='${id}').title`) === '📦 改名' && !$('ptTitle'));
    // 並べ替え
    w.movePromptTemplate(id, -1); t('move up', titles()[titles().length - 2] === '📦 改名'); w.movePromptTemplate(id, 1); t('move down', titles()[titles().length - 1] === '📦 改名');
    w.movePromptTemplate(id, 1); t('move down at end: no-op', titles()[titles().length - 1] === '📦 改名'); const firstId = ev('promptTemplates[0].id'); w.movePromptTemplate(firstId, -1); t('move up at top: no-op', ev('promptTemplates[0].id') === firstId);
    t('order persisted', stored().map(x => x.id).join() === ev('promptTemplates.map(t=>t.id).join()'));
    // 削除と元に戻す
    const n = titles().length; w.deletePromptTemplate(id); t('delete', titles().length === n - 1 && chips().length === n - 1 && stored().length === n - 1); undo(); t('undo delete restores in place', titles().length === n && titles()[n - 1] === '📦 改名');
    // 入力欄の内容を雛形に保存
    inp.value = ''; w.savePromptFromInput(); t('save-from-input needs text', !$('ptTitle')); inp.value = '今日の【食事】を分析して'; w.savePromptFromInput(); t('save-from-input opens form prefilled', $('ptText').value === '今日の【食事】を分析して' && $('ptTitle').value === '');
    $('ptTitle').value = '📊 分析（自作）'; w.savePromptTemplateForm(); t('saved from input', titles().includes('📊 分析（自作）') && ev(`promptTemplates.find(t=>t.title==='📊 分析（自作）').text`) === '今日の【食事】を分析して');
    // 初期化と元に戻す
    const before = ev('JSON.stringify(promptTemplates)'); w.resetPromptTemplates(); t('reset to defaults', titles().join() === d.map(x => x.title).join()); undo(); t('undo reset', ev('JSON.stringify(promptTemplates)') === before);
    // 上限・長さ・HTMLのエスケープ
    ev(`promptTemplates=Array.from({length:50},(_, i)=>({id:'m'+i,title:'t'+i,text:'x'}));renderPromptTemplates()`); w.editPromptTemplate('new'); $('ptTitle').value = 'overflow'; $('ptText').value = 'y'; w.savePromptTemplateForm(); t('max 50 templates', /最大50個/.test($('ptMsg').textContent) && ev('promptTemplates.length') === 50);
    ev(`promptTemplates=[{id:'h1',title:'<b>太字</b>"引用"',text:'<img src=x onerror=alert(1)>【a】'}];renderPromptTemplates()`); t('titles are escaped (no HTML injection)', !$('promptChips').querySelector('b') && !$('promptMgr').querySelector('img') && !$('promptChips').querySelector('img') && /<b>太字<\/b>/.test($('promptChips').textContent));
    inp.value = ''; chips()[0].click(); t('escaped title/text still copies verbatim', inp.value === '<img src=x onerror=alert(1)>【a】');
    // sanitize
    const sn = w.sanitizePromptTemplates([{ id: 'a', title: '  ok  ', text: 'T' }, { id: 'a', title: 'dup id', text: 'T2' }, { title: '', text: 'no title' }, { title: 'no text', text: '  ' }, null, 5, { title: 'x'.repeat(40), text: 'y'.repeat(3000) }]);
    t('sanitize: trims, dedupes ids, drops invalid, clamps lengths', sn.length === 3 && sn[0].title === 'ok' && sn[0].id !== sn[1].id && sn[2].title.length === 24 && sn[2].text.length === 2000); t('sanitize: non-array → null', w.sanitizePromptTemplates('x') === null && w.sanitizePromptTemplates(undefined) === null);
    // ── 永続化（再読み込み）──
    ev(`promptTemplates=[{id:'p1',title:'保存テスト',text:'本文【a】'}];savePromptTemplates()`); { const { w: w2 } = loadApp({ beforeParse(win) { win.localStorage.setItem('pfcPromptTemplates', w.localStorage.getItem('pfcPromptTemplates')); } }); await sleep(600); t('reload restores saved templates', w2.document.querySelectorAll('#promptChips .prompt-chip').length === 1 && w2.document.querySelector('#promptChips .prompt-chip').textContent === '保存テスト'); }
    { const { w: w3 } = loadApp({ beforeParse(win) { win.localStorage.setItem('pfcPromptTemplates', '{broken json'); } }); await sleep(600); t('corrupt storage falls back to defaults', w3.document.querySelectorAll('#promptChips .prompt-chip').length === d.length); }
    // ── クラウド同期 ──
    let calls = [], cloudDoc = null; w.__fsApi = { doc: () => ({}), setDoc: async (r, p) => { calls.push(JSON.parse(JSON.stringify(p))); cloudDoc = JSON.parse(JSON.stringify(p)); }, getDoc: async () => ({ exists: () => !!cloudDoc, data: () => JSON.parse(JSON.stringify(cloudDoc)) }) };
    ev("fbDb={};fbUser={uid:'u'};initialSyncDone=true;cloudDirty=false;_cloudInFlight=false"); ev(`promptTemplates=[{id:'c1',title:'同期',text:'本文'}];savePromptTemplates()`); await sleep(900);
    t('templates saved to cloud (debounced)', calls.length >= 1 && calls[calls.length - 1].promptTemplates.length === 1 && calls[calls.length - 1].promptTemplates[0].title === '同期');
    // クラウドの雛形を読み込む
    ev(`applyCloudData(${JSON.stringify({ entries: [], promptTemplates: [{ id: 'z1', title: '他端末の雛形', text: '本文' }, { id: 'z2', title: '2つ目', text: 'T' }], updatedAt: '2099' })})`);
    t('cloud templates applied + persisted + rendered', titles().join() === '他端末の雛形,2つ目' && stored().length === 2 && chips().length === 2);
    // クラウドに無い（古い文書）& 端末に保存済み → 送り直す対象
    t('old cloud doc without templates: keep local & flag upload', ev(`applyCloudData({entries:[],updatedAt:'2099'})`) === true && titles().join() === '他端末の雛形,2つ目');
    // 壊れたクラウドデータは無視
    ev(`applyCloudData({entries:[],promptTemplates:'broken',updatedAt:'2099'})`); t('invalid cloud templates ignored', titles().length === 2);
    // 複数端末: 空の配列は「全部削除した」状態として反映（雛形なしの表示）
    ev(`applyCloudData({entries:[],promptTemplates:[],updatedAt:'2099'})`); t('empty cloud list = user deleted all (shows hint)', titles().length === 0 && /雛形がありません/.test($('promptChips').textContent));
  } catch (err) { console.log('EXC', err.stack.split('\n').slice(0, 5).join(' | ')); process.exitCode = 1; }
  t.done(errs);
}, 800);
