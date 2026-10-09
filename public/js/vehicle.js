/* Vehicle page: one vehicle's service logbook — a summary card (photo,
   odometer, road tax / insurance), a rail of per-category reminders, and the
   service records as a timeline, newest first. Adding/editing a record
   happens on record-form.html; editing the vehicle itself happens on
   vehicle-form.html. */

const vehicleEls = {
  emptyAddRecord: document.querySelector("#emptyAddRecord"),
  fabAddRecord: document.querySelector("#fabAddRecord"),
  recordList: document.querySelector("#recordList"),
  emptyState: document.querySelector("#emptyState"),
  recordTemplate: document.querySelector("#recordTemplate"),
  historySub: document.querySelector("#historySub"),
  remindersSection: document.querySelector("#remindersSection"),
  reminderRail: document.querySelector("#reminderRail"),
  reminderCount: document.querySelector("#reminderCount"),
  reminderCardTemplate: document.querySelector("#reminderCardTemplate"),
  editVehicle: document.querySelector("#editVehicle"),
  summaryImage: document.querySelector("#summaryImage"),
  summaryVehicle: document.querySelector("#summaryVehicle"),
  summaryPlate: document.querySelector("#summaryPlate"),
  summaryModel: document.querySelector("#summaryModel"),
  summaryOdometer: document.querySelector("#summaryOdometer"),
  summaryOdometerMeta: document.querySelector("#summaryOdometerMeta"),
  updateOdometer: document.querySelector("#updateOdometer"),
  summaryLastServiceMeta: document.querySelector("#summaryLastServiceMeta"),
  roadTaxRow: document.querySelector("#roadTaxRow"),
  summaryRoadTax: document.querySelector("#summaryRoadTax"),
  summaryRoadTaxMeta: document.querySelector("#summaryRoadTaxMeta"),
  insuranceRow: document.querySelector("#insuranceRow"),
  summaryInsurance: document.querySelector("#summaryInsurance"),
  summaryInsuranceMeta: document.querySelector("#summaryInsuranceMeta"),
  expiryHint: document.querySelector("#expiryHint")
};

function currentVehicleId() {
  return new URLSearchParams(window.location.search).get("id");
}

function goHome() {
  window.location.href = "./index.html";
}

function openRecordForm(recordId) {
  const id = encodeURIComponent(currentVehicleId());
  const suffix = recordId ? `&record=${encodeURIComponent(recordId)}` : "";
  window.location.href = `./record-form.html?vehicle=${id}${suffix}`;
}

// Human text for a record's next-service status — km-driven ("in 800 km")
// when the odometer is the more urgent signal, otherwise days.
function dueText(status) {
  if (status.by === "km") {
    const km = Math.abs(status.kmLeft).toLocaleString("en-MY");
    if (status.kmLeft < 0) return `${km} km overdue`;
    if (status.kmLeft === 0) return "due now";
    return `in ${km} km`;
  }
  if (status.days < 0) return `${Math.abs(status.days)} day(s) overdue`;
  if (status.days === 0) return "due today";
  return `in ${status.days} day(s)`;
}

// Pill text for a road tax / insurance expiry entry.
function expiryText(entry) {
  if (entry.days < 0) return `Expired ${Math.abs(entry.days)}d ago`;
  if (entry.days === 0) return "Expires today";
  if (entry.status === "ok" && entry.days > 60) return `${Math.round(entry.days / 30)} months left`;
  return `${entry.days} day(s) left`;
}

// "today" / "yesterday" / "3 days ago" / a date, for the odometer stamp.
function relativeDay(dateStr) {
  const days = daysUntil(dateStr);
  if (days === null) return "";
  if (days === 0) return "today";
  if (days === -1) return "yesterday";
  if (days < 0 && days > -30) return `${Math.abs(days)} days ago`;
  return formatDate(dateStr);
}

