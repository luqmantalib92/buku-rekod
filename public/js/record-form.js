/* Service record create / edit page.
   - record-form.html?vehicle=<id>              → add a record to that vehicle
   - record-form.html?vehicle=<id>&record=<rid> → edit that record
   Always returns to the vehicle's logbook. */

const recordEls = {
  formHeading: document.querySelector("#formHeading"),
  formSubtitle: document.querySelector("#formSubtitle"),
  serviceForm: document.querySelector("#serviceForm"),
  serviceDate: document.querySelector("#serviceDate"),
  serviceCategory: document.querySelector("#serviceCategory"),
  itemChips: document.querySelector("#serviceItemChips"),
  chipsHint: document.querySelector("#chipsHint"),
  workshopSuggestions: document.querySelector("#workshopSuggestions"),
  suggestNext: document.querySelector("#suggestNext"),
  suggestNote: document.querySelector("#suggestNote"),
  submit: document.querySelector("#serviceSubmit"),
  cancel: document.querySelector("#cancelForm")
};

const params = new URLSearchParams(window.location.search);
const vehicleId = params.get("vehicle");
const recordId = params.get("record");
const returnHref = `./vehicle.html?id=${encodeURIComponent(vehicleId || "")}`;

const selectedItems = new Set();
let dirty = false;

function leave() {
  dirty = false;
  window.location.href = vehicleId ? returnHref : "./index.html";
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

function populateCategories() {
  for (const category of getCategories()) {
    const option = document.createElement("option");
    option.value = category.key;
    option.textContent = category.label;
    recordEls.serviceCategory.append(option);
  }
}

function renderItemChips() {
  const category = getCategories().find((entry) => entry.key === recordEls.serviceCategory.value);
  recordEls.itemChips.replaceChildren();
  selectedItems.clear();

  if (!category) {
    recordEls.itemChips.hidden = true;
    recordEls.chipsHint.textContent = "Pick a category to see common items.";
    recordEls.chipsHint.hidden = false;
    return;
  }

  if (!category.items.length) {
    recordEls.itemChips.hidden = true;
    recordEls.chipsHint.textContent = "No preset items for this category — use Details below.";
    recordEls.chipsHint.hidden = false;
    return;
  }

  recordEls.chipsHint.hidden = true;
  recordEls.itemChips.hidden = false;
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
      dirty = true;
    });
    recordEls.itemChips.append(chip);
  }
}

function populateWorkshopSuggestions() {
  recordEls.workshopSuggestions.replaceChildren();
  for (const name of getWorkshopNames()) {
    const option = document.createElement("option");
    option.value = name;
    recordEls.workshopSuggestions.append(option);
  }
}

function initForm() {
  const vehicle = getVehicle(vehicleId);
  if (!vehicle) {
    // Unknown / missing vehicle — nothing to log against.
    window.location.href = "./index.html";
    return;
  }

  recordEls.formSubtitle.textContent = `Log a service for ${vehicle.name || "this vehicle"}.`;
  populateCategories();
  populateWorkshopSuggestions();

  const record = recordId ? vehicle.records.find((entry) => entry.id === recordId) : null;
  if (recordId && !record) {
    // Record was deleted elsewhere — fall back to adding a new one.
    window.location.href = returnHref;
    return;
  }

  if (record) {
    document.title = "Edit service record | Service Log";
    recordEls.formHeading.textContent = "Edit service record";
    recordEls.formSubtitle.textContent = `Update this service record for ${vehicle.name || "this vehicle"}.`;
    recordEls.submit.textContent = "Save changes";
    recordEls.serviceCategory.value = record.category || "other";
    renderItemChips();
    // The record's items string goes into the details field (chip selection
    // isn't stored separately), so nothing is lost when editing.
    recordEls.serviceForm.date.value = record.date || "";
    recordEls.serviceForm.odometer.value = record.odometer || "";
    recordEls.serviceForm.workshop.value = record.workshop || "";
    recordEls.serviceForm.cost.value = record.cost || "";
    recordEls.serviceForm.items.value = record.items || "";
    recordEls.serviceForm.nextDate.value = record.nextDate || "";
    recordEls.serviceForm.nextOdometer.value = record.nextOdometer || "";
  } else {
    renderItemChips();
    recordEls.serviceDate.valueAsDate = new Date();
    // Date is prefilled to today, so start the cursor on the odometer.
    // Pointer devices only, to avoid popping the mobile keyboard on open.
    if (window.matchMedia("(pointer: fine)").matches) {
      recordEls.serviceForm.odometer.focus();
    }
  }
}

recordEls.serviceCategory.addEventListener("change", () => {
  renderItemChips();
  dirty = true;
});

function showSuggestNote(message) {
  recordEls.suggestNote.textContent = message;
  recordEls.suggestNote.hidden = !message;
}

recordEls.suggestNext.addEventListener("click", () => {
  const form = recordEls.serviceForm;
  const extra = form.items.value.trim();
  const items = [...selectedItems, ...(extra ? [extra] : [])];
  const suggestion = suggestNextService({
    categoryKey: recordEls.serviceCategory.value,
    items,
    date: form.date.value,
    odometer: form.odometer.value
  });

  if (!suggestion) {
    showSuggestNote("Pick a category or tick some items first.");
    return;
  }

  const filled = [];
  if (suggestion.nextDate) {
    form.nextDate.value = suggestion.nextDate;
    filled.push("date");
  }
  if (suggestion.nextOdometer) {
    form.nextOdometer.value = suggestion.nextOdometer;
    filled.push("odometer");
  }

  if (!filled.length) {
    showSuggestNote("Enter the service date and odometer above first.");
    return;
  }

  dirty = true;
  const missing = filled.includes("date") ? "" : " (add a service date for the next-date too)";
  showSuggestNote(`${suggestion.note}${missing}`);
});

recordEls.serviceForm.addEventListener("input", () => { dirty = true; });

recordEls.serviceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const vehicle = getVehicle(vehicleId);
  if (!vehicle) {
    window.location.href = "./index.html";
    return;
  }

  const form = new FormData(recordEls.serviceForm);
  const extra = form.get("items").trim();
  const items = [...selectedItems, ...(extra ? [extra] : [])].join(", ");
  const fields = {
    category: form.get("category") || "other",
    date: form.get("date"),
    odometer: Number(form.get("odometer")),
    workshop: form.get("workshop").trim(),
    cost: Number(form.get("cost") || 0),
    items,
    nextDate: form.get("nextDate"),
    nextOdometer: form.get("nextOdometer") ? Number(form.get("nextOdometer")) : ""
  };

  const existing = recordId ? vehicle.records.find((entry) => entry.id === recordId) : null;
  if (existing) {
    Object.assign(existing, fields);
  } else {
    vehicle.records = [{ id: makeId(), ...fields, createdAt: new Date().toISOString() }, ...vehicle.records];
  }
  if (fields.odometer > Number(vehicle.odometer || 0)) {
    vehicle.odometer = fields.odometer;
  }

  await withButtonBusy(recordEls.submit, "Saving…", () => persist());
  leave();
});

recordEls.cancel.addEventListener("click", tryLeave);
setupBackButton(() => (vehicleId ? returnHref : "./index.html"), () => dirty);

window.addEventListener("beforeunload", (event) => {
  if (dirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});

bootWithFallback(initForm);
