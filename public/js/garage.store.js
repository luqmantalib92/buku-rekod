/* Vehicle Log data module — the garage domain: vehicles, service records,
   categories, service intervals and reminders.

   Auth, boot, persistence plumbing and the shared dialogs live in core.js;
   this file only describes the garage's own data and rules, then registers
   itself with defineStore() at the bottom. Requires core.js first. */

const GARAGE_LOCAL_KEY = "vehicle-service-log:v1";

const state = {
  vehicles: [],
  settings: { leadDays: {} },
  categories: []
};

/* ---- Formatting ---- */

function formatKm(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return `${number.toLocaleString("en-MY")} km`;
}

function formatMoney(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR"
  }).format(number);
}

/* ---- Data model ---- */

function normalizeVehicle(vehicle) {
  const source = vehicle || {};
  return {
    id: source.id || makeId(),
    name: source.name || "",
    plate: source.plate || "",
    odometer: Number(source.odometer || 0),
    odometerDate: source.odometerDate || "",
    model: source.model || "",
    image: source.image || "",
    roadTaxExpiry: source.roadTaxExpiry || "",
    insuranceExpiry: source.insuranceExpiry || "",
    createdAt: source.createdAt || new Date().toISOString(),
    records: Array.isArray(source.records) ? source.records : []
  };
}

// Approx decoded byte size of a data URL (base64 payload is ~4/3 of bytes).
function dataUrlBytes(dataUrl) {
  const comma = dataUrl.indexOf(",");
  return Math.ceil((dataUrl.length - comma - 1) * 3 / 4);
}

const IMAGE_MAX_INPUT_BYTES = 15 * 1024 * 1024; // reject huge originals (15 MB)
const IMAGE_TARGET_BYTES = 80 * 1024;           // compress down to ~80 KB
const IMAGE_START_SIZE = 640;                   // starting max dimension (px)
const IMAGE_MIN_SIZE = 240;                     // don't degrade below this

