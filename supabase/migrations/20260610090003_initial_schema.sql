-- ============================================================
-- Migration: init_schema
--
-- Creates the schema for the events/updates/participation
-- product. NOT included (intentional — separate migrations):
--   • RLS policies [I will figure out as I go]
--   • updated_at triggers
--   • Counter-maintenance triggers (reaction_count, etc.)
--   • Trigger to auto-create public.users on auth.users insert
-- ============================================================

-- ------------------------------------------------------------
-- Extensions
-- ------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS citext;

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------

CREATE TYPE user_status        AS ENUM ('active', 'guest', 'deleted');
CREATE TYPE event_type         AS ENUM ('birth', 'wedding', 'hospital', 'trip', 'other');
CREATE TYPE event_status       AS ENUM ('draft', 'active', 'ended', 'archived');
CREATE TYPE event_visibility   AS ENUM ('private', 'link', 'public');
CREATE TYPE member_role        AS ENUM ('owner', 'contributor', 'viewer');
CREATE TYPE member_status      AS ENUM ('invited', 'active', 'removed');
CREATE TYPE update_kind        AS ENUM ('text', 'photo', 'video', 'voice', 'poll', 'prediction');
CREATE TYPE response_value     AS ENUM ('date', 'datetime', 'float', 'value_set');
create type response_type      as enum ('free_response', 'multiple_choice');
CREATE TYPE reaction_for    AS ENUM ('update', 'comment');
CREATE TYPE notification_type  AS ENUM ('reaction', 'comment', 'update', 'prediction', 'poll', 'invite', 'milestone');

-- ------------------------------------------------------------
-- Users
--   public.users.id == auth.users.id (1:1)
--   A trigger added in a later migration will create the
--   public.users row on auth signup.
-- ------------------------------------------------------------

CREATE TABLE users (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, -- auth.users is the underlying users table for authentication in supabase
  name            text NOT NULL,
  email           citext UNIQUE, -- citext for case-insensitive strings
  phone           text UNIQUE,
  avatar_bucket   text, -- where the bucket for profiles are
  avatar_path     text, -- path for profile image
  status          user_status NOT NULL DEFAULT 'active', -- status of user
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Events
-- ------------------------------------------------------------

CREATE TABLE events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  description           text,
  event_type            event_type NOT NULL,
  status                event_status NOT NULL DEFAULT 'draft', -- events will automatically start in draft until published
  visibility            event_visibility NOT NULL DEFAULT 'private',
  starts_at             timestamptz NOT NULL,
  ends_at               timestamptz,
  timezone              text NOT NULL,
  location_name         text,
  location_lat          numeric,
  location_lng          numeric,
  cover_storage_bucket  text,
  cover_storage_path    text,
  created_by_user_id    uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  update_count          int  NOT NULL DEFAULT 0,
  reaction_count        int  NOT NULL DEFAULT 0,
  comment_count         int  NOT NULL DEFAULT 0,
  member_count          int  NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);

-- ------------------------------------------------------------
-- Updates (atomic timeline items)
--   Created before event_members because event_members has a
--   FK to updates(id) for unread tracking.
-- ------------------------------------------------------------

CREATE TABLE updates (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE, -- deletes all updates dependent of the event
  author_user_id    uuid NOT NULL REFERENCES users(id)  ON DELETE RESTRICT, -- delete user should not delete updates, but we can consider setting to NULL in the future if needed
  update_type       update_kind NOT NULL,

  -- Shared
  body_text         text,
  title             text,
  posted_at         timestamptz NOT NULL DEFAULT now(),
  pinned            boolean     NOT NULL DEFAULT false,


  -- Media fields (photo, video, voice)
  storage_bucket    text, -- where the media is stored (e.g. "event-media"), its not the path 
  storage_path      text, -- path for the media (e.g. "event-media/1234abcd"), can be used with bucket to get the full URL, and can be null for text-only updates
  thumbnail_path    text,
  mime_type         text, --type (image, video, audio), and subtype (jpeg, mp4, etc.) can be parsed from this i.e "image/jpeg"
  file_size_bytes   bigint,
  frame_rate        int, -- Frames per second
  width             int, -- for photos and videos, width of the media in pixels
  height            int, -- for photos and videos, height of the media in pixels
  duration_seconds  int, -- for videos and voice, duration of the media in seconds

  -- Prompt fields (poll, prediction)
  response_type       response_type, -- free-response vs multiple-choice (for polls and predictions)
  response_value      response_value,
  value_set           jsonb,
  closes_at         timestamptz, -- when the poll or prediction closes for responses
  prediction_resolved_at       timestamptz, -- when the prediction was resolved (can be different from closes_at because predictions can be resolved early or late)
  prediction_answer      jsonb, -- for predictions, the correct answer (can be any JSON value depending on the type of prediction)
  response_count    int NOT NULL DEFAULT 0, -- # of repsonses from event members for polls and predictions, this is a counter that is updated by triggers on the responses table

  -- Engagement counters
  reaction_count    int NOT NULL DEFAULT 0,
  comment_count     int NOT NULL DEFAULT 0,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,

  CONSTRAINT updates_type_fields_valid CHECK (
    CASE update_type
      WHEN 'text'       THEN body_text IS NOT NULL AND storage_path IS NULL AND response_value IS NULL
      WHEN 'photo'      THEN storage_path IS NOT NULL and storage_bucket IS NOT NULL AND response_value IS NULL
      WHEN 'video'      THEN storage_path IS NOT NULL and storage_bucket IS NOT NULL AND response_value IS NULL
      WHEN 'voice'      THEN storage_path IS NOT NULL and storage_bucket IS NOT NULL AND response_value IS NULL
      WHEN 'poll'       THEN title IS NOT NULL AND response_type IS NOT NULL AND response_value IS NOT NULL AND storage_path IS NULL
      WHEN 'prediction' THEN title IS NOT NULL AND response_type IS NOT NULL AND response_value IS NOT NULL AND storage_path IS NULL
    END
  )
);

