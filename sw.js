// CACHE_VERSION はビルド時に自動更新されます（build.sh 参照）
// 手動デプロイ時は下の文字列を変更してください
const CACHE = 'pfc-memo-__BUILD_TS__';
const ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  // 即座に新しいSWを有効化（待機スキップ）
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // 古いキャッシュをすべて削除
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => {
        console.log('[SW] Deleting old cache:', k);
        return caches.delete(k);
      }))
    )
  );
  // すべてのタブを即座に新しいSWで制御
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  // 外部API・Firebaseはキャッシュしない
  if (url.includes('googleapis.com') ||
      url.includes('firebaseapp.com') ||
      url.includes('firestore.googleapis.com') ||
      url.includes('gstatic.com/firebasejs') ||
      url.includes('openfoodfacts') ||
      url.includes('.netlify/functions')) {
    return;
  }
  // Network First（最新を優先、失敗時にキャッシュ）
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // 成功時はキャッシュを更新
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
