/* TMDb provider adapter for the Movies mini app.

   The one place that knows about TMDb's API shape and image CDN. Everything
   downstream works with the normalized result below, so swapping providers
   later means rewriting this file only.

   Normalized search result:
     { provider, providerMediaId, mediaType, title, originalTitle,
       releaseDate, releaseYear, posterPath, overview }

   Note the poster is stored as a *path* ("/abc.jpg"), never a full URL — the
   CDN host and size belong to display time (posterUrl below), so cached
   bookmarks don't rot when TMDb changes either. */

const TMDB_PROVIDER = "tmdb";
const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_IMAGE = "https://image.tmdb.org/t/p";

function hasTmdbKey() {
  return Boolean(typeof tmdbConfig !== "undefined" && tmdbConfig.apiKey);
}

/**
 * Display URL for a poster path. `size` is a TMDb image size bucket:
 * w185 for list thumbnails, w342 for cards. Returns "" when there's no
 * poster, which callers render as the local fallback tile.
 */
function posterUrl(posterPath, size = "w342") {
  if (!posterPath) return "";
  return `${TMDB_IMAGE}/${size}${posterPath}`;
}

function releaseYearOf(dateStr) {
  const year = Number(String(dateStr || "").slice(0, 4));
  return Number.isFinite(year) && year > 1800 ? year : null;
}

// One TMDb multi-search hit → our shape. Returns null for anything that
// isn't a movie or TV series (multi-search also returns people).
function normalizeResult(raw) {
  const mediaType = raw.media_type;
  if (mediaType !== "movie" && mediaType !== "tv") return null;

  const isMovie = mediaType === "movie";
  const releaseDate = (isMovie ? raw.release_date : raw.first_air_date) || "";

  return {
    provider: TMDB_PROVIDER,
    providerMediaId: String(raw.id),
    mediaType,
    title: (isMovie ? raw.title : raw.name) || "Untitled",
    originalTitle: (isMovie ? raw.original_title : raw.original_name) || "",
    releaseDate,
    releaseYear: releaseYearOf(releaseDate),
    posterPath: raw.poster_path || "",
    overview: raw.overview || ""
  };
}

/**
 * Search movies and TV/drama titles. Resolves an array of normalized
 * results, most-popular first. Throws with a user-readable message so the
 * page can show it directly; pass an AbortSignal to cancel a stale query.
 */
async function searchTmdb(query, { signal } = {}) {
  if (!hasTmdbKey()) {
    throw new Error("Add your TMDb API key in js/tmdb-config.js to search.");
  }

  const url = `${TMDB_API}/search/multi?api_key=${encodeURIComponent(tmdbConfig.apiKey)}`
    + `&query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`;

  let response;
  try {
    response = await fetch(url, { signal });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error("Couldn't reach TMDb. Check your connection and try again.");
  }

  if (response.status === 401) throw new Error("TMDb rejected the API key. Check js/tmdb-config.js.");
  if (response.status === 429) throw new Error("Too many searches just now — wait a moment and try again.");
  if (!response.ok) throw new Error(`TMDb returned an error (${response.status}).`);

  const data = await response.json();
  return (data.results || [])
    .map(normalizeResult)
    .filter(Boolean)
    // Titles with neither a poster nor a year are almost always junk entries.
    .filter((item) => item.posterPath || item.releaseYear);
}
