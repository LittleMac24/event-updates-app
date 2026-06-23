# Event Update App

Mobile-first React Native (Expo) front-end for capturing live events as a
timeline of atomic moments, with Figma-style presence, Reddit-style
interactions, and a celebratory event recap. Talks directly to Supabase
(no separate backend).

This is the **thin end-to-end slice**: one event, every layer wired shallowly
(post → react → vote → presence → recap), with a first-class interaction
ledger feeding the recap.

## Prerequisites

- Node 18+
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Xcode (iOS Simulator) and/or Android Studio, or Expo Go on a device

## 1. Start the backend

```bash
supabase start          # boots local Postgres, Auth, Realtime, Studio
supabase db reset       # applies migrations + seed (idempotent from scratch)
supabase status         # copy the API URL + anon key
```

Studio: http://127.0.0.1:54323

## 2. Configure the app

```bash
cp .env.example .env
# paste the anon key from `supabase status` if it differs
```

Host note (the value in `.env` must be reachable from the device):
- iOS Simulator → `http://127.0.0.1:54321`
- Android emulator → `http://10.0.2.2:54321`
- Physical device (Expo Go) → `http://<your-LAN-IP>:54321`

## 3. Run the app

```bash
npm install
npx expo install --fix   # aligns native deps to your installed Expo SDK
npx expo start
```

Press `i` (iOS) or `a` (Android).

## Seed users

All share password `password123`:

- `alice@example.com` — owner of "Baby Whitfield"
- `bob@example.com` — contributor
- `charlie@example.com` — viewer

Sign in as two of them (e.g. simulator + web) to see live presence and the
feed update in real time.

## What's wired

- **Auth** — email/password against seeded users.
- **Spaces** — your active events.
- **Event space** — adaptive card feed (text / photo / prediction), live via
  Realtime `postgres_changes`; lens chips (Overview / Predictions / Discussions).
- **Interactions** — reactions, prediction votes, and batched "viewed" events
  all write to the `interactions` ledger.
- **Presence** — facepile + "typing…/just voted" via Realtime Presence +
  Broadcast; consent-first **visible/lurk** toggle in Profile.
- **Recap** — host-only, size-aware, celebratory summary (no rankings at small N).

## Out of scope (deferred — see plan)

`relationship_edges` rollups + network/influence analytics, AI story export
(Edge Function + Claude), RLS policies (**required before real use**),
counter-maintenance & `updated_at` triggers, real media upload, full
Members/Discussions surfaces.
