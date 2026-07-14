const authEls = {
  form: document.querySelector("#authForm"),
  message: document.querySelector("#authMessage"),
  createAccountButton: document.querySelector("#createAccountButton"),
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

// Firebase returns invalid-credential for both "no such user" and "wrong
// password" when email-enumeration protection is on, so we treat any of these
// as "you might not have an account yet" and unlock Create account.
const NO_ACCOUNT_CODES = new Set([
  "auth/user-not-found",
  "auth/invalid-credential",
  "auth/invalid-login-credentials"
]);

function setCreateAccountEnabled(enabled) {
  authEls.createAccountButton.disabled = !enabled;
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

  // Editing the email means we're targeting a (possibly) different account, so
  // re-lock Create account until the next sign-in attempt fails again.
  authEls.form.email.addEventListener("input", () => {
    setCreateAccountEnabled(false);
  });

  authEls.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(authEls.form);
    const email = form.get("email").trim();
    const password = form.get("password");

    try {
      setAuthMessage("Signing in...");
      setCreateAccountEnabled(false);
      await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
      if (NO_ACCOUNT_CODES.has(error.code)) {
        setCreateAccountEnabled(true);
        setAuthMessage("Couldn't sign in. If you don't have an account yet, tap Create account.");
      } else {
        setAuthMessage(error.message);
      }
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
      if (error.code === "auth/email-already-in-use") {
        setCreateAccountEnabled(false);
        setAuthMessage("An account already exists for that email — try signing in.");
      } else {
        setAuthMessage(error.message);
      }
    }
  });
}
