# Vehicle Service Log

Phase 1 is a simple personal webapp for recording vehicle service history.

## Features

- Save one vehicle profile.
- Add service records with date, odometer, workshop, cost, serviced items, notes, and next service recommendation.
- View service history newest first.
- See summary cards for current odometer, last service, and total spend.
- Works immediately with localStorage.
- Syncs to Firebase Firestore after you add your Firebase web config in `app.js`.

## Run locally

```sh
python3 -m http.server 5173
```

Then open `http://localhost:5173`.

## Connect Firebase

1. Create a Firebase project.
2. Add a Web App in Firebase project settings.
3. Copy the Firebase config object into `app.js`.
4. Enable Firestore Database.
5. Deploy with Firebase Hosting:

```sh
firebase deploy
```

The app stores data in:

```text
garage/main
```

Because this is a personal app, Phase 1 keeps the data model intentionally simple. Authentication and stricter rules should be added before sharing the app publicly.
