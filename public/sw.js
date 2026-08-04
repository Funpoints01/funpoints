/* Funpoints service worker — push-notificaties */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

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