function updateSummary(vehicle) {
  const latestRecord = [...vehicle.records].sort((a, b) => b.date.localeCompare(a.date))[0];
  const odometer = latestOdometer(vehicle);

  setShellTitle(vehicle.name || "Vehicle");
  vehicleEls.editVehicle.href = `./vehicle-form.html?id=${encodeURIComponent(vehicle.id)}`;

  if (vehicle.image) {
    vehicleEls.summaryImage.src = vehicle.image;
    vehicleEls.summaryImage.hidden = false;
  } else {
    vehicleEls.summaryImage.hidden = true;
  }

  vehicleEls.summaryVehicle.textContent = vehicle.name || "Unnamed vehicle";
  vehicleEls.summaryPlate.textContent = vehicle.plate || "No plate";
  vehicleEls.summaryModel.textContent = vehicle.model || "";
  vehicleEls.summaryModel.hidden = !vehicle.model;

  renderKmMetric(vehicleEls.summaryOdometer, odometer);
  vehicleEls.summaryOdometerMeta.textContent = vehicle.odometerDate
    ? `Updated ${relativeDay(vehicle.odometerDate)}`
    : "Latest saved reading";
  vehicleEls.summaryLastServiceMeta.textContent = latestRecord
    ? `Last service ${formatDate(latestRecord.date)} · ${latestRecord.workshop || "unspecified workshop"}`
    : "No service records yet";

  const expiries = new Map(vehicleExpiries(vehicle).map((entry) => [entry.field, entry]));
  let anySet = false;
  for (const [field, rowEl, valueEl, pillEl] of [
    ["roadTaxExpiry", vehicleEls.roadTaxRow, vehicleEls.summaryRoadTax, vehicleEls.summaryRoadTaxMeta],
    ["insuranceExpiry", vehicleEls.insuranceRow, vehicleEls.summaryInsurance, vehicleEls.summaryInsuranceMeta]
  ]) {
    const entry = expiries.get(field);
    anySet = anySet || Boolean(entry);
    valueEl.textContent = entry ? formatDate(entry.date) : "Not set";
    rowEl.className = entry ? `expiry-row is-${entry.status}` : "expiry-row";
    pillEl.hidden = !entry;
    if (entry) {
      pillEl.className = `pill pill-${entry.status}`;
      pillEl.textContent = expiryText(entry);
    }
  }
  vehicleEls.expiryHint.textContent = anySet
    ? "Badges turn amber 30 days before expiry and red once expired."
    : "Add road tax and insurance dates in Edit details to get expiry warnings.";
}

/* ---- Reminder rail ---- */

const REMINDER_STATUS = {
  overdue: { label: "Overdue", icon: "alert" },
  "due-soon": { label: "Due soon", icon: "clock" },
  ok: { label: "On track", icon: "check-circle" }
};

function buildReminderCard(reminder, currentOdometer) {
  const card = vehicleEls.reminderCardTemplate.content.firstElementChild.cloneNode(true);
  card.classList.add(`is-${reminder.status}`);

  const iconEl = card.querySelector(".reminder-card-icon");
  iconEl.classList.add(`is-${reminder.status}`);
  iconEl.append(iconNode(reminder.category));

  const info = REMINDER_STATUS[reminder.status] || REMINDER_STATUS.ok;
  const pill = card.querySelector(".reminder-card-status");
  pill.classList.add(`pill-${reminder.status}`);
  pill.textContent = info.label;

  card.querySelector(".reminder-card-label").textContent = reminder.label;

  // Headline target: the km reading when tracked by odometer, else the date.
  const hasKm = reminder.kmLeft !== null && reminder.kmLeft !== undefined;
  const target = card.querySelector(".reminder-card-target");
  const sub = card.querySelector(".reminder-card-sub");
  if (hasKm) {
    renderKmMetric(target, currentOdometer + reminder.kmLeft);
    sub.textContent = reminder.nextDate ? `or ${formatDate(reminder.nextDate)}` : "Odometer reminder";
  } else {
    target.textContent = formatDate(reminder.nextDate);
    sub.textContent = "Date reminder";
  }

  const footLabel = card.querySelector(".reminder-card-foot-label");
  const footValue = card.querySelector(".reminder-card-foot-value");
  const overdue = reminder.status === "overdue";
  footLabel.textContent = overdue ? "Over by" : "Remaining";
  const parts = [];
  if (hasKm) parts.push(`${Math.abs(reminder.kmLeft).toLocaleString("en-MY")} km`);
  if (reminder.days !== null && reminder.days !== undefined) parts.push(`${Math.abs(reminder.days)} d`);
  footValue.textContent = parts.join(" · ") || "-";
  return card;
}