// Gatekeeper: validate an uploaded image, then resize + JPEG-compress it,
// stepping quality/dimensions down until it fits IMAGE_TARGET_BYTES, so photos
// live inline in Firestore/localStorage (no paid Storage) without blowing the
// 1 MB doc budget. Resolves { dataUrl, bytes }; rejects with a user message.
function fileToResizedDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith("image/")) {
      reject(new Error("That's not an image. Please choose a photo (JPG, PNG, HEIC…)."));
      return;
    }
    if (file.size > IMAGE_MAX_INPUT_BYTES) {
      reject(new Error(`That image is ${Math.round(file.size / (1024 * 1024))} MB — please choose one under 15 MB.`));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That image looks corrupted or unsupported."));
      img.onload = () => {
        if (!img.width || !img.height) {
          reject(new Error("That image has no dimensions."));
          return;
        }

        const encode = (maxSize, quality) => {
          const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          return canvas.toDataURL("image/jpeg", quality);
        };

        let maxSize = IMAGE_START_SIZE;
        let quality = 0.8;
        let dataUrl = encode(maxSize, quality);

        // Step down quality first, then dimensions, until under target.
        for (let guard = 0; guard < 16 && dataUrlBytes(dataUrl) > IMAGE_TARGET_BYTES; guard += 1) {
          if (quality > 0.45) {
            quality -= 0.1;
          } else if (maxSize > IMAGE_MIN_SIZE) {
            maxSize = Math.max(IMAGE_MIN_SIZE, Math.round(maxSize * 0.8));
            quality = 0.7;
          } else {
            break; // as small as we'll go
          }
          dataUrl = encode(maxSize, quality);
        }

        resolve({ dataUrl, bytes: dataUrlBytes(dataUrl) });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Accepts new format ({vehicles: []}) and the old single-vehicle format
// ({vehicle, records}), migrating the latter into a one-vehicle garage.
function ingestGarage(data) {
  const source = data || {};
  if (Array.isArray(source.vehicles)) {
    state.vehicles = source.vehicles.map(normalizeVehicle);
  } else if (source.vehicle || Array.isArray(source.records)) {
    state.vehicles = [normalizeVehicle({
      ...(source.vehicle || { name: "My vehicle" }),
      records: source.records || []
    })];
  } else {
    state.vehicles = [];
  }
  state.settings = normalizeSettings(source.settings);
  state.categories = normalizeCategories(source.categories);
}

function getVehicle(id) {
  return state.vehicles.find((vehicle) => vehicle.id === id) || null;
}

function latestOdometer(vehicle) {
  return Math.max(
    Number(vehicle.odometer || 0),
    ...vehicle.records.map((record) => Number(record.odometer || 0)),
    0
  );
}

/* ---- Service categories (groups) ---- */

// Built-in seed. Used until the user customizes categories (then their saved
// list in state.categories takes over). getCategories() is the source of truth.
const DEFAULT_CATEGORIES = [
  { key: "engine-oil", label: "Engine & oil", lead: 30, items: ["Engine oil", "Oil filter", "Air filter", "Cabin/aircond filter"] },
  { key: "brakes-fluids", label: "Brakes & fluids", lead: 30, items: ["Brake pads", "Brake fluid", "Coolant", "ATF/gearbox oil"] },
  { key: "electrical-wear", label: "Electrical & wear", lead: 30, items: ["Battery", "Spark plugs", "Wipers", "Bulbs"] },
  { key: "tyres-alignment", label: "Tyres & alignment", lead: 30, items: ["Tyre rotation", "Alignment & balancing", "New front tyre", "New back tyre", "New tyres"] },
  { key: "other", label: "Other", lead: 30, items: [] }
];

function getCategories() {
  return state.categories.length ? state.categories : DEFAULT_CATEGORIES;
}

function normalizeCategories(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((entry) => ({
      key: entry.key || makeId(),
      label: String(entry.label || "").trim(),
      lead: Number.isFinite(Number(entry.lead)) ? Number(entry.lead) : 30,
      items: Array.isArray(entry.items) ? entry.items.map(String) : []
    }))
    .filter((entry) => entry.label);
}

function categoryLabel(key) {
  const category = getCategories().find((entry) => entry.key === key);
  return category ? category.label : "Other";
}

// Days before a due date to start warning, per category: user override wins,
// then the category default, then the global fallback.
function leadDaysFor(key) {
  const override = Number(state.settings?.leadDays?.[key]);
  if (Number.isFinite(override) && override >= 0) return override;
  const category = getCategories().find((entry) => entry.key === key);
  return category && Number.isFinite(category.lead) ? category.lead : DUE_SOON_DAYS;
}

function normalizeSettings(settings) {
  const leadDays = {};
  const source = (settings && settings.leadDays) || {};
  for (const key of Object.keys(source)) {
    const value = Number(source[key]);
    if (Number.isFinite(value) && value >= 0) leadDays[key] = value;
  }
  return { leadDays };
}

/* ---- Next-service suggestions ----
   Approximate maintenance intervals for common items: `months` = calendar
   time, `km` = distance. These are sensible generic defaults, not specific to
   any make/model — the user can always edit the suggested values. */
const SERVICE_INTERVALS = {
  "engine oil": { months: 6, km: 10000 },
  "oil filter": { months: 6, km: 10000 },
  "air filter": { months: 12, km: 20000 },
  "cabin/aircond filter": { months: 12, km: 15000 },
  "brake pads": { months: 24, km: 40000 },
  "brake fluid": { months: 24, km: 40000 },
  "coolant": { months: 24, km: 40000 },
  "atf/gearbox oil": { months: 48, km: 40000 },
  "battery": { months: 36, km: 60000 },
  "spark plugs": { months: 36, km: 40000 },
  "wipers": { months: 12, km: 0 },
  "tyre rotation": { months: 6, km: 10000 },
  "alignment & balancing": { months: 12, km: 20000 },
  "new front tyre": { months: 36, km: 40000 },
  "new back tyre": { months: 36, km: 40000 },
  "new tyres": { months: 36, km: 40000 }
};

// Fallback interval per default category, used when no item matched above.
const CATEGORY_INTERVALS = {
  "engine-oil": { months: 6, km: 10000 },
  "brakes-fluids": { months: 24, km: 40000 },
  "electrical-wear": { months: 36, km: 40000 },
  "tyres-alignment": { months: 12, km: 20000 }
};

// Add whole months to a YYYY-MM-DD string, clamping day overflow (e.g. Jan 31
// + 1 month → Feb 28/29). Returns "" if the input is empty/invalid.
function addMonthsToDate(dateStr, months) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// Suggest the next service date + odometer from what's being logged. Picks the
// soonest interval among matched items (whichever part is due first wins).
// Returns { nextDate, nextOdometer, note } or null if nothing matched.
function suggestNextService({ categoryKey, items, date, odometer }) {
  const candidates = [];
  for (const item of items || []) {
    const key = String(item).trim().toLowerCase();
    if (SERVICE_INTERVALS[key]) candidates.push({ label: item, ...SERVICE_INTERVALS[key] });
  }
  if (!candidates.length && CATEGORY_INTERVALS[categoryKey]) {
    candidates.push({ label: categoryLabel(categoryKey), ...CATEGORY_INTERVALS[categoryKey] });
  }
  if (!candidates.length) return null;

  const byMonths = candidates.filter((c) => c.months > 0).sort((a, b) => a.months - b.months)[0];
  const byKm = candidates.filter((c) => c.km > 0).sort((a, b) => a.km - b.km)[0];

  const nextDate = byMonths && date ? addMonthsToDate(date, byMonths.months) : "";
  const odo = Number(odometer);
  const nextOdometer = byKm && Number.isFinite(odo) && odo > 0 ? odo + byKm.km : "";

  const bits = [];
  if (byMonths) bits.push(`~${byMonths.months} months`);
  if (byKm) bits.push(`${byKm.km.toLocaleString()} km`);
  const driver = (byMonths || byKm).label.toLowerCase();
  const note = `Based on ${driver}: about every ${bits.join(" / ")}. Adjust if your car differs.`;

  return { nextDate, nextOdometer, note };
}

/* ---- Reminders (in-app) ---- */

const DUE_SOON_DAYS = 30;

// Start warning when the next-service odometer is this close (km).
const KM_DUE_SOON = 1000;

const STATUS_RANK = { ok: 0, upcoming: 0, "due-soon": 1, overdue: 2 };

// Next-service status for a single record, by date and/or odometer: null when
// there's nothing to track or it's been marked serviced. Otherwise
// { days, kmLeft, status, by } — status is "overdue" | "due-soon" | "upcoming"
// (the worse of the two signals) and `by` says which signal drove it.
function recordNextStatus(record, currentOdometer) {
  if (!record || record.nextDone) return null;

  let days = null;
  let dateStatus = null;
  if (record.nextDate) {
    days = daysUntil(record.nextDate);
    if (days !== null) {
      if (days < 0) dateStatus = "overdue";
      else if (days <= leadDaysFor(record.category || "other")) dateStatus = "due-soon";
      else dateStatus = "upcoming";
    }
  }

  let kmLeft = null;
  let kmStatus = null;
  const nextOdo = Number(record.nextOdometer);
  const currentOdo = Number(currentOdometer);
  if (Number.isFinite(nextOdo) && nextOdo > 0 && Number.isFinite(currentOdo) && currentOdo > 0) {
    kmLeft = nextOdo - currentOdo;
    if (kmLeft < 0) kmStatus = "overdue";
    else if (kmLeft <= KM_DUE_SOON) kmStatus = "due-soon";
    else kmStatus = "upcoming";
  }

  if (dateStatus === null && kmStatus === null) return null;
  let by = "date";
  let status = dateStatus;
  if (kmStatus !== null && (dateStatus === null || STATUS_RANK[kmStatus] > STATUS_RANK[dateStatus])) {
    by = "km";
    status = kmStatus;
  }
  return { days, kmLeft, status, by };
}

// One reminder per category, based on the most recent record in that category
// with a next-service date or odometer. Overdue first, then soonest.
function vehicleReminders(vehicle) {
  const currentOdo = latestOdometer(vehicle);
  const latestByCategory = new Map();
  for (const record of vehicle.records) {
    if (record.nextDone || (!record.nextDate && !record.nextOdometer)) continue;
    const key = record.category || "other";
    const existing = latestByCategory.get(key);
    if (!existing || (record.date || "") > (existing.date || "")) {
      latestByCategory.set(key, record);
    }
  }

  const reminders = [];
  for (const [key, record] of latestByCategory) {
    const next = recordNextStatus(record, currentOdo);
    if (!next) continue;
    reminders.push({
      category: key,
      label: categoryLabel(key),
      nextDate: record.nextDate,
      days: next.days,
      kmLeft: next.kmLeft,
      status: next.status === "upcoming" ? "ok" : next.status
    });
  }

  reminders.sort((a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status] || (a.days ?? 9999) - (b.days ?? 9999));
  return reminders;
}

/* ---- Vehicle-level expiries (road tax & insurance) ---- */

const EXPIRY_LEAD_DAYS = 30;

// Road tax / insurance status entries for a vehicle. Dates the user hasn't
// set are skipped. status is "ok" | "due-soon" | "overdue".
function vehicleExpiries(vehicle) {
  const entries = [];
  for (const [field, label] of [["roadTaxExpiry", "Road tax"], ["insuranceExpiry", "Insurance"]]) {
    const date = vehicle[field];
    if (!date) continue;
    const days = daysUntil(date);
    if (days === null) continue;
    let status = "ok";
    if (days < 0) status = "overdue";
    else if (days <= EXPIRY_LEAD_DAYS) status = "due-soon";
    entries.push({ field, label, date, days, status });
  }
  return entries;
}

function vehicleDueCount(vehicle) {
  return vehicleReminders(vehicle).filter((reminder) => reminder.status !== "ok").length
    + vehicleExpiries(vehicle).filter((entry) => entry.status !== "ok").length;
}

/* ---- Garage actions ---- */

// Quick odometer update (no service record needed) — keeps km-based
// reminders honest between services. Resolves true if a value was saved.
async function promptOdometerUpdate(vehicleId) {
  const vehicle = getVehicle(vehicleId);
  if (!vehicle) return false;
  const current = latestOdometer(vehicle);

  const value = await promptDialog({
    title: "Update odometer",
    message: current > 0
      ? `Last saved reading: ${formatKm(current)}.`
      : "Enter the current odometer reading.",
    label: "Current odometer (km)",
    value: current > 0 ? String(current) : "",
    confirmLabel: "Save",
    inputAttrs: { type: "number", min: "0", step: "1", inputmode: "numeric", required: "required" }
  });
  if (value === null) return false;

  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return false;
  vehicle.odometer = number;
  vehicle.odometerDate = new Date().toISOString().slice(0, 10);
  await persist();
  return true;
}

// Unique, sorted workshop names across all records — powers the workshop
// autocomplete suggestions.
function getWorkshopNames() {
  const names = new Set();
  for (const vehicle of state.vehicles) {
    for (const record of vehicle.records) {
      const workshop = (record.workshop || "").trim();
      if (workshop) names.add(workshop);
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/* ---- Registration ---- */

defineStore({
  label: "Vehicles",
  localKey: GARAGE_LOCAL_KEY,
  docPath: (uid) => ["users", uid, "garage", "main"],
  ingest: ingestGarage,
  serialize: () => ({
    vehicles: state.vehicles,
    settings: state.settings,
    categories: state.categories
  }),
  reset: () => {
    state.vehicles = [];
    state.settings = { leadDays: {} };
    state.categories = [];
  }
});
