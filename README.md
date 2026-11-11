# Enzi Timer

A minimalist timer, styled like enzi-ws. Pick an activity, press Start, stay with it.

- Activity navigation with ‹ Previous / Next ›
- Large Playfair countdown (MM:SS, or HH:MM:SS over an hour) + total duration
- Start / Pause / Stop-Reset, with a thin progress bar and a soft chime on finish
- New-activity slide-over: name + hours / minutes / seconds
- Visitor-only: no sign-in, no Google login anywhere
- Activity settings are stored in Supabase — the SAME project as enzi-ws
  (wjmaaagrlmwcesmovfwr), table `enzi_timer_activities` only.
  Each visitor is keyed by a per-browser visitor id, so no account is
  needed. No Firebase keys: activities save to localStorage on this device.
  DO NOT DELETE that table from the enzi-ws project — it belongs to
  Enzi Timer, not to the Bewize Workshop.

## Styling — like enzi-ws

- Helvetica Neue only, everywhere (system stack, no webfont)
- BSI palette: teal #00A39D, gold #F8AD3C, deep teal #003D36
- Buttons rounded-xl, chips rounded-full, one type scale, white pages
- Title is just "Enzi Timer"; footer is just "Enzi Timer"

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the enzi-ws Supabase URL + anon key
npm run dev
```

## Supabase setup

The table already exists in the enzi-ws Supabase project:

```sql
CREATE TABLE IF NOT EXISTS enzi_timer_activities (
  id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  name TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
  created_at BIGINT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE enzi_timer_activities DISABLE ROW LEVEL SECURITY;
COMMENT ON TABLE enzi_timer_activities IS 'Enzi Timer (enzi-timer.vercel.app) — visitor activity settings. DO NOT DELETE: this table belongs to Enzi Timer, not to the Bewize Workshop.';
```

Env vars (same values as enzi-ws): `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. Until they are set, the app runs
in local mode.

## Deploy

Push to `main` on GitHub — Vercel auto-deploys to https://enzi-timer.vercel.app
