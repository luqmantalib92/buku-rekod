/* Watchlist page (movies.html): saved titles, newest saved first.

   Grouping by release year is available as a toggle rather than the default —
   day to day the question is "what should I watch next", which recency of
   intent answers better than a 1994 heading. Both views share one card
   builder. */

const moviesEls = {
  addTitle: document.querySelector("#addTitle"),
  emptyAddTitle: document.querySelector("#emptyAddTitle"),
  fabAddTitle: document.querySelector("#fabAddTitle"),
  controls: document.querySelector("#watchlistControls"),
  groupByYear: document.querySelector("#groupByYear"),
  list: document.querySelector("#watchlist"),
  empty: document.querySelector("#watchlistEmpty"),
  emptyText: document.querySelector("#watchlistEmptyText"),
  groupTemplate: document.querySelector("#watchlistGroupTemplate"),
  cardTemplate: document.querySelector("#posterCardTemplate")
};

// "all" | "unwatched" | "watched" — view state only, never persisted.
let watchFilter = "all";

function openSearch() {
  window.location.href = "./movie-search.html";
}

moviesEls.addTitle.addEventListener("click", openSearch);
moviesEls.emptyAddTitle.addEventListener("click", openSearch);
moviesEls.fabAddTitle.addEventListener("click", openSearch);

for (const chip of moviesEls.controls.querySelectorAll(".chip")) {
  chip.addEventListener("click", () => {
    watchFilter = chip.dataset.filter;
    for (const other of moviesEls.controls.querySelectorAll(".chip")) {
      other.classList.toggle("chip-on", other === chip);
    }
    renderWatchlist();
  });
}

moviesEls.groupByYear.addEventListener("change", renderWatchlist);

function applyFilter(items) {
  if (watchFilter === "watched") return items.filter((item) => item.watched);
  if (watchFilter === "unwatched") return items.filter((item) => !item.watched);
  return items;
}

function buildPosterCard(item) {
  const card = moviesEls.cardTemplate.content.firstElementChild.cloneNode(true);
  card.classList.toggle("is-watched", item.watched);

  // Poster: swap in the remote image only once it actually decodes, so a
  // dead/blocked URL leaves the fallback tile in place instead of a broken
  // image icon. The frame keeps its aspect ratio either way.
  const img = card.querySelector(".poster-img");
  const fallback = card.querySelector(".poster-fallback");
  const url = posterUrl(item.posterPath, "w342");
  if (url) {
    img.addEventListener("load", () => {
      img.hidden = false;
      fallback.hidden = true;
    });
    img.addEventListener("error", () => { img.hidden = true; });
    img.alt = `${item.title} poster`;
    img.src = url;
  }

  card.querySelector(".poster-title").textContent = item.title;
  card.querySelector(".poster-type").textContent = mediaTypeLabel(item.mediaType);
  card.querySelector(".poster-year").textContent = item.releaseYear || "Unknown year";

  const flag = card.querySelector(".poster-watched-flag");
  flag.hidden = !item.watched;

  const watchBtn = card.querySelector(".poster-watch");
  watchBtn.textContent = item.watched ? "Watched" : "Mark watched";
  watchBtn.setAttribute("aria-pressed", String(item.watched));
  watchBtn.setAttribute("aria-label", item.watched
    ? `Mark "${item.title}" as not watched`
    : `Mark "${item.title}" as watched`);
  watchBtn.addEventListener("click", async () => {
    await withButtonBusy(watchBtn, null, () => toggleWatched(item.id));
    renderWatchlist();
  });

  card.querySelector(".poster-remove").addEventListener("click", async () => {
    const ok = await confirmDialog({
      title: `Remove "${item.title}"?`,
      message: "It'll be taken off your watchlist. You can always search and add it again.",
      confirmLabel: "Remove",
      danger: true
    });
    if (!ok) return;
    await removeBookmark(item.id);
    renderWatchlist();
  });

  return card;
}

function buildGroup(label, items) {
  const group = moviesEls.groupTemplate.content.firstElementChild.cloneNode(true);
  group.querySelector(".watchlist-group-label").textContent = label;
  const grid = group.querySelector(".watchlist-grid");
  for (const item of items) grid.append(buildPosterCard(item));
  return group;
}

function renderWatchlist() {
  const all = bookmarksByAdded();
  const items = applyFilter(all);

  moviesEls.controls.hidden = all.length === 0;
  moviesEls.list.replaceChildren();

  if (!items.length) {
    moviesEls.empty.hidden = false;
    moviesEls.emptyText.textContent = all.length
      ? (watchFilter === "watched"
        ? "Nothing marked watched yet."
        : "Everything on your watchlist is already watched.")
      : "Your watchlist is empty. Search for a movie or drama to save your first title.";
    moviesEls.emptyAddTitle.hidden = all.length > 0;
    return;
  }

  moviesEls.empty.hidden = true;
  moviesEls.emptyAddTitle.hidden = false;

  if (moviesEls.groupByYear.checked) {
    // Re-group the filtered set so year sections reflect the active filter.
    const keep = new Set(items.map((item) => item.id));
    for (const section of bookmarksByYear()) {
      const visible = section.items.filter((item) => keep.has(item.id));
      if (visible.length) moviesEls.list.append(buildGroup(section.label, visible));
    }
  } else {
    moviesEls.list.append(buildGroup("Recently added", items));
  }
}

window.onPullRefresh = async () => {
  await refreshData();
  renderWatchlist();
};

renderSkeletonCards(moviesEls.list, 3);
bootWithFallback(renderWatchlist);
