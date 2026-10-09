/* Service record create / edit page.
   - record-form.html?vehicle=<id>              → add a record to that vehicle
   - record-form.html?vehicle=<id>&record=<rid> → edit that record
   Always returns to the vehicle's logbook. */

const recordEls = {
  formHeading: document.querySelector("#formHeading"),
  formSubtitle: document.querySelector("#formSubtitle"),
  serviceForm: document.querySelector("#serviceForm"),
  serviceDate: document.querySelector("#serviceDate"),
  odometerHint: document.querySelector("#odometerHint"),
  serviceCategory: document.querySelector("#serviceCategory"),
  categoryChips: document.querySelector("#categoryChips"),
  categoryError: document.querySelector("#categoryError"),
  itemCount: document.querySelector("#itemCount"),
  formVehicleName: document.querySelector("#formVehicleName"),
  formVehiclePlate: document.querySelector("#formVehiclePlate"),
  recentWorkshops: document.querySelector("#recentWorkshops"),
  recentWorkshopChips: document.querySelector("#recentWorkshopChips"),
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

// After a successful save: go to the vehicle logbook and replace the form in
// history so pressing back doesn't return into the form we just submitted.
function leave() {
  dirty = false;
  window.location.replace(vehicleId ? returnHref : "./index.html");
}

// Cancel / discard: return to wherever we came from.
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
  dirty = false;
  goBack(vehicleId ? returnHref : "./index.html");
}

// Categories live in a (visually hidden) <select> so the form data and
// required-validation stay native; the chip row is the control you touch and
// just drives the select.
function populateCategories() {
  for (const category of getCategories()) {
    const option = document.createElement("option");
    option.value = category.key;
    option.textContent = category.label;
    recordEls.serviceCategory.append(option);

    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.dataset.value = category.key;
    chip.setAttribute("role", "radio");
    chip.setAttribute("aria-checked", "false");
    chip.append(iconNode(category.key), category.label);
    chip.addEventListener("click", () => {
      if (recordEls.serviceCategory.value === category.key) return;
      recordEls.serviceCategory.value = category.key;
      recordEls.serviceCategory.dispatchEvent(new Event("change"));
    });
    recordEls.categoryChips.append(chip);
  }
}

function syncCategoryChips() {
  const value = recordEls.serviceCategory.value;
  for (const chip of recordEls.categoryChips.querySelectorAll(".chip")) {
    chip.setAttribute("aria-checked", String(chip.dataset.value === value));
  }
  if (value) recordEls.categoryError.hidden = true;
}

// The hidden select can't show its own validation bubble, so say it inline.
recordEls.serviceCategory.addEventListener("invalid", () => {
  recordEls.categoryError.hidden = false;
  recordEls.categoryChips.scrollIntoView({ block: "center", behavior: "smooth" });
});

function updateItemCount() {
  const count = selectedItems.size;
  recordEls.itemCount.hidden = count === 0;
  recordEls.itemCount.textContent = `${count} selected`;
}

function renderItemChips() {
  const category = getCategories().find((entry) => entry.key === recordEls.serviceCategory.value);
  recordEls.itemChips.replaceChildren();
  selectedItems.clear();
  updateItemCount();
  syncCategoryChips();

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
    chip.className = "chip chip-soft chip-sm";
    chip.textContent = item;
    chip.setAttribute("aria-pressed", "false");
    chip.addEventListener("click", () => {
      const on = chip.getAttribute("aria-pressed") === "true";
      chip.setAttribute("aria-pressed", String(!on));
      chip.classList.toggle("chip-on", !on);
      if (on) selectedItems.delete(item);
      else selectedItems.add(item);
      updateItemCount();
      dirty = true;
      if (!on) maybeAutoSuggest();
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

// One-tap chips for the workshops used most recently, across all vehicles.
function renderRecentWorkshops() {
  const latest = new Map();
  for (const vehicle of state.vehicles) {
    for (const record of vehicle.records) {
      const name = (record.workshop || "").trim();
      if (name && (record.date || "") > (latest.get(name) || "")) latest.set(name, record.date || "");
    }
  }
  const recent = [...latest.entries()].sort((a, b) => b[1].localeCompare(a[1])).slice(0, 4).map(([name]) => name);
  recordEls.recentWorkshops.hidden = !recent.length;
  recordEls.recentWorkshopChips.replaceChildren();
  for (const name of recent) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip chip-sm";
    chip.textContent = name;
    chip.addEventListener("click", () => {
      recordEls.serviceForm.workshop.value = name;
      dirty = true;
    });
    recordEls.recentWorkshopChips.append(chip);
  }
}

function initForm() {
  const vehicle = getVehicle(vehicleId);
  if (!vehicle) {
    // Unknown / missing vehicle — nothing to log against.
    window.location.href = "./index.html";
    return;
  }

  recordEls.formSubtitle.textContent = "Log what was done, where and for how much.";
  recordEls.formVehicleName.textContent = vehicle.name || "Unnamed vehicle";
  recordEls.formVehiclePlate.textContent = vehicle.plate || "";
  recordEls.formVehiclePlate.hidden = !vehicle.plate;
  populateCategories();
  populateWorkshopSuggestions();
  renderRecentWorkshops();

  const record = recordId ? vehicle.records.find((entry) => entry.id === recordId) : null;
  if (recordId && !record) {
    // Record was deleted elsewhere — fall back to adding a new one.
    window.location.href = returnHref;
    return;
  }

  if (record) {
    document.title = "Edit service record | Buku Rekod";
    recordEls.formHeading.textContent = "Edit service record";
    recordEls.formSubtitle.textContent = "Update what was done, where and for how much.";
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
    // Show the last known reading as a starting point for the odometer.
    const lastOdo = latestOdometer(vehicle);
    if (lastOdo > 0) {
      recordEls.serviceForm.odometer.placeholder = String(lastOdo);
      recordEls.odometerHint.textContent = `Last recorded: ${formatKm(lastOdo)}`;
      recordEls.odometerHint.hidden = false;
    }
    // Date is prefilled to today, so start the cursor on the odometer.
    // Pointer devices only, to avoid popping the mobile keyboard on open.
    if (window.matchMedia("(pointer: fine)").matches) {
      recordEls.serviceForm.odometer.focus();
    }
  }
}

// On new records, ticking an item auto-fills the next-service fields (only
// the empty ones) so most logs never need the Suggest button. Edits and
// manually-entered values are left alone; the button still overwrites.
function maybeAutoSuggest() {
  if (recordId) return;
  const form = recordEls.serviceForm;
  if (form.nextDate.value && form.nextOdometer.value) return;

  const suggestion = suggestNextService({
    categoryKey: recordEls.serviceCategory.value,
    items: [...selectedItems],
    date: form.date.value,
    odometer: form.odometer.value || latestOdometer(getVehicle(vehicleId) || { records: [] })
  });
  if (!suggestion) return;

  let filled = false;
  if (suggestion.nextDate && !form.nextDate.value) {
    form.nextDate.value = suggestion.nextDate;
    filled = true;
  }
  if (suggestion.nextOdometer && !form.nextOdometer.value) {
    form.nextOdometer.value = suggestion.nextOdometer;
    filled = true;
  }
  if (filled) {
    showSuggestNote(`Next service auto-filled. ${suggestion.note}`);
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
