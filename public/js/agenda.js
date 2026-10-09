/* Home page (index.html): one vehicle at a time. A dropdown at the top picks
   the vehicle (remembered per device); under it sit that vehicle's card —
   odometer, last service, most urgent item, ⋮ menu — a compact month
   calendar with a status-coloured dot on each day that has something
   scheduled (a record's next service, or road-tax / insurance expiry), and
   the "Upcoming & due" list. Reuses the reminder logic (vehicleReminders /
   vehicleExpiries) from garage.store.js so the dots match the statuses shown
   elsewhere. Adding a vehicle lives in Settings. */

const homeEls = {
  homeEmpty: document.querySelector("#homeEmpty"),
  homeEmptyAction: document.querySelector("#homeEmptyAction"),
  vehiclePicker: document.querySelector("#vehiclePicker"),
  vehiclePickerButton: document.querySelector("#vehiclePickerButton"),
  vehiclePickerName: document.querySelector("#vehiclePickerName"),
  vehiclePickerPlate: document.querySelector("#vehiclePickerPlate"),
  vehiclePickerMenu: document.querySelector("#vehiclePickerMenu"),
  vehicleSlot: document.querySelector("#vehicleSlot"),
  vehicleCardTemplate: document.querySelector("#vehicleCardTemplate"),
  calendarSection: document.querySelector("#calendarSection"),
  calTitle: document.querySelector("#calTitle"),
  calToday: document.querySelector("#calToday"),
  calGrid: document.querySelector("#calGrid"),
  calPrev: document.querySelector("#calPrev"),
  calNext: document.querySelector("#calNext"),
  calDayDetail: document.querySelector("#calDayDetail"),
  calDayTitle: document.querySelector("#calDayTitle"),
  calDayList: document.querySelector("#calDayList"),
  scheduleSection: document.querySelector("#scheduleSection"),
  scheduleList: document.querySelector("#scheduleList"),
  scheduleSub: document.querySelector("#scheduleSub"),
  scheduleEmpty: document.querySelector("#scheduleEmpty"),
  fabAddRecord: document.querySelector("#fabAddRecord")
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const STATUS_WEIGHT = { ok: 0, "due-soon": 1, overdue: 2 };

// The month currently shown (1st of that month) and the selected day, if any.
let viewYear;
let viewMonth;
let selectedKey = null;

// The selected vehicle as a list, so the collectors below stay generic.
function visibleVehicles() {
  const vehicle = selectedVehicle();
  return vehicle ? [vehicle] : [];
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function dateKey(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function todayKey() {
  const t = new Date();
  return dateKey(t.getFullYear(), t.getMonth(), t.getDate());
}

// Human date from a YYYY-MM-DD key, e.g. "Mon, 21 Jul 2026".
function longDate(key) {
  const d = new Date(`${key}T00:00:00`);
  return d.toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function openVehicle(id) {
  window.location.href = `./vehicle.html?id=${encodeURIComponent(id)}`;
}

function openRecordForm(id) {
  window.location.href = `./record-form.html?vehicle=${encodeURIComponent(id)}`;
}

function openVehicleForm(id) {
  const suffix = id ? `?id=${encodeURIComponent(id)}` : "";
  window.location.href = `./vehicle-form.html${suffix}`;
}

homeEls.homeEmptyAction.addEventListener("click", () => openVehicleForm());

// Add record for the vehicle on screen; with none yet, add a vehicle first.
homeEls.fabAddRecord.addEventListener("click", () => {
  const vehicle = selectedVehicle();
  if (vehicle) openRecordForm(vehicle.id);
  else openVehicleForm();
});

// "in 12 day(s)" / "due today" / "3 day(s) overdue".
function daysPhrase(days) {
  if (days < 0) return `${Math.abs(days)} day(s) overdue`;
  if (days === 0) return "due today";
  return `in ${days} day(s)`;
}

// "820 km left" / "due now" / "150 km overdue".
function kmPhrase(kmLeft) {
  const km = Math.abs(kmLeft).toLocaleString("en-MY");
  if (kmLeft < 0) return `${km} km overdue`;
  if (kmLeft === 0) return "due now";
  return `${km} km left`;
}

// Combine whichever signals a service reminder has (date and/or odometer).
function serviceMeta(reminder) {
  const parts = [];
  if (reminder.days !== null && reminder.days !== undefined) parts.push(daysPhrase(reminder.days));
  if (reminder.kmLeft !== null && reminder.kmLeft !== undefined) parts.push(kmPhrase(reminder.kmLeft));
  return parts.join(" · ");
}

function expiryMeta(days) {
  if (days < 0) return `expired ${Math.abs(days)} day(s) ago`;
  if (days === 0) return "expires today";
  return `expires in ${days} day(s)`;
}

// Lower = more urgent. Prefer the date signal; fall back to odometer.
function urgency(item) {
  if (item.days !== null && item.days !== undefined) return item.days;
  if (item.kmLeft !== null && item.kmLeft !== undefined) return item.kmLeft <= 0 ? -1 : 9000;
  return 99999;
}

// Map of dateKey -> [{ vehicleId, vehicleName, title, status }] for every
// scheduled service / expiry that has an actual date to place on the calendar.
function collectScheduled() {
  const byDate = new Map();
  const add = (key, item) => {
    if (!key) return;
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(item);
  };
  for (const vehicle of visibleVehicles()) {
    const name = vehicle.name || "Unnamed vehicle";
    for (const reminder of vehicleReminders(vehicle)) {
      add(reminder.nextDate, { vehicleId: vehicle.id, vehicleName: name, plate: vehicle.plate, title: reminder.label, meta: serviceMeta(reminder), status: reminder.status });
    }
    for (const entry of vehicleExpiries(vehicle)) {
      add(entry.date, { vehicleId: vehicle.id, vehicleName: name, plate: vehicle.plate, title: entry.label, meta: expiryMeta(entry.days), status: entry.status });
    }
  }
  return byDate;
}

// Worst status among a day's items — drives the dot colour.
function worstStatus(items) {
  return items.reduce((worst, item) =>
    STATUS_WEIGHT[item.status] > STATUS_WEIGHT[worst] ? item.status : worst, "ok");
}

const STATUS_PILLS = {
  overdue: { label: "Overdue", icon: "alert" },
  "due-soon": { label: "Due soon", icon: "clock" },
  ok: { label: "On track", icon: "check-circle" }
};

// One "Upcoming & due" card: what's due, status pill, and when. Links to the
// vehicle's logbook. Home shows one vehicle, so the card doesn't name it.
function buildEventRow({ vehicleId, title, meta, status = "ok" }) {
  const link = document.createElement("a");
  link.className = `due-card is-${status}`;
  link.href = `./vehicle.html?id=${encodeURIComponent(vehicleId)}`;

  const top = document.createElement("div");
  top.className = "due-card-top";
  const heading = document.createElement("h3");
  heading.className = "due-card-title";
  heading.textContent = title;
  const pillInfo = STATUS_PILLS[status] || STATUS_PILLS.ok;
  const pill = document.createElement("span");
  pill.className = `pill pill-${status}`;
  pill.append(iconNode(pillInfo.icon), pillInfo.label);
  top.append(heading, pill);

  const metaEl = document.createElement("p");
  metaEl.className = "due-card-meta";
  metaEl.append(iconNode(status === "ok" ? "calendar" : "alert"), meta || "");

  link.append(top, metaEl);
  return link;
}

function renderDayDetail(key, byDate) {
  const items = key ? byDate.get(key) : null;
  if (!items || !items.length) {
    homeEls.calDayDetail.hidden = true;
    homeEls.calDayList.replaceChildren();
    return;
  }
  homeEls.calDayDetail.hidden = false;
  homeEls.calDayTitle.textContent = longDate(key);
  homeEls.calDayList.replaceChildren();
  for (const item of items) homeEls.calDayList.append(buildEventRow(item));
}

function renderCalendar() {
  const byDate = collectScheduled();
  homeEls.calTitle.textContent = `${MONTHS[viewMonth]} ${viewYear}`;
  homeEls.calGrid.replaceChildren();

  for (const label of WEEKDAYS) {
    const head = document.createElement("div");
    head.className = "cal-weekday";
    head.textContent = label;
    homeEls.calGrid.append(head);
  }

  // Leading blanks so day 1 lands under its weekday (Mon-first grid).
  const first = new Date(viewYear, viewMonth, 1);
  const lead = (first.getDay() + 6) % 7;
  for (let i = 0; i < lead; i += 1) {
    const blank = document.createElement("div");
    blank.className = "cal-cell is-blank";
    homeEls.calGrid.append(blank);
  }

  homeEls.calToday.hidden = viewYear === new Date().getFullYear() && viewMonth === new Date().getMonth();

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const today = todayKey();
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = dateKey(viewYear, viewMonth, day);
    const cell = document.createElement("div");
    cell.className = "cal-cell";
    cell.setAttribute("role", "gridcell");

    const num = document.createElement("span");
    num.className = "cal-num";
    num.textContent = String(day);
    cell.append(num);

    if (key === today) cell.classList.add("is-today");
    if (key === selectedKey) cell.classList.add("is-selected");

    const items = byDate.get(key);
    if (items && items.length) {
      const worst = worstStatus(items);
      const dot = document.createElement("i");
      dot.className = `cal-dot cal-dot-${worst}`;
      cell.append(dot);
      cell.classList.add("has-events");
      if (worst === "overdue") cell.classList.add("has-overdue");
      cell.tabIndex = 0;
      cell.setAttribute("aria-label", `${longDate(key)}, ${items.length} scheduled`);
      const select = () => {
        selectedKey = selectedKey === key ? null : key;
        renderCalendar();
      };
      cell.addEventListener("click", select);
      cell.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(); }
      });
    }
    homeEls.calGrid.append(cell);
  }

  renderDayDetail(selectedKey, byDate);
}

