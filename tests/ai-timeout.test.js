// AIが時間切れ（HTMLエラーページ / 504）になったときの動作と、サーバー関数の時間切れ処理のテスト
const { loadApp, makeT, sleep } = require('./harness');
const { w, errs } = loadApp(); const t = makeT(); const ev = s => w.eval(s); const $ = id => w.document.getElementById(id);
const resp = (status, body, ctype) => ({ ok: status >= 200 && status < 300, status, text: async () => body });
const okBody = txt => JSON.stringify({ content: [{ type: 'text', text: txt }] });
const HTML504 = '<HTML><HEAD><meta http-equiv="content-type" content="text/html;charset=utf-8">\n<TITLE>504 Gateway Time-out</TITLE></HEAD><BODY>Gateway Time-out</BODY></HTML>';
const chat = () => $('aiChatBox').textContent;
async function ask(handler, text = 'テスト依頼') {
  const calls = []; w.fetch = async (url, opt) => { const body = JSON.parse(opt.body); calls.push(body); return handler(calls.length, body); };
  ev("aiHistory=[];errorLog=[]"); $('aiChatBox').innerHTML = ''; const toasts = []; w.showToast = m => toasts.push(m);
  $('aiInput').value = text; $('aiInput').disabled = false; await w.sendAiMessage(); await sleep(30);
  return { calls, toasts, log: ev("JSON.stringify(errorLog)") };
}
setTimeout(async () => {
  try {
    // ── クライアント ──
    let r = await ask(() => resp(200, okBody('こんにちは')));
    t('normal success: 1 call, no lite flag, reply shown', r.calls.length === 1 && !r.calls[0].lite && !/軽量モード/.test(r.calls[0].system) && /こんにちは/.test(chat()));
    r = await ask(n => n === 1 ? resp(504, HTML504) : resp(200, okBody('軽量で成功')));
    t('HTML 504 → exactly one automatic retry in lite mode', r.calls.length === 2 && r.calls[1].lite === true && /軽量モード/.test(r.calls[1].system) && !r.calls[0].lite);
    t('lite retry succeeds: reply is shown, no "Unexpected token" error', /軽量で成功/.test(chat()) && !/Unexpected token/.test(chat()) && !/通信エラー/.test(chat()));
    t('the user is told about the retry (toast) and the error log records HTTP status and body head', r.toasts.some(m => /軽量モードで再試行/.test(m)) && /HTTP 504/.test(r.log) && /Gateway Time-out/.test(r.log));
    t('the lite note asks for short output (no micros / yomi) and the original prompt is kept', /ミクロ栄養素・yomi・fa\/aa などは省略/.test(r.calls[1].system) && r.calls[1].system.startsWith(r.calls[0].system));
    r = await ask(n => n === 1 ? resp(200, '<html><body>index</body></html>') : resp(200, okBody('ok2')));
    t('HTML with HTTP 200 (e.g. the SPA fallback page, wrong route) is not a timeout: no retry, clear message', r.calls.length === 1 && /想定外の応答がありました（HTTP 200）/.test(chat()) && !/Unexpected token/.test(chat()));
    r = await ask(n => n === 1 ? resp(500, '<html><body>Task timed out after 10.00 seconds</body></html>') : resp(200, okBody('ok2b')));
    t('a body saying "timed out" is treated as a timeout even on HTTP 500', r.calls.length === 2 && /ok2b/.test(chat()));
    r = await ask(n => n === 1 ? resp(504, JSON.stringify({ error: 'AIの応答が制限時間（10秒）内に終わりませんでした。', timeout: true })) : resp(200, okBody('ok3')));
    t('server JSON {timeout:true} (504) → lite retry', r.calls.length === 2 && r.calls[1].lite === true && /ok3/.test(chat()));
    r = await ask(n => n === 1 ? resp(502, JSON.stringify({ errorMessage: 'Task timed out after 10.01 seconds' })) : resp(200, okBody('ok4')));
    t('502 JSON without a server error text (platform timeout) → lite retry', r.calls.length === 2 && /ok4/.test(chat()));
    r = await ask(() => resp(504, HTML504));
    t('both attempts time out: only 2 calls, friendly message with the status, never the raw JSON parse error', r.calls.length === 2 && /AIサーバーが時間内に応答しませんでした（HTTP 504）/.test(chat()) && /品目を分けて/.test(chat()) && !/Unexpected token/.test(chat()));
    t('failed final attempt is logged with HTTP and body', /AI通信/.test(r.log) && /HTTP 504/.test(r.log) && /<HTML>/.test(r.log));
    t('history is rolled back after the failure (aiHistory empty)', ev('aiHistory.length') === 0);
    r = await ask(() => resp(401, JSON.stringify({ error: 'Unauthorized' })));
    t('401 is not retried and shows the server message', r.calls.length === 1 && /Unauthorized/.test(chat()));
    r = await ask(() => resp(429, JSON.stringify({ error: 'リクエストが多すぎます（レート制限）。' })));
    t('429 (rate limit) is not retried (would waste quota)', r.calls.length === 1 && /レート制限/.test(chat()));
    r = await ask(() => resp(500, '<html><body>Internal Server Error</body></html>'));
    t('HTML 500 is not a timeout: no retry, but a clear message instead of a JSON parse error', r.calls.length === 1 && /想定外の応答がありました（HTTP 500）/.test(chat()) && !/Unexpected token/.test(chat()));
    // 自動の再確認(retryAi)も同じ仕組みを使う
    t('helper maps statuses', /時間内に応答しませんでした（HTTP 524）/.test(w.aiHttpErrorMessage(524, '')) && /想定外/.test(w.aiHttpErrorMessage(500, 'oops')) && /想定外/.test(w.aiHttpErrorMessage(200, '<html>')) && /時間内/.test(w.aiHttpErrorMessage(200, 'Gateway Time-out')));
    // ── プロンプト ──
    const src = require('fs').readFileSync(__dirname + '/../app.js', 'utf8');
    t('prompt rule: 4+ items → short output (cal/p/f/c, fiber, salt only)', /4件以上をまとめて登録する依頼では[\s\S]{0,120}時間切れ/.test(src));
    // ── サーバー関数（Netlify版 / Vercel版）──
    const path = require('path');
    const loadFn = (file, env) => { Object.assign(process.env, { GEMINI_API_KEY: 'k', AI_FUNCTION_TIMEOUT_SEC: env || '' }); const f = path.join(__dirname, '..', file); delete require.cache[require.resolve(f)]; return require(f); };
    const realFetch = global.fetch; let seen = null;
    const geminiOk = { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'hi' }] }, finishReason: 'STOP' }] }) };
    global.fetch = async (url, opt) => { seen = JSON.parse(opt.body); return geminiOk; };
    let nf = loadFn('netlify/functions/ai-chat.js'); let out = await nf.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ messages: [{ role: 'user', content: 'x' }] }) });
    t('netlify fn normal mode: thinking budget 1024, 16384 tokens', out.statusCode === 200 && seen.generationConfig.thinkingConfig.thinkingBudget === 1024 && seen.generationConfig.maxOutputTokens === 16384);
    out = await nf.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ lite: true, messages: [{ role: 'user', content: 'x' }] }) });
    t('netlify fn lite mode: thinking off, 8192 tokens, lower temperature', seen.generationConfig.thinkingConfig.thinkingBudget === 0 && seen.generationConfig.maxOutputTokens === 8192 && seen.generationConfig.temperature < 0.7);
    nf = loadFn('netlify/functions/ai-chat.js', '5');   // 上限5秒 → 3.5秒で打ち切り（最短）
    global.fetch = (url, opt) => new Promise((_, rej) => { opt.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; rej(e); }); });
    const t0 = Date.now(); out = await nf.handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ messages: [{ role: 'user', content: 'x' }] }) }); const el = Date.now() - t0;
    const o = JSON.parse(out.body);
    t('netlify fn: a stuck Gemini call is cut off before the platform limit and answered as JSON 504 {timeout:true}', out.statusCode === 504 && o.timeout === true && /制限時間（5秒）/.test(o.error) && /application\/json/.test(out.headers['Content-Type']) && el < 4500 && el >= 3000);
    // Vercel版
    global.fetch = async (url, opt) => { seen = JSON.parse(opt.body); return geminiOk; };
    const vres = () => { const r = { headers: {}, setHeader(k, v) { r.headers[k] = v; }, status(c) { r.code = c; return r; }, end() { return r; }, send(b) { r.body = b; return r; }, json(b) { r.body = JSON.stringify(b); return r; } }; return r; };
    let vf = loadFn('api/ai-chat.js', '5'); let vr = vres(); await vf({ method: 'POST', headers: {}, body: { lite: true, messages: [{ role: 'user', content: 'x' }] } }, vr);
    t('vercel fn lite mode: thinking off, 8192 tokens', seen.generationConfig.thinkingConfig.thinkingBudget === 0 && seen.generationConfig.maxOutputTokens === 8192);
    global.fetch = (url, opt) => new Promise((_, rej) => { opt.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; rej(e); }); });
    vr = vres(); await vf({ method: 'POST', headers: {}, body: { messages: [{ role: 'user', content: 'x' }] } }, vr);
    t('vercel fn: stuck Gemini call → JSON 504 {timeout:true}', vr.code === 504 && /"timeout":true/.test(vr.body || ''));
    global.fetch = realFetch; delete process.env.AI_FUNCTION_TIMEOUT_SEC;
    t.done(errs);
  } catch (x) { console.log('EXC', x); process.exit(1); }
}, 300);
