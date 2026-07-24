/* Garage page (vehicles.html): the list of vehicles. Adding a vehicle happens
   on vehicle-form.html; each card has a ⋮ menu to edit or delete. */

const garageEls = {
  addVehicle: document.querySelector("#addVehicle"),
  emptyAddVehicle: document.querySelector("#emptyAddVehicle"),
  fabAddVehicle: document.querySelector("#fabAddVehicle"),
  vehicleList: document.querySelector("#vehicleList"),
  vehicleEmpty: document.querySelector("#vehicleEmpty"),
  vehicleCardTemplate: document.querySelector("#vehicleCardTemplate")
};

function openVehicle(id) {
  window.location.href = `./vehicle.html?id=${encodeURIComponent(id)}`;
}

function openVehicleForm(id) {
  const suffix = id ? `?id=${encodeURIComponent(id)}` : "";
  window.location.href = `./vehicle-form.html${suffix}`;
}

garageEls.addVehicle.addEventListener("click", () => openVehicleForm());
garageEls.emptyAddVehicle.addEventListener("click", () => openVehicleForm());
garageEls.fabAddVehicle.addEventListener("click", () => openVehicleForm());

function closeAllVehicleMenus() {
  for (const menu of garageEls.vehicleList.querySelectorAll(".vehicle-menu")) {
    menu.hidden = true;
  }
  for (const btn of garageEls.vehicleList.querySelectorAll(".vehicle-menu-btn")) {
    btn.setAttribute("aria-expanded", "false");
  }
}

// Close any open card menu on an outside click or Escape (registered once).
document.addEventListener("click", closeAllVehicleMenus);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeAllVehicleMenus();
});

async function deleteVehicle(id) {
  const vehicle = getVehicle(id);
  if (!vehicle) return;
  const ok = await confirmDialog({
    title: `Delete "${vehicle.name || "this vehicle"}"?`,
    message: "The vehicle and all its service logs will be deleted. This can't be undone.",
    confirmLabel: "Delete",
    danger: true
  });
  if (!ok) return;
  state.vehicles = state.vehicles.filter((item) => item.id !== id);
  await persist();
  renderGarage();
}

function buildVehicleCard(vehicle) {
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
  card.querySelector(".vehicle-last").textContent = lastRecord ? formatDate(lastRecord.date) : "-";

  const dueCount = vehicleDueCount(vehicle);
  const dueEl = card.querySelector(".vehicle-due");
  if (dueCount > 0) {
    dueEl.hidden = false;
    dueEl.textContent = `${dueCount} due`;
  }

  const dueSuffix = dueCount > 0 ? `, ${dueCount} service(s) due` : "";
  const openBtn = card.querySelector(".vehicle-open");
  openBtn.setAttribute("aria-label", `${vehicle.name || "Unnamed vehicle"}, view logs${dueSuffix}`);
  openBtn.addEventListener("click", () => openVehicle(vehicle.id));

  // ⋮ menu: edit / delete.
  const menuBtn = card.querySelector(".vehicle-menu-btn");
  const menu = card.querySelector(".vehicle-menu");
  menuBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = menu.hidden;
    closeAllVehicleMenus();
    if (willOpen) {
      menu.hidden = false;
      menuBtn.setAttribute("aria-expanded", "true");
    }
  });
  card.querySelector(".vehicle-odometer-update").addEventListener("click", async () => {
    const saved = await promptOdometerUpdate(vehicle.id);
    if (saved) renderGarage();
  });
  card.querySelector(".vehicle-edit").addEventListener("click", () => openVehicleForm(vehicle.id));
  card.querySelector(".vehicle-delete").addEventListener("click", () => deleteVehicle(vehicle.id));

  return card;
}

function renderGarage() {
  garageEls.vehicleList.replaceChildren();
  const vehicles = [...state.vehicles].sort((a, b) => a.name.localeCompare(b.name));
  garageEls.vehicleEmpty.hidden = vehicles.length > 0;
  for (const vehicle of vehicles) {
    garageEls.vehicleList.append(buildVehicleCard(vehicle));
  }
}

window.onPullRefresh = async () => {
  await refreshData();
  renderGarage();
};

renderSkeletonCards(garageEls.vehicleList, 4);
bootWithFallback(() => {
  renderGarage();
});
