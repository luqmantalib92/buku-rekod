/* Scheduled reminder notifications.
 *
 * Runs daily, scans every user's garage for services that are overdue or due
 * within that category's lead window, and sends a push to the user's devices.
 * Requires the Blaze plan (Cloud Functions + Cloud Scheduler).
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

const DEFAULT_LEAD = 30;
const CATEGORY_LABELS = {
  "engine-oil": "Engine & oil",
  "brakes-fluids": "Brakes & fluids",
  "electrical-wear": "Electrical & wear",
  "tyres-alignment": "Tyres & alignment",
  other: "Other"
};

function categoryLabel(key) {
  return CATEGORY_LABELS[key] || "Other";
}

function daysUntil(dateStr, today) {
  if (!dateStr) return null;
  const target = new Date(`${dateStr}T00:00:00`);
  return Math.round((target - today) / 86400000);
}

function leadDaysFor(key, settings) {
  const override = Number(settings && settings.leadDays && settings.leadDays[key]);
  return Number.isFinite(override) && override >= 0 ? override : DEFAULT_LEAD;
}

// Categories in a vehicle that are overdue or within their lead window,
// using the most recent record per category (mirrors the client logic).
function dueForVehicle(vehicle, settings, today) {
  const latestByCategory = new Map();
  for (const record of vehicle.records || []) {
    if (!record.nextDate) continue;
    const key = record.category || "other";
    const existing = latestByCategory.get(key);
    if (!existing || (record.date || "") > (existing.date || "")) {
      latestByCategory.set(key, record);
    }
  }

  const due = [];
  for (const [key, record] of latestByCategory) {
    const days = daysUntil(record.nextDate, today);
    if (days === null) continue;
    if (days < 0 || days <= leadDaysFor(key, settings)) {
      due.push({ label: categoryLabel(key), days });
    }
  }
  return due;
}

exports.serviceReminders = onSchedule(
  { schedule: "every day 09:00", timeZone: "Asia/Kuala_Lumpur" },
  async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // collectionGroup finds every users/<uid>/garage/main doc even though the
    // parent users/<uid> document itself is never written.
    const garages = await db.collectionGroup("garage").get();
    let sent = 0;

    for (const doc of garages.docs) {
      if (doc.id !== "main") continue;
      const uid = doc.ref.parent.parent && doc.ref.parent.parent.id;
      if (!uid) continue;

      const data = doc.data() || {};
      const vehicles = data.vehicles || [];
      const settings = data.settings || {};

      const lines = [];
      for (const vehicle of vehicles) {
        for (const item of dueForVehicle(vehicle, settings, today)) {
          const when = item.days < 0
            ? `${Math.abs(item.days)}d overdue`
            : item.days === 0
              ? "due today"
              : `in ${item.days}d`;
          lines.push(`${vehicle.name || "Vehicle"}: ${item.label} (${when})`);
        }
      }
      if (!lines.length) continue;

      const pushSnap = await db.doc(`users/${uid}/meta/push`).get();
      const tokens = pushSnap.exists ? (pushSnap.data().tokens || []) : [];
      if (!tokens.length) continue;

      const title = lines.length === 1 ? "1 service due" : `${lines.length} services due`;
      const body = lines.slice(0, 6).join("\n");

      const response = await getMessaging().sendEachForMulticast({
        tokens,
        data: { title, body, url: "/index.html" }
      });
      sent += response.successCount;

      // Drop tokens the FCM backend reports as dead.
      const stale = [];
      response.responses.forEach((result, index) => {
        if (!result.success) {
          const code = result.error && result.error.code;
          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-argument"
          ) {
            stale.push(tokens[index]);
          }
        }
      });
      if (stale.length) {
        await db.doc(`users/${uid}/meta/push`).set(
          { tokens: FieldValue.arrayRemove(...stale) },
          { merge: true }
        );
      }
    }

    logger.info(`serviceReminders sent ${sent} message(s)`);
  }
);
