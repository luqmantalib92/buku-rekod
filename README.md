# Vehicle Service Log

A personal webapp for tracking vehicle maintenance across multiple vehicles.

## Features

- **Garage** (`index.html`): add and list vehicles; each card shows odometer, log count, last service, and a "due" badge.
- **Vehicle logbook** (`vehicle.html?id=<id>`): add/edit/delete a vehicle and its service records.
- **Categorized services**: each record is tagged to a category (Engine & oil, Brakes & fluids, Electrical & wear, Tyres & alignment, Other) with quick-pick item chips.
- **Reminders**: per-category due dates with overdue / due-soon status, and a configurable lead time per category (Reminder settings on the garage page).
- **Push notifications** (optional): a scheduled Cloud Function sends reminders when services are due — even when the app is closed.
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

## Push notifications setup (optional, phase 2)

Requires the **Blaze** plan (Cloud Functions + Cloud Scheduler). For personal
use this typically stays within the free monthly allotment.

1. **Web Push key**: Firebase Console → Project settings → Cloud Messaging →
   Web Push certificates → *Generate key pair*. Paste it into `VAPID_KEY` in
   `firebase-config.js`.
2. **Deploy the function** (installs `functions/` dependencies on deploy):

   ```sh
   firebase deploy --only functions
   ```

   `serviceReminders` runs daily (09:00 Asia/Kuala_Lumpur) and pushes any
   overdue / due-soon services to each user's registered devices.
3. **Enable on device**: open the app, go to *Reminder settings* on the garage
   page, and tap **Enable** to grant permission and register the device.

Notes:
- On **iPhone**, web push only works for an **installed PWA** (Add to Home
  Screen) on iOS 16.4+ — enable notifications from inside the installed app.
- Device tokens are stored at `users/{uid}/meta/push`; dead tokens are pruned
  automatically.
