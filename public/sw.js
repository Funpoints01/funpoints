/* Funpoints service worker — offline caching + push-notificaties */
const VERSION = 'fp-cache-v1'
const APP_SHELL = ['/', '/manifest.json', '/favicon-48.png', '/icon-192.png', '/icon-512.png']

// ── Installatie: app-schil vooraf cachen ────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  )
  self.skipWaiting()
})

// ── Activatie: oude caches opruimen ─────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    await self.clients.claim()
  })())
})

// ── Ophalen: navigaties network-first, assets stale-while-revalidate ──
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

  // Statische bestanden (JS-bundel, CSS, fonts, iconen): meteen uit cache
  // serveren en op de achtergrond verversen.
  event.respondWith(
    caches.match(req).then((cached) => {
      const netwerk = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone()
            caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {})
          }
          return res
        })
        .catch(() => cached)
      return cached || netwerk
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
