/* Shared data + auth layer used by both the garage and vehicle pages. */

const LOCAL_KEY = "vehicle-service-log:v1";

const state = {
  vehicles: [],
  settings: { leadDays: {} },
  categories: [],
  user: null,
  auth: null,
  db: null,
  dataRef: null,
  useFirestore: false
};

function hasFirebaseConfig() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && window.firebase?.auth && window.firebase?.firestore);
}

/* ---- Formatting ---- */

function formatKm(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return `${number.toLocaleString("en-MY")} km`;
}

function formatMoney(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR"
  }).format(number);
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}

function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
}

/* ---- Data model ---- */

function normalizeVehicle(vehicle) {
  const source = vehicle || {};
  return {
    id: source.id || makeId(),
    name: source.name || "",
    plate: source.plate || "",
    odometer: Number(source.odometer || 0),
    model: source.model || "",
    image: source.image || "",
    createdAt: source.createdAt || new Date().toISOString(),
    records: Array.isArray(source.records) ? source.records : []
  };
}

// Approx decoded byte size of a data URL (base64 payload is ~4/3 of bytes).
function dataUrlBytes(dataUrl) {
  const comma = dataUrl.indexOf(",");
  return Math.ceil((dataUrl.length - comma - 1) * 3 / 4);
}

const IMAGE_MAX_INPUT_BYTES = 15 * 1024 * 1024; // reject huge originals (15 MB)
const IMAGE_TARGET_BYTES = 80 * 1024;           // compress down to ~80 KB
const IMAGE_START_SIZE = 640;                   // starting max dimension (px)
const IMAGE_MIN_SIZE = 240;                     // don't degrade below this

