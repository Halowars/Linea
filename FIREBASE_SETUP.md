# Linea Firebase Setup

Linea works fully local by default. Firebase is only for optional draft sync across devices.
Firestore stores draft data only. Firebase Authentication stores the email/password account identity.

## 1. Enable Email/Password Auth

1. Open Firebase Console.
2. Go to Authentication.
3. Open Sign-in method.
4. Enable Email/Password.

## 2. Add a Web App

1. Go to Project settings.
2. Under Your apps, add a Web app.
3. Copy the `firebaseConfig` values.
4. Paste them into `firebase-config.js`.

Example shape:

```js
window.LINEA_FIREBASE_CONFIG = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  appId: "your-app-id",
};
```

## 3. Authorized Domains

In Authentication settings, add the domains you use:

```text
localhost
halowars.github.io
```

## 4. Firestore Rules

Paste these in Firestore Rules:

```txt
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/drafts/current {
      allow read: if request.auth != null
        && request.auth.uid == userId;

      allow create, update: if request.auth != null
        && request.auth.uid == userId
        && request.resource.data.keys().hasOnly([
          "activeDraftId",
          "drafts",
          "updatedAt"
        ])
        && request.resource.data.drafts is list
        && request.resource.data.drafts.size() <= 200;

      allow delete: if false;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## What Gets Synced

Only this draft data is written to Firestore:

- draft ID
- draft title
- draft HTML
- draft updated timestamp
- active draft ID

Looks, images, GIFs, audio files, YouTube queue, colors, and local customization assets stay local only.
