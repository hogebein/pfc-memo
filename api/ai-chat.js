// api/ai-chat.js — Vercel版
// Google Gemini API へのプロキシ
//
// Gemini の無料枠（2025年時点）:
//   gemini-2.5-flash : 10 RPM / 250 RPD / 入力100万トークン
//   gemini-2.5-flash-lite: 15 RPM / 1,000 RPD / 入力100万トークン（プレビュー・不安定）
// → 安定性を優先して gemini-2.5-flash を使用

const GEMINI_MODEL = 'gemini-2.5-flash';

// 関数の実行時間には上限がある（Vercelの無料枠は既定10秒）。超えるとプラットフォームがHTMLのエラーページを返し、
// アプリ側で「Unexpected token '<'」になっていたため、上限の少し手前で待機を打ち切って JSON で「時間切れ(504)」を返す。
// 上限を延ばした場合は環境変数 AI_FUNCTION_TIMEOUT_SEC に秒数を入れる。
const FUNCTION_LIMIT_SEC = Math.max(5, Number(process.env.AI_FUNCTION_TIMEOUT_SEC) || 10);
const GEMINI_WAIT_MS = Math.max(3000, FUNCTION_LIMIT_SEC * 1000 - 1500);

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'Method Not Allowed' });

  // 任意の簡易認証: APP_ACCESS_TOKEN が設定されている場合のみ、
  // クライアントの X-App-Token ヘッダーとの一致を要求する（無料枠の乱用対策）
  const requiredToken = process.env.APP_ACCESS_TOKEN;
  if (requiredToken && req.headers['x-app-token'] !== requiredToken) {
    return json(res, 401, { error: 'Unauthorized' });
  }

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

  const contents = body.messages.map(m => {
    if (m.parts) {
      return { role: m.role === 'assistant' ? 'model' : m.role, parts: m.parts };
    }
    return {
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
    };
  });

  const geminiBody = {
    contents,
    ...(systemInstruction ? { systemInstruction } : {}),
    tools: [{
      functionDeclarations: [{
        name: 'search_food_db',
        description: 'ユーザーの内蔵食品データベースおよびカスタム食品DBを、食品名の一部で検索する。「〇〇は登録されている？」のような質問、栄養価が分からない食品の確認、記録追加の前の下調べに使う。',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: { type: 'STRING', description: '検索キーワード（食品名の一部。ひらがな・カタカナ・漢字いずれでも可）' },
          },
          required: ['query'],
        },
      }],
    }],
    generationConfig: {
      // gemini-2.5-flash は既定で「思考」を行い、その思考トークンも maxOutputTokens に含まれる。
      // 上限が小さいと、思考で使い切って本文（操作用JSON）が途中で切れる（MAX_TOKENS）ため、
      // 思考量に上限を設けつつ出力上限を広げる
      // lite: 時間切れの再試行用。思考を止め、出力上限を下げて速く返す
      maxOutputTokens: body.lite ? 8192 : 16384,
      thinkingConfig: { thinkingBudget: body.lite ? 0 : 1024 },
      temperature: body.lite ? 0.4 : 0.7,
    },
  };

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), GEMINI_WAIT_MS);
    let geminiRes;
    try {
      geminiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody),
        signal: ctrl.signal,
      });
    } finally { clearTimeout(timer); }

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
        finishReason: 'MAX_TOKENS',
        usage: data.usageMetadata || null,
      });
    }
    if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
      return json(res, 200, {
        content: [{ type: 'text', text: `⚠️ 応答が中断されました（理由: ${candidate.finishReason}）。別の表現で試してください。` }],
      });
    }

    const text = candidate?.content?.parts?.map(p => p.text || '').join('') || '';
    const functionCallPart = candidate?.content?.parts?.find(p => p.functionCall);
    if (functionCallPart) {
      return json(res, 200, { functionCall: functionCallPart.functionCall });
    }
    return json(res, 200, { content: [{ type: 'text', text }], usage: data.usageMetadata || null });

  } catch (err) {
    if (err && err.name === 'AbortError') {
      return json(res, 504, { error: `AIの応答が制限時間（${FUNCTION_LIMIT_SEC}秒）内に終わりませんでした。出力が長い依頼は時間切れになりやすいため、品目を分けてお試しください。`, timeout: true });
    }
    return json(res, 502, { error: `Gemini API への接続に失敗しました: ${err.message}` });
  }
};

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-App-Token');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}
function json(res, status, obj) {
  res.status(status).setHeader('Content-Type', 'application/json');
  return res.send(JSON.stringify(obj));
}
