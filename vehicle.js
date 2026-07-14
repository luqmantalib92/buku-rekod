/* Vehicle page: one vehicle's service logbook (add / list / delete records). */

const vehicleEls = {
  backToGarage: document.querySelector("#backToGarage"),
  editVehicle: document.querySelector("#editVehicle"),
  deleteVehicle: document.querySelector("#deleteVehicle"),
  editPanel: document.querySelector("#editPanel"),
  editVehicleForm: document.querySelector("#editVehicleForm"),
  editName: document.querySelector("#editName"),
  editPlate: document.querySelector("#editPlate"),
  editOdometer: document.querySelector("#editOdometer"),
  editModel: document.querySelector("#editModel"),
  cancelEdit: document.querySelector("#cancelEdit"),
  serviceForm: document.querySelector("#serviceForm"),
  serviceDate: document.querySelector("#serviceDate"),
  serviceCategory: document.querySelector("#serviceCategory"),
  itemChips: document.querySelector("#serviceItemChips"),
  chipsHint: document.querySelector("#chipsHint"),
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

/* ---- Category + item chips ---- */

const selectedItems = new Set();

function populateCategories() {
  for (const category of SERVICE_CATEGORIES) {
    const option = document.createElement("option");
    option.value = category.key;
    option.textContent = category.label;
    vehicleEls.serviceCategory.append(option);
  }
}

function renderItemChips() {
  const category = SERVICE_CATEGORIES.find((entry) => entry.key === vehicleEls.serviceCategory.value);
  vehicleEls.itemChips.replaceChildren();
  selectedItems.clear();

  if (!category) {
    vehicleEls.itemChips.hidden = true;
    vehicleEls.chipsHint.textContent = "Pick a category to see common items.";
    vehicleEls.chipsHint.hidden = false;
    return;
  }

  if (!category.items.length) {
    vehicleEls.itemChips.hidden = true;
    vehicleEls.chipsHint.textContent = "No preset items for this category — use Details below.";
    vehicleEls.chipsHint.hidden = false;
    return;
  }

  vehicleEls.chipsHint.hidden = true;
  vehicleEls.itemChips.hidden = false;
  for (const item of category.items) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = item;
    chip.setAttribute("aria-pressed", "false");
    chip.addEventListener("click", () => {
      const on = chip.getAttribute("aria-pressed") === "true";
      chip.setAttribute("aria-pressed", String(!on));
      chip.classList.toggle("chip-on", !on);
      if (on) selectedItems.delete(item);
      else selectedItems.add(item);
    });
    vehicleEls.itemChips.append(chip);
  }
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

function goGarage() {
  window.location.href = "./index.html";
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
  const sorted = [...vehicle.records].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    return byDate || Number(b.odometer || 0) - Number(a.odometer || 0);
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
    item.querySelector(".record-notes").textContent = record.notes || "";
    item.querySelector(".icon-button").addEventListener("click", () => deleteRecord(record.id));
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
  vehicle.records = vehicle.records.filter((record) => record.id !== recordId);
  await persist();
  renderVehicle();
}

vehicleEls.serviceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const vehicle = getVehicle(currentVehicleId());
  if (!vehicle) {
    goGarage();
    return;
  }

  const form = new FormData(vehicleEls.serviceForm);
  const extra = form.get("items").trim();
  const items = [...selectedItems, ...(extra ? [extra] : [])].join(", ");
  const record = {
    id: makeId(),
    category: form.get("category") || "other",
    date: form.get("date"),
    odometer: Number(form.get("odometer")),
    workshop: form.get("workshop").trim(),
    cost: Number(form.get("cost") || 0),
    items,
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
  vehicleEls.serviceForm.reset();
  vehicleEls.serviceDate.valueAsDate = new Date();
  renderItemChips();
  renderVehicle();
});

vehicleEls.serviceCategory.addEventListener("change", renderItemChips);

vehicleEls.clearRecords.addEventListener("click", async () => {
  const vehicle = getVehicle(currentVehicleId());
  if (!vehicle) return;
  const confirmed = confirm("Clear all service records for this vehicle? The vehicle itself stays saved.");
  if (!confirmed) return;
  vehicle.records = [];
  await persist();
  renderVehicle();
});

function openEdit() {
  const vehicle = getVehicle(currentVehicleId());
  if (!vehicle) return;
  vehicleEls.editName.value = vehicle.name || "";
  vehicleEls.editPlate.value = vehicle.plate || "";
  vehicleEls.editOdometer.value = vehicle.odometer || "";
  vehicleEls.editModel.value = vehicle.model || "";
  vehicleEls.editPanel.hidden = false;
  vehicleEls.editName.focus();
}

function closeEdit() {
  vehicleEls.editPanel.hidden = true;
}

vehicleEls.editVehicle.addEventListener("click", () => {
  if (vehicleEls.editPanel.hidden) openEdit();
  else closeEdit();
});

vehicleEls.cancelEdit.addEventListener("click", closeEdit);

vehicleEls.editVehicleForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const vehicle = getVehicle(currentVehicleId());
  if (!vehicle) {
    goGarage();
    return;
  }

  const form = new FormData(vehicleEls.editVehicleForm);
  vehicle.name = form.get("name").trim();
  vehicle.plate = form.get("plate").trim().toUpperCase();
  const odometer = Number(form.get("odometer"));
  if (Number.isFinite(odometer)) vehicle.odometer = odometer;
  vehicle.model = form.get("model").trim();

  await persist();
  closeEdit();
  renderVehicle();
});

vehicleEls.deleteVehicle.addEventListener("click", async () => {
  const vehicle = getVehicle(currentVehicleId());
  if (!vehicle) return;
  const confirmed = confirm(`Delete "${vehicle.name || "this vehicle"}" and all its logs? This can't be undone.`);
  if (!confirmed) return;
  state.vehicles = state.vehicles.filter((item) => item.id !== vehicle.id);
  await persist();
  goGarage();
});

vehicleEls.backToGarage.addEventListener("click", goGarage);

window.onPullRefresh = async () => {
  await refreshData();
  renderVehicle();
};

vehicleEls.serviceDate.valueAsDate = new Date();
populateCategories();
renderItemChips();
bootWithFallback(renderVehicle);
