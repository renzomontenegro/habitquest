/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision?: string | null } | string>
}

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('push', (event) => {
  let title = 'Traza'
  let body = ''
  try {
    const data = event.data ? JSON.parse(event.data.text()) : {}
    if (data && typeof data === 'object') {
      if (typeof data.title === 'string') title = data.title
      if (typeof data.body === 'string') body = data.body
    }
  } catch {
    // payload no JSON: mostrar el texto crudo
    if (event.data) body = event.data.text()
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-512.png',
      badge: '/icon-192.png',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of all) {
        if ('focus' in client) {
          client.focus()
          return
        }
      }
      await self.clients.openWindow('/')
    })(),
  )
})
