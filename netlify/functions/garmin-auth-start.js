// netlify/functions/garmin-auth-start.js
// 環境変数: GARMIN_CLIENT_ID, GARMIN_CLIENT_SECRET, URL（自動設定）
//
// Garmin は OAuth 1.0a を使用します。
// npm install oauth を実行してから使用してください。

const { OAuth } = require('oauth');

exports.handler = async (event) => {
  const clientId     = process.env.GARMIN_CLIENT_ID;
  const clientSecret = process.env.GARMIN_CLIENT_SECRET;
  const siteUrl      = process.env.URL || 'http://localhost:8888';

  if (!clientId || !clientSecret) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Garmin credentials not set' }) };
  }

  const oauth = new OAuth(
    'https://connectapi.garmin.com/oauth-service/oauth/request_token',
    'https://connectapi.garmin.com/oauth-service/oauth/access_token',
    clientId,
    clientSecret,
    '1.0',
    `${siteUrl}/.netlify/functions/garmin-auth-callback`,
    'HMAC-SHA1'
  );

  return new Promise((resolve) => {
    oauth.getOAuthRequestToken((err, token, secret) => {
      if (err) {
        resolve({ statusCode: 500, body: JSON.stringify({ error: err.message }) });
        return;
      }
      // secret は本来セッションに保存すべきですが、簡易実装として Cookie に持たせます
      const authUrl = `https://connect.garmin.com/oauthConfirm?oauth_token=${token}`;
      resolve({
        statusCode: 200,
        headers: {
          'Set-Cookie': `garmin_secret=${secret}; Path=/; HttpOnly; SameSite=Lax`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ authUrl })
      });
    });
  });
};
