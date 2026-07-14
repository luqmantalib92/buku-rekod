const LOCAL_KEY = "vehicle-service-log:v1";

const state = {
  vehicles: [],
  currentVehicleId: null,
  user: null,
  auth: null,
  db: null,
  dataRef: null,
  useFirestore: false
};

const els = {
  appContent: document.querySelector("#appContent"),
  signOutButton: document.querySelector("#signOutButton"),
  syncStatus: document.querySelector("#syncStatus"),
  // Garage view
  garageView: document.querySelector("#garageView"),
  vehicleForm: document.querySelector("#vehicleForm"),
  vehicleList: document.querySelector("#vehicleList"),
  vehicleEmpty: document.querySelector("#vehicleEmpty"),
  vehicleCardTemplate: document.querySelector("#vehicleCardTemplate"),
  // Vehicle detail view
  vehicleView: document.querySelector("#vehicleView"),
  backToGarage: document.querySelector("#backToGarage"),
  deleteVehicle: document.querySelector("#deleteVehicle"),
  serviceForm: document.querySelector("#serviceForm"),
  clearRecords: document.querySelector("#clearRecords"),
  recordList: document.querySelector("#recordList"),
  emptyState: document.querySelector("#emptyState"),
  recordTemplate: document.querySelector("#recordTemplate"),
  summaryVehicle: document.querySelector("#summaryVehicle"),
  summaryPlate: document.querySelector("#summaryPlate"),
  summaryOdometer: document.querySelector("#summaryOdometer"),
  summaryLastService: document.querySelector("#summaryLastService"),
  summaryLastServiceMeta: document.querySelector("#summaryLastServiceMeta"),
  summaryCost: document.querySelector("#summaryCost")
};

function hasFirebaseConfig() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && window.firebase?.auth && window.firebase?.firestore);
}

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

async function initFirestore() {
  if (!hasFirebaseConfig()) {
    loadLocal();
    els.appContent.hidden = false;
    els.signOutButton.hidden = true;
    render();
    return;
  }

  firebase.initializeApp(firebaseConfig);
  state.auth = firebase.auth();
  state.db = firebase.firestore();
  state.useFirestore = true;
  els.syncStatus.textContent = "Checking session";

  state.auth.onAuthStateChanged(async (user) => {
    state.user = user;
    state.vehicles = [];

    if (!user) {
      state.dataRef = null;
      window.location.replace("./login.html");
      return;
    }

    els.appContent.hidden = false;
    els.signOutButton.hidden = false;
    els.syncStatus.textContent = user.email || "Signed in";
    els.syncStatus.classList.add("online");
    state.dataRef = state.db.collection("users").doc(user.uid).collection("garage").doc("main");

    await loadRemoteData();
  });
}

async function loadRemoteData() {
  if (!state.dataRef) return;
  const snapshot = await state.dataRef.get();
  ingest(snapshot.exists ? snapshot.data() : {});
  render();
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

/* ---- Routing (hash-based) ---- */

function currentRoute() {
  const match = (location.hash || "").match(/^#\/v\/(.+)$/);
  return match ? { view: "vehicle", id: decodeURIComponent(match[1]) } : { view: "garage" };
}

function goGarage() {
  location.hash = "#/";
}

function goVehicle(id) {
  location.hash = `#/v/${encodeURIComponent(id)}`;
}

function showView(name) {
  els.garageView.hidden = name !== "garage";
  els.vehicleView.hidden = name !== "vehicle";
}

function render() {
  const route = currentRoute();

  if (route.view === "vehicle") {
    const vehicle = getVehicle(route.id);
    if (!vehicle) {
      goGarage(); // hashchange re-triggers render()
      return;
    }
    state.currentVehicleId = vehicle.id;
    showView("vehicle");
    renderVehicleDetail(vehicle);
  } else {
    state.currentVehicleId = null;
    showView("garage");
    renderGarage();
  }

  window.scrollTo(0, 0);
}

/* ---- Garage view ---- */

function renderGarage() {
  els.vehicleList.replaceChildren();
  const vehicles = [...state.vehicles].sort((a, b) => a.name.localeCompare(b.name));
  els.vehicleEmpty.hidden = vehicles.length > 0;

  for (const vehicle of vehicles) {
    const card = els.vehicleCardTemplate.content.firstElementChild.cloneNode(true);
    const lastRecord = [...vehicle.records].sort((a, b) => b.date.localeCompare(a.date))[0];
    const odometer = latestOdometer(vehicle);

    card.querySelector(".vehicle-name").textContent = vehicle.name || "Unnamed vehicle";
    card.querySelector(".vehicle-plate").textContent = vehicle.plate || "No plate";
    card.querySelector(".vehicle-odometer").textContent = odometer > 0 ? formatKm(odometer) : "-";
    card.querySelector(".vehicle-count").textContent = String(vehicle.records.length);
    card.querySelector(".vehicle-last").textContent = lastRecord ? formatDate(lastRecord.date) : "-";
    card.setAttribute("aria-label", `${vehicle.name || "Unnamed vehicle"}, view logs`);
    card.addEventListener("click", () => goVehicle(vehicle.id));
    els.vehicleList.append(card);
  }
}

/* ---- Vehicle detail view ---- */

function renderVehicleDetail(vehicle) {
  updateSummary(vehicle);
  renderRecords(vehicle);
}

function updateSummary(vehicle) {
  const latestRecord = [...vehicle.records].sort((a, b) => b.date.localeCompare(a.date))[0];
  const odometer = latestOdometer(vehicle);
  const totalCost = vehicle.records.reduce((sum, record) => sum + Number(record.cost || 0), 0);

  els.summaryVehicle.textContent = vehicle.name || "Unnamed vehicle";
  els.summaryPlate.textContent = vehicle.plate || "-";
  els.summaryOdometer.textContent = odometer > 0 ? formatKm(odometer) : "-";
  els.summaryLastService.textContent = latestRecord ? formatDate(latestRecord.date) : "-";
  els.summaryLastServiceMeta.textContent = latestRecord
    ? `${formatKm(latestRecord.odometer)} at ${latestRecord.workshop || "unspecified workshop"}`
    : "No records yet";
  els.summaryCost.textContent = formatMoney(totalCost);
}

function renderRecords(vehicle) {
  els.recordList.replaceChildren();
  const sorted = [...vehicle.records].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    return byDate || Number(b.odometer || 0) - Number(a.odometer || 0);
  });

  els.emptyState.hidden = sorted.length > 0;

  for (const record of sorted) {
    const item = els.recordTemplate.content.firstElementChild.cloneNode(true);
    item.querySelector("h3").textContent = formatDate(record.date);
    item.querySelector(".record-meta").textContent = `${formatKm(record.odometer)} · ${record.workshop || "No workshop saved"}`;
    item.querySelector(".record-items").textContent = record.items;
    item.querySelector(".record-cost").textContent = formatMoney(record.cost);
    item.querySelector(".record-next-date").textContent = formatDate(record.nextDate);
    item.querySelector(".record-next-odometer").textContent = record.nextOdometer ? formatKm(record.nextOdometer) : "-";
    item.querySelector(".record-notes").textContent = record.notes || "";
    item.querySelector(".icon-button").addEventListener("click", () => deleteRecord(vehicle.id, record.id));
    els.recordList.append(item);
  }
}

