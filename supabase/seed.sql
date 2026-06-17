-- I will create fake data for testing purposes

-- Insert fake users to auth
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'charlie@example.com');

Insert into users (id, name, email, status) values
('11111111-1111-1111-1111-111111111111', 'Alice', 'alice@example.com', 'active'),
('22222222-2222-2222-2222-222222222222', 'Bob', 'bob@example.com', 'deleted'),
('33333333-3333-3333-3333-333333333333', 'Charlie', 'charlie@example.com', 'active');

INSERT INTO events (id, name, event_type, status, visibility, starts_at, timezone, created_by_user_id)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Baby Whitfield', 'birth', 'active', 'link',
  now(), 'America/Los_Angeles',
  '11111111-1111-1111-1111-111111111111'
);

INSERT INTO event_members (event_id, user_id, role, status, joined_at) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner', 'active', now()),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'viewer', 'active', now());


  INSERT INTO updates (event_id, author_user_id, kind, body_text) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
   'text', '1 cm dilated');

  insert into updates (event_id, author_user_id, kind, storage_bucket, storage_path, body_text, mime_type, file_size_bytes, width, height) values (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    'photo',
    'event-media-storage-bucket',
    'event-media/baby-whitfield/photo1.jpg',
    'Just born! #blessed (Body text)',
    'image/jpeg',
    102400,
    100,
    200  
  );


--There is no way to choose the choices for a prediction
  insert into updates (event_id, author_user_id, kind, body_text, value_type, choices) values (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    'prediction',
    'What is the gender of the baby?',
    'choice',
    '["Boy", "Girl"]'::jsonb
  );