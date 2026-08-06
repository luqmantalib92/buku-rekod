/* App-agnostic core shared by every mini app in the super app.

   Owns: Firebase init + auth, the boot sequence, load/save plumbing, the
   shared dialogs, and the topbar/shell helpers. It knows nothing about
   vehicles or movies — each mini app supplies its own data module via
   defineStore() and this file drives it.

   Load order on every page:
     version.js → shell.js → firebase-config.js → core.js → <app>.store.js → <page>.js */

const appState = {
  user: null,
  auth: null,
  db: null,
  dataRef: null,
  useFirestore: false
};

function hasFirebaseConfig() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && window.firebase?.auth && window.firebase?.firestore);
}

/* ---- Generic formatting ---- */

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}

function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
}

// Whole days from today to a YYYY-MM-DD date (negative = past).
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${dateStr}T00:00:00`);
  return Math.round((target - today) / 86400000);
}

/* ---- Mini-app data modules ----

   A mini app describes its own storage by calling defineStore() at parse
   time. Exactly one store is active per page — the one whose <app>.store.js
   the page includes.

     localKey  string                  localStorage key for offline/local mode
     docPath   (uid) => string[]       Firestore path segments for the doc
     ingest    (data) => void          hydrate in-memory state from a snapshot
     serialize () => object            the object to write back
     reset     () => void              clear in-memory state (signed out / no data)
*/

let activeStore = null;

function defineStore(config) {
  activeStore = config;
  return config;
}

function requireStore() {
  if (!activeStore) throw new Error("No store defined — include an <app>.store.js before the page script.");
  return activeStore;
}

function loadLocal() {
  const store = requireStore();
  const raw = localStorage.getItem(store.localKey);
  if (!raw) {
    store.reset();
    return;
  }
  try {
    store.ingest(JSON.parse(raw));
  } catch {
    store.reset();
  }
}

function saveLocal() {
  const store = requireStore();
  localStorage.setItem(store.localKey, JSON.stringify(store.serialize()));
}

async function loadRemoteData() {
  if (!appState.dataRef) return;
  const snapshot = await appState.dataRef.get();
  requireStore().ingest(snapshot.exists ? snapshot.data() : {});
}

// Re-pull the latest data (used by pull-to-refresh). The caller re-renders.
async function refreshData() {
  if (appState.useFirestore && appState.dataRef) {
    await loadRemoteData();
  } else {
    loadLocal();
  }
}

async function persist() {
  if (appState.useFirestore && appState.dataRef) {
    await appState.dataRef.set({
      ...requireStore().serialize(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } else {
    saveLocal();
  }
}

/* ---- Shared shell (topbar) ---- */

const shellEls = {
  appContent: document.querySelector("#appContent"),
  appLoading: document.querySelector("#appLoading"),
  signOutButton: document.querySelector("#signOutButton"),
  accountButton: document.querySelector("#accountButton"),
  accountMenu: document.querySelector("#accountMenu"),
  accountAvatar: document.querySelector("#accountAvatar"),
  accountMenuAvatar: document.querySelector("#accountMenuAvatar"),
  accountEmail: document.querySelector("#accountEmail"),
  accountStatus: document.querySelector("#accountStatus")
};

/* ---- Custom confirmation dialog (replaces window.confirm) ---- */

let confirmEls = null;

function ensureConfirmModal() {
  if (confirmEls) return confirmEls;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.hidden = true;

  const modal = document.createElement("div");
  modal.className = "modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");

  const title = document.createElement("h2");
  title.className = "modal-title";
  const message = document.createElement("p");
  message.className = "modal-message";
  const actions = document.createElement("div");
  actions.className = "modal-actions";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "ghost-action";
  const ok = document.createElement("button");
  ok.type = "button";
  ok.className = "primary-action";

  actions.append(cancel, ok);
  modal.append(title, message, actions);
  backdrop.append(modal);
  document.body.append(backdrop);

  confirmEls = { backdrop, title, message, cancel, ok };
  return confirmEls;
}

// Promise<boolean> — resolves true on confirm, false on cancel/dismiss.
function confirmDialog(options) {
  const opts = options || {};
  const els = ensureConfirmModal();

  els.title.textContent = opts.title || "Are you sure?";
  els.message.textContent = opts.message || "";
  els.message.hidden = !opts.message;
  els.ok.textContent = opts.confirmLabel || "Confirm";
  els.cancel.textContent = opts.cancelLabel || "Cancel";
  els.ok.classList.toggle("danger-action", Boolean(opts.danger));

  els.backdrop.hidden = false;
  document.body.style.overflow = "hidden";
  // Focus Cancel for destructive prompts so an accidental Enter won't confirm.
  (opts.danger ? els.cancel : els.ok).focus();

  return new Promise((resolve) => {
    function cleanup(result) {
      els.backdrop.hidden = true;
      document.body.style.overflow = "";
      els.ok.removeEventListener("click", onOk);
      els.cancel.removeEventListener("click", onCancel);
      els.backdrop.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKey);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    function onBackdrop(event) { if (event.target === els.backdrop) cleanup(false); }
    function onKey(event) { if (event.key === "Escape") cleanup(false); }

    els.ok.addEventListener("click", onOk);
    els.cancel.addEventListener("click", onCancel);
    els.backdrop.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKey);
  });
}

/* ---- Input dialog (a confirm dialog with one field) ---- */

let promptEls = null;

function ensurePromptModal() {
  if (promptEls) return promptEls;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.hidden = true;

  const modal = document.createElement("form");
  modal.className = "modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");

  const title = document.createElement("h2");
  title.className = "modal-title";
  const message = document.createElement("p");
  message.className = "modal-message";
  const field = document.createElement("label");
  field.className = "modal-field";
  const fieldLabel = document.createElement("span");
  const input = document.createElement("input");
  field.append(fieldLabel, input);
  const actions = document.createElement("div");
  actions.className = "modal-actions";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "ghost-action";
  const ok = document.createElement("button");
  ok.type = "submit";
  ok.className = "primary-action";

  actions.append(cancel, ok);
  modal.append(title, message, field, actions);
  backdrop.append(modal);
  document.body.append(backdrop);

  promptEls = { backdrop, modal, title, message, fieldLabel, input, cancel, ok };
  return promptEls;
}

// Promise<string|null> — resolves with the input value on confirm, or null on
// cancel/dismiss. `inputAttrs` are set directly on the input element.
function promptDialog(options) {
  const opts = options || {};
  const els = ensurePromptModal();

  els.title.textContent = opts.title || "";
  els.message.textContent = opts.message || "";
  els.message.hidden = !opts.message;
  els.fieldLabel.textContent = opts.label || "";
  els.ok.textContent = opts.confirmLabel || "Save";
  els.cancel.textContent = opts.cancelLabel || "Cancel";

  for (const [name, value] of Object.entries(opts.inputAttrs || {})) {
    els.input.setAttribute(name, value);
  }
  els.input.value = opts.value || "";

  els.backdrop.hidden = false;
  document.body.style.overflow = "hidden";
  els.input.focus();
  els.input.select();

  return new Promise((resolve) => {
    function cleanup(result) {
      els.backdrop.hidden = true;
      document.body.style.overflow = "";
      els.modal.removeEventListener("submit", onSubmit);
      els.cancel.removeEventListener("click", onCancel);
      els.backdrop.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKey);
      resolve(result);
    }
    function onSubmit(event) {
      event.preventDefault();
      cleanup(els.input.value);
    }
    function onCancel() { cleanup(null); }
    function onBackdrop(event) { if (event.target === els.backdrop) cleanup(null); }
    function onKey(event) { if (event.key === "Escape") cleanup(null); }

    els.modal.addEventListener("submit", onSubmit);
    els.cancel.addEventListener("click", onCancel);
    els.backdrop.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKey);
  });
}

/* ---- Account ---- */

async function signOut() {
  const ok = await confirmDialog({
    title: "Sign out?",
    message: "You'll need to sign in again to view your logs.",
    confirmLabel: "Sign out",
    danger: true
  });
  if (!ok) return;
  if (appState.auth) await appState.auth.signOut();
  window.location.replace("./login.html");
}

if (shellEls.signOutButton) {
  shellEls.signOutButton.addEventListener("click", signOut);
}

// Top-right avatar popover: shows email, a Settings link, Sign out and the
// version. Toggles on click; closes on outside click or Escape.
function setupAccountMenu() {
  const { accountButton: button, accountMenu: menu } = shellEls;
  if (!button || !menu) return;

  const close = () => { menu.hidden = true; button.setAttribute("aria-expanded", "false"); };

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    if (menu.hidden) {
      menu.hidden = false;
      button.setAttribute("aria-expanded", "true");
    } else {
      close();
    }
  });
  document.addEventListener("click", (event) => {
    if (!menu.hidden && !menu.contains(event.target) && !button.contains(event.target)) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) close();
  });
}

setupAccountMenu();

/* ---- Navigation ---- */

// Navigate "up". Prefer the real previous page when we arrived from another
// page in this app — so a vehicle opened from Home returns to Home, and one
// opened from the garage returns to the garage. Fall back to an explicit
// parent href for direct loads, deep links and PWA shortcuts (no in-app
// referrer). `fallback` may be a string or a getter.
function goBack(fallback) {
  const href = typeof fallback === "function" ? fallback() : fallback;
  const ref = document.referrer;
  if (ref && window.history.length > 1) {
    try {
      if (new URL(ref).origin === window.location.origin) {
        window.history.back();
        return;
      }
    } catch { /* malformed referrer — use the fallback below */ }
  }
  window.location.href = href;
}

// Wire the circular back button (#backButton) to navigate up a level. If
// `isDirty` is supplied and returns true, confirm before leaving. `href` may
// be a string or a getter and is used as the fallback when there's no in-app
// history to step back to.
function setupBackButton(href, isDirty) {
  const btn = document.querySelector("#backButton");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    if (isDirty && isDirty()) {
      const ok = await confirmDialog({
        title: "Discard changes?",
        message: "You have unsaved changes. Leaving now won't save them.",
        confirmLabel: "Discard",
        danger: true
      });
      if (!ok) return;
    }
    goBack(href);
  });
}

/* ---- Shell reveal + async UI helpers ---- */

function revealShell(signedIn, label) {
  if (shellEls.appLoading) shellEls.appLoading.hidden = true;
  if (shellEls.appContent) shellEls.appContent.hidden = false;
  if (shellEls.signOutButton) shellEls.signOutButton.hidden = !signedIn;

  const initial = signedIn && label ? label.trim().charAt(0).toUpperCase() : "·";
  if (shellEls.accountAvatar) shellEls.accountAvatar.textContent = initial;
  if (shellEls.accountMenuAvatar) shellEls.accountMenuAvatar.textContent = initial;
  if (shellEls.accountEmail) {
    shellEls.accountEmail.textContent = signedIn && label ? label : "Local mode";
  }
  if (shellEls.accountStatus) {
    shellEls.accountStatus.textContent = signedIn ? "Synced to your account" : "Saved on this device";
  }
}

// Disable a button and show a busy label while an async action runs, then
// restore it — gives submit feedback and prevents double-submits.
async function withButtonBusy(button, busyLabel, action) {
  if (!button) return action();
  const originalLabel = button.textContent;
  button.disabled = true;
  if (busyLabel) button.textContent = busyLabel;
  try {
    return await action();
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

// Fill a list container with placeholder skeleton cards while data loads.
// The real render later calls replaceChildren(), which clears these.
function renderSkeletonCards(container, count = 3) {
  if (!container) return;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i += 1) {
    const card = document.createElement("div");
    card.className = "skeleton-card";
    card.setAttribute("aria-hidden", "true");
    for (const cls of ["skeleton-line skeleton-line-lg", "skeleton-line skeleton-line-sm", "skeleton-line"]) {
      const line = document.createElement("div");
      line.className = cls;
      card.append(line);
    }
    frag.append(card);
  }
  container.replaceChildren(frag);
}

/* ---- Boot ---- */

/**
 * Boot the active store, then call onReady() once its data is available.
 * Redirects to the login page when Firebase is configured but no user is
 * signed in. Falls back to local storage if Firebase is unavailable.
 */
async function initStore(onReady) {
  const store = requireStore();

  if (!hasFirebaseConfig()) {
    loadLocal();
    revealShell(false, null);
    onReady();
    return;
  }

  // Pages are separate documents but the SDK is shared — initialize once.
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  appState.auth = firebase.auth();
  appState.db = firebase.firestore();
  appState.useFirestore = true;

  appState.auth.onAuthStateChanged(async (user) => {
    appState.user = user;
    store.reset();

    if (!user) {
      appState.dataRef = null;
      window.location.replace("./login.html");
      return;
    }

    appState.dataRef = store.docPath(user.uid).reduce(
      (ref, segment, i) => (i % 2 === 0 ? ref.collection(segment) : ref.doc(segment)),
      appState.db
    );
    // Reveal as soon as auth resolves so a slow or blocked Firestore fetch
    // can never leave the loading spinner stuck. Data renders when it lands.
    revealShell(true, user.email || "Signed in");
    try {
      await loadRemoteData();
    } catch (error) {
      console.error(error);
    }
    onReady();
  });
}

// Local fallback shared by every page when initStore rejects.
function bootWithFallback(onReady) {
  initStore(onReady).catch((error) => {
    console.error(error);
    appState.useFirestore = false;
    loadLocal();
    revealShell(false, null);
    onReady();
  });
}
