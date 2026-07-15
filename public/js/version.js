/* Single source of truth for the app version. Bump this on release; it is
   injected as plain text into any element with the .app-version class. */
const APP_VERSION = "1.6.1";

for (const el of document.querySelectorAll(".app-version")) {
  el.textContent = `v${APP_VERSION}`;
}
