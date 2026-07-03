/**
 * ============================================================
 *  Service Worker — منصة المدرسة الإلكترونية
 * ============================================================
 *
 *  استراتيجيات التخزين:
 *    1. Precache:      صفحات أساسية عند التثبيت (app shell)
 *    2. Navigation:    network-first → cache → offline page
 *    3. Static (_next): stale-while-revalidate (أسرع تحميل)
 *    4. Images:        cache-first (توفير البيانات)
 *    5. API:           network-only (بيانات حية دائماً)
 *    6. Fonts:         cache-first (دائم)
 *
 *  الميزات:
 *    - صفحة offline احتياطية بالعربية
 *    - تحديث تلقائي عند توفّر نسخة جديدة (skipWaiting)
 *    - تنظيف الكاش القديم تلقائياً
 *    - دعم safe area للهواتف ذات النوتش
 * ============================================================
 */

const CACHE_VERSION = 'v2';
const CACHE_NAME = `school-platform-${CACHE_VERSION}`;
const STATIC_CACHE = `${CACHE_NAME}-static`;
const IMAGE_CACHE = `${CACHE_NAME}-images`;
const PAGE_CACHE = `${CACHE_NAME}-pages`;

// الصفحات الأساسية للتطبيق (app shell) — تُخزّن عند التثبيت
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.png',
  '/favicon-32.png',
  '/apple-touch-icon.png',
];

// ============== INSTALL: Precache app shell ==============
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      // addAll تفشل كلياً إذا فشل مورد واحد — نستخدم add لكل واحد على حدة
      return Promise.allSettled(
        PRECACHE_URLS.map((url) => cache.add(url))
      );
    })
  );
  // تفعيل فوري دون انتظار إغلاق التبويبات
  self.skipWaiting();
});

// ============== ACTIVATE: Clean old caches ==============
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !name.startsWith(CACHE_NAME))
          .map((name) => {
            return caches.delete(name);
          })
      );
    }).then(() => {
      // السيطرة على جميع التبويبات فوراً
      return self.clients.claim();
    })
  );
});

// ============== FETCH: Smart routing ==============
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // تجاهل الطلبات غير GET (POST/PUT/DELETE)
  if (request.method !== 'GET') return;

  // تجاهل طلبات الـ API — دائماً شبكة (بيانات حية)
  if (url.pathname.startsWith('/api/')) return;

  // تجاهل الطلبات الخارجية (Supabase, Google Fonts, إلخ)
  if (url.origin !== self.location.origin) return;

  // تجاهل طلبات Socket.io و hot reload (في وضع التطوير)
  if (url.pathname.startsWith('/_next/webpack-hmr')) return;
  if (url.pathname.startsWith('/socket.io')) return;

  // 1. طلبات التنقل (HTML pages) — network-first مع fallback
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  // 2. أصول Next.js الثابتة (_next/static) — stale-while-revalidate
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  // 3. الصور — cache-first
  if (request.destination === 'image' || url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|bmp)$/i)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // 4. CSS/JS/Fonts — stale-while-revalidate
  if (url.pathname.match(/\.(css|js|woff2?|ttf|eot)$/i)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  // 5. افتراضي — network-first
  event.respondWith(networkFirst(request, STATIC_CACHE));
});

// ============== استراتيجيات التخزين ==============

/**
 * Network-first: نحاول الشبكة أولاً، وإذا فشلت نستخدم الكاش
 * مناسب للصفحات (المحتوى قد يتغير)
 */
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;
    throw error;
  }
}

/**
 * Cache-first: نستخدم الكاش أولاً، وإذا لم يوجد نطلب من الشبكة
 * مناسب للصور (نادراً ما تتغير)
 */
async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // لا كاش ولا شبكة — إرجاع استجابة فارغة
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

/**
 * Stale-while-revalidate: نُرجع الكاش فوراً ونحدّث في الخلفية
 * مناسب للأصول الثابتة (سريع + محدّث)
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => cachedResponse);

  // إرجاع الكاش فوراً إن وُجد، وإلا انتظر الشبكة
  return cachedResponse || fetchPromise;
}

/**
 * معالجة طلبات التنقل — network-first مع صفحة offline احتياطية
 */
async function handleNavigation(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(PAGE_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // الشبكة غير متاحة — نحاول الكاش
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;

    // لا يوجد كاش — نعرض صفحة offline
    const offlineResponse = await caches.match('/offline.html');
    if (offlineResponse) return offlineResponse;

    // كحل أخير — استجابة بسيطة
    return new Response(
      '<html><body style="font-family:sans-serif;text-align:center;padding:3rem"><h1>غير متصل</h1><p>تحقق من اتصالك بالإنترنت.</p></body></html>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

// ============== MESSAGE: Handle skipWaiting from client ==============
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
