// api/google-health-auth-callback.js — Vercel版
// Google OAuth 2.0 コールバック → authorization code を access/refresh token に交換

module.exports = async (req, res) => {
  const { code, state, error } = req.query || {};
  const clientId     = process.env.GOOGLE_HEALTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_HEALTH_CLIENT_SECRET;
  const siteUrl      = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;

  if (error) {
    return res.redirect(302, `/?gh_error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    res.status(400).setHeader('Content-Type', 'application/json');
    return res.send(JSON.stringify({ error: 'Missing code' }));
  }

  // state検証（CSRF対策）
  const cookies = Object.fromEntries(
    (req.headers.cookie || '').split(';')
      .map(c => c.trim().split('=').map(s => decodeURIComponent(s.trim())))
      .filter(([k]) => k)
  );
  if (cookies['gh_state'] !== state) {
    return res.redirect(302, '/?gh_error=state_mismatch');
  }

  const redirectUri = `${siteUrl}/api/google-health-auth-callback`;

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
    return res.redirect(302, '/?gh_error=token_exchange_failed');
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

  res.setHeader('Set-Cookie', 'gh_state=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  return res.redirect(302, `/?gh_token=${encodeURIComponent(combined)}`);
};
