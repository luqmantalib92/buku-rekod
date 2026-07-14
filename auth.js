const authEls = {
  form: document.querySelector("#authForm"),
  message: document.querySelector("#authMessage"),
  passwordInput: document.querySelector("#authPassword"),
  togglePassword: document.querySelector("#togglePassword")
};

// Show/hide password — pure UI, works regardless of Firebase config.
authEls.togglePassword.addEventListener("click", () => {
  const reveal = authEls.passwordInput.type === "password";
  authEls.passwordInput.type = reveal ? "text" : "password";
  authEls.togglePassword.textContent = reveal ? "Hide" : "Show";
  authEls.togglePassword.setAttribute("aria-pressed", String(reveal));
  authEls.togglePassword.setAttribute("aria-label", reveal ? "Hide password" : "Show password");
  authEls.passwordInput.focus();
});

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
}
