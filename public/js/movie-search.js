/* Search page (movie-search.html): query TMDb, show matches, save one to the
   watchlist.

   Searches fire on a 400 ms debounce from 2 characters up, and every request
   carries an AbortController so a slower earlier query can never overwrite a
   newer one's results. */

const searchEls = {
  form: document.querySelector("#searchForm"),
  input: document.querySelector("#searchInput"),
  status: document.querySelector("#searchStatus"),
  empty: document.querySelector("#searchEmpty"),
  results: document.querySelector("#searchResults"),
  cardTemplate: document.querySelector("#resultCardTemplate")
};

const MIN_QUERY_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 400;

let debounceTimer = null;
let inFlight = null;

function setStatus(message, tone) {
  searchEls.status.hidden = !message;
  searchEls.status.textContent = message || "";
  searchEls.status.classList.toggle("is-error", tone === "error");
}

function showPrompt(message) {
  searchEls.empty.hidden = false;
  searchEls.empty.querySelector("p").textContent = message;
}

function buildResultCard(result) {
  const card = searchEls.cardTemplate.content.firstElementChild.cloneNode(true);

  const img = card.querySelector(".poster-img");
  const fallback = card.querySelector(".poster-fallback");
  const url = posterUrl(result.posterPath, "w342");
  if (url) {
    img.addEventListener("load", () => {
      img.hidden = false;
      fallback.hidden = true;
    });
    img.addEventListener("error", () => { img.hidden = true; });
    img.alt = `${result.title} poster`;
    img.src = url;
  }

  card.querySelector(".poster-title").textContent = result.title;
  card.querySelector(".poster-type").textContent = mediaTypeLabel(result.mediaType);
  card.querySelector(".poster-year").textContent = result.releaseYear || "Unknown year";

  const overview = card.querySelector(".poster-overview");
  if (result.overview) {
    overview.textContent = result.overview;
  } else {
    overview.hidden = true;
  }

  const addBtn = card.querySelector(".poster-add");
  const markSaved = () => {
    addBtn.textContent = "Saved";
    addBtn.disabled = true;
    addBtn.classList.add("is-saved");
  };

  if (isBookmarked(result)) {
    markSaved();
  } else {
    addBtn.textContent = "Add to watchlist";
    addBtn.setAttribute("aria-label", `Add "${result.title}" to watchlist`);
    addBtn.addEventListener("click", async () => {
      await withButtonBusy(addBtn, "Saving…", () => addBookmark(result));
      markSaved();
    });
  }

  return card;
}

function renderResults(results) {
  searchEls.results.replaceChildren();
  if (!results.length) {
    showPrompt("No matches. Try a different spelling or the original title.");
    return;
  }
  searchEls.empty.hidden = true;
  for (const result of results) searchEls.results.append(buildResultCard(result));
}

async function runSearch(query) {
  // Supersede any request still in flight so out-of-order responses can't win.
  if (inFlight) inFlight.abort();
  const controller = new AbortController();
  inFlight = controller;

  setStatus("Searching…");
  renderSkeletonCards(searchEls.results, 3);
  searchEls.empty.hidden = true;

  try {
    const results = await searchTmdb(query, { signal: controller.signal });
    if (controller.signal.aborted) return;
    setStatus("");
    renderResults(results);
  } catch (error) {
    if (error.name === "AbortError") return;
    searchEls.results.replaceChildren();
    setStatus(error.message, "error");
    showPrompt("Nothing to show yet.");
  } finally {
    if (inFlight === controller) inFlight = null;
  }
}

function scheduleSearch(query) {
  clearTimeout(debounceTimer);
  const trimmed = query.trim();

  if (trimmed.length < MIN_QUERY_LENGTH) {
    if (inFlight) inFlight.abort();
    clearTimeout(debounceTimer);
    searchEls.results.replaceChildren();
    setStatus("");
    showPrompt(`Type at least ${MIN_QUERY_LENGTH} characters to search for a movie, drama or series.`);
    return;
  }

  debounceTimer = setTimeout(() => runSearch(trimmed), SEARCH_DEBOUNCE_MS);
}

searchEls.input.addEventListener("input", (event) => scheduleSearch(event.target.value));

// Enter searches immediately, skipping the debounce.
searchEls.form.addEventListener("submit", (event) => {
  event.preventDefault();
  clearTimeout(debounceTimer);
  const query = searchEls.input.value.trim();
  if (query.length < MIN_QUERY_LENGTH) {
    showPrompt(`Type at least ${MIN_QUERY_LENGTH} characters to search for a movie, drama or series.`);
    return;
  }
  runSearch(query);
});

bootWithFallback(() => {
  if (!hasTmdbKey()) {
    setStatus("No TMDb API key set — add one in js/tmdb-config.js to search.", "error");
  }
  searchEls.input.focus();
});
