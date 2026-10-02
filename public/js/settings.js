/* Settings page: profile (email + sign out), the theme picker, and links to
   the manage pages. Sign out is wired in core.js; email/status are filled by
   revealShell; the theme itself lives in theme.js. */

const settingsEls = {
  profileAvatar: document.querySelector("#profileAvatar"),
  themeChoice: document.querySelector("#themeChoice"),
  themeHint: document.querySelector("#themeHint")
};

const THEME_HINTS = {
  system: "Follows your phone's light or dark setting.",
  light: "Always light, whatever your phone is set to.",
  dark: "Always dark, whatever your phone is set to."
};

function renderThemeChoice() {
  const current = getThemeChoice();
  for (const btn of settingsEls.themeChoice.querySelectorAll(".segmented-btn")) {
    const on = btn.dataset.themeChoice === current;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", String(on));
  }
  settingsEls.themeHint.textContent = THEME_HINTS[current];
}

for (const btn of settingsEls.themeChoice.querySelectorAll(".segmented-btn")) {
  btn.addEventListener("click", () => {
    setThemeChoice(btn.dataset.themeChoice);
    renderThemeChoice();
  });
}

// Another tab changed it: theme.js re-applies, this keeps the buttons in step.
window.addEventListener("storage", renderThemeChoice);

renderThemeChoice();

function initSettings() {
  const email = (appState.user && appState.user.email) || "";
  if (settingsEls.profileAvatar) {
    settingsEls.profileAvatar.textContent = email ? email.trim().charAt(0).toUpperCase() : "·";
  }
}

// Settings is a top-level tab (bottom nav), so there's no back button — the
// topbar shows the app icon, which links Home.

window.onPullRefresh = async () => {
  await refreshData();
  initSettings();
};

bootWithFallback(initSettings);
