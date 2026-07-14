/* Categories management page: add / rename / remove categories and edit the
   items inside each. Works on a local copy; Save persists to the store. */

const editorEls = {
  form: document.querySelector("#categoryForm"),
  list: document.querySelector("#categoryEditor"),
  addCategory: document.querySelector("#addCategory"),
  reset: document.querySelector("#resetCategories"),
  saved: document.querySelector("#categoriesSaved"),
  back: document.querySelector("#backToGarage"),
  cardTemplate: document.querySelector("#categoryEditorTemplate"),
  itemTemplate: document.querySelector("#categoryItemTemplate")
};

// Working copy so edits aren't committed until Save.
let working = [];

function cloneCategories(list) {
  return list.map((category) => ({
    key: category.key || makeId(),
    label: category.label || "",
    lead: Number.isFinite(Number(category.lead)) ? Number(category.lead) : 30,
    items: Array.isArray(category.items) ? [...category.items] : []
  }));
}

function renderEditor() {
  editorEls.list.replaceChildren();

  working.forEach((category, categoryIndex) => {
    const card = editorEls.cardTemplate.content.firstElementChild.cloneNode(true);

    const nameInput = card.querySelector(".category-name");
    nameInput.value = category.label;
    nameInput.addEventListener("input", () => { working[categoryIndex].label = nameInput.value; });

    card.querySelector(".category-remove").addEventListener("click", () => {
      working.splice(categoryIndex, 1);
      renderEditor();
    });

    const itemsWrap = card.querySelector(".category-items");
    category.items.forEach((item, itemIndex) => {
      const row = editorEls.itemTemplate.content.firstElementChild.cloneNode(true);
      const input = row.querySelector(".category-item-input");
      input.value = item;
      input.addEventListener("input", () => { working[categoryIndex].items[itemIndex] = input.value; });
      row.querySelector(".category-item-remove").addEventListener("click", () => {
        working[categoryIndex].items.splice(itemIndex, 1);
        renderEditor();
      });
      itemsWrap.append(row);
    });

    card.querySelector(".category-add-item").addEventListener("click", () => {
      working[categoryIndex].items.push("");
      renderEditor();
    });

    editorEls.list.append(card);
  });
}

editorEls.addCategory.addEventListener("click", () => {
  working.push({ key: makeId(), label: "", lead: 30, items: [""] });
  renderEditor();
  const inputs = editorEls.list.querySelectorAll(".category-name");
  const last = inputs[inputs.length - 1];
  if (last) last.focus();
});

editorEls.reset.addEventListener("click", () => {
  const confirmed = confirm("Reset categories to the defaults? Your custom changes will be lost once you Save.");
  if (!confirmed) return;
  working = cloneCategories(DEFAULT_CATEGORIES);
  renderEditor();
});

editorEls.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const cleaned = working
    .map((category) => ({
      key: category.key,
      label: category.label.trim(),
      lead: Number.isFinite(Number(category.lead)) ? Number(category.lead) : 30,
      items: [...new Set(category.items.map((item) => item.trim()).filter(Boolean))]
    }))
    .filter((category) => category.label);

  state.categories = cleaned;
  const submitButton = editorEls.form.querySelector('button[type="submit"]');
  await withButtonBusy(submitButton, "Saving…", () => persist());

  working = cloneCategories(getCategories());
  renderEditor();
  editorEls.saved.hidden = false;
  setTimeout(() => { editorEls.saved.hidden = true; }, 2000);
});

editorEls.back.addEventListener("click", () => {
  window.location.href = "./index.html";
});

function initCategoriesPage() {
  working = cloneCategories(getCategories());
  renderEditor();
}

bootWithFallback(initCategoriesPage);