-- ------------------------------------------------------------
-- Event members (collapses MEMBERS + INVITES)
-- ------------------------------------------------------------

CREATE TABLE event_members (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              uuid NOT NULL REFERENCES events(id)  ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  role                  member_role   NOT NULL DEFAULT 'viewer',
  status                member_status NOT NULL DEFAULT 'invited',
  invited_by_user_id    uuid REFERENCES users(id)            ON DELETE SET NULL,
  invite_token          text UNIQUE,
  invite_expires_at     timestamptz,
  joined_at             timestamptz,
  last_seen_update_id   uuid REFERENCES updates(id)          ON DELETE SET NULL,
  last_seen_at          timestamptz, -- when the user last viewed the event timeline, used for tracking unread updates
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  notification_preference jsonb -- user preferences for receiving notifications for this event (e.g. { "reactions": true, "comments": false }
  
);

-- ------------------------------------------------------------
-- Comments (text-only, threaded)
-- ------------------------------------------------------------

CREATE TABLE comments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id           uuid NOT NULL REFERENCES updates(id)  ON DELETE CASCADE,
  parent_comment_id   uuid REFERENCES comments(id)          ON DELETE SET NULL, -- for threading, if null then it's a top-level comment
  author_user_id      uuid NOT NULL REFERENCES users(id)    ON DELETE RESTRICT,
  body_text           text NOT NULL,
  reaction_count      int  NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

-- ------------------------------------------------------------
-- Reactions (polymorphic on update | comment)
--   target_id has no FK because it points at either updates
--   or comments depending on target_type. Cleanup is handled
--   by app logic or a future trigger.
-- ------------------------------------------------------------

CREATE TABLE reactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  reaction_for    reaction_for NOT NULL, --
  target_id       uuid NOT NULL,
  user_id         uuid NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  reaction_type   text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Responses (poll / prediction votes)
-- ------------------------------------------------------------

CREATE TABLE prompt_responses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id   uuid NOT NULL REFERENCES updates(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  value       jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Notifications: It shows when a user receives a notification and when they read it. etc
-- ------------------------------------------------------------

CREATE TABLE notifications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id   uuid NOT NULL REFERENCES users(id)  ON DELETE CASCADE, 
  event_id            uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  actor_user_id       uuid REFERENCES users(id)           ON DELETE SET NULL,
  type                notification_type NOT NULL,
  payload             jsonb NOT NULL,
  read_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Event exports (deferred; placeholder for v2)
-- ------------------------------------------------------------

CREATE TABLE event_exports (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  requested_by_user_id    uuid NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  status                  text NOT NULL,
  file_url                text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  completed_at            timestamptz
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------

-- event_members: enforce one row per (event, user) + support lookups
CREATE UNIQUE INDEX idx_event_members_unique
  ON event_members(event_id, user_id); -- one row per (event,user); also THE RLS membership-check index + "members of an event"
CREATE INDEX idx_event_members_user_status
  ON event_members(user_id, status); -- user-centric: "my events" / "my active events" (home screen)
CREATE INDEX idx_event_members_event_status
  ON event_members(event_id, status); -- event-centric: "active members of this event" (member lists, notification fan-out)

-- updates: partial indexes for active rows (most reads filter deleted_at IS NULL)
CREATE INDEX idx_updates_event_posted_alive
  ON updates(event_id, posted_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_updates_event_update_type_alive
  ON updates(event_id, update_type) WHERE deleted_at IS NULL;

-- comments: partial index for active rows
CREATE INDEX idx_comments_update_created_alive
  ON comments(update_id, created_at) WHERE deleted_at IS NULL;

-- reactions: prevent duplicate user+target+type + support target lookups
CREATE UNIQUE INDEX idx_reactions_unique
  ON reactions(reaction_for, target_id, user_id, reaction_type);
CREATE INDEX idx_reactions_target
  ON reactions(reaction_for, target_id);

-- responses: one response per user per prompt
CREATE UNIQUE INDEX idx_prompt_responses_unique
  ON prompt_responses(update_id, user_id);

-- notifications: unread-first ordering for the inbox query
CREATE INDEX idx_notifications_inbox
  ON notifications(recipient_user_id, read_at, created_at DESC);