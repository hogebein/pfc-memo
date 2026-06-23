// ai-chat.js
// Anthropic API へのプロキシ
// APIキーをサーバー側（環境変数）で保持し、ブラウザに露出させない
//
// エンドポイント: /.netlify/functions/ai-chat
// メソッド: POST
// ボディ: { model, max_tokens, system, messages }

exports.handler = async (event) => {
  // CORS プリフライト対応
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders(),
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json(500, { error: 'ANTHROPIC_API_KEY が設定されていません。Netlify の環境変数を確認してください。' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Invalid JSON body' });
  }

  // 必須フィールドの検証
  if (!body.messages || !Array.isArray(body.messages)) {
    return json(400, { error: 'messages フィールドが必要です' });
  }

  // Anthropic API へ転送
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      body.model      || 'claude-sonnet-4-6',
        max_tokens: body.max_tokens || 1500,
        system:     body.system     || '',
        messages:   body.messages,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      // Anthropic 側のエラーをそのまま返す
      return json(res.status, { error: data.error?.message || 'Anthropic API エラー', detail: data });
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
      body: JSON.stringify(data),
    };

  } catch (err) {
    return json(502, { error: `Anthropic API への接続に失敗しました: ${err.message}` });
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
