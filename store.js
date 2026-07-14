/* Shared data + auth layer used by both the garage and vehicle pages. */

const LOCAL_KEY = "vehicle-service-log:v1";

const state = {
  vehicles: [],
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

const SERVICE_CATEGORIES = [
  { key: "engine-oil", label: "Engine & oil", items: ["Engine oil", "Oil filter", "Air filter", "Cabin/aircond filter"] },
  { key: "brakes-fluids", label: "Brakes & fluids", items: ["Brake pads", "Brake fluid", "Coolant", "ATF/gearbox oil"] },
  { key: "electrical-wear", label: "Electrical & wear", items: ["Battery", "Spark plugs", "Wipers", "Bulbs"] },
  { key: "tyres-alignment", label: "Tyres & alignment", items: ["Tyre rotation", "Alignment & balancing", "New tyres"] },
  { key: "other", label: "Other", items: [] }
];

function categoryLabel(key) {
  const category = SERVICE_CATEGORIES.find((entry) => entry.key === key);
  return category ? category.label : "Other";
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
    else if (days <= DUE_SOON_DAYS) status = "due-soon";
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
  localStorage.setItem(LOCAL_KEY, JSON.stringify({ vehicles: state.vehicles }));
}

async function loadRemoteData() {
  if (!state.dataRef) return;
  const snapshot = await state.dataRef.get();
  ingest(snapshot.exists ? snapshot.data() : {});
}

async function persist() {
  if (state.useFirestore && state.dataRef) {
    await state.dataRef.set({
      vehicles: state.vehicles,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } else {
    saveLocal();
  }
}

/* ---- Shared shell (topbar) ---- */

const shellEls = {
  appContent: document.querySelector("#appContent"),
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
  if (shellEls.appContent) shellEls.appContent.hidden = false;
  if (shellEls.signOutButton) shellEls.signOutButton.hidden = !signedIn;
  if (shellEls.syncStatus && label) {
    shellEls.syncStatus.textContent = label;
    if (signedIn) shellEls.syncStatus.classList.add("online");
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

    revealShell(true, user.email || "Signed in");
    state.dataRef = state.db.collection("users").doc(user.uid).collection("garage").doc("main");
    await loadRemoteData();
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
