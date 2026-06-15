// netlify/functions/garmin-auth-callback.js
// Garminから認証後にリダイレクトされるエンドポイント

const { OAuth } = require('oauth');

exports.handler = async (event) => {
  const { oauth_token, oauth_verifier } = event.queryStringParameters || {};
  const clientId     = process.env.GARMIN_CLIENT_ID;
  const clientSecret = process.env.GARMIN_CLIENT_SECRET;
  const siteUrl      = process.env.URL || 'http://localhost:8888';

  // Cookieからrequest_token_secretを取得
  const cookies = Object.fromEntries(
    (event.headers.cookie || '').split(';').map(c => c.trim().split('=').map(decodeURIComponent))
  );
  const tokenSecret = cookies['garmin_secret'];

  const oauth = new OAuth(
    'https://connectapi.garmin.com/oauth-service/oauth/request_token',
    'https://connectapi.garmin.com/oauth-service/oauth/access_token',
    clientId, clientSecret, '1.0',
    `${siteUrl}/.netlify/functions/garmin-auth-callback`,
    'HMAC-SHA1'
  );

  return new Promise((resolve) => {
    oauth.getOAuthAccessToken(oauth_token, tokenSecret, oauth_verifier, (err, accessToken, accessSecret) => {
      if (err) {
        resolve({ statusCode: 302, headers: { Location: `/?garmin_error=1` } });
        return;
      }
      // アクセストークンをまとめてクライアントに渡す（本番では暗号化推奨）
      const combined = Buffer.from(`${accessToken}:${accessSecret}`).toString('base64');
      resolve({
        statusCode: 302,
        headers: { Location: `/?garmin_token=${combined}` }
      });
    });
  });
};
