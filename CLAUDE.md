# Event Update App

A mobile app for capturing live events (births, weddings, hospital stays, trips) as a timeline of atomic moments, then turning collective participation — reactions, comments, predictions, polls — into visual story artifacts when the event ends.

The product thesis: **updates → participation → data → visualization → memory.** The competitive moat isn't the timeline (Apple Notes already wins at posting). It's the generated representation of the collective experience around the event.

## Architecture

There is no separate backend server. The mobile app talks to Supabase directly.

```
React Native + Expo  ──HTTPS / WebSocket──▶  Supabase
                                              ├── Postgres (the schema)
                                              ├── Auth (auth.users, sessions)
                                              ├── Storage (private buckets)
                                              ├── PostgREST (auto-generated REST API)
                                              ├── Realtime (Postgres change streams)
                                              └── Edge Functions (Deno/TS, only for server-side work)
```

The "API" is auto-generated from the Postgres schema by PostgREST. Authorization is enforced by Row Level Security policies in the database, not by middleware. There is no Node/Python/FastAPI service to write. If something genuinely needs server-side code (calling Claude API, sending push notifications, processing exports), it lives in an Edge Function.

## Stack

| Layer | Tech |
|---|---|
| Mobile | React Native + Expo (TypeScript) |
| Backend platform | Supabase (hosted Postgres 15+) |
| DB schema | SQL migrations under `supabase/migrations/` |
| Server-side logic | Supabase Edge Functions (Deno + TypeScript) when needed |
| Client SDK | `@supabase/supabase-js` |

## Repo layout

```
event-update-app/
├── supabase/
│   ├── config.toml                                  Supabase project config
│   ├── migrations/
│   │   └── 20260610090003_initial_schema.sql        Tables, enums, CHECK, indexes
│   ├── functions/                                   Edge Functions (none yet)
│   ├── seed.sql                                     Dev seed data
│   └── tests/                                       Constraint tests (planned)
├── schema.rs                                        DBML source (despite extension)
├── event-update-erd.csv                             ERD as CSV
└── app/                                             Expo app (planned)
```

`schema.rs` is misnamed — it's actually a DBML file for dbdiagram.io. Don't treat it as Rust.

## Schema model — non-obvious decisions

Read these before changing the schema; several look weird without context.

1. **Updates are atomic.** One update = one piece of content (text, photo, video, voice, poll, or prediction). No multi-photo carousels. The `updates` table has nullable media fields AND nullable prompt fields, gated by a `CHECK` constraint on `kind`. A poll IS an update — there's no separate `prompts` table.

2. **`public.users.id` references `auth.users.id` 1:1.** Every user — including guests — has an `auth.users` row. Guests get one via `supabase.auth.signInAnonymously()`. This makes RLS policies trivial: `WHERE user_id = auth.uid()` Just Works.

3. **`event_members` is the unified membership + invite state machine.** No separate INVITES table. `status` cycles: `invited → active → removed`. `invite_token`/`invite_expires_at` live on the same row, set only while `status='invited'`.

4. **Reactions are polymorphic.** `reactions.target_type` is `update | comment` and `reactions.target_id` is a bare uuid with no FK (it points at one of two tables). Uniqueness enforced by `(target_type, target_id, user_id, reaction_type)`. Cleanup on parent delete is app-layer or future-trigger work.

5. **Responses are votes on prompt-kind updates.** `responses.update_id` FK to `updates.id` — only valid when `updates.kind IN ('poll', 'prediction')`. Not currently enforced by trigger; rely on app layer + the `UNIQUE (update_id, user_id)` index.

6. **Counter columns are denormalized but not yet maintained.** `events.reaction_count`, `updates.comment_count`, `prompts.response_count`, etc. exist as `int DEFAULT 0` — they'll stay at 0 until counter triggers are added. Don't read them until then.

7. **`event_id` is denormalized onto `media`/`reactions`/etc.** This is for RLS performance — every read needs a single `event_members` lookup, not a join walk.

8. **Soft delete via `deleted_at`** on `events`, `updates`, `comments`. Partial indexes (`WHERE deleted_at IS NULL`) cover the active-rows queries. Users are not hard-deleted — set `status='deleted'` and scrub PII.

