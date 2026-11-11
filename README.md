# Enzi Timer

A minimalist timer, styled like enzi-ws. Pick an activity, press Start, stay with it.

- Activity navigation with ‹ Previous / Next ›
- Large Playfair countdown (MM:SS, or HH:MM:SS over an hour) + total duration
- Start / Pause / Stop-Reset, with a thin progress bar and a soft chime on finish
- New-activity slide-over: name + hours / minutes / seconds
- Visitor-only: no sign-in, no Google login anywhere
- Activity settings are stored in Firestore (`users/{uid}/activities`) under
  an invisible anonymous visitor id — no Firebase keys: activities save
  to localStorage on this device

## Styling — like enzi-ws

- Poppins for UI, Playfair Display for the hero (countdown + activity name)
- BSI palette: teal #00A39D, gold #F8AD3C, deep teal #003D36
- Buttons rounded-xl, chips rounded-full, one type scale, white pages

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in Firebase web-app keys
npm run dev
```

## Firebase setup

1. Firebase Console → create a project → Add a Web app → copy the config
   into `.env.local` (`NEXT_PUBLIC_FIREBASE_*`) and into Vercel env vars.
2. Authentication → Sign-in method → enable **Anonymous** (do NOT enable Google).
3. Firestore Database → Create database (production mode) → the app reads/writes
   `users/{uid}/activities` only for that visitor's anonymous id.

Until the keys are set, the app runs in local mode.

## Deploy

Push to `main` on GitHub — Vercel auto-deploys to https://enzi-timer.vercel.app
