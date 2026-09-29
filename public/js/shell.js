/* Super-app shell: topbar, app launcher and the per-app bottom tab bar.

   Each page declares an empty <section class="topbar" data-shell="..."> and
   this script fills it in, so the header markup lives in one place instead of
   being copy-pasted per page.

   Variants:
     data-shell="brand"   — app icon (opens the launcher) + page title
     data-shell="back"    — circular back button + page title (detail/sub pages)

   The title comes from the section's data-title attribute; pages whose title
   depends on data (a vehicle's name) update it later with setShellTitle().

   Account + Sign out live on the Settings tab (reachable from the bottom nav),
   so the topbar carries no avatar menu.

   Must be loaded BEFORE core.js, which looks these elements up on parse. */

const SUPER_APP_NAME = "Buku Rekod";

/* ---- Icons ----
   One stroke-icon set for the whole app (24×24, currentColor). Page scripts
   reuse these through icon(name) so markup built in JS matches the HTML. */

const ICON_PATHS = {
  home: '<path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  car: '<path d="M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13v5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H8v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-5z"/><path d="M5 13h14"/><circle cx="7.5" cy="16" r=".6"/><circle cx="16.5" cy="16" r=".6"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M16 4v16"/><path d="M3 9h5M3 15h5M16 9h5M16 15h5"/>',
  bookmark: '<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z"/>',
  "bookmark-add": '<path d="M6 3h7M19 11v10l-7-4.5L5 21V4a1 1 0 0 1 1-1"/><path d="M18 2v6M15 5h6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  "chevron-left": '<path d="M15 6l-6 6 6 6"/>',
  "chevron-right": '<path d="M9 6l6 6-6 6"/>',
  "chevron-down": '<path d="M6 9l6 6 6-6"/>',
  "arrow-right": '<path d="M5 12h14M13 6l6 6-6 6"/>',
  more: '<circle cx="12" cy="5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="19" r="1.4" fill="currentColor"/>',
  gauge: '<path d="M4.5 18a9 9 0 1 1 15 0"/><path d="M12 13l4-4"/><circle cx="12" cy="13" r="1.2"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.1L3.5 17.2a1.8 1.8 0 0 0 2.6 2.6l5.8-5.8a4 4 0 0 0 5.1-5.4l-2.4 2.4-2.3-.3-.3-2.3z"/>',
  alert: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.3v.2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  "check-circle": '<circle cx="12" cy="12" r="9"/><path d="M8 12.3l2.8 2.8L16.3 9.5"/>',
  shield: '<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.3-7.5 9.5-4.3-1.2-7.5-5-7.5-9.5V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  pencil: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  camera: '<path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 16V5M7 9.5l5-5 5 5M5 20h14"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
  tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 16l-4-4 4-4M6 12h10"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5 12 13l8.5-6.5"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2.5 2.5M14 9l2 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.7v.2"/>',
  layers: '<path d="M12 3 3 8l9 5 9-5z"/><path d="M3 13l9 5 9-5"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  // Category glyphs (keyed by default category key; anything else uses "tag").
  "engine-oil": '<path d="M12 3.5s-5 6-5 9.5a5 5 0 0 0 10 0c0-3.5-5-9.5-5-9.5z"/><path d="M10 14a2 2 0 0 0 2 2"/>',
  "brakes-fluids": '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/><path d="M5.5 6.5a9 9 0 0 0 0 11"/>',
  "electrical-wear": '<path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z"/>',
  "tyres-alignment": '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 3.5v6M12 14.5v6M3.5 12h6M14.5 12h6"/>'
};

