// ai-chat.js
// Google Gemini API へのプロキシ
//
// Gemini の無料枠（2025年時点）:
//   gemini-2.5-flash : 10 RPM / 250 RPD / 入力100万トークン
//   gemini-2.5-flash-lite: 15 RPM / 1,000 RPD / 入力100万トークン（プレビュー・不安定）
// → 安定性を優先して gemini-2.5-flash を使用

const GEMINI_MODEL = 'gemini-2.5-flash';

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json(500, { error: 'GEMINI_API_KEY が設定されていません。Netlify の環境変数を確認してください。' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Invalid JSON body' });
  }

  if (!body.messages || !Array.isArray(body.messages)) {
    return json(400, { error: 'messages フィールドが必要です' });
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
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.7,
    },
  };

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    const data = await res.json();

    if (!res.ok) {
      // Gemini エラーを日本語で分かりやすく返す
      const code    = data.error?.code    || res.status;
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
      return json(res.status, { error: userMsg });
    }

    // finish_reason チェック（SAFETY など）
    const candidate = data.candidates?.[0];
    if (candidate?.finishReason && candidate.finishReason !== 'STOP' && candidate.finishReason !== 'MAX_TOKENS') {
      return json(200, {
        content: [{ type: 'text', text: `⚠️ 応答が中断されました（理由: ${candidate.finishReason}）。別の表現で試してください。` }],
      });
    }

    const text = candidate?.content?.parts?.map(p => p.text || '').join('') || '';
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      body: JSON.stringify({ content: [{ type: 'text', text }] }),
    };

  } catch (err) {
    return json(502, { error: `Gemini API への接続に失敗しました: ${err.message}` });
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}
function json(status, obj) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    body: JSON.stringify(obj),
  };
}