// Gatekeeper: validate an uploaded image, then resize + JPEG-compress it,
// stepping quality/dimensions down until it fits IMAGE_TARGET_BYTES, so photos
// live inline in Firestore/localStorage (no paid Storage) without blowing the
// 1 MB doc budget. Resolves { dataUrl, bytes }; rejects with a user message.
function fileToResizedDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith("image/")) {
      reject(new Error("That's not an image. Please choose a photo (JPG, PNG, HEIC…)."));
      return;
    }
    if (file.size > IMAGE_MAX_INPUT_BYTES) {
      reject(new Error(`That image is ${Math.round(file.size / (1024 * 1024))} MB — please choose one under 15 MB.`));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That image looks corrupted or unsupported."));
      img.onload = () => {
        if (!img.width || !img.height) {
          reject(new Error("That image has no dimensions."));
          return;
        }

        const encode = (maxSize, quality) => {
          const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          return canvas.toDataURL("image/jpeg", quality);
        };

        let maxSize = IMAGE_START_SIZE;
        let quality = 0.8;
        let dataUrl = encode(maxSize, quality);

        // Step down quality first, then dimensions, until under target.
        for (let guard = 0; guard < 16 && dataUrlBytes(dataUrl) > IMAGE_TARGET_BYTES; guard += 1) {
          if (quality > 0.45) {
            quality -= 0.1;
          } else if (maxSize > IMAGE_MIN_SIZE) {
            maxSize = Math.max(IMAGE_MIN_SIZE, Math.round(maxSize * 0.8));
            quality = 0.7;
          } else {
            break; // as small as we'll go
          }
          dataUrl = encode(maxSize, quality);
        }

        resolve({ dataUrl, bytes: dataUrlBytes(dataUrl) });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Accepts new format ({vehicles: []}) and the old single-vehicle format
// ({vehicle, records}), migrating the latter into a one-vehicle garage.
function ingest(data) {
  const source = data || {};
  if (Array.isArray(source.vehicles)) {
    state.vehicles = source.vehicles.map(normalizeVehicle);
  } else if (source.vehicle || Array.isArray(source.records)) {
    state.vehicles = [normalizeVehicle({
      ...(source.vehicle || { name: "My vehicle" }),
      records: source.records || []
    })];
  } else {
    state.vehicles = [];
  }
  state.settings = normalizeSettings(source.settings);
  state.categories = normalizeCategories(source.categories);
}

function getVehicle(id) {
  return state.vehicles.find((vehicle) => vehicle.id === id) || null;
}

function latestOdometer(vehicle) {
  return Math.max(
    Number(vehicle.odometer || 0),
    ...vehicle.records.map((record) => Number(record.odometer || 0)),
    0
  );
}

/* ---- Service categories (groups) ---- */

// Built-in seed. Used until the user customizes categories (then their saved
// list in state.categories takes over). getCategories() is the source of truth.
const DEFAULT_CATEGORIES = [
  { key: "engine-oil", label: "Engine & oil", lead: 30, items: ["Engine oil", "Oil filter", "Air filter", "Cabin/aircond filter"] },
  { key: "brakes-fluids", label: "Brakes & fluids", lead: 30, items: ["Brake pads", "Brake fluid", "Coolant", "ATF/gearbox oil"] },
  { key: "electrical-wear", label: "Electrical & wear", lead: 30, items: ["Battery", "Spark plugs", "Wipers", "Bulbs"] },
  { key: "tyres-alignment", label: "Tyres & alignment", lead: 30, items: ["Tyre rotation", "Alignment & balancing", "New front tyre", "New back tyre", "New tyres"] },
  { key: "other", label: "Other", lead: 30, items: [] }
];

function getCategories() {
  return state.categories.length ? state.categories : DEFAULT_CATEGORIES;
}

function normalizeCategories(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((entry) => ({
      key: entry.key || makeId(),
      label: String(entry.label || "").trim(),
      lead: Number.isFinite(Number(entry.lead)) ? Number(entry.lead) : 30,
      items: Array.isArray(entry.items) ? entry.items.map(String) : []
    }))
    .filter((entry) => entry.label);
}

function categoryLabel(key) {
  const category = getCategories().find((entry) => entry.key === key);
  return category ? category.label : "Other";
}

// Days before a due date to start warning, per category: user override wins,
// then the category default, then the global fallback.
function leadDaysFor(key) {
  const override = Number(state.settings?.leadDays?.[key]);
  if (Number.isFinite(override) && override >= 0) return override;
  const category = getCategories().find((entry) => entry.key === key);
  return category && Number.isFinite(category.lead) ? category.lead : DUE_SOON_DAYS;
}

function normalizeSettings(settings) {
  const leadDays = {};
  const source = (settings && settings.leadDays) || {};
  for (const key of Object.keys(source)) {
    const value = Number(source[key]);
    if (Number.isFinite(value) && value >= 0) leadDays[key] = value;
  }
  return { leadDays };
}

/* ---- Reminders (in-app) ---- */

const DUE_SOON_DAYS = 30;

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  return Math.round((target - today) / 86400000);
}

// One reminder per category, based on the most recent record in that category
// that carries a next-service date. Overdue first, then soonest.
function vehicleReminders(vehicle) {
  const latestByCategory = new Map();
  for (const record of vehicle.records) {
    if (!record.nextDate) continue;
    const key = record.category || "other";
    const existing = latestByCategory.get(key);
    if (!existing || (record.date || "") > (existing.date || "")) {
      latestByCategory.set(key, record);
    }
  }

  const reminders = [];
  for (const [key, record] of latestByCategory) {
    const days = daysUntil(record.nextDate);
    if (days === null) continue;
    let status = "ok";
    if (days < 0) status = "overdue";
    else if (days <= leadDaysFor(key)) status = "due-soon";
    reminders.push({ category: key, label: categoryLabel(key), nextDate: record.nextDate, days, status });
  }

  reminders.sort((a, b) => a.days - b.days);
  return reminders;
}

function vehicleDueCount(vehicle) {
  return vehicleReminders(vehicle).filter((reminder) => reminder.status !== "ok").length;
}

function loadLocal() {
  const raw = localStorage.getItem(LOCAL_KEY);
  if (!raw) {
    state.vehicles = [];
    return;
  }
  try {
    ingest(JSON.parse(raw));
  } catch {
    state.vehicles = [];
  }
}

function saveLocal() {
  localStorage.setItem(LOCAL_KEY, JSON.stringify({ vehicles: state.vehicles, settings: state.settings, categories: state.categories }));
}

async function loadRemoteData() {
  if (!state.dataRef) return;
  const snapshot = await state.dataRef.get();
  ingest(snapshot.exists ? snapshot.data() : {});
}

// Re-pull the latest data (used by pull-to-refresh). The caller re-renders.
async function refreshData() {
  if (state.useFirestore && state.dataRef) {
    await loadRemoteData();
  } else {
    loadLocal();
  }
}

async function persist() {
  if (state.useFirestore && state.dataRef) {
    await state.dataRef.set({
      vehicles: state.vehicles,
      settings: state.settings,
      categories: state.categories,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } else {
    saveLocal();
  }
}

/* ---- Shared shell (topbar) ---- */

const shellEls = {
  appContent: document.querySelector("#appContent"),
  appLoading: document.querySelector("#appLoading"),
  signOutButton: document.querySelector("#signOutButton"),
  accountButton: document.querySelector("#accountButton"),
  accountMenu: document.querySelector("#accountMenu"),
  accountAvatar: document.querySelector("#accountAvatar"),
  accountEmail: document.querySelector("#accountEmail"),
  accountStatus: document.querySelector("#accountStatus")
};

/* ---- Custom confirmation dialog (replaces window.confirm) ---- */

let confirmEls = null;

function ensureConfirmModal() {
  if (confirmEls) return confirmEls;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.hidden = true;

  const modal = document.createElement("div");
  modal.className = "modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");

  const title = document.createElement("h2");
  title.className = "modal-title";
  const message = document.createElement("p");
  message.className = "modal-message";
  const actions = document.createElement("div");
  actions.className = "modal-actions";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "ghost-action";
  const ok = document.createElement("button");
  ok.type = "button";
  ok.className = "primary-action";

  actions.append(cancel, ok);
  modal.append(title, message, actions);
  backdrop.append(modal);
  document.body.append(backdrop);

  confirmEls = { backdrop, title, message, cancel, ok };
  return confirmEls;
}

// Promise<boolean> — resolves true on confirm, false on cancel/dismiss.
function confirmDialog(options) {
  const opts = options || {};
  const els = ensureConfirmModal();

  els.title.textContent = opts.title || "Are you sure?";
  els.message.textContent = opts.message || "";
  els.message.hidden = !opts.message;
  els.ok.textContent = opts.confirmLabel || "Confirm";
  els.cancel.textContent = opts.cancelLabel || "Cancel";
  els.ok.classList.toggle("danger-action", Boolean(opts.danger));

  els.backdrop.hidden = false;
  document.body.style.overflow = "hidden";
  // Focus Cancel for destructive prompts so an accidental Enter won't confirm.
  (opts.danger ? els.cancel : els.ok).focus();

  return new Promise((resolve) => {
    function cleanup(result) {
      els.backdrop.hidden = true;
      document.body.style.overflow = "";
      els.ok.removeEventListener("click", onOk);
      els.cancel.removeEventListener("click", onCancel);
      els.backdrop.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKey);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    function onBackdrop(event) { if (event.target === els.backdrop) cleanup(false); }
    function onKey(event) { if (event.key === "Escape") cleanup(false); }

    els.ok.addEventListener("click", onOk);
    els.cancel.addEventListener("click", onCancel);
    els.backdrop.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKey);
  });
}

async function signOut() {
  const ok = await confirmDialog({
    title: "Sign out?",
    message: "You'll need to sign in again to view your logs.",
    confirmLabel: "Sign out",
    danger: true
  });
  if (!ok) return;
  if (state.auth) await state.auth.signOut();
  window.location.replace("./login.html");
}

if (shellEls.signOutButton) {
  shellEls.signOutButton.addEventListener("click", signOut);
}

// Account menu: a top-right avatar button that opens a popover with the
// user's email, sync status, and Sign out — keeps them out of the header.
function setupAccountMenu() {
  const { accountButton: button, accountMenu: menu } = shellEls;
  if (!button || !menu) return;

  // The avatar opens the nav + account menu, so make that discoverable.
  button.title = "Menu & account";
  button.setAttribute("aria-label", "Open menu and account");

  const close = () => { menu.hidden = true; button.setAttribute("aria-expanded", "false"); };
  const open = () => { menu.hidden = false; button.setAttribute("aria-expanded", "true"); };

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    if (menu.hidden) open();
    else close();
  });
  document.addEventListener("click", (event) => {
    if (!menu.hidden && !menu.contains(event.target) && !button.contains(event.target)) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) close();
  });

  // Highlight the current page's nav link.
  const current = (location.pathname.split("/").pop() || "index.html") || "index.html";
  menu.querySelectorAll(".account-link").forEach((link) => {
    const target = link.getAttribute("href").replace(/^\.\//, "");
    if (target === current) {
      link.classList.add("account-link-active");
      link.setAttribute("aria-current", "page");
    }
  });
}

