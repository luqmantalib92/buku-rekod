/* Home page (index.html): status counts, a compact month calendar — today
   marked and a status-coloured dot on each day that has something scheduled
   (a record's next service, or road-tax / insurance expiry) — and the
   "Upcoming & due" list below. With more than one vehicle a chip row filters
   all three to a single vehicle. Reuses the reminder logic (vehicleReminders /
   vehicleExpiries) from garage.store.js so the dots match the statuses shown
   elsewhere. */

const homeEls = {
  vehicleFilter: document.querySelector("#vehicleFilter"),
  statOverdue: document.querySelector("#statOverdue"),
  statDueSoon: document.querySelector("#statDueSoon"),
  statUpcoming: document.querySelector("#statUpcoming"),
  calTitle: document.querySelector("#calTitle"),
  calToday: document.querySelector("#calToday"),
  calGrid: document.querySelector("#calGrid"),
  calPrev: document.querySelector("#calPrev"),
  calNext: document.querySelector("#calNext"),
  calDayDetail: document.querySelector("#calDayDetail"),
  calDayTitle: document.querySelector("#calDayTitle"),
  calDayList: document.querySelector("#calDayList"),
  scheduleList: document.querySelector("#scheduleList"),
  scheduleSub: document.querySelector("#scheduleSub"),
  scheduleEmpty: document.querySelector("#scheduleEmpty"),
  scheduleEmptyText: document.querySelector("#scheduleEmptyText"),
  scheduleEmptyAction: document.querySelector("#scheduleEmptyAction"),
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

// Vehicle id the page is filtered to, or null for the whole garage. View
// state only — never persisted.
let filterVehicleId = null;

function visibleVehicles() {
  if (!filterVehicleId) return state.vehicles;
  return state.vehicles.filter((vehicle) => vehicle.id === filterVehicleId);
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

homeEls.scheduleEmptyAction.addEventListener("click", () => {
  window.location.href = state.vehicles.length ? "./vehicles.html" : "./vehicle-form.html";
});

// Add record: straight to the form when it's clear which vehicle (one in the
// garage, or the filter picked one); otherwise the garage to choose.
homeEls.fabAddRecord.addEventListener("click", () => {
  const target = filterVehicleId ? getVehicle(filterVehicleId) : (state.vehicles.length === 1 ? state.vehicles[0] : null);
  window.location.href = target
    ? `./record-form.html?vehicle=${encodeURIComponent(target.id)}`
    : (state.vehicles.length ? "./vehicles.html" : "./vehicle-form.html");
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

// One "Upcoming & due" card: vehicle + plate, status pill, what's due, and
// when. Links to the vehicle's logbook.
function buildEventRow({ vehicleId, vehicleName, plate, title, meta, status = "ok" }) {
  const link = document.createElement("a");
  link.className = `due-card is-${status}`;
  link.href = `./vehicle.html?id=${encodeURIComponent(vehicleId)}`;

  const top = document.createElement("div");
  top.className = "due-card-top";
  const who = document.createElement("span");
  who.className = "due-card-vehicle";
  const name = document.createElement("span");
  name.textContent = vehicleName;
  who.append(name);
  if (plate) {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = plate;
    who.append(tag);
  }
  const pillInfo = STATUS_PILLS[status] || STATUS_PILLS.ok;
  const pill = document.createElement("span");
  pill.className = `pill pill-${status}`;
  pill.append(iconNode(pillInfo.icon), pillInfo.label);
  top.append(who, pill);

  const heading = document.createElement("h3");
  heading.className = "due-card-title";
  heading.textContent = title;

  const metaEl = document.createElement("p");
  metaEl.className = "due-card-meta";
  metaEl.append(iconNode(status === "ok" ? "calendar" : "alert"), meta || "");

  link.append(top, heading, metaEl);
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

// Every tracked service reminder + expiry across the garage, with status and
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
// within each. The same items feed the three status counters on top.
function renderSchedule() {
  homeEls.scheduleList.replaceChildren();
  const items = collectDue().sort((a, b) =>
    STATUS_WEIGHT[b.status] - STATUS_WEIGHT[a.status] || urgency(a) - urgency(b));

  const count = (status) => items.filter((item) => item.status === status).length;
  homeEls.statOverdue.textContent = String(count("overdue"));
  homeEls.statDueSoon.textContent = String(count("due-soon"));
  homeEls.statUpcoming.textContent = String(count("ok"));

  const urgent = count("overdue") + count("due-soon");
  homeEls.scheduleSub.textContent = items.length
    ? (urgent ? `${urgent} item${urgent === 1 ? "" : "s"} need${urgent === 1 ? "s" : ""} attention, most urgent first.` : "All on track, soonest first.")
    : "What's coming up across your garage, most urgent first.";

  for (const item of items) homeEls.scheduleList.append(buildEventRow(item));

  homeEls.scheduleEmpty.hidden = items.length > 0;
  homeEls.scheduleEmptyText.textContent = state.vehicles.length
    ? "Nothing scheduled. Add a next-service date to a record to start tracking what's next."
    : "Add your first vehicle to start building service logs.";
  homeEls.scheduleEmptyAction.textContent = state.vehicles.length ? "View garage" : "Add a vehicle";
}

// Vehicle filter chips — only worth showing with two or more vehicles.
function renderVehicleFilter() {
  const vehicles = [...state.vehicles].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  if (filterVehicleId && !getVehicle(filterVehicleId)) filterVehicleId = null;
  homeEls.vehicleFilter.hidden = vehicles.length < 2;
  homeEls.vehicleFilter.replaceChildren();
  if (vehicles.length < 2) return;

  const makeChip = (id, children) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip chip-sm";
    chip.setAttribute("aria-pressed", String(filterVehicleId === id));
    chip.append(...children);
    chip.addEventListener("click", () => {
      filterVehicleId = id;
      selectedKey = null;
      renderHome();
    });
    return chip;
  };

  homeEls.vehicleFilter.append(makeChip(null, [iconNode("car"), `All vehicles (${vehicles.length})`]));
  for (const vehicle of vehicles) {
    const parts = [vehicle.name || "Unnamed vehicle"];
    if (vehicle.plate) {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = vehicle.plate;
      parts.push(tag);
    }
    homeEls.vehicleFilter.append(makeChip(vehicle.id, parts));
  }
}

function renderHome() {
  renderVehicleFilter();
  renderCalendar();
  renderSchedule();
}

window.onPullRefresh = async () => {
  await refreshData();
  renderHome();
};

// App-shortcut deep links (manifest shortcuts land on index.html?action=…).
// With a single vehicle the action runs directly; otherwise the home screen
// shows as usual. The param is stripped so a reload doesn't repeat the action.
async function handleShortcutAction() {
  const action = new URLSearchParams(window.location.search).get("action");
  if (!action) return;
  window.history.replaceState(null, "", window.location.pathname);
  if (state.vehicles.length !== 1) {
    if (action === "add-record") window.location.href = "./vehicles.html";
    return;
  }
  const vehicle = state.vehicles[0];
  if (action === "add-record") {
    window.location.href = `./record-form.html?vehicle=${encodeURIComponent(vehicle.id)}`;
  } else if (action === "update-odometer") {
    const saved = await promptOdometerUpdate(vehicle.id);
    if (saved) renderHome();
  }
}

const now = new Date();
viewYear = now.getFullYear();
viewMonth = now.getMonth();

bootWithFallback(() => {
  renderHome();
  handleShortcutAction();
});
