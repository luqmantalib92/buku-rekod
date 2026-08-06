/* Settings page: profile (email + sign out) and links to the manage pages.
   Sign out is wired in core.js; email/status are filled by revealShell. */

const settingsEls = {
  profileAvatar: document.querySelector("#profileAvatar")
};

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
