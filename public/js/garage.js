/* Garage page (vehicles.html): the list of vehicles. Adding a vehicle happens
   on vehicle-form.html; each card has a ⋮ menu to edit or delete. */

const garageEls = {
  vehicleCount: document.querySelector("#vehicleCount"),
  garageStats: document.querySelector("#garageStats"),
  garageHealth: document.querySelector("#garageHealth"),
  garageHealthIcon: document.querySelector("#garageHealthIcon"),
  garageKm: document.querySelector("#garageKm"),
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

// Short "when" for the card's status pill: "in 12 days", "820 km overdue"…
function alertWhen(item) {
  if (item.days !== null && item.days !== undefined) {
    if (item.days < 0) return `${Math.abs(item.days)} day(s) overdue`;
    if (item.days === 0) return "due today";
    return `in ${item.days} day(s)`;
  }
  if (item.kmLeft !== null && item.kmLeft !== undefined) {
    const km = Math.abs(item.kmLeft).toLocaleString("en-MY");
    return item.kmLeft < 0 ? `${km} km overdue` : `in ${km} km`;
  }
  return "";
}

// The card's status pill: the most urgent thing, plus how many more.
function fillDuePill(el, vehicle) {
  const alerts = vehicleAlerts(vehicle);
  const urgent = alerts.filter((item) => item.status !== "ok");
  el.hidden = false;
  if (!urgent.length) {
    el.className = alerts.length ? "pill pill-ok vehicle-due" : "pill vehicle-due";
    el.replaceChildren(iconNode("check-circle"), alerts.length ? "All on track" : "Nothing scheduled");
    return;
  }
  const top = urgent[0];
  const more = urgent.length > 1 ? ` +${urgent.length - 1}` : "";
  el.className = `pill pill-${top.status} vehicle-due`;
  el.replaceChildren(iconNode(top.status === "overdue" ? "alert" : "clock"), `${top.label} ${alertWhen(top)}${more}`);
}

// Footer line: the sooner of road tax / insurance, or hidden if neither set.
function fillExpiryFoot(card, vehicle) {
  const foot = card.querySelector(".vehicle-expiry");
  const next = vehicleExpiries(vehicle).sort((a, b) => a.days - b.days)[0];
  if (!next) return;
  let when;
  if (next.days < 0) when = `expired ${Math.abs(next.days)} day(s) ago`;
  else if (next.days === 0) when = "expires today";
  else when = `expires ${formatDate(next.date)} (${next.days} day(s))`;
  foot.hidden = false;
  foot.classList.add(`is-${next.status}`);
  foot.querySelector(".vehicle-expiry-text").textContent = `${next.label} ${when}`;
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
  card.querySelector(".vehicle-model").textContent = vehicle.model || "";
  renderKmMetric(card.querySelector(".vehicle-odometer"), odometer);
  card.querySelector(".vehicle-last").textContent = lastRecord ? formatDate(lastRecord.date) : "No records";
  card.querySelector(".vehicle-last-km").textContent = lastRecord && lastRecord.odometer ? `at ${formatKm(lastRecord.odometer)}` : "";

  fillDuePill(card.querySelector(".vehicle-due"), vehicle);
  fillExpiryFoot(card, vehicle);
  const dueCount = vehicleDueCount(vehicle);

  const dueSuffix = dueCount > 0 ? `, ${dueCount} service(s) due` : "";
  const openBtn = card.querySelector(".vehicle-open");
  openBtn.setAttribute("aria-label", `${vehicle.name || "Unnamed vehicle"}, view logs${dueSuffix}`);
  openBtn.addEventListener("click", () => openVehicle(vehicle.id));
  card.querySelector(".vehicle-view").addEventListener("click", () => openVehicle(vehicle.id));
  card.querySelector(".vehicle-log").addEventListener("click", () => {
    window.location.href = `./record-form.html?vehicle=${encodeURIComponent(vehicle.id)}`;
  });

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

// Header count + the two summary tiles (alerts across the garage, total km).
function renderGarageStats(vehicles) {
  garageEls.vehicleCount.hidden = !vehicles.length;
  garageEls.vehicleCount.textContent = `${vehicles.length} ${vehicles.length === 1 ? "vehicle" : "vehicles"}`;
  garageEls.garageStats.hidden = !vehicles.length;
  if (!vehicles.length) return;

  const alerts = vehicles.flatMap(vehicleAlerts).filter((item) => item.status !== "ok");
  const overdue = alerts.some((item) => item.status === "overdue");
  garageEls.garageHealth.textContent = alerts.length ? `${alerts.length} alert${alerts.length === 1 ? "" : "s"}` : "All good";
  garageEls.garageHealthIcon.className = `icon-tile is-${alerts.length ? (overdue ? "overdue" : "due-soon") : "ok"}`;
  garageEls.garageKm.textContent = formatKm(vehicles.reduce((sum, vehicle) => sum + latestOdometer(vehicle), 0));
}

function renderGarage() {
  garageEls.vehicleList.replaceChildren();
  const vehicles = [...state.vehicles].sort((a, b) => a.name.localeCompare(b.name));
  renderGarageStats(vehicles);
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
