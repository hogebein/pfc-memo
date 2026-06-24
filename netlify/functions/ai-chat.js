// ai-chat.js
// Google Gemini API へのプロキシ（無料枠あり・クレジットカード不要）
// APIキーをサーバー側（環境変数）で保持し、ブラウザに露出させない
//
// エンドポイント: /.netlify/functions/ai-chat
// メソッド: POST
// ボディ: { system, messages: [{role, content}] }
//
// Gemini の無料枠（2025年時点）:
//   gemini-2.5-flash : 10 RPM / 250 RPD
//   gemini-2.5-flash-lite: 15 RPM / 1,000 RPD

const GEMINI_MODEL = 'gemini-2.5-flash-lite'; // 無料枠が最も広いモデル

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

  // Anthropic形式 → Gemini形式 に変換
  // system は Gemini では systemInstruction に分離
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
      maxOutputTokens: 1500,
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
      const errMsg = data.error?.message || `Gemini API エラー (${res.status})`;
      return json(res.status, { error: errMsg, detail: data });
    }

    // Gemini レスポンス → Anthropic互換形式 に変換してアプリ側の解析を共通化
    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    const compatible = {
      content: [{ type: 'text', text }],
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      body: JSON.stringify(compatible),
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
