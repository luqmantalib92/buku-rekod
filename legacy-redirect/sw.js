/* Kill switch for the old Logbook service worker at my-personal-log.web.app.
   An installed app keeps running its cached copy until the worker changes, so
   this replacement clears every cache, unregisters itself and sends open
   windows to the new address. */

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key);
    await self.registration.unregister();
    for (const client of await self.clients.matchAll({ type: "window" })) {
      const url = new URL(client.url);
      client.navigate("https://buku-rekod.web.app" + url.pathname + url.search);
    }
  })());
});
