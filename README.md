# Enzi Timer

A minimalist, Swiss-type timer. Pick an activity, press Start, stay with it.

- Activity navigation with ‹ Previous / Next ›
- Large tabular countdown (MM:SS, or HH:MM:SS over an hour) + total duration
- Start / Pause / Stop-Reset, with a thin progress bar and a soft chime on finish
- New-activity slide-over: name + hours / minutes / seconds
- Firebase Auth (Google Sign-In) + Firestore (`users/{uid}/activities`)
  - Signed in: activities sync to your account
  - Not signed in / no Firebase keys: activities save to localStorage on this device

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in Firebase web-app keys
npm run dev
```

## Firebase setup

1. Firebase Console → create a project → Add a Web app → copy the config
   into `.env.local` (`NEXT_PUBLIC_FIREBASE_*`) and into Vercel env vars.
2. Authentication → Sign-in method → enable Google.
3. Firestore Database → Create database (production mode) → the app reads/writes
   `users/{uid}/activities` only for the signed-in user.
4. Authentication → Settings → Authorized domains → add `enzi-timer.vercel.app`.

Until the keys are set, the app runs in local mode and sign-in shows a clear notice.

## Deploy

Push to `main` on GitHub — Vercel auto-deploys to https://enzi-timer.vercel.app
