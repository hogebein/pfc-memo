// api/ai-chat.js — Vercel版
// Google Gemini API へのプロキシ
//
// Gemini の無料枠（2025年時点）:
//   gemini-2.5-flash : 10 RPM / 250 RPD / 入力100万トークン
//   gemini-2.5-flash-lite: 15 RPM / 1,000 RPD / 入力100万トークン（プレビュー・不安定）
// → 安定性を優先して gemini-2.5-flash を使用

const GEMINI_MODEL = 'gemini-2.5-flash';

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'Method Not Allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json(res, 500, { error: 'GEMINI_API_KEY が設定されていません。Vercel の環境変数を確認してください。' });
  }

  // Vercelは Content-Type: application/json のリクエストを自動でパースするが、
  // 文字列で来た場合にも対応しておく
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body || '{}'); } catch (e) { return json(res, 400, { error: 'Invalid JSON body' }); }
  }
  body = body || {};

  if (!body.messages || !Array.isArray(body.messages)) {
    return json(res, 400, { error: 'messages フィールドが必要です' });
  }

  const systemInstruction = body.system
    ? { parts: [{ text: body.system }] }
    : undefined;

  const contents = body.messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
  }));

  const geminiBody = {
    contents,
    ...(systemInstruction ? { systemInstruction } : {}),
    tools: [{ google_search: {} }],
    generationConfig: {
      maxOutputTokens: 8192,
      temperature: 0.7,
    },
  };

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      const code    = data.error?.code    || geminiRes.status;
      const message = data.error?.message || '';
      let userMsg;
      if (code === 429) {
        userMsg = 'リクエストが多すぎます（レート制限）。しばらく待ってから再度お試しください。\n無料枠: gemini-2.5-flash は1日250回まで。';
      } else if (code === 400 && message.includes('token')) {
        userMsg = 'コンテキストが長すぎます。会話履歴をリセットしてお試しください。';
      } else if (code === 403) {
        userMsg = 'APIキーが無効か権限がありません。GEMINI_API_KEY を確認してください。';
      } else if (code === 503 || code === 502) {
        userMsg = 'Gemini APIが一時的に利用できません。しばらく待ってから再度お試しください。';
      } else {
        userMsg = `Gemini APIエラー (${code}): ${message}`;
      }
      return json(res, geminiRes.status, { error: userMsg });
    }

    // finish_reason チェック（SAFETY など）
    const candidate = data.candidates?.[0];
    if (candidate?.finishReason === 'MAX_TOKENS') {
      return json(res, 200, {
        content: [{ type: 'text', text: `⚠️ 応答が長すぎて途中で切れました。一度に頼む量を減らす（例：品目数を分割する、日付範囲を短くする）と改善する場合があります。` }],
      });
    }
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
      return json(res, 200, {
        content: [{ type: 'text', text: `⚠️ 応答が中断されました（理由: ${candidate.finishReason}）。別の表現で試してください。` }],
      });
    }

    const text = candidate?.content?.parts?.map(p => p.text || '').join('') || '';
    return json(res, 200, { content: [{ type: 'text', text }] });

  } catch (err) {
    return json(res, 502, { error: `Gemini API への接続に失敗しました: ${err.message}` });
  }
};

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}
function json(res, status, obj) {
  res.status(status).setHeader('Content-Type', 'application/json');
  return res.send(JSON.stringify(obj));
}
