/* Single source of truth for the app version. Bump this on release; it is
   injected into any element with the .app-version class across all pages. */
const APP_VERSION = "1.0.0";

for (const el of document.querySelectorAll(".app-version")) {
  el.textContent = `v${APP_VERSION}`;
}
