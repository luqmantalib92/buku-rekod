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
    createdAt: source.createdAt || new Date().toISOString(),
    records: Array.isArray(source.records) ? source.records : []
  };
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
  syncStatus: document.querySelector("#syncStatus")
};

async function signOut() {
  if (state.auth) await state.auth.signOut();
  window.location.replace("./login.html");
}

if (shellEls.signOutButton) {
  shellEls.signOutButton.addEventListener("click", signOut);
}

function revealShell(signedIn, label) {
  if (shellEls.appLoading) shellEls.appLoading.hidden = true;
  if (shellEls.appContent) shellEls.appContent.hidden = false;
  if (shellEls.signOutButton) shellEls.signOutButton.hidden = !signedIn;
  if (shellEls.syncStatus && label) {
    shellEls.syncStatus.textContent = label;
    if (signedIn) shellEls.syncStatus.classList.add("online");
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
  if (shellEls.syncStatus) shellEls.syncStatus.textContent = "Checking session";

  state.auth.onAuthStateChanged(async (user) => {
    state.user = user;
    state.vehicles = [];

    if (!user) {
      state.dataRef = null;
      window.location.replace("./login.html");
      return;
    }

    state.dataRef = state.db.collection("users").doc(user.uid).collection("garage").doc("main");
    try {
      await loadRemoteData();
    } catch (error) {
      // Don't leave the loading spinner stuck on a fetch failure — reveal the
      // app with whatever we have (empty) so the user isn't blocked.
      console.error(error);
    }
    // Reveal only after data is in, so content paints populated (no flash of
    // the "add your first vehicle" empty state during the fetch).
    revealShell(true, user.email || "Signed in");
    onReady();
  });
}

// Local fallback shared by both pages when initStore rejects.
function bootWithFallback(onReady) {
  initStore(onReady).catch((error) => {
    console.error(error);
    if (shellEls.syncStatus) shellEls.syncStatus.textContent = "Local fallback";
    state.useFirestore = false;
    loadLocal();
    revealShell(false, null);
    onReady();
  });
}
