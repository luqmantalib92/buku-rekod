/* Garage page: the list of vehicles (main screen). Adding a vehicle happens
   on the separate vehicle-form.html page. */

const garageEls = {
  addVehicle: document.querySelector("#addVehicle"),
  emptyAddVehicle: document.querySelector("#emptyAddVehicle"),
  vehicleList: document.querySelector("#vehicleList"),
  vehicleEmpty: document.querySelector("#vehicleEmpty"),
  vehicleCardTemplate: document.querySelector("#vehicleCardTemplate")
};

function openVehicle(id) {
  window.location.href = `./vehicle.html?id=${encodeURIComponent(id)}`;
}

function openVehicleForm() {
  window.location.href = "./vehicle-form.html";
}

garageEls.addVehicle.addEventListener("click", openVehicleForm);
garageEls.emptyAddVehicle.addEventListener("click", openVehicleForm);

function renderGarage() {
  garageEls.vehicleList.replaceChildren();
  const vehicles = [...state.vehicles].sort((a, b) => a.name.localeCompare(b.name));
  garageEls.vehicleEmpty.hidden = vehicles.length > 0;

  for (const vehicle of vehicles) {
    const card = garageEls.vehicleCardTemplate.content.firstElementChild.cloneNode(true);
    const lastRecord = [...vehicle.records].sort((a, b) => b.date.localeCompare(a.date))[0];
    const odometer = latestOdometer(vehicle);

    const thumb = card.querySelector(".vehicle-thumb");
    if (vehicle.image) {
      thumb.src = vehicle.image;
      thumb.hidden = false;
    }

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

window.onPullRefresh = async () => {
  await refreshData();
  renderGarage();
};

bootWithFallback(renderGarage);
