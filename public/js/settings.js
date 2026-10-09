/* Settings page: profile (email + sign out), the theme picker, your vehicles
   (each opens its logbook) with Add vehicle, and links to the manage pages. Sign out is wired in core.js; email/status are filled by
   revealShell; the theme itself lives in theme.js. */

const settingsEls = {
  profileAvatar: document.querySelector("#profileAvatar"),
  vehicleList: document.querySelector("#settingsVehicleList"),
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

// One row per vehicle, linking to its logbook.
function renderVehicleRows() {
  settingsEls.vehicleList.replaceChildren();
  for (const vehicle of sortedVehicles()) {
    const row = document.createElement("a");
    row.className = "list-row";
    row.href = `./vehicle.html?id=${encodeURIComponent(vehicle.id)}`;

    const tile = document.createElement("span");
    tile.className = "icon-tile icon-tile-sm";
    tile.append(iconNode("car"));

    const text = document.createElement("span");
    text.className = "list-row-text";
    const title = document.createElement("span");
    title.className = "list-row-title";
    title.textContent = vehicle.name || "Unnamed vehicle";
    const sub = document.createElement("span");
    sub.className = "list-row-sub";
    sub.textContent = [vehicle.plate, vehicle.model].filter(Boolean).join(" · ") || "No plate";
    text.append(title, sub);

    const end = document.createElement("span");
    end.className = "list-row-end";
    end.append(iconNode("chevron-right"));

    row.append(tile, text, end);
    settingsEls.vehicleList.append(row);
  }
}

function initSettings() {
  const email = (appState.user && appState.user.email) || "";
  if (settingsEls.profileAvatar) {
    settingsEls.profileAvatar.textContent = email ? email.trim().charAt(0).toUpperCase() : "·";
  }
  renderVehicleRows();
}

// Settings is a top-level tab (bottom nav), so there's no back button — the
// topbar shows the app icon, which links Home.

window.onPullRefresh = async () => {
  await refreshData();
  initSettings();
};

bootWithFallback(initSettings, { cached: true });
