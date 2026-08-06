/* Single source of truth for the app version. Bump this on release; it is
   injected as plain text into any element with the .app-version class.
   Also imported by the service worker (importScripts) for its cache name,
   so everything below is guarded to only run in pages. */
const APP_VERSION = "1.8.7";

if (typeof document !== "undefined") {
  for (const el of document.querySelectorAll(".app-version")) {
    el.textContent = `v${APP_VERSION}`;
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }
}
