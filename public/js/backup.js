/* Backup & restore (backup.html): export every mini app's data to one JSON
   file, and restore it.

   This is also the supported way to move between Firebase projects. Restore
   writes to whichever account is signed in *now*, so exporting from one
   project and importing into another re-homes the data automatically —
   Firebase Auth uids differ per project, and this sidesteps that entirely
   instead of trying to re-key documents.

   Stores are keyed by localKey in the file: a stable identifier that doesn't
   change when a mini app is renamed, and that lets an older backup restore
   cleanly after a third mini app is added. */

const BACKUP_FORMAT = 1;
const BACKUP_APP = "buku-rekod";
// Files exported before the rename to Buku Rekod carry the old app tag.
// Same format, so they still restore.
const LEGACY_BACKUP_APPS = ["logbook"];

const backupEls = {
  summary: document.querySelector("#backupSummary"),
  exportButton: document.querySelector("#exportButton"),
  importButton: document.querySelector("#importButton"),
  importFile: document.querySelector("#importFile"),
  status: document.querySelector("#backupStatus")
};

function setBackupStatus(message, tone) {
  backupEls.status.hidden = !message;
  backupEls.status.textContent = message || "";
  backupEls.status.classList.toggle("is-error", tone === "error");
}

/* ---- Describing what's stored ---- */

// A short human count per mini app, so the page says what a backup contains
// rather than just claiming success.
function describeStoreData(store, data) {
  if (!data) return "nothing saved yet";
  if (Array.isArray(data.vehicles)) {
    const vehicles = data.vehicles.length;
    const records = data.vehicles.reduce((sum, v) => sum + (Array.isArray(v.records) ? v.records.length : 0), 0);
    return `${vehicles} vehicle${vehicles === 1 ? "" : "s"}, ${records} service record${records === 1 ? "" : "s"}`;
  }
  if (Array.isArray(data.items)) {
    const items = data.items.length;
    return `${items} saved title${items === 1 ? "" : "s"}`;
  }
  return "saved";
}

async function renderSummary() {
  backupEls.summary.replaceChildren();
  for (const store of STORES) {
    let text;
    try {
      text = describeStoreData(store, await readStoreData(store));
    } catch (error) {
      console.error(error);
      text = "couldn't be read";
    }
    const row = document.createElement("div");
    row.className = "backup-row";
    const tile = document.createElement("span");
    tile.className = "icon-tile icon-tile-sm";
    tile.append(iconNode(store.label === "Movies" ? "film" : store.label === "Vehicles" ? "car" : "layers"));
    row.append(tile);
    const name = document.createElement("span");
    name.className = "backup-row-name";
    name.textContent = store.label || store.localKey;
    const detail = document.createElement("span");
    detail.className = "backup-row-detail";
    detail.textContent = text;
    row.append(name, detail);
    backupEls.summary.append(row);
  }
}

/* ---- Export ---- */

function backupFilename() {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
  return `buku-rekod-backup-${stamp}.json`;
}

async function exportAll() {
  setBackupStatus("Collecting your data…");

  const stores = {};
  let included = 0;
  for (const store of STORES) {
    const data = await readStoreData(store);
    if (data) {
      stores[store.localKey] = data;
      included += 1;
    }
  }

  if (!included) {
    setBackupStatus("There's nothing saved yet to export.", "error");
    return;
  }

  const payload = {
    app: BACKUP_APP,
    formatVersion: BACKUP_FORMAT,
    appVersion: typeof APP_VERSION === "undefined" ? null : APP_VERSION,
    exportedAt: new Date().toISOString(),
    stores
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = backupFilename();
  document.body.append(link);
  link.click();
  link.remove();
  // Revoke on the next tick so the download has taken the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  setBackupStatus(`Exported ${included} mini app${included === 1 ? "" : "s"} to ${link.download}.`);
}

/* ---- Import ---- */

function parseBackup(text) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  const knownApp = payload && (payload.app === BACKUP_APP || LEGACY_BACKUP_APPS.includes(payload.app));
  if (!knownApp || !payload.stores || typeof payload.stores !== "object") {
    throw new Error("That doesn't look like a Buku Rekod backup file.");
  }
  if (Number(payload.formatVersion) > BACKUP_FORMAT) {
    throw new Error("That backup was made by a newer version of the app. Update first, then import.");
  }
  return payload;
}

async function importFromFile(file) {
  const payload = parseBackup(await file.text());

  // Only restore stores this build actually knows about; anything else in the
  // file (a mini app added later, then removed) is reported rather than
  // silently dropped.
  const matched = STORES.filter((store) => payload.stores[store.localKey]);
  const unknown = Object.keys(payload.stores).filter(
    (key) => !STORES.some((store) => store.localKey === key)
  );

  if (!matched.length) {
    throw new Error("That backup has no data this version of the app can restore.");
  }

  const lines = matched.map(
    (store) => `• ${store.label || store.localKey} — ${describeStoreData(store, payload.stores[store.localKey])}`
  );
  const exportedOn = payload.exportedAt ? new Date(payload.exportedAt).toLocaleString("en-MY") : "an unknown date";

  const ok = await confirmDialog({
    title: "Replace your data?",
    message: `This backup was made on ${exportedOn} and contains:\n${lines.join("\n")}\n\n`
      + "Restoring overwrites what's currently saved for those mini apps. This can't be undone.",
    confirmLabel: "Restore",
    danger: true
  });
  if (!ok) {
    setBackupStatus("Import cancelled — nothing was changed.");
    return;
  }

  setBackupStatus("Restoring…");
  for (const store of matched) {
    await writeStoreData(store, payload.stores[store.localKey]);
  }

  await renderSummary();
  const skipped = unknown.length ? ` ${unknown.length} unrecognised section(s) were skipped.` : "";
  setBackupStatus(`Restored ${matched.length} mini app${matched.length === 1 ? "" : "s"}.${skipped}`);
}

/* ---- Wiring ---- */

backupEls.exportButton.addEventListener("click", () =>
  withButtonBusy(backupEls.exportButton, "Exporting…", async () => {
    try {
      await exportAll();
    } catch (error) {
      console.error(error);
      setBackupStatus(error.message || "Export failed.", "error");
    }
  })
);

backupEls.importButton.addEventListener("click", () => backupEls.importFile.click());

backupEls.importFile.addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  // Reset first so picking the same file twice still fires a change event.
  event.target.value = "";
  if (!file) return;
  try {
    await importFromFile(file);
  } catch (error) {
    console.error(error);
    setBackupStatus(error.message || "Import failed.", "error");
  }
});

setupBackButton("./settings.html");

bootWithFallback(() => {
  renderSummary();
});