// Inline SVG markup for a named icon. Unknown names fall back to "tag".
function icon(name, extraClass = "") {
  const paths = ICON_PATHS[name] || ICON_PATHS.tag;
  const cls = extraClass ? ` class="${extraClass}"` : "";
  return `<svg${cls} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

// Same icon as a DOM node, for scripts that build markup with createElement.
function iconNode(name, extraClass = "") {
  const wrap = document.createElement("span");
  wrap.innerHTML = icon(name, extraClass);
  return wrap.firstElementChild;
}

// Fill every <i data-icon="name"> placeholder in static markup (and inside
// <template>s, so cloned cards arrive with their icons already in place).
function hydrateIcons(root = document) {
  for (const el of root.querySelectorAll("i[data-icon]")) {
    el.replaceWith(iconNode(el.dataset.icon, el.className));
  }
  for (const tpl of root.querySelectorAll("template")) hydrateIcons(tpl.content);
}

hydrateIcons();

/* ---- Mini-app registry ----

   One entry per mini app. `pages` lists the HTML files that belong to it —
   used to pick the right bottom nav and to highlight the current app in the
   launcher. `tabs` is that app's bottom nav. Adding a third mini app means
   adding one entry here and nothing else in this file. */

// Settings is shared by every mini app, so it's appended to each nav below.
// The garage's own settings pages (categories, reminders) open from here too,
// so they light this tab rather than Home.
const SETTINGS_TAB = { key: "settings", label: "Settings", href: "./settings.html", icon: "gear", pages: ["categories.html", "reminders.html"] };

const APPS = [
  {
    key: "garage",
    name: "Vehicles",
    tagline: "Service log & reminders",
    href: "./index.html",
    icon: "car",
    pages: ["index.html", "", "vehicles.html", "vehicle.html", "vehicle-form.html", "record-form.html", "categories.html", "reminders.html"],
    tabs: [
      { key: "home", label: "Home", href: "./index.html", pages: ["index.html", ""], icon: "home" },
      { key: "vehicles", label: "Vehicles", href: "./vehicles.html", pages: ["vehicles.html", "vehicle.html", "vehicle-form.html", "record-form.html"], icon: "car" },
      SETTINGS_TAB
    ]
  },
  {
    key: "movies",
    name: "Movies",
    tagline: "Watchlist & viewing log",
    href: "./movies.html",
    icon: "film",
    pages: ["movies.html", "movie-search.html"],
    tabs: [
      { key: "watchlist", label: "Watchlist", href: "./movies.html", pages: ["movies.html"], icon: "bookmark" },
      { key: "search", label: "Search", href: "./movie-search.html", pages: ["movie-search.html"], icon: "search" },
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

const LAST_APP_KEY = "buku-rekod:last-app";

// Pages that belong to the shell rather than to any one mini app. They sit
// under the Settings tab and inherit the nav of the app you came from.
const SHARED_SHELL_PAGES = ["settings.html", "changelog.html", "backup.html"];

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

function escapeShellText(text) {
  const span = document.createElement("span");
  span.textContent = text || "";
  return span.innerHTML;
}

(function buildTopbar() {
  const topbar = document.querySelector(".topbar[data-shell]");
  if (!topbar) return;
  const kind = topbar.getAttribute("data-shell");
  const title = escapeShellText(topbar.getAttribute("data-title") || "");

  const lead = kind === "brand"
    ? `<button type="button" id="launcherButton" class="brand" aria-label="Open apps" aria-haspopup="dialog" aria-expanded="false">
        <img src="./assets/icon-192.png" alt="" class="brand-icon" />
        ${icon("chevron-down", "brand-chevron")}
      </button>`
    : `<button type="button" id="backButton" class="icon-back" aria-label="Back">${icon("back")}</button>`;

  topbar.innerHTML = `
    <div class="topbar-inner">
      ${lead}
      <p class="topbar-title" id="shellTitle">${title}</p>
      <div class="topbar-actions" id="shellActions"></div>
    </div>`;
})();

// Replace the topbar title once a page knows it (e.g. the vehicle's name).
function setShellTitle(text) {
  const el = document.querySelector("#shellTitle");
  if (el) el.textContent = text || "";
}

/* ---- App launcher ----
   A bottom sheet listing every mini app. Opened from the brand icon so the
   daily-use page stays the home screen and switching apps costs one tap
   without ever burying the calendar behind a launcher. */

let launcherEl = null;

function buildLauncher() {
  if (launcherEl) return launcherEl;

  const backdrop = document.createElement("div");
  backdrop.className = "launcher-backdrop";
  backdrop.hidden = true;
  backdrop.setAttribute("role", "dialog");
  backdrop.setAttribute("aria-modal", "true");
  backdrop.setAttribute("aria-labelledby", "launcherTitle");

  backdrop.innerHTML = `
    <div class="launcher-sheet">
      <span class="sheet-handle" aria-hidden="true"></span>
      <div class="launcher-head">
        <div>
          <p class="launcher-title" id="launcherTitle">Switch mini app</p>
          <p class="launcher-sub">Single-purpose tools inside ${SUPER_APP_NAME}</p>
        </div>
        <button type="button" class="launcher-close" aria-label="Close">${icon("close")}</button>
      </div>
      <div class="launcher-grid">
        ${APPS.map((app) => {
          const current = app.key === currentApp.key;
          return `
          <a href="${app.href}" class="launcher-app${current ? " is-current" : ""}"${current ? ' aria-current="true"' : ""}>
            <span class="launcher-app-top">
              <span class="launcher-app-icon" aria-hidden="true">${icon(app.icon)}</span>
              ${current ? '<span class="pill pill-solid">Active</span>' : ""}
            </span>
            <span class="launcher-app-name">${app.name}</span>
            <span class="launcher-app-tagline">${app.tagline}</span>
            <span class="launcher-app-cta">${current ? `Opened ${icon("check")}` : `Open ${icon("arrow-right")}`}</span>
          </a>`;
        }).join("")}
      </div>
      <p class="launcher-version"><span class="status-dot" aria-hidden="true"></span>${SUPER_APP_NAME} <span class="app-version"></span></p>
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
    || tabs.find((tab) => tab.key === "settings" && SHARED_SHELL_PAGES.includes(currentPage))
    || tabs[0];

  const nav = document.createElement("nav");
  nav.className = "bottom-nav";
  nav.setAttribute("aria-label", "Primary");
  nav.innerHTML = `<div class="bottom-nav-inner">${tabs.map((tab) => {
    const active = tab.key === activeTab.key;
    return `<a href="${tab.href}" class="bottom-nav-tab${active ? " is-active" : ""}"${active ? ' aria-current="page"' : ""}>
      <span class="bottom-nav-icon" aria-hidden="true">${icon(tab.icon)}</span>
      <span class="bottom-nav-label">${tab.label}</span>
    </a>`;
  }).join("")}</div>`;
  shell.appendChild(nav);
})();
