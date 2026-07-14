/* Vehicle page: one vehicle's service logbook (summary + reminders + record
   list). Adding/editing a record happens on record-form.html; editing the
   vehicle itself happens on vehicle-form.html. */

const vehicleEls = {
  editVehicle: document.querySelector("#editVehicle"),
  deleteVehicle: document.querySelector("#deleteVehicle"),
  addRecord: document.querySelector("#addRecord"),
  emptyAddRecord: document.querySelector("#emptyAddRecord"),
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

function currentVehicleId() {
  return new URLSearchParams(window.location.search).get("id");
}

function goGarage() {
  window.location.href = "./index.html";
}

function openRecordForm(recordId) {
  const id = encodeURIComponent(currentVehicleId());
  const suffix = recordId ? `&record=${encodeURIComponent(recordId)}` : "";
  window.location.href = `./record-form.html?vehicle=${id}${suffix}`;
}

// Human "days left" text for a record's next-service status.
function dueText(days) {
  if (days < 0) return `${Math.abs(days)} day(s) overdue`;
  if (days === 0) return "due today";
  return `in ${days} day(s)`;
}

function updateSummary(vehicle) {
  const latestRecord = [...vehicle.records].sort((a, b) => b.date.localeCompare(a.date))[0];
  const odometer = latestOdometer(vehicle);
  const totalCost = vehicle.records.reduce((sum, record) => sum + Number(record.cost || 0), 0);

  vehicleEls.summaryVehicle.textContent = vehicle.name || "Unnamed vehicle";
  vehicleEls.summaryPlate.textContent = vehicle.plate || "-";
  vehicleEls.summaryOdometer.textContent = odometer > 0 ? formatKm(odometer) : "-";
  vehicleEls.summaryLastService.textContent = latestRecord ? formatDate(latestRecord.date) : "-";
  vehicleEls.summaryLastServiceMeta.textContent = latestRecord
    ? `${formatKm(latestRecord.odometer)} at ${latestRecord.workshop || "unspecified workshop"}`
    : "No records yet";
  vehicleEls.summaryCost.textContent = formatMoney(totalCost);
}

function closeAllRecordMenus() {
  for (const menu of vehicleEls.recordList.querySelectorAll(".record-menu")) {
    menu.hidden = true;
  }
  for (const btn of vehicleEls.recordList.querySelectorAll(".record-menu-btn")) {
    btn.setAttribute("aria-expanded", "false");
  }
}

// Close any open card menu on an outside click or Escape (registered once).
document.addEventListener("click", closeAllRecordMenus);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeAllRecordMenus();
});

function buildRecordCard(record) {
  const item = vehicleEls.recordTemplate.content.firstElementChild.cloneNode(true);
  item.querySelector("h3").textContent = formatDate(record.date);
  item.querySelector(".record-category").textContent = categoryLabel(record.category);
  item.querySelector(".record-meta").textContent = `${formatKm(record.odometer)} · ${record.workshop || "No workshop saved"}`;
  item.querySelector(".record-items").textContent = record.items;
  item.querySelector(".record-cost").textContent = formatMoney(record.cost);
  item.querySelector(".record-next-date").textContent = formatDate(record.nextDate);
  item.querySelector(".record-next-odometer").textContent = record.nextOdometer ? formatKm(record.nextOdometer) : "-";

  const notesEl = item.querySelector(".record-notes");
  notesEl.textContent = record.notes || "";
  notesEl.hidden = !record.notes;

  // Status pill + card highlight + the mark-serviced menu item.
  const dueEl = item.querySelector(".record-due");
  const doneBtn = item.querySelector(".record-done");
  if (record.nextDate) {
    dueEl.hidden = false;
    doneBtn.hidden = false;
    if (record.nextDone) {
      dueEl.textContent = "Serviced";
      dueEl.className = "record-due record-due-done";
      doneBtn.textContent = "Undo serviced";
    } else {
      const status = recordNextStatus(record);
      dueEl.textContent = dueText(status.days);
      dueEl.className = `record-due record-due-${status.status}`;
      if (status.status !== "upcoming") item.classList.add(`is-${status.status}`);
      doneBtn.textContent = "Mark serviced";
    }
    doneBtn.addEventListener("click", () => toggleServiced(record.id));
  }

  // Kebab menu (Mark serviced / Edit / Delete).
  const menuBtn = item.querySelector(".record-menu-btn");
  const menu = item.querySelector(".record-menu");
  menuBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = menu.hidden;
    closeAllRecordMenus();
    if (willOpen) {
      menu.hidden = false;
      menuBtn.setAttribute("aria-expanded", "true");
    }
  });
  item.querySelector(".record-edit").addEventListener("click", () => openRecordForm(record.id));
  item.querySelector(".record-delete").addEventListener("click", () => deleteRecord(record.id));
  return item;
}

