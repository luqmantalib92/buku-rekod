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
5. Deploy through CI, not by hand: see [Development and releases](#development-and-releases).

Data is stored per user, one document per mini app:

| Mini app | Firestore path | localStorage key |
| --- | --- | --- |
| Vehicles | `users/{uid}/garage/main` | `vehicle-service-log:v1` |
| Movies | `users/{uid}/watchlist/main` | `watchlist:v1` |

`firestore.rules` scopes `users/{userId}/{document=**}` to its owner, so every
mini app is covered by that one rule. Neither store is queried — both are
fetched by path — so no Firestore indexes are needed.

## Development and releases

Work lands on `develop`; `main` only moves when something is released. Live
changes only through a GitHub release. Nobody runs `firebase deploy` to live
by hand.

| Branch | Environment | URL | Deployed by |
| --- | --- | --- | --- |
| `feature/<name>` | none (local only) | `http://localhost:5173` | you, with `python3 -m http.server` |
| `develop` | Firebase Hosting preview channel `develop` | the channel URL printed in the Preview run log (`https://buku-rekod--develop-<hash>.web.app`) | [`preview.yml`](.github/workflows/preview.yml) on every push |
| `main` | live | <https://buku-rekod.web.app> | [`release.yml`](.github/workflows/release.yml) on a published GitHub release |

The preview channel is named, so its URL never changes and only had to be
added to Authentication → Settings → Authorised domains once. It expires
30 days after the last deploy to it; the next push to `develop` brings it back
at the same URL.

### Developing a feature

```sh
git switch develop && git pull
git switch -c feature/<name>
# ...work, then bump APP_VERSION in public/js/version.js
git push -u origin feature/<name>
gh pr create --base develop
```

Bump `APP_VERSION` in every user-facing PR. The service worker's cache name
comes from it, so without a bump, installed copies (the preview included) keep
serving the old cached files. When the PR is merged, the push to `develop`
deploys the preview channel.

### Releasing to live

```sh
git switch main && git pull
git merge --ff-only origin/develop
git push origin main
gh release create vX.Y.Z --target main --generate-notes
```

`vX.Y.Z` must equal `APP_VERSION` in `public/js/version.js`. The release
workflow refuses a tag that isn't on `main` or doesn't match the version.
Otherwise it deploys hosting and Firestore rules to live, then comments on the
open **Live releases** issue.

### Rolling back

Run the release workflow by hand with an older tag. It redeploys that tag's
files and rules:

```sh
gh workflow run release.yml -f tag=vX.Y.Z
```

The tag still has to be on `main`, which every past release is.

### Getting the "it's live" email

Each live deploy comments "**vX.Y.Z is live**" on the open issue labelled
`release-log` ("Live releases"). GitHub emails everyone subscribed to that
issue, including whoever opened it. To get the email, subscribe to the issue.
Preview deploys don't comment there, so they stay quiet. A failed run emails
whoever triggered it through GitHub's default Actions notifications.

### CI setup

Repo **variables** (Settings → Secrets and variables → Actions → Variables) hold
the gitignored web config. Each one is the whole file:

| Variable | Written to |
| --- | --- |
| `FIREBASE_CONFIG_JS` | `public/js/firebase-config.js` (public identifiers only) |

```sh
gh variable set FIREBASE_CONFIG_JS < public/js/firebase-config.js
```

Repo **secrets**:

| Secret | What it is |
| --- | --- |
| `TMDB_API_KEY` | just the TMDb v3 API key; CI writes `public/js/tmdb-config.js` around it. It is a secret, not a variable, because it is a real API key. Only the key is stored: GitHub masks every line of a multi-line secret, so storing the whole file would mask `//` and `};` throughout the logs |
| `FIREBASE_SERVICE_ACCOUNT` | JSON key of the `github-deploy` service account |

```sh
gh secret set TMDB_API_KEY   # paste the key when prompted
```

The `github-deploy` service account (Google Cloud Console → IAM and admin →
Service accounts, project `buku-rekod`) has exactly these roles:

- Firebase Hosting Admin
- Firebase Rules Admin
- Service Account User
- API Keys Viewer
- Service Usage Consumer (without it, deploying rules fails with
  `403 Permission denied to get service [firestore.googleapis.com]`)

Don't use the `firebase-adminsdk` account for CI. It has far broader access.

**Rotating the key:** open the service account → Keys → Add key → JSON, then:

```sh
gh secret set FIREBASE_SERVICE_ACCOUNT < ~/Downloads/buku-rekod-<id>.json
rm ~/Downloads/buku-rekod-<id>.json
```

Delete the old key on the same Keys tab. `buku-rekod-*.json` is gitignored, so a
key downloaded into the repo folder can't be committed by accident.

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