function renderReminders(vehicle) {
  const reminders = vehicleReminders(vehicle);
  vehicleEls.remindersSection.hidden = !reminders.length;
  vehicleEls.reminderRail.replaceChildren();
  if (!reminders.length) return;
  const currentOdometer = latestOdometer(vehicle);
  const urgent = reminders.filter((reminder) => reminder.status !== "ok").length;
  vehicleEls.reminderCount.textContent = urgent ? `${urgent} need attention` : `${reminders.length} tracked`;
  for (const reminder of reminders) {
    vehicleEls.reminderRail.append(buildReminderCard(reminder, currentOdometer));
  }
}

/* ---- Records timeline ---- */

function closeAllRecordMenus() {
  for (const menu of vehicleEls.recordList.querySelectorAll(".record-menu")) {
    menu.hidden = true;
  }
  for (const btn of vehicleEls.recordList.querySelectorAll(".record-menu-btn")) {
    btn.setAttribute("aria-expanded", "false");
  }
}

// Close any open card menu on an outside click or Escape (registered once).
document.addEventListener("click", closeAllRecordMenus);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeAllRecordMenus();
});

// Items are saved as one comma-joined string (chips + free text); show each
// as its own chip.
function splitItems(text) {
  return String(text || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function buildRecordCard(record, currentOdometer) {
  const item = vehicleEls.recordTemplate.content.firstElementChild.cloneNode(true);
  item.querySelector(".record-date").textContent = formatDate(record.date);
  const odo = item.querySelector(".record-odo");
  odo.textContent = record.odometer ? formatKm(record.odometer) : "";
  odo.hidden = !record.odometer;
  item.querySelector(".record-cost").textContent = Number(record.cost) ? formatMoney(record.cost) : "";
  item.querySelector(".record-workshop-name").textContent = record.workshop || "No workshop saved";
  item.querySelector(".record-category").textContent = categoryLabel(record.category);

  const itemsEl = item.querySelector(".record-items");
  const items = splitItems(record.items);
  itemsEl.hidden = !items.length;
  for (const text of items) {
    const chip = document.createElement("span");
    chip.className = "item-chip";
    chip.textContent = text;
    itemsEl.append(chip);
  }

  const notesEl = item.querySelector(".record-notes");
  notesEl.textContent = record.notes || "";
  notesEl.hidden = !record.notes;

  // Next service line: whichever of date / odometer the record carries.
  const nextParts = [];
  if (record.nextDate) nextParts.push(formatDate(record.nextDate));
  if (record.nextOdometer) nextParts.push(formatKm(record.nextOdometer));
  const nextEl = item.querySelector(".record-next");
  nextEl.hidden = !nextParts.length;
  item.querySelector(".record-next-value").textContent = nextParts.join(" or ");

  // Status pill + timeline dot colour + the mark-serviced menu item.
  const dueEl = item.querySelector(".record-due");
  const doneBtn = item.querySelector(".record-done");
  const doneLabel = item.querySelector(".record-done-label");
  item.classList.add("is-history");
  if (record.nextDate || record.nextOdometer) {
    doneBtn.hidden = false;
    if (record.nextDone) {
      dueEl.hidden = false;
      dueEl.textContent = "Serviced";
      dueEl.className = "pill pill-ok record-due";
      item.classList.replace("is-history", "is-done");
      doneLabel.textContent = "Undo serviced";
    } else {
      const status = recordNextStatus(record, currentOdometer);
      if (status) {
        dueEl.hidden = false;
        dueEl.textContent = `Next ${dueText(status)}`;
        const tone = status.status === "upcoming" ? "primary" : status.status;
        dueEl.className = `pill pill-${tone} record-due`;
        item.classList.replace("is-history", `is-${status.status}`);
      }
      doneLabel.textContent = "Mark serviced";
    }
    doneBtn.addEventListener("click", () => toggleServiced(record.id));
  }

  // Kebab menu (Mark serviced / Edit / Delete).
  const menuBtn = item.querySelector(".record-menu-btn");
  const menu = item.querySelector(".record-menu");
  menuBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = menu.hidden;
    closeAllRecordMenus();
    if (willOpen) {
      menu.hidden = false;
      menuBtn.setAttribute("aria-expanded", "true");
    }
  });
  item.querySelector(".record-edit").addEventListener("click", () => openRecordForm(record.id));
  item.querySelector(".record-delete").addEventListener("click", () => deleteRecord(record.id));
  return item;
}

