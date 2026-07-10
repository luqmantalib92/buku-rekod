const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

const LOCAL_KEY = "vehicle-service-log:v1";

const state = {
  vehicle: null,
  records: [],
  db: null,
  useFirestore: false
};

const els = {
  syncStatus: document.querySelector("#syncStatus"),
  vehicleForm: document.querySelector("#vehicleForm"),
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
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && window.firebase);
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

function loadLocal() {
  const raw = localStorage.getItem(LOCAL_KEY);
  if (!raw) return;

  try {
    const saved = JSON.parse(raw);
    state.vehicle = saved.vehicle || null;
    state.records = Array.isArray(saved.records) ? saved.records : [];
  } catch {
    state.vehicle = null;
    state.records = [];
  }
}

function saveLocal() {
  localStorage.setItem(LOCAL_KEY, JSON.stringify({
    vehicle: state.vehicle,
    records: state.records
  }));
}

async function initFirestore() {
  if (!hasFirebaseConfig()) {
    loadLocal();
    render();
    return;
  }

  firebase.initializeApp(firebaseConfig);
  state.db = firebase.firestore();
  state.useFirestore = true;
  els.syncStatus.textContent = "Firestore sync";
  els.syncStatus.classList.add("online");

  const snapshot = await state.db.collection("garage").doc("main").get();
  const data = snapshot.exists ? snapshot.data() : {};
  state.vehicle = data.vehicle || null;
  state.records = Array.isArray(data.records) ? data.records : [];
  render();
}

async function persist() {
  if (state.useFirestore) {
    await state.db.collection("garage").doc("main").set({
      vehicle: state.vehicle,
      records: state.records,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } else {
    saveLocal();
  }
}

function fillVehicleForm() {
  if (!state.vehicle) return;
  els.vehicleForm.name.value = state.vehicle.name || "";
  els.vehicleForm.plate.value = state.vehicle.plate || "";
  els.vehicleForm.odometer.value = state.vehicle.odometer || "";
  els.vehicleForm.model.value = state.vehicle.model || "";
}

function updateSummary() {
  const sorted = [...state.records].sort((a, b) => b.date.localeCompare(a.date));
  const latestRecord = sorted[0];
  const latestOdometer = Math.max(
    Number(state.vehicle?.odometer || 0),
    ...state.records.map((record) => Number(record.odometer || 0))
  );
  const totalCost = state.records.reduce((sum, record) => sum + Number(record.cost || 0), 0);

  els.summaryVehicle.textContent = state.vehicle?.name || "Not added";
  els.summaryPlate.textContent = state.vehicle?.plate || "Add your first vehicle";
  els.summaryOdometer.textContent = latestOdometer > 0 ? formatKm(latestOdometer) : "-";
  els.summaryLastService.textContent = latestRecord ? formatDate(latestRecord.date) : "-";
  els.summaryLastServiceMeta.textContent = latestRecord
    ? `${formatKm(latestRecord.odometer)} at ${latestRecord.workshop || "unspecified workshop"}`
    : "No records yet";
  els.summaryCost.textContent = formatMoney(totalCost);
}

function renderRecords() {
  els.recordList.replaceChildren();
  const sorted = [...state.records].sort((a, b) => {
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
    item.querySelector(".icon-button").addEventListener("click", () => deleteRecord(record.id));
    els.recordList.append(item);
  }
}

function render() {
  fillVehicleForm();
  updateSummary();
  renderRecords();
}

async function deleteRecord(id) {
  state.records = state.records.filter((record) => record.id !== id);
  await persist();
  render();
}

els.vehicleForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(els.vehicleForm);
  state.vehicle = {
    name: form.get("name").trim(),
    plate: form.get("plate").trim().toUpperCase(),
    odometer: Number(form.get("odometer")),
    model: form.get("model").trim()
  };
  await persist();
  render();
});

els.serviceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
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

  state.records = [record, ...state.records];
  if (state.vehicle && record.odometer > Number(state.vehicle.odometer || 0)) {
    state.vehicle.odometer = record.odometer;
  }

  await persist();
  els.serviceForm.reset();
  document.querySelector("#serviceDate").valueAsDate = new Date();
  render();
});

els.clearRecords.addEventListener("click", async () => {
  const confirmed = confirm("Clear all service records? Your vehicle details will stay saved.");
  if (!confirmed) return;
  state.records = [];
  await persist();
  render();
});

document.querySelector("#serviceDate").valueAsDate = new Date();
initFirestore().catch((error) => {
  console.error(error);
  els.syncStatus.textContent = "Local fallback";
  state.useFirestore = false;
  loadLocal();
  render();
});
