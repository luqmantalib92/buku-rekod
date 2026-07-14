/* Garage page: list of vehicles + add a vehicle. */

const garageEls = {
  vehicleForm: document.querySelector("#vehicleForm"),
  vehicleList: document.querySelector("#vehicleList"),
  vehicleEmpty: document.querySelector("#vehicleEmpty"),
  vehicleCardTemplate: document.querySelector("#vehicleCardTemplate")
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
    card.setAttribute("aria-label", `${vehicle.name || "Unnamed vehicle"}, view logs`);
    card.addEventListener("click", () => openVehicle(vehicle.id));
    garageEls.vehicleList.append(card);
  }
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

  state.vehicles.push(vehicle);
  await persist();
  garageEls.vehicleForm.reset();
  renderGarage();
});

bootWithFallback(renderGarage);
