/* Single source of truth for the app version. Bump this on release; it is
   injected into any element with the .app-version class across all pages. */
const APP_VERSION = "1.3.3";

// Render the version as a link to the What's new page so tapping it shows
// what changed. (Falls back to plain text if the anchor can't be created.)
for (const el of document.querySelectorAll(".app-version")) {
  const link = document.createElement("a");
  link.href = "./changelog.html";
  link.className = "app-version-link";
  link.textContent = `v${APP_VERSION}`;
  link.title = "See what's new in this version";
  el.replaceChildren(link);
}
