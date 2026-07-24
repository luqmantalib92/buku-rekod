/* Home page (index.html): a compact month calendar on top — today marked and a
   status-coloured dot on each day that has something scheduled (a record's next
   service, or road-tax / insurance expiry) — with the full service history
   below. Reuses the reminder logic (vehicleReminders / vehicleExpiries) from
   store.js so the dots match the statuses shown elsewhere. */

const homeEls = {
  calTitle: document.querySelector("#calTitle"),
  calGrid: document.querySelector("#calGrid"),
  calPrev: document.querySelector("#calPrev"),
  calNext: document.querySelector("#calNext"),
  calDayDetail: document.querySelector("#calDayDetail"),
  calDayTitle: document.querySelector("#calDayTitle"),
  calDayList: document.querySelector("#calDayList"),
  historyList: document.querySelector("#historyList"),
  historyEmpty: document.querySelector("#historyEmpty"),
  historyEmptyText: document.querySelector("#historyEmptyText"),
  historyEmptyAction: document.querySelector("#historyEmptyAction")
};

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

homeEls.historyEmptyAction.addEventListener("click", () => {
  window.location.href = "./vehicles.html";
});

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

function buildEventRow({ vehicleId, vehicleName, title, meta }) {
  const link = document.createElement("a");
  link.className = "reminder reminder-ok agenda-item";
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
  for (const item of items) {
    const row = buildEventRow(item);
    row.classList.remove("reminder-ok");
    row.classList.add(`reminder-${item.status}`);
    homeEls.calDayList.append(row);
  }
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

function renderHistory() {
  const rows = [];
  for (const vehicle of state.vehicles) {
    const name = vehicle.name || "Unnamed vehicle";
    for (const record of vehicle.records) {
      rows.push({ vehicleId: vehicle.id, vehicleName: name, record });
    }
  }
  rows.sort((a, b) => (b.record.date || "").localeCompare(a.record.date || ""));

  homeEls.historyEmpty.hidden = rows.length > 0;
  homeEls.historyEmptyText.textContent = state.vehicles.length
    ? "No services logged yet. Open a vehicle to log one."
    : "Add your first vehicle to start building service logs.";
  homeEls.historyEmptyAction.textContent = state.vehicles.length ? "View garage" : "Add a vehicle";

  homeEls.historyList.replaceChildren();
  for (const { vehicleId, vehicleName, record } of rows) {
    homeEls.historyList.append(buildEventRow({
      vehicleId,
      vehicleName,
      title: categoryLabel(record.category),
      meta: formatDate(record.date)
    }));
  }
}

function renderHome() {
  renderCalendar();
  renderHistory();
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
