# Vehicle Service Log

A personal webapp for tracking vehicle maintenance across multiple vehicles.

## Features

- **Garage** (`index.html`): add and list vehicles; each card shows odometer, log count, last service, and a "due" badge.
- **Vehicle logbook** (`vehicle.html?id=<id>`): add/edit/delete a vehicle and its service records.
- **Categorized services**: each record is tagged to a category (Engine & oil, Brakes & fluids, Electrical & wear, Tyres & alignment, Other) with quick-pick item chips.
- **Reminders**: per-category due dates with overdue / due-soon status, and a configurable lead time per category (its own Reminder settings page). Shown in-app when you open it.
- **Installable**: PWA manifest + iOS home-screen icon; "Add to Home Screen" launches full-screen.
- Works offline-ish via `localStorage`; syncs to Firestore once configured.
- Login on a separate page (`login.html`) via Firebase Authentication.

## Project structure

```
public/            # everything served by Firebase Hosting (the web app)
  *.html           # one file per page (index, vehicle, record-form, …)
  manifest.webmanifest
  css/styles.css
  js/              # store.js (shared) + one script per page + version.js, auth.js, …
  assets/          # PWA / home-screen icons
firebase.json      # hosting points at public/
firestore.rules
firestore.indexes.json
```

## Run locally

```sh
python3 -m http.server 5173 --directory public
```

Then open `http://localhost:5173`.

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

Data is stored per user at `users/{uid}/garage/main`.
