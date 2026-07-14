/* Firebase Cloud Messaging service worker — shows reminders while the app
   (tab or installed PWA) is in the background or closed. */

importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js");
importScripts("./firebase-config.js");

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Data-only messages (sent by the serviceReminders Cloud Function) are shown
// here, which avoids the double-notification you can get with notification
// payloads.
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  self.registration.showNotification(data.title || "Service reminder", {
    body: data.body || "",
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    data: { url: data.url || "./index.html" }
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "./index.html";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});
