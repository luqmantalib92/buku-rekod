/* Vehicle page: one vehicle's service logbook (summary + reminders + record
   list). Adding/editing a record happens on record-form.html; editing the
   vehicle itself happens on vehicle-form.html. */

const vehicleEls = {
  addRecord: document.querySelector("#addRecord"),
  emptyAddRecord: document.querySelector("#emptyAddRecord"),
  fabAddRecord: document.querySelector("#fabAddRecord"),
  recordList: document.querySelector("#recordList"),
  emptyState: document.querySelector("#emptyState"),
  recordTemplate: document.querySelector("#recordTemplate"),
  summaryVehicle: document.querySelector("#summaryVehicle"),
  summaryPlate: document.querySelector("#summaryPlate"),
  summaryOdometer: document.querySelector("#summaryOdometer"),
  summaryOdometerMeta: document.querySelector("#summaryOdometerMeta"),
  updateOdometer: document.querySelector("#updateOdometer"),
  summaryLastService: document.querySelector("#summaryLastService"),
  summaryLastServiceMeta: document.querySelector("#summaryLastServiceMeta"),
  summaryCost: document.querySelector("#summaryCost"),
  summaryRoadTax: document.querySelector("#summaryRoadTax"),
  summaryRoadTaxMeta: document.querySelector("#summaryRoadTaxMeta"),
  summaryInsurance: document.querySelector("#summaryInsurance"),
  summaryInsuranceMeta: document.querySelector("#summaryInsuranceMeta")
};

function currentVehicleId() {
  return new URLSearchParams(window.location.search).get("id");
}

function goGarage() {
  window.location.href = "./vehicles.html";
}

function openRecordForm(recordId) {
  const id = encodeURIComponent(currentVehicleId());
  const suffix = recordId ? `&record=${encodeURIComponent(recordId)}` : "";
  window.location.href = `./record-form.html?vehicle=${id}${suffix}`;
}

// Human text for a record's next-service status — km-driven ("in 800 km")
// when the odometer is the more urgent signal, otherwise days.
function dueText(status) {
  if (status.by === "km") {
    const km = Math.abs(status.kmLeft).toLocaleString("en-MY");
    if (status.kmLeft < 0) return `${km} km overdue`;
    if (status.kmLeft === 0) return "due now";
    return `in ${km} km`;
  }
  if (status.days < 0) return `${Math.abs(status.days)} day(s) overdue`;
  if (status.days === 0) return "due today";
  return `in ${status.days} day(s)`;
}

// Human text for a road tax / insurance expiry entry.
function expiryText(entry) {
  if (entry.days < 0) return `Expired ${Math.abs(entry.days)} day(s) ago`;
  if (entry.days === 0) return "Expires today";
  return `Expires in ${entry.days} day(s)`;
}

function updateSummary(vehicle) {
  const latestRecord = [...vehicle.records].sort((a, b) => b.date.localeCompare(a.date))[0];
  const odometer = latestOdometer(vehicle);
  const totalCost = vehicle.records.reduce((sum, record) => sum + Number(record.cost || 0), 0);

  vehicleEls.summaryVehicle.textContent = vehicle.name || "Unnamed vehicle";
  vehicleEls.summaryPlate.textContent = vehicle.plate || "-";
  vehicleEls.summaryOdometer.textContent = odometer > 0 ? formatKm(odometer) : "-";
  vehicleEls.summaryOdometerMeta.textContent = vehicle.odometerDate
    ? `Updated ${formatDate(vehicle.odometerDate)}`
    : "Latest saved reading";
  vehicleEls.summaryLastService.textContent = latestRecord ? formatDate(latestRecord.date) : "-";
  vehicleEls.summaryLastServiceMeta.textContent = latestRecord
    ? `${formatKm(latestRecord.odometer)} at ${latestRecord.workshop || "unspecified workshop"}`
    : "No records yet";
  vehicleEls.summaryCost.textContent = formatMoney(totalCost);

  const expiries = new Map(vehicleExpiries(vehicle).map((entry) => [entry.field, entry]));
  for (const [field, valueEl, metaEl] of [
    ["roadTaxExpiry", vehicleEls.summaryRoadTax, vehicleEls.summaryRoadTaxMeta],
    ["insuranceExpiry", vehicleEls.summaryInsurance, vehicleEls.summaryInsuranceMeta]
  ]) {
    const entry = expiries.get(field);
    valueEl.textContent = entry ? formatDate(entry.date) : "-";
    metaEl.textContent = entry ? expiryText(entry) : "Set it in Edit details";
    metaEl.className = entry && entry.status !== "ok" ? `summary-meta-${entry.status}` : "";
  }
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

function buildRecordCard(record, currentOdometer) {
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
  if (record.nextDate || record.nextOdometer) {
    doneBtn.hidden = false;
    if (record.nextDone) {
      dueEl.hidden = false;
      dueEl.textContent = "Serviced";
      dueEl.className = "record-due record-due-done";
      item.classList.add("is-done");
      doneBtn.textContent = "Undo serviced";
    } else {
      const status = recordNextStatus(record, currentOdometer);
      if (status) {
        dueEl.hidden = false;
        dueEl.textContent = dueText(status);
        dueEl.className = `record-due record-due-${status.status}`;
        item.classList.add(`is-${status.status}`);
      }
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

  const currentOdometer = latestOdometer(vehicle);

  // Bucket records by next-service status; history = no active reminder.
  const groups = { overdue: [], "due-soon": [], upcoming: [], history: [] };
  for (const record of vehicle.records) {
    const status = recordNextStatus(record, currentOdometer);
    (status ? groups[status.status] : groups.history).push(record);
  }

  // Records tracked only by odometer have no next date — sort them last.
  const byNextDate = (a, b) => (a.nextDate || "9999").localeCompare(b.nextDate || "9999");
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
      vehicleEls.recordList.append(buildRecordCard(record, currentOdometer));
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

  document.title = `${vehicle.name || "Vehicle"} | Logbook`;
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

vehicleEls.updateOdometer.addEventListener("click", async () => {
  const saved = await promptOdometerUpdate(currentVehicleId());
  if (saved) renderVehicle();
});

vehicleEls.addRecord.addEventListener("click", () => openRecordForm(null));
vehicleEls.emptyAddRecord.addEventListener("click", () => openRecordForm(null));
vehicleEls.fabAddRecord.addEventListener("click", () => openRecordForm(null));

setupBackButton("./vehicles.html");

window.onPullRefresh = async () => {
  await refreshData();
  renderVehicle();
};

renderSkeletonCards(vehicleEls.recordList, 3);
bootWithFallback(renderVehicle);
