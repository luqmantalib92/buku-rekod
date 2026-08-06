/* Super-app shell: topbar, app launcher and the per-app bottom tab bar.

   Each page declares an empty <section class="topbar" data-shell="..."> and
   this script fills it in, so the header markup lives in one place instead of
   being copy-pasted per page.

   Variants:
     data-shell="brand"                 — app icon that opens the launcher
     data-shell="back" / "back-only"    — circular back button (detail/sub pages)

   Account + Sign out live on the Settings tab (reachable from the bottom nav),
   so the topbar no longer carries an avatar menu.

   Must be loaded BEFORE core.js, which looks these elements up on parse. */

const SUPER_APP_NAME = "Logbook";

/* ---- Mini-app registry ----

   One entry per mini app. `pages` lists the HTML files that belong to it —
   used to pick the right bottom nav and to highlight the current app in the
   launcher. `tabs` is that app's bottom nav. Adding a third mini app means
   adding one entry here and nothing else in this file. */

const ICONS = {
  calendar: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>`,
  car: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13v5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H8v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-5z"/><path d="M5 13h14"/><circle cx="7.5" cy="16" r=".6"/><circle cx="16.5" cy="16" r=".6"/></svg>`,
  film: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M16 4v16"/><path d="M3 9h5M3 15h5M16 9h5M16 15h5"/></svg>`,
  bookmark: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z"/></svg>`,
  search: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg>`,
  gear: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`
};

// Settings is shared by every mini app, so it's appended to each nav below.
const SETTINGS_TAB = { key: "settings", label: "Settings", href: "./settings.html", icon: ICONS.gear };

const APPS = [
  {
    key: "garage",
    name: "Vehicles",
    tagline: "Service log & reminders",
    href: "./index.html",
    icon: ICONS.car,
    pages: ["index.html", "", "vehicles.html", "vehicle.html", "vehicle-form.html", "record-form.html", "categories.html", "reminders.html"],
    tabs: [
      { key: "home", label: "Home", href: "./index.html", pages: ["index.html", ""], icon: ICONS.calendar },
      { key: "vehicles", label: "Vehicles", href: "./vehicles.html", pages: ["vehicles.html", "vehicle.html", "vehicle-form.html", "record-form.html"], icon: ICONS.car },
      SETTINGS_TAB
    ]
  },
  {
    key: "movies",
    name: "Movies",
    tagline: "Watchlist & viewing log",
    href: "./movies.html",
    icon: ICONS.film,
    pages: ["movies.html", "movie-search.html"],
    tabs: [
      { key: "watchlist", label: "Watchlist", href: "./movies.html", pages: ["movies.html"], icon: ICONS.bookmark },
      { key: "search", label: "Search", href: "./movie-search.html", pages: ["movie-search.html"], icon: ICONS.search },
      SETTINGS_TAB
    ]
  }
];

const currentPage = window.location.pathname.split("/").pop();

/* Which mini app owns this page.

   Settings and What's new are shared shell pages that belong to no single
   mini app, so they inherit the nav of whichever app you were last in — open
   Settings from Movies and the tabs still say Watchlist / Search, instead of
   stranding you in the garage. The app key is remembered per tab (session,
   not local) so it never outlives the visit that set it. */

const LAST_APP_KEY = "logbook:last-app";

// sessionStorage throws in some privacy modes — nav must never be fatal.
function rememberApp(key) {
  try { sessionStorage.setItem(LAST_APP_KEY, key); } catch { /* not critical */ }
}

function lastAppKey() {
  try { return sessionStorage.getItem(LAST_APP_KEY); } catch { return null; }
}

function resolveCurrentApp() {
  const owner = APPS.find((app) => app.pages.includes(currentPage));
  if (owner) {
    rememberApp(owner.key);
    return owner;
  }
  return APPS.find((app) => app.key === lastAppKey()) || APPS[0];
}

const currentApp = resolveCurrentApp();

/* ---- Topbar ---- */

const SHELL_BRAND = `
  <button type="button" id="launcherButton" class="brand" aria-label="Open apps" aria-haspopup="dialog" aria-expanded="false">
    <img src="./assets/icon-192.png" alt="" class="brand-icon" />
  </button>`;

