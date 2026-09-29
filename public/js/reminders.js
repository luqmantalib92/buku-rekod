/* Reminder settings page: lead-time (days before due) per service category.
   Each category gets one-tap presets plus a free number field; the number
   field is the source of truth that gets saved. */

const remindersEls = {
  settingsForm: document.querySelector("#settingsForm"),
  settingsRows: document.querySelector("#settingsRows"),
  settingsSaved: document.querySelector("#settingsSaved")
};

const LEAD_PRESETS = [7, 14, 30, 60];

function buildLeadCard(category) {
  const card = document.createElement("section");
  card.className = "card lead-card";

  const head = document.createElement("div");
  head.className = "lead-card-head";
  const tile = document.createElement("span");
  tile.className = "icon-tile icon-tile-sm";
  tile.append(iconNode(category.key));
  const text = document.createElement("div");
  text.className = "card-head-text";
  const name = document.createElement("strong");
  name.textContent = category.label;
  const sub = document.createElement("span");
  sub.className = "card-sub";
  sub.textContent = "Remind me before it's due";
  text.append(name, sub);
  const value = document.createElement("span");
  value.className = "lead-value";
  head.append(tile, text, value);

  const segmented = document.createElement("div");
  segmented.className = "segmented segmented-solid";
  segmented.setAttribute("role", "group");
  segmented.setAttribute("aria-label", `${category.label} lead time`);

  const custom = document.createElement("label");
  custom.className = "lead-custom";
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.step = "1";
  input.inputMode = "numeric";
  input.name = category.key;
  input.value = leadDaysFor(category.key);
  input.setAttribute("aria-label", `${category.label}: days before due`);
  custom.append("Custom", input, "days");

  const sync = () => {
    const days = Number(input.value);
    value.textContent = Number.isFinite(days) && input.value !== "" ? `${days} days` : "-";
    for (const btn of segmented.children) {
      const on = Number(btn.dataset.days) === days;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", String(on));
    }
  };

  for (const days of LEAD_PRESETS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "segmented-btn";
    btn.dataset.days = String(days);
    btn.textContent = `${days}d`;
    btn.setAttribute("aria-label", `${days} days`);
    btn.addEventListener("click", () => {
      input.value = String(days);
      sync();
    });
    segmented.append(btn);
  }
  input.addEventListener("input", sync);
  sync();

  card.append(head, segmented, custom);
  return card;
}

function renderSettings() {
  remindersEls.settingsRows.replaceChildren();
  for (const category of getCategories()) {
    remindersEls.settingsRows.append(buildLeadCard(category));
  }
}

remindersEls.settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(remindersEls.settingsForm);
  const leadDays = {};
  for (const category of getCategories()) {
    const value = Number(form.get(category.key));
    if (Number.isFinite(value) && value >= 0) leadDays[category.key] = value;
  }
  state.settings = { leadDays };
  const submitButton = remindersEls.settingsForm.querySelector('button[type="submit"]');
  await withButtonBusy(submitButton, "Saving…", () => persist());

  remindersEls.settingsSaved.hidden = false;
  setTimeout(() => { remindersEls.settingsSaved.hidden = true; }, 2000);
});

setupBackButton("./settings.html");

window.onPullRefresh = async () => {
  await refreshData();
  renderSettings();
};

renderSkeletonCards(remindersEls.settingsRows, 4);
bootWithFallback(renderSettings);
