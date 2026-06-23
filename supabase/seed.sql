-- ============================================================
-- Local dev seed (NOT for production).
--
-- Writes directly to auth.* — this is the standard local-only
-- pattern so `signInWithPassword` works against seeded users.
-- App code must NEVER write to auth.* (see CLAUDE.md). All
-- seeded users share the password: "password123".
--
-- Re-applied on every `supabase db reset`.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- auth.users  (+ identities required by GoTrue for email login)
-- ------------------------------------------------------------

INSERT INTO auth.users
  (instance_id, id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at,
   raw_app_meta_data, raw_user_meta_data)
VALUES
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111',
   'authenticated','authenticated','alice@example.com',
   crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}','{"name":"Alice"}'),
  ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222',
   'authenticated','authenticated','bob@example.com',
   crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}','{"name":"Bob"}'),
  ('00000000-0000-0000-0000-000000000000','33333333-3333-3333-3333-333333333333',
   'authenticated','authenticated','charlie@example.com',
   crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}','{"name":"Charlie"}');

-- GoTrue scans these token columns into non-nullable strings; seeded rows
-- leave them NULL, which causes "Database error querying schema" on login.
-- Set them to '' so password sign-in works locally.
UPDATE auth.users SET
  confirmation_token         = COALESCE(confirmation_token, ''),
  recovery_token             = COALESCE(recovery_token, ''),
  email_change               = COALESCE(email_change, ''),
  email_change_token_new     = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone_change               = COALESCE(phone_change, ''),
  phone_change_token         = COALESCE(phone_change_token, ''),
  reauthentication_token     = COALESCE(reauthentication_token, '')
WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

INSERT INTO auth.identities
  (id, user_id, identity_data, provider, provider_id,
   last_sign_in_at, created_at, updated_at)
VALUES
  (gen_random_uuid(),'11111111-1111-1111-1111-111111111111',
   jsonb_build_object('sub','11111111-1111-1111-1111-111111111111','email','alice@example.com'),
   'email','11111111-1111-1111-1111-111111111111', now(), now(), now()),
  (gen_random_uuid(),'22222222-2222-2222-2222-222222222222',
   jsonb_build_object('sub','22222222-2222-2222-2222-222222222222','email','bob@example.com'),
   'email','22222222-2222-2222-2222-222222222222', now(), now(), now()),
  (gen_random_uuid(),'33333333-3333-3333-3333-333333333333',
   jsonb_build_object('sub','33333333-3333-3333-3333-333333333333','email','charlie@example.com'),
   'email','33333333-3333-3333-3333-333333333333', now(), now(), now());

-- ------------------------------------------------------------
-- public.users  (1:1 mirror; trigger not built yet, so seed it)
-- ------------------------------------------------------------

INSERT INTO public.users (id, name, email, status) VALUES
  ('11111111-1111-1111-1111-111111111111','Alice','alice@example.com','active'),
  ('22222222-2222-2222-2222-222222222222','Bob','bob@example.com','active'),
  ('33333333-3333-3333-3333-333333333333','Charlie','charlie@example.com','active');

-- ------------------------------------------------------------
-- One event: "Baby Whitfield"
-- ------------------------------------------------------------

INSERT INTO events (id, name, description, event_type, status, visibility, starts_at, timezone, created_by_user_id)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Baby Whitfield',
  'Following along as Baby Whitfield makes their grand entrance.',
  'birth', 'active', 'link', now(), 'America/Los_Angeles',
  '11111111-1111-1111-1111-111111111111'
);

INSERT INTO event_members (event_id, user_id, role, status, joined_at) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','owner','active', now() - interval '3 hours'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222222','contributor','active', now() - interval '2 hours'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','33333333-3333-3333-3333-333333333333','viewer','active', now() - interval '1 hour');

-- ------------------------------------------------------------
-- Updates (atomic timeline objects)
-- ------------------------------------------------------------

-- text
INSERT INTO updates (id, event_id, author_user_id, update_type, body_text, posted_at) VALUES
  ('b0000000-0000-0000-0000-000000000001','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111','text','We are 1 cm dilated! It begins 😮', now() - interval '2 hours'),
  ('b0000000-0000-0000-0000-000000000002','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '22222222-2222-2222-2222-222222222222','text','On our way to the hospital — drive safe everyone!', now() - interval '90 minutes');

-- photo (placeholder media; real upload is out of slice scope)
INSERT INTO updates (id, event_id, author_user_id, update_type, body_text,
                     storage_bucket, storage_path, mime_type, file_size_bytes, width, height, posted_at)
VALUES
  ('b0000000-0000-0000-0000-000000000003','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111','photo','First photo from the hospital room 💕',
   'event-media','event-media/baby-whitfield/room.jpg','image/jpeg', 102400, 1080, 1350, now() - interval '80 minutes');

-- prediction (multiple choice, RESOLVED so recap can show winners)
INSERT INTO updates (id, event_id, author_user_id, update_type, title, body_text,
                     response_type, response_value, value_set, prediction_answer, prediction_resolved_at, posted_at)
VALUES
  ('b0000000-0000-0000-0000-000000000004','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111','prediction','Boy or girl?','Place your bets before the big reveal!',
   'multiple_choice','value_set','["Boy","Girl"]'::jsonb,'"Girl"'::jsonb, now() - interval '10 minutes', now() - interval '75 minutes');

-- prediction (free response, OPEN — still accepting answers)
INSERT INTO updates (id, event_id, author_user_id, update_type, title, body_text,
                     response_type, response_value, closes_at, posted_at)
VALUES
  ('b0000000-0000-0000-0000-000000000005','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111','prediction','What time will baby arrive?','Guess the exact time of birth!',
   'free_response','datetime', now() + interval '6 hours', now() - interval '70 minutes');

-- ------------------------------------------------------------
-- Prompt responses (votes on the gender prediction)
--   answer was "Girl" -> Alice & Bob win, Charlie does not.
-- ------------------------------------------------------------

INSERT INTO prompt_responses (update_id, user_id, value) VALUES
  ('b0000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','"Girl"'::jsonb),
  ('b0000000-0000-0000-0000-000000000004','22222222-2222-2222-2222-222222222222','"Girl"'::jsonb),
  ('b0000000-0000-0000-0000-000000000004','33333333-3333-3333-3333-333333333333','"Boy"'::jsonb);

-- ------------------------------------------------------------
-- Reactions (on the first text update)
-- ------------------------------------------------------------

INSERT INTO reactions (event_id, reaction_for, target_id, user_id, reaction_type) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','update','b0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','❤️'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','update','b0000000-0000-0000-0000-000000000001','33333333-3333-3333-3333-333333333333','🎉');

-- ------------------------------------------------------------
-- Interactions (seed ledger so the recap is non-empty on first run)
-- ------------------------------------------------------------

INSERT INTO interactions (event_id, actor_user_id, target_user_id, subject_type, subject_id, verb) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','member',NULL,'joined'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','member',NULL,'joined'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','update','b0000000-0000-0000-0000-000000000001','reacted'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','update','b0000000-0000-0000-0000-000000000001','reacted'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','prediction','b0000000-0000-0000-0000-000000000004','voted'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','prediction','b0000000-0000-0000-0000-000000000004','voted');
