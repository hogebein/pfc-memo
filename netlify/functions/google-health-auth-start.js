// google-health-auth-start.js
// Google Health API (health.googleapis.com/v4/) OAuth 2.0 認証開始
// Fitbit Web APIの後継。Google Cloud ConsoleでOAuthクライアントIDを取得して使用
//
// 環境変数:
//   GOOGLE_HEALTH_CLIENT_ID     - Google Cloud Console で発行
//   GOOGLE_HEALTH_CLIENT_SECRET - Google Cloud Console で発行
//   URL                         - Netlifyが自動設定するサイトURL

exports.handler = async (event) => {
  const clientId = process.env.GOOGLE_HEALTH_CLIENT_ID;
  const siteUrl  = process.env.URL || 'http://localhost:8888';

  if (!clientId) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'GOOGLE_HEALTH_CLIENT_ID が設定されていません' })
    };
  }

  const redirectUri = `${siteUrl}/.netlify/functions/google-health-auth-callback`;

  // Google Health API に必要なスコープ
  const scopes = [
    'https://www.googleapis.com/auth/health.activity_and_fitness',      // 歩数・消費カロリー・運動
    'https://www.googleapis.com/auth/health.health_metrics_and_measurements', // 心拍数・体重・体脂肪
    'https://www.googleapis.com/auth/health.sleep',                     // 睡眠
  ].join(' ');

  // PKCE用 code_verifier を生成（サーバーレスなのでシンプルにstate管理）
  const state = Math.random().toString(36).substring(2, 15);

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('access_type', 'offline');   // refresh_token を取得
  authUrl.searchParams.set('prompt', 'consent');        // 毎回consent → refresh_token確実取得
  authUrl.searchParams.set('state', state);

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `gh_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`,
    },
    body: JSON.stringify({ authUrl: authUrl.toString() })
  };
};
