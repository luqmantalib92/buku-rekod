/* Vehicle page: one vehicle's service logbook (add / list / delete records). */

const vehicleEls = {
  pageTitle: document.querySelector("#pageTitle"),
  pagePlate: document.querySelector("#pagePlate"),
  backToGarage: document.querySelector("#backToGarage"),
  deleteVehicle: document.querySelector("#deleteVehicle"),
  serviceForm: document.querySelector("#serviceForm"),
  serviceDate: document.querySelector("#serviceDate"),
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
  if (vehicleEls.pageTitle) vehicleEls.pageTitle.textContent = vehicle.name || "Unnamed vehicle";
  if (vehicleEls.pagePlate) vehicleEls.pagePlate.textContent = vehicle.plate || "No plate";

  updateSummary(vehicle);
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
  vehicleEls.serviceForm.reset();
  vehicleEls.serviceDate.valueAsDate = new Date();
  renderVehicle();
});

vehicleEls.clearRecords.addEventListener("click", async () => {
  const vehicle = getVehicle(currentVehicleId());
  if (!vehicle) return;
  const confirmed = confirm("Clear all service records for this vehicle? The vehicle itself stays saved.");
  if (!confirmed) return;
  vehicle.records = [];
  await persist();
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

vehicleEls.serviceDate.valueAsDate = new Date();
bootWithFallback(renderVehicle);
