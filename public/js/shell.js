/* Shared topbar builder. Each page declares an empty
   <section class="topbar" data-shell="..."> and this script fills it in, so
   the header markup lives in one place instead of being copy-pasted per page.

   Variants:
     data-shell="brand"                 — app icon linking home (Home, Vehicles)
     data-shell="back" / "back-only"    — circular back button (detail/sub pages)

   Account + Sign out now live on the Settings tab (reachable from the bottom
   nav), so the topbar no longer carries an avatar menu.

   Must be loaded BEFORE store.js, which looks these elements up on parse. */

const SHELL_BRAND = `
  <a href="./index.html" class="brand" aria-label="Service Log">
    <img src="./assets/icon-192.png" alt="Service Log" class="brand-icon" />
  </a>`;

const SHELL_BACK = `
  <button type="button" id="backButton" class="icon-back" aria-label="Back"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button>`;

(function buildTopbar() {
  const topbar = document.querySelector(".topbar[data-shell]");
  if (!topbar) return;
  const kind = topbar.getAttribute("data-shell");
  topbar.innerHTML = kind === "brand" ? SHELL_BRAND : SHELL_BACK;
})();

/* Bottom tab bar: Home (agenda) · Vehicles (garage) · Settings. Built once and
   appended inside the app shell so it hides with #appContent while loading.
   The active tab is derived from the current page; detail/sub pages light up
   their parent tab (e.g. a vehicle's logbook highlights Vehicles). */
const NAV_TABS = [
  {
    key: "home",
    label: "Home",
    href: "./index.html",
    pages: ["index.html", ""],
    icon: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>`
  },
  {
    key: "vehicles",
    label: "Vehicles",
    href: "./vehicles.html",
    pages: ["vehicles.html", "vehicle.html", "vehicle-form.html", "record-form.html"],
    icon: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13v5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H8v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-5z"/><path d="M5 13h14"/><circle cx="7.5" cy="16" r=".6"/><circle cx="16.5" cy="16" r=".6"/></svg>`
  },
  {
    key: "settings",
    label: "Settings",
    href: "./settings.html",
    pages: ["settings.html", "reminders.html", "categories.html", "changelog.html"],
    icon: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`
  }
];

(function buildBottomNav() {
  const shell = document.querySelector(".app-shell");
  if (!shell) return;
  const current = window.location.pathname.split("/").pop();
  const activeTab = NAV_TABS.find((tab) => tab.pages.includes(current)) || NAV_TABS[0];

  const nav = document.createElement("nav");
  nav.className = "bottom-nav";
  nav.setAttribute("aria-label", "Primary");
  nav.innerHTML = NAV_TABS.map((tab) => {
    const active = tab.key === activeTab.key;
    return `<a href="${tab.href}" class="bottom-nav-tab${active ? " is-active" : ""}"${active ? ' aria-current="page"' : ""}>
      <span class="bottom-nav-icon" aria-hidden="true">${tab.icon}</span>
      <span class="bottom-nav-label">${tab.label}</span>
    </a>`;
  }).join("");
  shell.appendChild(nav);
})();
