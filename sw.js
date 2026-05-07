// Hello AI Service Worker v2.0
// 策略：Network First（HTML）+ Cache First（MediaPipe）+ Stale While Revalidate（其他静态资源）

const CACHE_NAME = 'hello-ai-v4';
const RUNTIME_CACHE = 'hello-ai-runtime-v4';

// 预缓存：核心资源（小文件）
const PRECACHE_URLS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/managers/toast.js',
  './js/managers/settings.js',
  './js/managers/speech.js',
  './js/managers/camera.js',
  './js/utils/dom.js',
  './js/utils/feature-extractor.js',
  './js/utils/gesture-recognizer.js',
  './js/utils/sign-classifier.js',
  './js/modules/deaf.js',
  './js/modules/blind.js',
  './js/modules/cognitive.js',
  './js/modules/physical.js',
  './js/modules/elderly.js',
  './manifest.json',
  './assets/icon.svg',
  './landing/index.html'
];

// 安装：预缓存核心资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS).catch(err => {
        console.warn('[SW] 预缓存部分失败:', err);
        // 即使部分失败也继续安装
        return Promise.allSettled(
          PRECACHE_URLS.map(url => cache.add(url).catch(() => {}))
        );
      });
    })
  );
  self.skipWaiting();
});

// 激活：清理旧版本缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== RUNTIME_CACHE)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// 请求拦截
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 只处理 GET 请求
  if (event.request.method !== 'GET') return;

  // MediaPipe 模型文件：Cache First（大文件，首次下载后离线可用）
  if (url.pathname.includes('mediapipe') || url.pathname.includes('.wasm') || url.pathname.includes('.task')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => new Response('离线模式：资源未缓存', { status: 503 }));
      })
    );
    return;
  }

  // HTML 导航请求：Network First（优先最新版本）
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // 尝试匹配请求的页面，回退到 index.html
          return caches.match(event.request).then(cached => cached || caches.match('./index.html'));
        })
    );
    return;
  }

  // 其他静态资源（CSS/JS/图片）：Stale While Revalidate
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached); // 网络失败时返回缓存
      return cached || fetchPromise;
    })
  );
});
