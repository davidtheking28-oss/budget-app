/* Service worker — offline app shell with auto-update.
   HTML is network-first (online users always get the latest app; cache is
   the offline fallback only), static assets cache-first.
   Activates only when the app is served over https:// or localhost. */
const CACHE = 'budget-app-v46';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './apple-touch-icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.108.2/dist/umd/supabase.min.js'
];
/* Deliberately NOT precached — fetched on demand, then runtime-cached:
   exceljs.min.js (201 KB, only on Excel export) and icon-512.png (389 KB,
   read by the OS only at install time, which always happens online). */

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(SHELL.map(async (url) => {
      try { await cache.add(url); }
      catch (err) {
        const previous = await caches.match(url);
        if (previous) await cache.put(url, previous);
      }
    }));
    for (const url of SHELL.filter(url => url === './index.html' || url.startsWith('https://'))) {
      if (!(await cache.match(url))) throw new Error('Required offline asset unavailable');
    }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('budget-app-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) {}
  e.waitUntil(
    self.registration.showNotification(d.title || 'תקציב', {
      body: d.body || '',
      icon: './icon-192.png',
      badge: './icon-192.png',
      dir: 'rtl',
      lang: 'he',
      data: { url: d.url || './' }
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      return clients.openWindow(e.notification.data?.url || './');
    })
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // Never intercept cross-origin requests (Supabase API, etc.) — this SW's
  // scope covers /advisor/ too, and cache-first here previously served
  // stale/empty API responses to both apps indefinitely.
  const url = new URL(req.url);
  const appFont = (url.origin === 'https://fonts.googleapis.com' && url.pathname === '/css2' && url.searchParams.get('family')?.startsWith('Assistant:')) || (url.origin === 'https://fonts.gstatic.com' && url.pathname.startsWith('/s/assistant/'));
  if (url.origin !== self.location.origin && !appFont && !SHELL.some(u => u === req.url)) return;

  const accept = req.headers.get('accept') || '';
  const isHTML = req.mode === 'navigate' || accept.includes('text/html');

  if (isHTML) {
    // network-first: online users always get the latest app; cache is offline fallback only
    const fallback = () => caches.match(req).then((r) => r || caches.match('./index.html'));
    const network = fetch(req,{cache:'no-store'}).then(async (res) => {
      if (res.status >= 500) throw new Error('App temporarily unavailable');
      if (res.status === 200) {
        try { await (await caches.open(CACHE)).put(req, res.clone()); } catch (err) {}
      }
      return res;
    }).catch(fallback);
    e.waitUntil?.(network.then(() => {}, () => {}));
    e.respondWith((async () => {
      let timer;
      try {
        return await Promise.race([
          network,
          new Promise((resolve) => { timer = setTimeout(() => fallback().then((cached) => resolve(cached || network), () => resolve(network)), 3000); })
        ]);
      } finally { clearTimeout(timer); }
    })());
    return;
  }

  // static assets (icons, CDN libs, fonts): cache-first with runtime caching
  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
          const copy = res.clone();
          caches.open(appFont ? 'budget-fonts-v1' : CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => new Response('', { status: 504, statusText: 'offline' }));
    })
  );
});
