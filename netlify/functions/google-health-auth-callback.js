// google-health-auth-callback.js
// Google OAuth 2.0 コールバック → authorization code を access/refresh token に交換

exports.handler = async (event) => {
  const { code, state, error } = event.queryStringParameters || {};
  const clientId     = process.env.GOOGLE_HEALTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_HEALTH_CLIENT_SECRET;
  const siteUrl      = process.env.URL || 'http://localhost:8888';

  if (error) {
    return { statusCode: 302, headers: { Location: `/?gh_error=${encodeURIComponent(error)}` } };
  }
  if (!code) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing code' }) };
  }

  // state検証（CSRF対策）
  const cookies = Object.fromEntries(
    (event.headers.cookie || '').split(';')
      .map(c => c.trim().split('=').map(s => decodeURIComponent(s.trim())))
      .filter(([k]) => k)
  );
  if (cookies['gh_state'] !== state) {
    return { statusCode: 302, headers: { Location: '/?gh_error=state_mismatch' } };
  }

  const redirectUri = `${siteUrl}/.netlify/functions/google-health-auth-callback`;

  // authorization code → tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  redirectUri,
      grant_type:    'authorization_code',
    }).toString(),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error('Token exchange failed:', err);
    return { statusCode: 302, headers: { Location: '/?gh_error=token_exchange_failed' } };
  }

  const tokens = await tokenRes.json();
  // access_token + refresh_token をBase64でクライアントに渡す
  // 本番では暗号化・サーバーサイドセッション推奨
  const combined = Buffer.from(JSON.stringify({
    access_token:  tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_in:    tokens.expires_in,
    obtained_at:   Date.now(),
  })).toString('base64');

  return {
    statusCode: 302,
    headers: {
      Location: `/?gh_token=${encodeURIComponent(combined)}`,
      'Set-Cookie': 'gh_state=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    }
  };
};