function shiftMonth(delta) {
  const d = new Date(viewYear, viewMonth + delta, 1);
  viewYear = d.getFullYear();
  viewMonth = d.getMonth();
  selectedKey = null;
  renderCalendar();
}

homeEls.calPrev.addEventListener("click", () => shiftMonth(-1));
homeEls.calNext.addEventListener("click", () => shiftMonth(1));
homeEls.calToday.addEventListener("click", () => {
  const today = new Date();
  shiftMonth((today.getFullYear() - viewYear) * 12 + today.getMonth() - viewMonth);
});

// Every tracked service reminder + expiry for the vehicle, with status and
// human meta. Unlike the calendar dots this also includes odometer-only
// reminders that have no date to plot.
function collectDue() {
  const items = [];
  for (const vehicle of visibleVehicles()) {
    const name = vehicle.name || "Unnamed vehicle";
    for (const reminder of vehicleReminders(vehicle)) {
      items.push({
        vehicleId: vehicle.id,
        vehicleName: name,
        plate: vehicle.plate,
        title: reminder.label,
        status: reminder.status,
        meta: serviceMeta(reminder),
        days: reminder.days,
        kmLeft: reminder.kmLeft
      });
    }
    for (const entry of vehicleExpiries(vehicle)) {
      items.push({
        vehicleId: vehicle.id,
        vehicleName: name,
        plate: vehicle.plate,
        title: entry.label,
        status: entry.status,
        meta: expiryMeta(entry.days),
        days: entry.days,
        kmLeft: null
      });
    }
  }
  return items;
}