const RECORD_GROUP_ORDER = ["overdue", "due-soon", "upcoming", "history"];
const RECORD_GROUP_LABELS = {
  overdue: "Overdue",
  "due-soon": "Due soon",
  upcoming: "Upcoming",
  history: "History"
};

function renderRecords(vehicle) {
  vehicleEls.recordList.replaceChildren();

  // Bucket records by next-service status; history = no active reminder.
  const groups = { overdue: [], "due-soon": [], upcoming: [], history: [] };
  for (const record of vehicle.records) {
    const status = recordNextStatus(record);
    (status ? groups[status.status] : groups.history).push(record);
  }

  const byNextDate = (a, b) => (a.nextDate || "").localeCompare(b.nextDate || "");
  const byServiceDesc = (a, b) => b.date.localeCompare(a.date) || Number(b.odometer || 0) - Number(a.odometer || 0);
  groups.overdue.sort(byNextDate);
  groups["due-soon"].sort(byNextDate);
  groups.upcoming.sort(byNextDate);
  groups.history.sort(byServiceDesc);

  vehicleEls.emptyState.hidden = vehicle.records.length > 0;

  for (const key of RECORD_GROUP_ORDER) {
    const items = groups[key];
    if (!items.length) continue;

    const header = document.createElement("div");
    header.className = `record-group record-group-${key}`;
    const label = document.createElement("span");
    label.className = "record-group-label";
    label.textContent = RECORD_GROUP_LABELS[key];
    const count = document.createElement("span");
    count.className = "record-group-count";
    count.textContent = `${items.length} ${items.length === 1 ? "service" : "services"}`;
    header.append(label, count);
    vehicleEls.recordList.append(header);

    for (const record of items) {
      vehicleEls.recordList.append(buildRecordCard(record));
    }
  }
}

async function toggleServiced(recordId) {
  const vehicle = getVehicle(currentVehicleId());
  const record = vehicle && vehicle.records.find((entry) => entry.id === recordId);
  if (!record) return;
  record.nextDone = !record.nextDone;
  await persist();
  renderVehicle();
}

function renderVehicle() {
  const vehicle = getVehicle(currentVehicleId());
  if (!vehicle) {
    // Unknown / deleted vehicle — send the user back to the garage.
    goGarage();
    return;
  }

  document.title = `${vehicle.name || "Vehicle"} | Service Log`;
  updateSummary(vehicle);
  renderRecords(vehicle);
}

async function deleteRecord(recordId) {
  const vehicle = getVehicle(currentVehicleId());
  if (!vehicle) return;
  const ok = await confirmDialog({
    title: "Delete this record?",
    message: "This service record will be removed.",
    confirmLabel: "Delete",
    danger: true
  });
  if (!ok) return;
  vehicle.records = vehicle.records.filter((record) => record.id !== recordId);
  await persist();
  renderVehicle();
}

vehicleEls.addRecord.addEventListener("click", () => openRecordForm(null));
vehicleEls.emptyAddRecord.addEventListener("click", () => openRecordForm(null));

vehicleEls.editVehicle.addEventListener("click", () => {
  window.location.href = `./vehicle-form.html?id=${encodeURIComponent(currentVehicleId())}`;
});

vehicleEls.clearRecords.addEventListener("click", async () => {
  const vehicle = getVehicle(currentVehicleId());
  if (!vehicle) return;
  const ok = await confirmDialog({
    title: "Clear all records?",
    message: "Every service record for this vehicle will be removed. The vehicle itself stays saved.",
    confirmLabel: "Clear all",
    danger: true
  });
  if (!ok) return;
  vehicle.records = [];
  await persist();
  renderVehicle();
});

vehicleEls.deleteVehicle.addEventListener("click", async () => {
  const vehicle = getVehicle(currentVehicleId());
  if (!vehicle) return;
  const ok = await confirmDialog({
    title: `Delete "${vehicle.name || "this vehicle"}"?`,
    message: "The vehicle and all its service logs will be deleted. This can't be undone.",
    confirmLabel: "Delete",
    danger: true
  });
  if (!ok) return;
  state.vehicles = state.vehicles.filter((item) => item.id !== vehicle.id);
  await persist();
  goGarage();
});

setupBackButton("./index.html");

window.onPullRefresh = async () => {
  await refreshData();
  renderVehicle();
};

renderSkeletonCards(vehicleEls.recordList, 3);
bootWithFallback(renderVehicle);
