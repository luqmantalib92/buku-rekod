const authEls = {
  form: document.querySelector("#authForm"),
  message: document.querySelector("#authMessage"),
  createAccountButton: document.querySelector("#createAccountButton")
};

function hasFirebaseConfig() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && window.firebase?.auth);
}

function setAuthMessage(message) {
  authEls.message.textContent = message;
}

if (!hasFirebaseConfig()) {
  setAuthMessage("Add your Firebase web config in firebase-config.js first.");
} else {
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();

  auth.onAuthStateChanged((user) => {
    if (user) {
      window.location.replace("./index.html");
    }
  });

  authEls.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(authEls.form);
    const email = form.get("email").trim();
    const password = form.get("password");

    try {
      setAuthMessage("Signing in...");
      await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
      setAuthMessage(error.message);
    }
  });

  authEls.createAccountButton.addEventListener("click", async () => {
    const form = new FormData(authEls.form);
    const email = form.get("email").trim();
    const password = form.get("password");

    if (!email || !password) {
      setAuthMessage("Enter an email and password first.");
      return;
    }

    try {
      setAuthMessage("Creating account...");
      await auth.createUserWithEmailAndPassword(email, password);
    } catch (error) {
      setAuthMessage(error.message);
    }
  });
}