// Upcoming & due: overdue first, then due soon, then upcoming — soonest first
// within each.
function renderSchedule() {
  homeEls.scheduleList.replaceChildren();
  const items = collectDue().sort((a, b) =>
    STATUS_WEIGHT[b.status] - STATUS_WEIGHT[a.status] || urgency(a) - urgency(b));

  const urgent = items.filter((item) => item.status !== "ok").length;
  homeEls.scheduleSub.textContent = items.length
    ? (urgent ? `${urgent} item${urgent === 1 ? "" : "s"} need${urgent === 1 ? "s" : ""} attention, most urgent first.` : "All on track, soonest first.")
    : "What's coming up for this vehicle, most urgent first.";

  for (const item of items) homeEls.scheduleList.append(buildEventRow(item));
  homeEls.scheduleEmpty.hidden = items.length > 0;
}

/* ---- Vehicle picker ---- */

function closePicker() {
  homeEls.vehiclePickerMenu.hidden = true;
  homeEls.vehiclePickerButton.setAttribute("aria-expanded", "false");
}

function closeAllMenus() {
  closePicker();
  for (const menu of document.querySelectorAll(".vehicle-menu")) menu.hidden = true;
  for (const btn of document.querySelectorAll(".vehicle-menu-btn")) btn.setAttribute("aria-expanded", "false");
}

