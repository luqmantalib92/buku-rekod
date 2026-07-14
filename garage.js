/* Garage page: list of vehicles + add a vehicle. */

const garageEls = {
  vehicleForm: document.querySelector("#vehicleForm"),
  vehicleList: document.querySelector("#vehicleList"),
  vehicleEmpty: document.querySelector("#vehicleEmpty"),
  vehicleCardTemplate: document.querySelector("#vehicleCardTemplate"),
  vehicleImage: document.querySelector("#vehicleImage"),
  vehicleImagePreview: document.querySelector("#vehicleImagePreview"),
  vehicleImageHint: document.querySelector("#vehicleImageHint")
};

// Data URL of the photo chosen in the add-vehicle form (empty = none).
let pendingImage = "";

const IMAGE_HINT_DEFAULT = "JPG or PNG, up to 15 MB. It's auto-compressed before saving.";

function setImageHint(el, message, isError) {
  el.textContent = message;
  el.classList.toggle("image-hint-error", Boolean(isError));
}

garageEls.vehicleImage.addEventListener("change", async () => {
  const file = garageEls.vehicleImage.files[0];
  if (!file) {
    pendingImage = "";
    garageEls.vehicleImagePreview.hidden = true;
    setImageHint(garageEls.vehicleImageHint, IMAGE_HINT_DEFAULT, false);
    return;
  }
  setImageHint(garageEls.vehicleImageHint, "Compressing photo…", false);
  try {
    const { dataUrl, bytes } = await fileToResizedDataUrl(file);
    pendingImage = dataUrl;
    garageEls.vehicleImagePreview.src = dataUrl;
    garageEls.vehicleImagePreview.hidden = false;
    setImageHint(garageEls.vehicleImageHint, `Photo ready — ${Math.round(bytes / 1024)} KB after compression.`, false);
  } catch (error) {
    pendingImage = "";
    garageEls.vehicleImage.value = "";
    garageEls.vehicleImagePreview.hidden = true;
    setImageHint(garageEls.vehicleImageHint, error.message || "Could not use that image.", true);
  }
});

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

function onGarageReady() {
  renderGarage();
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
    image: pendingImage,
    createdAt: new Date().toISOString(),
    records: []
  });

  const submitButton = garageEls.vehicleForm.querySelector('button[type="submit"]');
  state.vehicles.push(vehicle);
  await withButtonBusy(submitButton, "Adding…", () => persist());
  garageEls.vehicleForm.reset();
  pendingImage = "";
  garageEls.vehicleImagePreview.hidden = true;
  setImageHint(garageEls.vehicleImageHint, IMAGE_HINT_DEFAULT, false);
  renderGarage();
});

window.onPullRefresh = async () => {
  await refreshData();
  onGarageReady();
};

bootWithFallback(onGarageReady);