async function deleteRecord(vehicleId, recordId) {
  const vehicle = getVehicle(vehicleId);
  if (!vehicle) return;
  vehicle.records = vehicle.records.filter((record) => record.id !== recordId);
  await persist();
  renderVehicleDetail(vehicle);
}

/* ---- Event handlers ---- */

els.vehicleForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(els.vehicleForm);
  const vehicle = normalizeVehicle({
    id: makeId(),
    name: form.get("name").trim(),
    plate: form.get("plate").trim().toUpperCase(),
    odometer: Number(form.get("odometer")),
    model: form.get("model").trim(),
    createdAt: new Date().toISOString(),
    records: []
  });

  state.vehicles.push(vehicle);
  await persist();
  els.vehicleForm.reset();
  renderGarage();
});

els.serviceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  // Guard: a record can only exist under a selected vehicle. The form is
  // only visible inside a vehicle's page, but this blocks any edge/stale
  // state from creating an orphan record.
  const vehicle = getVehicle(state.currentVehicleId);
  if (!vehicle) {
    alert("Select a vehicle first, then add its service record.");
    goGarage();
    return;
  }

  const form = new FormData(els.serviceForm);
  const record = {
    id: makeId(),
    date: form.get("date"),
    odometer: Number(form.get("odometer")),
    workshop: form.get("workshop").trim(),
    cost: Number(form.get("cost") || 0),
    items: form.get("items").trim(),
    nextDate: form.get("nextDate"),
    nextOdometer: form.get("nextOdometer") ? Number(form.get("nextOdometer")) : "",
    notes: form.get("notes").trim(),
    createdAt: new Date().toISOString()
  };

  vehicle.records = [record, ...vehicle.records];
  if (record.odometer > Number(vehicle.odometer || 0)) {
    vehicle.odometer = record.odometer;
  }

  await persist();
  els.serviceForm.reset();
  document.querySelector("#serviceDate").valueAsDate = new Date();
  renderVehicleDetail(vehicle);
});

els.clearRecords.addEventListener("click", async () => {
  const vehicle = getVehicle(state.currentVehicleId);
  if (!vehicle) return;
  const confirmed = confirm("Clear all service records for this vehicle? The vehicle itself stays saved.");
  if (!confirmed) return;
  vehicle.records = [];
  await persist();
  renderVehicleDetail(vehicle);
});

els.deleteVehicle.addEventListener("click", async () => {
  const vehicle = getVehicle(state.currentVehicleId);
  if (!vehicle) return;
  const confirmed = confirm(`Delete "${vehicle.name || "this vehicle"}" and all its logs? This can't be undone.`);
  if (!confirmed) return;
  state.vehicles = state.vehicles.filter((item) => item.id !== vehicle.id);
  await persist();
  goGarage();
});

els.backToGarage.addEventListener("click", () => goGarage());

els.signOutButton.addEventListener("click", async () => {
  await state.auth.signOut();
  window.location.replace("./login.html");
});

window.addEventListener("hashchange", render);

document.querySelector("#serviceDate").valueAsDate = new Date();
initFirestore().catch((error) => {
  console.error(error);
  els.syncStatus.textContent = "Local fallback";
  state.useFirestore = false;
  loadLocal();
  els.appContent.hidden = false;
  render();
});
