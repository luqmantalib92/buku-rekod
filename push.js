/* Push notification opt-in (garage page). Registers the messaging service
   worker, gets an FCM token, and stores it under the signed-in user so the
   serviceReminders Cloud Function can send due-date reminders. */

const pushEls = {
  button: document.querySelector("#enableNotify"),
  status: document.querySelector("#notifyStatus")
};

function setNotify(message, { disable = false, label } = {}) {
  if (pushEls.status) pushEls.status.textContent = message;
  if (pushEls.button) {
    if (label) pushEls.button.textContent = label;
    pushEls.button.disabled = disable;
  }
}

function pushSupported() {
  return (
    "serviceWorker" in navigator &&
    "Notification" in window &&
    window.firebase?.messaging &&
    typeof firebase.messaging.isSupported === "function" &&
    firebase.messaging.isSupported()
  );
}

function pushTokenRef() {
  return state.db.collection("users").doc(state.user.uid).collection("meta").doc("push");
}

async function enableNotifications() {
  if (!VAPID_KEY) {
    setNotify("Push isn't configured yet — add a Web Push (VAPID) key. See setup notes.");
    return;
  }

  try {
    setNotify("Requesting permission…");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setNotify("Permission was not granted. Enable notifications for this site in your browser settings.");
      return;
    }

    const registration = await navigator.serviceWorker.register("./firebase-messaging-sw.js");
    const messaging = firebase.messaging();
    const token = await messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
    if (!token) {
      setNotify("Couldn't get a device token — try again.");
      return;
    }

    await pushTokenRef().set({
      tokens: firebase.firestore.FieldValue.arrayUnion(token),
      enabled: true,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    setNotify("Reminders are on for this device.", { disable: true, label: "Enabled" });
  } catch (error) {
    console.error(error);
    setNotify(`Couldn't enable notifications: ${error.message}`);
  }
}

function initPush() {
  // Local (no-Firebase) mode: nothing to register against.
  if (!state.useFirestore || !state.user) {
    setNotify("Sign in with Firebase to use reminders.", { disable: true });
    return;
  }

  if (!pushSupported()) {
    setNotify("This browser can't do push. On iPhone, Add to Home Screen first, then open the app and enable.", { disable: true });
    return;
  }

  if (Notification.permission === "denied") {
    setNotify("Notifications are blocked. Re-enable them for this site in your browser settings.", { disable: true });
    return;
  }

  if (Notification.permission === "granted") {
    setNotify("Reminders are on for this device.", { label: "Re-sync" });
  }

  pushEls.button.addEventListener("click", enableNotifications);
}
