/* Reminder settings page: lead-time (days before due) per service category. */

const remindersEls = {
  settingsForm: document.querySelector("#settingsForm"),
  settingsRows: document.querySelector("#settingsRows"),
  settingsSaved: document.querySelector("#settingsSaved")
};

function renderSettings() {
  remindersEls.settingsRows.replaceChildren();
  for (const category of getCategories()) {
    const label = document.createElement("label");
    label.className = "settings-row";
    label.textContent = category.label;

    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.name = category.key;
    input.value = leadDaysFor(category.key);

    label.append(input);
    remindersEls.settingsRows.append(label);
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

setupBackButton("./index.html");

window.onPullRefresh = async () => {
  await refreshData();
  renderSettings();
};

bootWithFallback(renderSettings);
