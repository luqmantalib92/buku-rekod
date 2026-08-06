/* Movies data module — the watchlist domain: saved titles, watched state and
   the grouping/sorting rules.

   Auth, boot, persistence plumbing and the shared dialogs live in core.js;
   this file only describes the watchlist's own data, then registers itself
   with defineStore() at the bottom. Requires core.js first. */

const WATCHLIST_LOCAL_KEY = "watchlist:v1";

const watchlist = {
  items: []
};

/* ---- Data model ---- */

// Stable identity for a saved title. TMDb ids are only unique *within* a
// media type, so the type is part of the key — this is what enforces
// "bookmark a title at most once".
function bookmarkKey(item) {
  return `${item.provider || TMDB_PROVIDER}:${item.mediaType}:${item.providerMediaId}`;
}

function normalizeBookmark(entry) {
  const source = entry || {};
  const releaseDate = source.releaseDate || "";
  return {
    id: source.id || makeId(),
    provider: source.provider || TMDB_PROVIDER,
    providerMediaId: String(source.providerMediaId || ""),
    mediaType: source.mediaType === "tv" ? "tv" : "movie",
    title: source.title || "Untitled",
    originalTitle: source.originalTitle || "",
    releaseDate,
    // Prefer the stored year, but re-derive it if an older entry lacks one.
    releaseYear: Number.isFinite(Number(source.releaseYear)) && Number(source.releaseYear) > 1800
      ? Number(source.releaseYear)
      : releaseYearOf(releaseDate),
    posterPath: source.posterPath || "",
    overview: source.overview || "",
    watched: Boolean(source.watched),
    watchedAt: source.watchedAt || "",
    createdAt: source.createdAt || new Date().toISOString()
  };
}

function ingestWatchlist(data) {
  const source = data || {};
  watchlist.items = Array.isArray(source.items) ? source.items.map(normalizeBookmark) : [];
}

/* ---- Queries ---- */

function findBookmark(key) {
  return watchlist.items.find((item) => bookmarkKey(item) === key) || null;
}

function isBookmarked(result) {
  return Boolean(findBookmark(bookmarkKey(result)));
}

function mediaTypeLabel(mediaType) {
  return mediaType === "tv" ? "TV / Drama" : "Movie";
}

// Newest saved first — the default view. A watchlist answers "what should I
// watch next", and recency of intent tracks that far better than release year.
function bookmarksByAdded() {
  return [...watchlist.items].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

/**
 * Bookmarks grouped into { year, label, items } sections, newest year first,
 * with undated titles collected under "Unknown year" at the end.
 */
function bookmarksByYear() {
  const groups = new Map();
  for (const item of bookmarksByAdded()) {
    const year = item.releaseYear || null;
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year).push(item);
  }

  const sections = [...groups.entries()]
    .map(([year, items]) => ({ year, label: year ? String(year) : "Unknown year", items }))
    .sort((a, b) => {
      if (a.year === null) return 1;   // unknown always last
      if (b.year === null) return -1;
      return b.year - a.year;
    });

  return sections;
}

/* ---- Mutations ---- */

/**
 * Save a normalized search result. Resolves true when saved, false when the
 * title was already bookmarked (the unique-per-(provider, type, id) rule).
 */
async function addBookmark(result) {
  if (isBookmarked(result)) return false;
  watchlist.items.push(normalizeBookmark(result));
  await persist();
  return true;
}

async function removeBookmark(id) {
  const index = watchlist.items.findIndex((item) => item.id === id);
  if (index === -1) return false;
  watchlist.items.splice(index, 1);
  await persist();
  return true;
}

// Flip watched state. Stamps the date it was marked watched so a viewing
// history is available later without another migration.
async function toggleWatched(id) {
  const item = watchlist.items.find((entry) => entry.id === id);
  if (!item) return false;
  item.watched = !item.watched;
  item.watchedAt = item.watched ? new Date().toISOString().slice(0, 10) : "";
  await persist();
  return item.watched;
}

/* ---- Registration ---- */

defineStore({
  localKey: WATCHLIST_LOCAL_KEY,
  docPath: (uid) => ["users", uid, "watchlist", "main"],
  ingest: ingestWatchlist,
  serialize: () => ({ items: watchlist.items }),
  reset: () => {
    watchlist.items = [];
  }
});