const SHELL_BACK = `
  <button type="button" id="backButton" class="icon-back" aria-label="Back"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button>`;

(function buildTopbar() {
  const topbar = document.querySelector(".topbar[data-shell]");
  if (!topbar) return;
  const kind = topbar.getAttribute("data-shell");
  topbar.innerHTML = kind === "brand" ? SHELL_BRAND : SHELL_BACK;
})();

/* ---- App launcher ----
   A full-screen sheet listing every mini app. Opened from the brand icon so
   the daily-use page stays the home screen and switching apps costs one tap
   without ever burying the calendar behind a launcher. */

let launcherEl = null;

function buildLauncher() {
  if (launcherEl) return launcherEl;

  const backdrop = document.createElement("div");
  backdrop.className = "launcher-backdrop";
  backdrop.hidden = true;
  backdrop.setAttribute("role", "dialog");
  backdrop.setAttribute("aria-modal", "true");
  backdrop.setAttribute("aria-label", "Apps");

  backdrop.innerHTML = `
    <div class="launcher-sheet">
      <div class="launcher-head">
        <p class="launcher-title">${SUPER_APP_NAME}</p>
        <button type="button" class="launcher-close" aria-label="Close">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
      <div class="launcher-grid">
        ${APPS.map((app) => `
          <a href="${app.href}" class="launcher-app${app.key === currentApp.key ? " is-current" : ""}">
            <span class="launcher-app-icon" aria-hidden="true">${app.icon}</span>
            <span class="launcher-app-name">${app.name}</span>
            <span class="launcher-app-tagline">${app.tagline}</span>
          </a>`).join("")}
      </div>
      <p class="launcher-version app-version"></p>
    </div>`;

  document.body.append(backdrop);
  launcherEl = backdrop;
  return backdrop;
}

(function setupLauncher() {
  const button = document.querySelector("#launcherButton");
  if (!button) return;

  const backdrop = buildLauncher();
  // version.js already ran, so stamp the freshly-built .app-version node.
  const version = backdrop.querySelector(".app-version");
  if (version && typeof APP_VERSION !== "undefined") version.textContent = `v${APP_VERSION}`;

  function close() {
    backdrop.hidden = true;
    document.body.style.overflow = "";
    button.setAttribute("aria-expanded", "false");
    button.focus();
  }
  function open() {
    backdrop.hidden = false;
    document.body.style.overflow = "hidden";
    button.setAttribute("aria-expanded", "true");
    backdrop.querySelector(".launcher-app").focus();
  }

  button.addEventListener("click", () => (backdrop.hidden ? open() : close()));
  backdrop.querySelector(".launcher-close").addEventListener("click", close);
  backdrop.addEventListener("click", (event) => { if (event.target === backdrop) close(); });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !backdrop.hidden) close();
  });
})();

/* ---- Bottom tab bar ----
   Built once and appended inside the app shell so it hides with #appContent
   while loading. Tabs come from the current mini app; detail/sub pages light
   up their parent tab (e.g. a vehicle's logbook highlights Vehicles). */

(function buildBottomNav() {
  const shell = document.querySelector(".app-shell");
  if (!shell) return;

  const tabs = currentApp.tabs;
  const activeTab = tabs.find((tab) => tab.pages && tab.pages.includes(currentPage))
    || tabs.find((tab) => tab.key === "settings" && ["settings.html", "changelog.html"].includes(currentPage))
    || tabs[0];

  const nav = document.createElement("nav");
  nav.className = "bottom-nav";
  nav.setAttribute("aria-label", "Primary");
  nav.innerHTML = tabs.map((tab) => {
    const active = tab.key === activeTab.key;
    return `<a href="${tab.href}" class="bottom-nav-tab${active ? " is-active" : ""}"${active ? ' aria-current="page"' : ""}>
      <span class="bottom-nav-icon" aria-hidden="true">${tab.icon}</span>
      <span class="bottom-nav-label">${tab.label}</span>
    </a>`;
  }).join("");
  shell.appendChild(nav);
})();
