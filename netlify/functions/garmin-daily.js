// netlify/functions/garmin-daily.js
// その日の歩数・消費カロリー・安静時代謝をGarmin APIから取得

const { OAuth } = require('oauth');

exports.handler = async (event) => {
  const { date, token } = event.queryStringParameters || {};
  const clientId     = process.env.GARMIN_CLIENT_ID;
  const clientSecret = process.env.GARMIN_CLIENT_SECRET;

  if (!token) return { statusCode: 401, body: JSON.stringify({ error: 'No token' }) };

  // base64デコードして accessToken:accessSecret に分割
  const [accessToken, accessSecret] = Buffer.from(token, 'base64').toString().split(':');

  const oauth = new OAuth(
    'https://connectapi.garmin.com/oauth-service/oauth/request_token',
    'https://connectapi.garmin.com/oauth-service/oauth/access_token',
    clientId, clientSecret, '1.0', null, 'HMAC-SHA1'
  );

  const targetDate = date || new Date().toISOString().split('T')[0];

  // Garmin Wellness API — Daily Summary
  const url = `https://apis.garmin.com/wellness-api/rest/dailies?uploadStartTimeInSeconds=${toUnix(targetDate)}&uploadEndTimeInSeconds=${toUnix(targetDate, true)}`;

  return new Promise((resolve) => {
    oauth.get(url, accessToken, accessSecret, (err, data) => {
      if (err) {
        resolve({ statusCode: 502, body: JSON.stringify({ error: err.message }) });
        return;
      }
      try {
        const parsed = JSON.parse(data);
        const day = (parsed.dailies || [])[0] || {};
        resolve({
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            steps:          day.steps          || 0,
            activeCalories: day.activeKilocalories || 0,
            bmr:            day.bmrKilocalories    || 0,
            avgHeartRate:   day.averageHeartRateInBeatsPerMinute || null,
            maxHeartRate:   day.maxHeartRateInBeatsPerMinute     || null,
          })
        });
      } catch(e) {
        resolve({ statusCode: 500, body: JSON.stringify({ error: 'Parse error' }) });
      }
    });
  });
};

function toUnix(dateStr, endOfDay = false) {
  const d = new Date(dateStr + 'T00:00:00Z');
  if (endOfDay) d.setUTCHours(23, 59, 59);
  return Math.floor(d.getTime() / 1000);
}