homeEls.vehiclePickerButton.addEventListener("click", (event) => {
  event.stopPropagation();
  const willOpen = homeEls.vehiclePickerMenu.hidden;
  closeAllMenus();
  if (!willOpen) return;
  homeEls.vehiclePickerMenu.hidden = false;
  homeEls.vehiclePickerButton.setAttribute("aria-expanded", "true");
  const current = homeEls.vehiclePickerMenu.querySelector('[aria-checked="true"]');
  if (current) current.focus();
});

// Close any open menu on an outside click or Escape (registered once).
document.addEventListener("click", closeAllMenus);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeAllMenus();
});

function renderPicker(selected) {
  homeEls.vehiclePickerName.textContent = selected.name || "Unnamed vehicle";
  homeEls.vehiclePickerPlate.textContent = selected.plate || "";
  homeEls.vehiclePickerPlate.hidden = !selected.plate;

  homeEls.vehiclePickerMenu.replaceChildren();
  for (const vehicle of sortedVehicles()) {
    const item = document.createElement("button");
    item.type = "button";
    item.setAttribute("role", "menuitemradio");
    const on = vehicle.id === selected.id;
    item.setAttribute("aria-checked", String(on));
    const name = document.createElement("span");
    name.className = "vehicle-picker-item-name";
    name.textContent = vehicle.name || "Unnamed vehicle";
    item.append(iconNode(on ? "check" : "car"), name);
    if (vehicle.plate) {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = vehicle.plate;
      item.append(tag);
    }
    item.addEventListener("click", () => {
      selectVehicle(vehicle.id);
      selectedKey = null;
      closePicker();
      renderHome();
      homeEls.vehiclePickerButton.focus();
    });
    homeEls.vehiclePickerMenu.append(item);
  }
}

/* ---- Vehicle card ---- */

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
  renderHome();
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
  const card = homeEls.vehicleCardTemplate.content.firstElementChild.cloneNode(true);
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
  card.querySelector(".vehicle-log").addEventListener("click", () => openRecordForm(vehicle.id));

  // ⋮ menu: odometer / edit / delete.
  const menuBtn = card.querySelector(".vehicle-menu-btn");
  const menu = card.querySelector(".vehicle-menu");
  menuBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = menu.hidden;
    closeAllMenus();
    if (willOpen) {
      menu.hidden = false;
      menuBtn.setAttribute("aria-expanded", "true");
    }
  });
  card.querySelector(".vehicle-odometer-update").addEventListener("click", async () => {
    const saved = await promptOdometerUpdate(vehicle.id);
    if (saved) renderHome();
  });
  card.querySelector(".vehicle-edit").addEventListener("click", () => openVehicleForm(vehicle.id));
  card.querySelector(".vehicle-delete").addEventListener("click", () => deleteVehicle(vehicle.id));

  return card;
}

function renderHome() {
  const vehicle = selectedVehicle();
  homeEls.homeEmpty.hidden = Boolean(vehicle);
  homeEls.vehiclePicker.hidden = !vehicle;
  homeEls.calendarSection.hidden = !vehicle;
  homeEls.scheduleSection.hidden = !vehicle;
  homeEls.fabAddRecord.hidden = !vehicle;
  homeEls.vehicleSlot.replaceChildren();
  if (!vehicle) return;

  renderPicker(vehicle);
  homeEls.vehicleSlot.append(buildVehicleCard(vehicle));
  renderCalendar();
  renderSchedule();
}

window.onPullRefresh = async () => {
  await refreshData();
  renderHome();
};

// App-shortcut deep links (manifest shortcuts land on index.html?action=…).
// The action runs on the selected vehicle. The param is stripped so a reload
// (or the second render once fresh data lands) doesn't repeat it.
async function handleShortcutAction() {
  const action = new URLSearchParams(window.location.search).get("action");
  if (!action) return;
  window.history.replaceState(null, "", window.location.pathname);
  const vehicle = selectedVehicle();
  if (!vehicle) {
    if (action === "add-record") openVehicleForm();
    return;
  }
  if (action === "add-record") {
    openRecordForm(vehicle.id);
  } else if (action === "update-odometer") {
    const saved = await promptOdometerUpdate(vehicle.id);
    if (saved) renderHome();
  }
}

const now = new Date();
viewYear = now.getFullYear();
viewMonth = now.getMonth();

renderSkeletonCards(homeEls.vehicleSlot, 1);
bootWithFallback(() => {
  renderHome();
  handleShortcutAction();
}, { cached: true });
