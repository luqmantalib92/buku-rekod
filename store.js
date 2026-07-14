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
