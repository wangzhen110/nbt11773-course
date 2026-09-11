/* NB/T 11773—2025 课程 · Service Worker
 * 策略：
 *   - 页面(HTML 导航请求) → network-first：联网时总能拿到最新版，断网回退缓存
 *   - 静态资源(CSS/JS/图标) → cache-first：秒开，靠 CACHE 版本号控制更新
 * 注意：每次改动站点文件后必须递增 CACHE_VERSION，否则老用户会一直看到旧缓存。
 */
const CACHE_VERSION = 'v2';
const CACHE = 'nbt11773-' + CACHE_VERSION;

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './data/ch01.js', './data/ch02.js', './data/ch03.js', './data/ch04.js',
  './data/ch05.js', './data/ch06.js', './data/ch07.js', './data/ch08.js',
  './data/ch09.js', './data/fill.js', './data/kb.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const sameOrigin = req.url.startsWith(self.location.origin);
  if (!sameOrigin) return;

  // 页面请求：优先联网拿最新版
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('./index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html').then((hit) => hit || caches.match('./')))
    );
    return;
  }

  // 静态资源：缓存优先
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => new Response('', { status: 504, statusText: 'Offline' }));
    })
  );
});
