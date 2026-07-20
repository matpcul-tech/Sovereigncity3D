// Kill-switch service worker.
// Older deployments of Sovereign City installed a PWA service worker at this
// URL that pinned a stale build on players' devices (stale-while-revalidate +
// precache). Browsers refetch this file on navigation; shipping this byte-
// different worker replaces the old one, wipes every cache, unregisters
// itself, and reloads open tabs so the live version loads from the network.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) {}
    try { await self.registration.unregister(); } catch (e) {}
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((c) => { try { c.navigate(c.url); } catch (e) {} });
  })());
});