setupAccountMenu();

// Unique, sorted workshop names across all records — powers the workshop
// autocomplete suggestions.
function getWorkshopNames() {
  const names = new Set();
  for (const vehicle of state.vehicles) {
    for (const record of vehicle.records) {
      const workshop = (record.workshop || "").trim();
      if (workshop) names.add(workshop);
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

function revealShell(signedIn, label) {
  if (shellEls.appLoading) shellEls.appLoading.hidden = true;
  if (shellEls.appContent) shellEls.appContent.hidden = false;
  if (shellEls.signOutButton) shellEls.signOutButton.hidden = !signedIn;

  if (shellEls.accountAvatar) {
    shellEls.accountAvatar.textContent = signedIn && label ? label.trim().charAt(0).toUpperCase() : "·";
  }
  if (shellEls.accountEmail) {
    shellEls.accountEmail.textContent = signedIn && label ? label : "Local mode";
  }
  if (shellEls.accountStatus) {
    shellEls.accountStatus.textContent = signedIn ? "Synced to your account" : "Saved on this device";
  }
}

// Disable a button and show a busy label while an async action runs, then
// restore it — gives submit feedback and prevents double-submits.
async function withButtonBusy(button, busyLabel, action) {
  if (!button) return action();
  const originalLabel = button.textContent;
  button.disabled = true;
  if (busyLabel) button.textContent = busyLabel;
  try {
    return await action();
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

/**
 * Boot the store, then call onReady() once vehicle data is available.
 * Redirects to the login page when Firebase is configured but no user
 * is signed in. Falls back to local storage if Firebase is unavailable.
 */
async function initStore(onReady) {
  if (!hasFirebaseConfig()) {
    loadLocal();
    revealShell(false, null);
    onReady();
    return;
  }

  firebase.initializeApp(firebaseConfig);
  state.auth = firebase.auth();
  state.db = firebase.firestore();
  state.useFirestore = true;

  state.auth.onAuthStateChanged(async (user) => {
    state.user = user;
    state.vehicles = [];

    if (!user) {
      state.dataRef = null;
      window.location.replace("./login.html");
      return;
    }

    state.dataRef = state.db.collection("users").doc(user.uid).collection("garage").doc("main");
    // Reveal as soon as auth resolves so a slow or blocked Firestore fetch
    // can never leave the loading spinner stuck. Data renders when it lands.
    revealShell(true, user.email || "Signed in");
    try {
      await loadRemoteData();
    } catch (error) {
      console.error(error);
    }
    onReady();
  });
}

// Local fallback shared by both pages when initStore rejects.
function bootWithFallback(onReady) {
  initStore(onReady).catch((error) => {
    console.error(error);
    state.useFirestore = false;
    loadLocal();
    revealShell(false, null);
    onReady();
  });
}
