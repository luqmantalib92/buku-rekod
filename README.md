# Vehicle Service Log

A personal webapp for tracking vehicle maintenance across multiple vehicles.

## Features

- **Garage** (`index.html`): add and list vehicles; each card shows odometer, log count, last service, and a "due" badge.
- **Vehicle logbook** (`vehicle.html?id=<id>`): add/edit/delete a vehicle and its service records.
- **Categorized services**: each record is tagged to a category (Engine & oil, Brakes & fluids, Electrical & wear, Tyres & alignment, Other) with quick-pick item chips.
- **Reminders**: per-category due dates with overdue / due-soon status, and a configurable lead time per category (Reminder settings on the garage page). Shown in-app when you open it.
- **Installable**: PWA manifest + iOS home-screen icon; "Add to Home Screen" launches full-screen.
- Works offline-ish via `localStorage`; syncs to Firestore once configured.
- Login on a separate page (`login.html`) via Firebase Authentication.

## Run locally

```sh
python3 -m http.server 5173
```

Then open `http://localhost:5173`.

## Connect Firebase

1. Create a Firebase project.
2. Add a Web App in project settings and copy the config into `firebase-config.js`.
3. Enable Authentication with the Email/Password provider, and add your user under Authentication → Users.
4. Enable Firestore Database.
5. Deploy:

```sh
firebase deploy --only hosting,firestore:rules
```

Data is stored per user at `users/{uid}/garage/main`.
