# Vehicle Service Log

Phase 1 is a simple personal webapp for recording vehicle service history.

## Features

- Save one vehicle profile.
- Add service records with date, odometer, workshop, cost, serviced items, notes, and next service recommendation.
- View service history newest first.
- See summary cards for current odometer, last service, and total spend.
- Works immediately with localStorage.
- Uses `login.html` for Firebase Authentication.
- Syncs private user data to Firebase Firestore after you add your Firebase web config in `firebase-config.js`.

## Run locally

```sh
python3 -m http.server 5173
```

Then open `http://localhost:5173`.

## Connect Firebase

1. Create a Firebase project.
2. Add a Web App in Firebase project settings.
3. Copy the Firebase config object into `firebase-config.js`.
4. Enable Authentication with the Email/Password provider.
5. Enable Firestore Database.
6. Deploy with Firebase Hosting:

```sh
firebase deploy
```

The app stores data in:

```text
users/{uid}/garage/main
```

Deploy Firestore rules before storing real data:

```sh
firebase deploy --only firestore:rules
```
