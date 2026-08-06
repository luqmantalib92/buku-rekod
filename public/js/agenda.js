/* Home page (index.html): a compact month calendar on top — today marked and a
   status-coloured dot on each day that has something scheduled (a record's next
   service, or road-tax / insurance expiry) — with the full service history
   below. Reuses the reminder logic (vehicleReminders / vehicleExpiries) from
   garage.store.js so the dots match the statuses shown elsewhere. */

const homeEls = {
  calTitle: document.querySelector("#calTitle"),
  calGrid: document.querySelector("#calGrid"),
  calPrev: document.querySelector("#calPrev"),
  calNext: document.querySelector("#calNext"),
  calDayDetail: document.querySelector("#calDayDetail"),
  calDayTitle: document.querySelector("#calDayTitle"),
  calDayList: document.querySelector("#calDayList"),
  scheduleList: document.querySelector("#scheduleList"),
  scheduleEmpty: document.querySelector("#scheduleEmpty"),
  scheduleEmptyText: document.querySelector("#scheduleEmptyText"),
  scheduleEmptyAction: document.querySelector("#scheduleEmptyAction"),
  scheduleGroupTemplate: document.querySelector("#scheduleGroupTemplate")
};

// Upcoming & due list, grouped by status (soonest first within each group).
const SCHEDULE_GROUPS = [
  { key: "overdue", label: "Overdue", statuses: ["overdue"] },
  { key: "due-soon", label: "Due soon", statuses: ["due-soon"] },
  { key: "upcoming", label: "Upcoming", statuses: ["ok"] }
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const STATUS_WEIGHT = { ok: 0, "due-soon": 1, overdue: 2 };

// The month currently shown (1st of that month) and the selected day, if any.
let viewYear;
let viewMonth;
let selectedKey = null;

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
  window.location.href = "./vehicles.html";
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
  for (const vehicle of state.vehicles) {
    const name = vehicle.name || "Unnamed vehicle";
    for (const reminder of vehicleReminders(vehicle)) {
      add(reminder.nextDate, { vehicleId: vehicle.id, vehicleName: name, title: reminder.label, status: reminder.status });
    }
    for (const entry of vehicleExpiries(vehicle)) {
      add(entry.date, { vehicleId: vehicle.id, vehicleName: name, title: entry.label, status: entry.status });
    }
  }
  return byDate;
}

// Worst status among a day's items — drives the dot colour.
function worstStatus(items) {
  return items.reduce((worst, item) =>
    STATUS_WEIGHT[item.status] > STATUS_WEIGHT[worst] ? item.status : worst, "ok");
}

function buildEventRow({ vehicleId, vehicleName, title, meta, status = "ok" }) {
  const link = document.createElement("a");
  link.className = `reminder reminder-${status} agenda-item`;
  link.href = `./vehicle.html?id=${encodeURIComponent(vehicleId)}`;
  const label = document.createElement("span");
  label.className = "reminder-label";
  label.textContent = title;
  const sub = document.createElement("span");
  sub.className = "agenda-item-sub";
  sub.textContent = vehicleName;
  label.append(sub);
  const metaEl = document.createElement("span");
  metaEl.className = "reminder-meta";
  metaEl.textContent = meta || "";
  link.append(label, metaEl);
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
      const dot = document.createElement("i");
      dot.className = `cal-dot cal-dot-${worstStatus(items)}`;
      cell.append(dot);
      cell.classList.add("has-events");
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

// Every tracked service reminder + expiry across the garage, with status and
// human meta. Unlike the calendar dots this also includes odometer-only
// reminders that have no date to plot.
function collectDue() {
  const items = [];
  for (const vehicle of state.vehicles) {
    const name = vehicle.name || "Unnamed vehicle";
    for (const reminder of vehicleReminders(vehicle)) {
      items.push({
        vehicleId: vehicle.id,
        vehicleName: name,
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

function renderSchedule() {
  homeEls.scheduleList.replaceChildren();
  const items = collectDue();
  let shown = 0;

  for (const group of SCHEDULE_GROUPS) {
    const groupItems = items
      .filter((item) => group.statuses.includes(item.status))
      .sort((a, b) => urgency(a) - urgency(b));
    if (!groupItems.length) continue;
    shown += groupItems.length;

    const node = homeEls.scheduleGroupTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".schedule-group-label").textContent = group.label;
    const list = node.querySelector(".reminder-list");
    for (const item of groupItems) list.append(buildEventRow(item));
    homeEls.scheduleList.append(node);
  }

  homeEls.scheduleEmpty.hidden = shown > 0;
  homeEls.scheduleEmptyText.textContent = state.vehicles.length
    ? "Nothing scheduled. Add a next-service date to a record to start tracking what's next."
    : "Add your first vehicle to start building service logs.";
  homeEls.scheduleEmptyAction.textContent = state.vehicles.length ? "View garage" : "Add a vehicle";
}

function renderHome() {
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
