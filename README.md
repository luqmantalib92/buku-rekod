# Buku Rekod

Live at <https://buku-rekod.web.app> (Firebase project `buku-rekod`).
The latest `develop` build is on the Firebase Hosting preview channel `develop`.
Formerly **Logbook** (Firebase project `my-personal-log`, deleted September 2026).

A personal super app: a set of small single-purpose mini apps behind one
install. Currently **Vehicles** (service history and reminders) and
**Movies** (a watch-later list).

Tap the app icon in the top-left of any page to open the launcher and switch
between mini apps. Each mini app has its own bottom tab bar; Home still opens
straight on the vehicle service calendar.

## Mini apps

### Vehicles

- **Home** (`index.html`): a month calendar of what's scheduled — a dot per day, red for overdue, amber for due soon — with an "Upcoming & due" list underneath.
- **Garage** (`vehicles.html`): add and list vehicles; each card shows odometer, last service, and a "due" badge.
- **Vehicle logbook** (`vehicle.html?id=<id>`): add/edit/delete a vehicle and its service records.
- **Categorized services**: each record is tagged to a category (Engine & oil, Brakes & fluids, Electrical & wear, Tyres & alignment, Other) with quick-pick item chips.
- **Reminders**: per-category due dates with overdue / due-soon status, and a configurable lead time per category (its own Reminder settings page). Reminders also watch the odometer — a record's next-service km can make it due, not just the date.
- **Quick odometer update**: log your current km from the vehicle page or the garage card's ⋮ menu, no service record needed.
- **Road tax & insurance**: per-vehicle expiry dates with a warning 30 days before they lapse.

### Movies

- **Watchlist** (`movies.html`): saved titles, newest saved first, each with poster, type badge and release year. Filter by All / To watch / Watched, or switch on grouping by release year.
- **Search** (`movie-search.html`): search TMDb for a movie, drama or series and save it. Debounced from 2 characters; people and untitled junk results are filtered out.
- **Watched state**: mark a title watched (it dims and gets a badge) — the thing that makes this a log rather than a to-do list.
- A title can only be bookmarked once, keyed on `provider:mediaType:providerMediaId` rather than the title.

## Shared

- **Installable**: PWA manifest + iOS home-screen icon; "Add to Home Screen" launches full-screen.
- **Offline**: a service worker (`sw.js`) precaches the app shell, so the app opens instantly and works offline. Movie posters are cached separately in `tmdb-posters-v2`, which survives version bumps so releases don't force a re-download. Only successful responses are cached, so a failed image can't get stuck.
- Login on a separate page (`login.html`) via Firebase Authentication.
- Data lives in `localStorage` and syncs to Firestore once configured.
- **Backup & restore** (Settings): export every mini app's data to one JSON file and load it back. Restoring writes to whichever account is signed in, so it doubles as the way to move between devices or Firebase projects.

## Project structure

```
public/                  # everything served by Firebase Hosting (the web app)
  *.html                 # one file per page (index, vehicle, movies, …)
  sw.js                  # service worker (offline shell cache, versioned by version.js)
  manifest.webmanifest
  css/styles.css
  js/
    core.js              # app-agnostic: auth, boot, dialogs, shell, load/save plumbing
    shell.js             # topbar, app launcher, per-app bottom nav (APPS registry)
    garage.store.js      # Vehicles data module
    watchlist.store.js   # Movies data module
    backup.js            # export/restore every registered store
    tmdb.js              # TMDb search adapter (the only file that knows TMDb)
    <page>.js            # one script per page
    version.js           # single source of truth for APP_VERSION
  assets/                # PWA / home-screen icons
firebase.json            # hosting points at public/
firestore.rules
firestore.indexes.json
```

### Adding a mini app

1. Add an entry to `APPS` in `js/shell.js` (name, icon, its pages, its bottom tabs).
2. Write `<app>.store.js` ending in `defineStore({ label, localKey, docPath, ingest, serialize, reset })`.
3. Include `core.js` then `<app>.store.js` then your page script, and add the new files to `SHELL` in `sw.js`.

`core.js` drives whichever store the page registered, so nothing else needs to change.
Registering also adds the mini app to `STORES`, so Backup & restore picks it up
automatically — add its store script to `backup.html` and it's included.

## Run locally

```sh
python3 -m http.server 5173 --directory public
```

Then open `http://localhost:5173`. With an empty `firebase-config.js` the app
skips login and runs entirely on `localStorage`, which is the easiest way to
poke at it.

## Connect Firebase

1. Create a Firebase project.
2. Add a Web App in project settings, then copy `public/js/firebase-config.example.js`
   to `public/js/firebase-config.js` and fill in the values. (`firebase-config.js` is
   gitignored; the web apiKey is a public client identifier, but restrict it
   in Google Cloud Console — HTTP referrers + API restrictions — and rely on
   Firestore rules to protect data.)
3. Enable Authentication with the Email/Password provider, and add your user under Authentication → Users.
4. Enable Firestore Database.
5. Deploy:

```sh
firebase deploy --only hosting,firestore:rules
```

Data is stored per user, one document per mini app:

| Mini app | Firestore path | localStorage key |
| --- | --- | --- |
| Vehicles | `users/{uid}/garage/main` | `vehicle-service-log:v1` |
| Movies | `users/{uid}/watchlist/main` | `watchlist:v1` |

`firestore.rules` scopes `users/{userId}/{document=**}` to its owner, so every
mini app is covered by that one rule. Neither store is queried — both are
fetched by path — so no Firestore indexes are needed.

## Moving to another Firebase project

Firebase Auth uids are per-project, so the same person gets a **different uid**
in a new project. Copying Firestore documents directly would preserve the old
uid in the path and the app would sign you into an empty account. Use Backup &
restore instead — it writes to whoever is signed in, so the re-keying is
implicit:

1. In the **old** project's app: Settings → Backup & restore → **Export all data**.
2. Create the new project's Web App, then copy its config into `public/js/firebase-config.js`.
3. In the new project: enable Email/Password auth and add your user; enable Firestore.
4. `firebase deploy --project <new-id> --only hosting,firestore:rules`
5. Open the new site, sign in, then Settings → Backup & restore → **Import from file**.

`.firebaserc` pins the deploy target: `default` is the live project, so
`firebase deploy` needs no `--project` flag. Keep the old project reachable
under a second alias (`firebase use --add`) until you're sure the move is
complete — the 2026 migration off `vehicle-service-logs` did exactly that, and
the alias was dropped once that project was deleted. The Buku Rekod rename
(September 2026) moved from `my-personal-log` to `buku-rekod` the same way,
and `my-personal-log` was deleted once the data was confirmed in the new
project.

Two things that don't move on their own:

- The installed PWA, its service worker and its `localStorage` all belong to the
  **old origin**. Delete and re-install the app from the new URL.
- The TMDb key is unrelated to Firebase and needs no change.

## Connect TMDb (Movies search)

1. Get a free v3 API key at <https://www.themoviedb.org/settings/api>.
2. Copy `public/js/tmdb-config.example.js` to `public/js/tmdb-config.js` and paste the key in.

`tmdb-config.js` is gitignored. This is a static site with no backend, so the
key ships in the browser — a TMDb v3 key is read-only and rate-limited, which
is an acceptable trade for a personal app, but don't reuse a key you also use
server-side. Without a key the watchlist still works normally; only the search
page reports that it needs one.

This product uses the TMDb API but is not endorsed or certified by TMDb.