## Migration conventions

- Filename: `<timestamp>_<snake_case_name>.sql` — use `supabase migration new <name>` to get the prefix right.
- One concern per migration: schema, RLS, triggers, seed-helpers as separate files.
- Always test locally with `supabase db reset` before commit. A clean reset proves the migration is idempotent from scratch.
- `ON DELETE` behavior is mandatory on every FK — no defaults. See the initial migration for the policy matrix.
- `CHECK` constraints over app-layer validation when the rule is data-shape (e.g., `updates_kind_fields_valid`). App-layer for cross-table or contextual rules.

## RLS conventions (when policies are added)

- **Every public table must have RLS enabled.** Without `ENABLE ROW LEVEL SECURITY`, Supabase grants anon/authenticated full access via default GRANTs — i.e., wide open.
- Policy filter shape: usually `EXISTS (SELECT 1 FROM event_members WHERE event_id = <table>.event_id AND user_id = auth.uid() AND status = 'active')`. This is why `event_id` is denormalized onto every child table.
- Write SELECT, INSERT, UPDATE, DELETE policies separately — don't rely on `FOR ALL`. Different operations have different invariants.
- Service-role queries (Edge Functions using `SUPABASE_SERVICE_ROLE_KEY`) bypass RLS. Treat that key like a root password.

## Edge Function conventions

- One folder per function: `supabase/functions/<name>/index.ts`.
- Server-side secrets (Claude API key, FCM/APNS creds) come from `Deno.env.get(...)`. Never ship them in the mobile bundle.
- Functions invoked from the client should use the user's JWT (default behavior); functions running on a schedule (cron) typically use service role.
- Use Deno-compatible imports: `https://esm.sh/...` or `npm:...`, not bare specifiers.

## Testing approach

Schema testing is layered. Skip pgTAP until there are triggers/functions worth a real test framework.

1. `supabase db reset` — proves the migration applies cleanly.
2. Studio table editor — eyeball that tables exist with the right columns.
3. `supabase/seed.sql` — proves the schema accepts realistic data.
4. `supabase/tests/constraints.sql` — `DO $$ ... EXCEPTION WHEN ... $$` blocks that assert each CHECK, UNIQUE, FK, and CASCADE behaves correctly. Run with `psql ... -f`.
5. `curl` against `http://127.0.0.1:54321/rest/v1/<table>` — confirms the auto-generated API is live.

For app code testing: TBD. Probably Vitest + React Native Testing Library when we get there.

## Don'ts

- **Don't write directly to `auth.users`.** Use `supabase.auth.*` APIs. The SQL editor lets you, but app code never should.
- **Don't add a separate backend server.** Supabase IS the backend. If something needs server-side logic, write an Edge Function. The only reason to add FastAPI/Express is long-running CPU work (video transcoding, multi-minute ML inference) — and even then, it sits alongside Supabase, not in front of it.
- **Don't put profile fields on `auth.users`.** Supabase manages that schema and may evolve it. Your fields go in `public.users`.
- **Don't read counter columns until counter triggers exist.** They're all 0 right now.
- **Don't bypass the `updates_kind_fields_valid` CHECK.** If you're tempted to disable it, you're probably modeling the data wrong.
- **Don't trust `updated_at` until the trigger is added.** Postgres doesn't auto-update it; without a trigger it stays at INSERT time forever.

## Current state (as of last session)

- ✅ Initial schema migration written and committed
- ✅ DBML + CSV ERD in repo for diagram tools
- ⏳ Next migration: `auth.users → public.users` mirror trigger + `updated_at` triggers
- ⏳ After that: RLS policies migration
- ⏳ After that: counter-maintenance triggers
- ⏳ Expo app: not started

## Open product questions

- Cover image: inline `cover_storage_*` on events for now. Revisit if we add multi-cover or hero-update.
- Poll/prediction resolution UX: how is `actual_value` set on prediction-kind updates? Owner action? Time-based auto-close?
- Notifications: which signals warrant a push vs. just an in-app badge?
- Story export: deferred (the `event_exports` table is a placeholder).
