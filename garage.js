/* Garage page: list of vehicles + add a vehicle. */

const garageEls = {
  vehicleForm: document.querySelector("#vehicleForm"),
  vehicleList: document.querySelector("#vehicleList"),
  vehicleEmpty: document.querySelector("#vehicleEmpty"),
  vehicleCardTemplate: document.querySelector("#vehicleCardTemplate"),
  settingsForm: document.querySelector("#settingsForm"),
  settingsRows: document.querySelector("#settingsRows"),
  settingsSaved: document.querySelector("#settingsSaved")
};

function openVehicle(id) {
  window.location.href = `./vehicle.html?id=${encodeURIComponent(id)}`;
}

function renderGarage() {
  garageEls.vehicleList.replaceChildren();
  const vehicles = [...state.vehicles].sort((a, b) => a.name.localeCompare(b.name));
  garageEls.vehicleEmpty.hidden = vehicles.length > 0;

  for (const vehicle of vehicles) {
    const card = garageEls.vehicleCardTemplate.content.firstElementChild.cloneNode(true);
    const lastRecord = [...vehicle.records].sort((a, b) => b.date.localeCompare(a.date))[0];
    const odometer = latestOdometer(vehicle);

    card.querySelector(".vehicle-name").textContent = vehicle.name || "Unnamed vehicle";
    card.querySelector(".vehicle-plate").textContent = vehicle.plate || "No plate";
    card.querySelector(".vehicle-odometer").textContent = odometer > 0 ? formatKm(odometer) : "-";
    card.querySelector(".vehicle-count").textContent = String(vehicle.records.length);
    card.querySelector(".vehicle-last").textContent = lastRecord ? formatDate(lastRecord.date) : "-";

    const dueCount = vehicleDueCount(vehicle);
    const dueEl = card.querySelector(".vehicle-due");
    if (dueCount > 0) {
      dueEl.hidden = false;
      dueEl.textContent = `${dueCount} due`;
    }

    const dueSuffix = dueCount > 0 ? `, ${dueCount} service(s) due` : "";
    card.setAttribute("aria-label", `${vehicle.name || "Unnamed vehicle"}, view logs${dueSuffix}`);
    card.addEventListener("click", () => openVehicle(vehicle.id));
    garageEls.vehicleList.append(card);
  }
}

function renderSettings() {
  garageEls.settingsRows.replaceChildren();
  for (const category of getCategories()) {
    const label = document.createElement("label");
    label.className = "settings-row";
    label.textContent = category.label;

    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.name = category.key;
    input.value = leadDaysFor(category.key);

    label.append(input);
    garageEls.settingsRows.append(label);
  }
}

garageEls.settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(garageEls.settingsForm);
  const leadDays = {};
  for (const category of getCategories()) {
    const value = Number(form.get(category.key));
    if (Number.isFinite(value) && value >= 0) leadDays[category.key] = value;
  }
  state.settings = { leadDays };
  const submitButton = garageEls.settingsForm.querySelector('button[type="submit"]');
  await withButtonBusy(submitButton, "Saving…", () => persist());
  renderGarage();

  garageEls.settingsSaved.hidden = false;
  setTimeout(() => { garageEls.settingsSaved.hidden = true; }, 2000);
});

function onGarageReady() {
  renderGarage();
  renderSettings();
}

garageEls.vehicleForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(garageEls.vehicleForm);
  const vehicle = normalizeVehicle({
    id: makeId(),
    name: form.get("name").trim(),
    plate: form.get("plate").trim().toUpperCase(),
    odometer: Number(form.get("odometer")),
    model: form.get("model").trim(),
    createdAt: new Date().toISOString(),
    records: []
  });

  const submitButton = garageEls.vehicleForm.querySelector('button[type="submit"]');
  state.vehicles.push(vehicle);
  await withButtonBusy(submitButton, "Adding…", () => persist());
  garageEls.vehicleForm.reset();
  renderGarage();
});

window.onPullRefresh = async () => {
  await refreshData();
  onGarageReady();
};

bootWithFallback(onGarageReady);
