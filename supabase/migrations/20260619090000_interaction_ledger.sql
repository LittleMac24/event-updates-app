-- ============================================================
-- Migration: interaction_ledger
--
-- Adds the append-only interaction ledger — the first-class
-- record of who did what to whom inside an event. This is the
-- substrate for relationship/influence analytics and the
-- exportable event "story". Cheap to add now, impossible to
-- backfill later, so it ships with the first slice.
--
-- Also adds the relevant tables to the `supabase_realtime`
-- publication so the client can subscribe to live changes.
-- ============================================================

-- ------------------------------------------------------------
-- Enum: the verbs we track
-- ------------------------------------------------------------

CREATE TYPE interaction_verb AS ENUM (
  'viewed',        -- author -> viewer (content was seen)
  'reacted',       -- viewer -> author
  'commented',     -- viewer -> author
  'replied',       -- viewer -> viewer
  'mentioned',     -- viewer -> viewer
  'voted',         -- viewer -> author (poll/prediction)
  'joined',        -- member joined the event
  'pinned',        -- host curated an object
  'profile_viewed' -- viewer -> viewer
);

-- ------------------------------------------------------------
-- Interactions (append-only ledger)
--   actor_user_id  -> who performed the action
--   target_user_id -> the user on the other end of the edge
--                     (e.g. the content author for a reaction/view).
--                     Nullable: some verbs have no counterpart user.
--   subject_type/id -> the object acted on (update | comment |
--                     prediction | member). No FK because it is
--                     polymorphic; cleanup is app/rollup-layer work.
-- ------------------------------------------------------------

CREATE TABLE interactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  actor_user_id   uuid NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  target_user_id  uuid REFERENCES users(id)           ON DELETE SET NULL,
  subject_type    text NOT NULL,            -- 'update' | 'comment' | 'prediction' | 'member'
  subject_id      uuid,
  verb            interaction_verb NOT NULL,
  weight          int  NOT NULL DEFAULT 1,  -- relative importance for analytics rollups
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Timeline / recap reads: "everything in this event, newest first".
CREATE INDEX idx_interactions_event_created
  ON interactions(event_id, created_at DESC);

-- Relationship-edge rollups: "interactions from A to B in this event".
CREATE INDEX idx_interactions_edge
  ON interactions(event_id, actor_user_id, target_user_id);

-- Per-actor aggregates: "most active member".
CREATE INDEX idx_interactions_actor
  ON interactions(event_id, actor_user_id);

-- ------------------------------------------------------------
-- Realtime: expose the live-feed tables to Postgres change streams.
-- The `supabase_realtime` publication is created by Supabase's
-- internal migrations before user migrations run.
-- ------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE updates;
ALTER PUBLICATION supabase_realtime ADD TABLE reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE prompt_responses;
ALTER PUBLICATION supabase_realtime ADD TABLE interactions;
