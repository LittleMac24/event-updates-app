# seed.sql — TODO

Work for tomorrow: expand `seed.sql` so it exercises the rest of the schema.
Insert in dependency order (parents before children) and keep using the fixed
UUIDs already in the file (Alice `1111…`, Bob `2222…`, Charlie `3333…`,
event `aaaa…`).

## Add coverage for:

- [ ] **poll** — add a `kind='poll'` row to `updates`. CHECK requires
      `body_text IS NOT NULL AND value_type IS NOT NULL AND storage_path IS NULL`.
      Populate `choices` (jsonb) with the options.
- [ ] **comments** — add a row to `comments` (text-only). Set `event_id` to match
      the parent update's event (denormalized for RLS).
- [ ] **responses** — add a vote on the poll/prediction update. FK `update_id` must
      point at a `poll`/`prediction` update; respects `UNIQUE (update_id, user_id)`.
- [ ] **invited** — add an `event_members` row with `status='invited'` plus
      `invite_token` and `invite_expires_at` (e.g. Charlie `3333…`) to exercise the
      invite state machine.

## Before committing

- [ ] Fix existing bug: `seed.sql` line ~52 — `'["Boy", "Girl"]::jsonb'` should be
      `'["Boy", "Girl"]'::jsonb` (cast outside the quotes). Reset currently fails on this.
- [ ] Run `supabase db reset` — must apply clean with no errors.
