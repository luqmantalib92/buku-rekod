/* Vehicle create / edit page.
   - vehicle-form.html            → create a new vehicle (returns to garage)
   - vehicle-form.html?id=<id>    → edit that vehicle (returns to its logbook) */

const formEls = {
  formEyebrow: document.querySelector("#formEyebrow"),
  formHeading: document.querySelector("#formHeading"),
  formSubtitle: document.querySelector("#formSubtitle"),
  vehicleForm: document.querySelector("#vehicleForm"),
  name: document.querySelector("#vehicleName"),
  plate: document.querySelector("#vehiclePlate"),
  odometer: document.querySelector("#vehicleOdometer"),
  model: document.querySelector("#vehicleModel"),
  image: document.querySelector("#vehicleImage"),
  imageHint: document.querySelector("#vehicleImageHint"),
  imagePreview: document.querySelector("#vehicleImagePreview"),
  removeImage: document.querySelector("#removeImage"),
  submit: document.querySelector("#vehicleSubmit"),
  cancel: document.querySelector("#cancelForm")
};

const IMAGE_HINT_DEFAULT = "JPG or PNG, up to 15 MB. It's auto-compressed before saving.";

const editId = new URLSearchParams(window.location.search).get("id");
const returnHref = editId ? `./vehicle.html?id=${encodeURIComponent(editId)}` : "./index.html";

let imageData = "";   // data URL of the chosen/existing photo ("" = none)
let dirty = false;    // unsaved changes present?

function setImageHint(message, isError) {
  formEls.imageHint.textContent = message;
  formEls.imageHint.classList.toggle("image-hint-error", Boolean(isError));
}

function showImage() {
  if (imageData) {
    formEls.imagePreview.src = imageData;
    formEls.imagePreview.hidden = false;
    formEls.removeImage.hidden = false;
  } else {
    formEls.imagePreview.hidden = true;
    formEls.removeImage.hidden = true;
  }
}

function leave() {
  dirty = false;
  window.location.href = returnHref;
}

async function tryLeave() {
  if (dirty) {
    const ok = await confirmDialog({
      title: "Discard changes?",
      message: "You have unsaved changes. Leaving now won't save them.",
      confirmLabel: "Discard",
      danger: true
    });
    if (!ok) return;
  }
  leave();
}

function initForm() {
  if (editId) {
    const vehicle = getVehicle(editId);
    if (!vehicle) {
      // Unknown / deleted vehicle — bounce back to the garage.
      window.location.href = "./index.html";
      return;
    }
    document.title = `Edit ${vehicle.name || "vehicle"} | Service Log`;
    formEls.formEyebrow.textContent = "Edit";
    formEls.formHeading.textContent = "Edit vehicle";
    formEls.formSubtitle.textContent = "Update this vehicle's details. Changes save to its logbook.";
    formEls.submit.textContent = "Save changes";
    formEls.name.value = vehicle.name || "";
    formEls.plate.value = vehicle.plate || "";
    formEls.odometer.value = vehicle.odometer || "";
    formEls.model.value = vehicle.model || "";
    imageData = vehicle.image || "";
    showImage();
  }
  setImageHint(IMAGE_HINT_DEFAULT, false);

  // Autofocus the first field on pointer devices only, so phones don't pop
  // the keyboard the moment the page opens.
  if (window.matchMedia("(pointer: fine)").matches) {
    formEls.name.focus();
  }
}

formEls.vehicleForm.addEventListener("input", () => { dirty = true; });

formEls.image.addEventListener("change", async () => {
  const file = formEls.image.files[0];
  if (!file) return;
  dirty = true;
  setImageHint("Compressing photo…", false);
  try {
    const { dataUrl, bytes } = await fileToResizedDataUrl(file);
    imageData = dataUrl;
    showImage();
    setImageHint(`Photo ready — ${Math.round(bytes / 1024)} KB after compression.`, false);
  } catch (error) {
    formEls.image.value = "";
    setImageHint(error.message || "Could not use that image.", true);
  }
});

formEls.removeImage.addEventListener("click", () => {
  imageData = "";
  formEls.image.value = "";
  dirty = true;
  showImage();
  setImageHint(IMAGE_HINT_DEFAULT, false);
});

formEls.vehicleForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(formEls.vehicleForm);
  const name = form.get("name").trim();
  const plate = form.get("plate").trim().toUpperCase();
  const odometer = Number(form.get("odometer"));
  const model = form.get("model").trim();

  if (editId) {
    const vehicle = getVehicle(editId);
    if (!vehicle) {
      window.location.href = "./index.html";
      return;
    }
    vehicle.name = name;
    vehicle.plate = plate;
    if (Number.isFinite(odometer)) vehicle.odometer = odometer;
    vehicle.model = model;
    vehicle.image = imageData;
  } else {
    state.vehicles.push(normalizeVehicle({
      id: makeId(),
      name,
      plate,
      odometer,
      model,
      image: imageData,
      createdAt: new Date().toISOString(),
      records: []
    }));
  }

  await withButtonBusy(formEls.submit, "Saving…", () => persist());
  leave();
});

formEls.cancel.addEventListener("click", tryLeave);
setupBackButton(returnHref, () => dirty);

window.addEventListener("beforeunload", (event) => {
  if (dirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});

bootWithFallback(initForm);
