// google-health-daily.js
// Google Health API v4 から日次データを取得
//
// エンドポイント: https://health.googleapis.com/v4/users/-/dataTypes/{dataType}/dataPoints:dailyRollUp
// 仕様: https://developers.google.com/health/reference/rest
//
// 取得データ:
//   steps             : 歩数 (activity_and_fitness)
//   active-energy-burned : 活動消費カロリー (activity_and_fitness)
//   total-calories    : 総消費カロリー (activity_and_fitness)
//   daily-resting-heart-rate : 安静時心拍数 (health_metrics_and_measurements)
//   weight            : 体重 (health_metrics_and_measurements)

const BASE_URL = 'https://health.googleapis.com/v4';

exports.handler = async (event) => {
  const { date, token: tokenB64 } = event.queryStringParameters || {};
  const clientId     = process.env.GOOGLE_HEALTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_HEALTH_CLIENT_SECRET;

  if (!tokenB64) return { statusCode: 401, body: JSON.stringify({ error: 'No token' }) };

  let tokenData;
  try {
    tokenData = JSON.parse(Buffer.from(decodeURIComponent(tokenB64), 'base64').toString());
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid token format' }) };
  }

  // アクセストークンの有効期限チェック（期限切れなら refresh）
  let accessToken = tokenData.access_token;
  const expiresAt = tokenData.obtained_at + (tokenData.expires_in * 1000);
  if (Date.now() > expiresAt - 60000 && tokenData.refresh_token) {
    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: tokenData.refresh_token,
        client_id:     clientId,
        client_secret: clientSecret,
        grant_type:    'refresh_token',
      }).toString(),
    });
    if (refreshRes.ok) {
      const refreshed = await refreshRes.json();
      accessToken = refreshed.access_token;
      tokenData = { ...tokenData, access_token: accessToken, obtained_at: Date.now(), expires_in: refreshed.expires_in };
    }
  }

  const targetDate = date || new Date().toISOString().split('T')[0];

  // Google Health API dailyRollUp はクエリパラメータで日付範囲を指定
  // afterDate / beforeDate は "YYYY-MM-DD" 形式
  const headers = { Authorization: `Bearer ${accessToken}` };

  async function fetchDailyRollUp(dataType) {
    const url = `${BASE_URL}/users/-/dataTypes/${dataType}/dataPoints:dailyRollUp` +
      `?afterDate=${targetDate}&beforeDate=${targetDate}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const json = await res.json();
    return (json.dataPoints || [])[0] || null;
  }

  async function fetchList(dataType) {
    const url = `${BASE_URL}/users/-/dataTypes/${dataType}/dataPoints:list` +
      `?afterDate=${targetDate}&beforeDate=${targetDate}&sort=desc&limit=1`;
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const json = await res.json();
    return (json.dataPoints || [])[0] || null;
  }

  try {
    const [stepsData, activeCalData, totalCalData, hrData, weightData] = await Promise.all([
      fetchDailyRollUp('steps'),
      fetchDailyRollUp('active-energy-burned'),
      fetchDailyRollUp('total-calories'),
      fetchList('daily-resting-heart-rate'),
      fetchList('weight'),
    ]);

    // Google Health API のレスポンスからフィールドを取り出す
    // steps: value.intVal
    // calories: value.fpVal (kcal)
    // heart rate: value.fpVal (bpm)
    // weight: value.fpVal (kg)
    const steps          = stepsData?.value?.intVal ?? stepsData?.value?.fpVal ?? 0;
    const activeCalories = activeCalData?.value?.fpVal ?? 0;
    const totalCalories  = totalCalData?.value?.fpVal ?? 0;
    const restingHR      = hrData?.value?.fpVal ?? null;
    const weight         = weightData?.value?.fpVal ?? null;

    // 更新されたtokenをクライアントへ返す（リフレッシュした場合）
    const newTokenB64 = Buffer.from(JSON.stringify(tokenData)).toString('base64');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: targetDate,
        steps:           Math.round(steps),
        activeCalories:  Math.round(activeCalories),
        totalCalories:   Math.round(totalCalories),
        restingHeartRate: restingHR ? Math.round(restingHR) : null,
        weight:           weight ? Math.round(weight * 10) / 10 : null,
        // リフレッシュしたトークンをクライアントが保存できるよう返す
        updatedToken: newTokenB64,
      })
    };
  } catch(e) {
    console.error('Google Health API error:', e);
    return { statusCode: 502, body: JSON.stringify({ error: e.message }) };
  }
};
