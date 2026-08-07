/* Funpoints service worker — offline caching + push-notificaties */
const VERSION = 'fp-cache-v2'
const APP_SHELL = ['/', '/manifest.json', '/favicon.ico', '/favicon-48.png', '/icon-192.png', '/icon-512.png']

// Ontdek en cache álle app-bestanden: de HTML, de CSS, de entry-bundel én
// de lazy-geladen JS-chunks (die hashes veranderen per build, dus we lezen
// ze uit de HTML en de bundel i.p.v. ze hard te coderen).
async function precacheApp(cache) {
  const urls = new Set(APP_SHELL)
  try {
    const html = await fetch('/', { cache: 'no-store' }).then((r) => r.text())
    for (const m of html.matchAll(/\/_expo\/static\/[^"'\s>]+\.(?:js|css)/g)) urls.add(m[0])
    // Doorzoek elke JS-bundel op verwijzingen naar verdere chunks.
    for (const u of [...urls]) {
      if (u.endsWith('.js')) {
        try {
          const t = await fetch(u).then((r) => r.text())
          for (const m of t.matchAll(/\/?_expo\/static\/[^"'\)\s]+\.js/g)) urls.add('/' + m[0].replace(/^\//, ''))
        } catch (e) {}
      }
    }
  } catch (e) {}
  // Cache stuk voor stuk zodat één mislukte fetch de rest niet blokkeert.
  await Promise.all([...urls].map((u) => cache.add(u).catch(() => {})))
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => precacheApp(cache)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  let url
  try { url = new URL(req.url) } catch (e) { return }

  // Alleen eigen origin cachen. API's (Supabase e.d.) nooit — die moeten
  // vers zijn of falen, zodat de app weet dat er geen netwerk is.
  if (url.origin !== self.location.origin) return

  // Navigaties (de app-pagina zelf): probeer het netwerk, val terug op de
  // gecachte app-schil zodat de app ook zonder internet opent.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(VERSION).then((c) => c.put('/', copy)).catch(() => {})
          return res
        })
        .catch(() => caches.match('/').then((r) => r || caches.match(req)))
    )
    return
  }

  // Gehashte assets (JS/CSS/fonts/iconen) zijn onveranderlijk: eerst uit de
  // cache serveren, en enkel bij een misser het netwerk proberen en cachen.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone()
            caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {})
          }
          return res
        })
        .catch(() => cached)
    })
  )
})

// ── Push-notificaties (ongewijzigd) ─────────────────────────
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (e) { data = {} }
  const titel = data.title || 'Funpoints'
  const opties = {
    body: data.body || 'Er is een nieuwe actie voor jou!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/bezoeker' },
  }
  event.waitUntil(self.registration.showNotification(titel, opties))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/bezoeker'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lijst) => {
      for (const c of lijst) { if ('focus' in c) { c.navigate(url); return c.focus() } }
      return self.clients.openWindow(url)
    })
  )
})
