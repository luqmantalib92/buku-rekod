/* Vehicle page: one vehicle's service logbook (summary + reminders + record
   list). Adding/editing a record happens on record-form.html; editing the
   vehicle itself happens on vehicle-form.html. */

const vehicleEls = {
  editVehicle: document.querySelector("#editVehicle"),
  deleteVehicle: document.querySelector("#deleteVehicle"),
  addRecord: document.querySelector("#addRecord"),
  emptyAddRecord: document.querySelector("#emptyAddRecord"),
  reminders: document.querySelector("#reminders"),
  reminderList: document.querySelector("#reminderList"),
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

function renderReminders(vehicle) {
  const reminders = vehicleReminders(vehicle);
  vehicleEls.reminders.hidden = reminders.length === 0;
  vehicleEls.reminderList.replaceChildren();

  for (const reminder of reminders) {
    const row = document.createElement("div");
    row.className = `reminder reminder-${reminder.status}`;

    const label = document.createElement("span");
    label.className = "reminder-label";
    label.textContent = reminder.label;

    const when = reminder.days < 0
      ? `${Math.abs(reminder.days)} day(s) overdue`
      : reminder.days === 0
        ? "due today"
        : `in ${reminder.days} day(s)`;

    const meta = document.createElement("span");
    meta.className = "reminder-meta";
    meta.textContent = `${formatDate(reminder.nextDate)} · ${when}`;

    row.append(label, meta);
    vehicleEls.reminderList.append(row);
  }
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

function renderRecords(vehicle) {
  vehicleEls.recordList.replaceChildren();
  // Sort by next-service date, soonest first (so what's due next is on top).
  // Records without a next date fall to the bottom, newest service first.
  const sorted = [...vehicle.records].sort((a, b) => {
    const an = a.nextDate || "";
    const bn = b.nextDate || "";
    if (an && bn) {
      if (an !== bn) return an.localeCompare(bn);
    } else if (an || bn) {
      return an ? -1 : 1;
    }
    return b.date.localeCompare(a.date) || Number(b.odometer || 0) - Number(a.odometer || 0);
  });

  vehicleEls.emptyState.hidden = sorted.length > 0;

  for (const record of sorted) {
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

    item.querySelector(".record-edit").addEventListener("click", () => openRecordForm(record.id));
    item.querySelector(".record-delete").addEventListener("click", () => deleteRecord(record.id));
    vehicleEls.recordList.append(item);
  }
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
  renderReminders(vehicle);
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

bootWithFallback(renderVehicle);
