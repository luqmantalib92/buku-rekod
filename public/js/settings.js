/* Settings page: profile (email + sign out) and links to the manage pages.
   Sign out is wired in store.js; email/status are filled by revealShell. */

const settingsEls = {
  profileAvatar: document.querySelector("#profileAvatar")
};

function initSettings() {
  const email = (state.user && state.user.email) || "";
  if (settingsEls.profileAvatar) {
    settingsEls.profileAvatar.textContent = email ? email.trim().charAt(0).toUpperCase() : "·";
  }
}

setupBackButton("./index.html");

window.onPullRefresh = async () => {
  await refreshData();
  initSettings();
};

bootWithFallback(initSettings);
