// api/google-health-auth-start.js — Vercel版
// Google Health API (health.googleapis.com/v4/) OAuth 2.0 認証開始
//
// 環境変数:
//   GOOGLE_HEALTH_CLIENT_ID     - Google Cloud Console で発行
//   GOOGLE_HEALTH_CLIENT_SECRET - Google Cloud Console で発行（callback側で使用）

const crypto = require('crypto');

module.exports = async (req, res) => {
  const clientId = process.env.GOOGLE_HEALTH_CLIENT_ID;
  const siteUrl  = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;

  if (!clientId) {
    res.status(500).setHeader('Content-Type', 'application/json');
    return res.send(JSON.stringify({ error: 'GOOGLE_HEALTH_CLIENT_ID が設定されていません' }));
  }

  const redirectUri = `${siteUrl}/api/google-health-auth-callback`;

  // Google Health API に必要なスコープ
  const scopes = [
    'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',      // 歩数・消費カロリー・運動
    'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly', // 心拍数・体重・体脂肪
    'https://www.googleapis.com/auth/googlehealth.sleep.readonly',                     // 睡眠
  ].join(' ');

  // CSRF対策用 state を暗号学的に安全な乱数で生成
  const state = crypto.randomBytes(16).toString('hex');

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('access_type', 'offline');   // refresh_token を取得
  authUrl.searchParams.set('prompt', 'consent');        // 毎回consent → refresh_token確実取得
  authUrl.searchParams.set('state', state);

  res.status(200);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Set-Cookie', `gh_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);
  return res.send(JSON.stringify({ authUrl: authUrl.toString() }));
};