function renderRecords(vehicle) {
  vehicleEls.recordList.replaceChildren();
  const currentOdometer = latestOdometer(vehicle);
  const records = [...vehicle.records].sort((a, b) =>
    (b.date || "").localeCompare(a.date || "") || Number(b.odometer || 0) - Number(a.odometer || 0));

  vehicleEls.emptyState.hidden = records.length > 0;
  vehicleEls.recordList.hidden = !records.length;

  const total = records.reduce((sum, record) => sum + Number(record.cost || 0), 0);
  vehicleEls.historySub.textContent = records.length
    ? `${records.length} ${records.length === 1 ? "record" : "records"} · ${formatMoney(total)} spent in total`
    : "Everything you've logged, newest first.";

  for (const record of records) {
    vehicleEls.recordList.append(buildRecordCard(record, currentOdometer));
  }
}

async function toggleServiced(recordId) {
  const vehicle = getVehicle(currentVehicleId());
  const record = vehicle && vehicle.records.find((entry) => entry.id === recordId);
  if (!record) return;
  record.nextDone = !record.nextDone;
  await persist();
  renderVehicle();
}

function renderVehicle() {
  const vehicle = getVehicle(currentVehicleId());
  if (!vehicle) {
    // Not in the offline copy — it may still be in the fresh data.
    if (appState.useFirestore && !appState.synced) return;
    // Unknown / deleted vehicle — send the user back Home.
    goHome();
    return;
  }

  // Opening a vehicle makes it the one Home shows.
  selectVehicle(vehicle.id);

  document.title = `${vehicle.name || "Vehicle"} | Buku Rekod`;
  updateSummary(vehicle);
  renderReminders(vehicle);
  renderRecords(vehicle);
}

async function deleteRecord(recordId) {
  const vehicle = getVehicle(currentVehicleId());
  if (!vehicle) return;
  const ok = await confirmDialog({
    title: "Delete this record?",
    message: "This service record will be removed.",
    confirmLabel: "Delete",
    danger: true
  });
  if (!ok) return;
  vehicle.records = vehicle.records.filter((record) => record.id !== recordId);
  await persist();
  renderVehicle();
}

vehicleEls.updateOdometer.addEventListener("click", async () => {
  const saved = await promptOdometerUpdate(currentVehicleId());
  if (saved) renderVehicle();
});

vehicleEls.emptyAddRecord.addEventListener("click", () => openRecordForm(null));
vehicleEls.fabAddRecord.addEventListener("click", () => openRecordForm(null));

setupBackButton("./index.html");

window.onPullRefresh = async () => {
  await refreshData();
  renderVehicle();
};

renderSkeletonCards(vehicleEls.recordList, 3);
bootWithFallback(renderVehicle, { cached: true });
