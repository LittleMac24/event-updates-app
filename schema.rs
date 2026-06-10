// ============================================================
// Enums
// ============================================================

Enum user_status {
  active
  guest
  deleted
}

Enum event_type {
  birth
  wedding
  hospital
  trip
  other
}

Enum event_status {
  draft
  active
  ended
  archived
}

Enum event_visibility {
  private
  link
  public
}

Enum member_role {
  owner
  contributor
  viewer
}

Enum member_status {
  invited
  active
  removed
}

Enum prompt_kind {
  prediction
  poll
}

Enum prompt_value_type {
  date
  datetime
  number
  choice
}

Enum reaction_target {
  update
  comment
}

Enum notification_type {
  reaction
  comment
  media
  prediction
  poll
  invite
  milestone
}

// ============================================================
// Identity & membership
// ============================================================

Table users {
  // Cannot be duplicated or NULL
  id uuid [pk] 
  name text [not null]
  //cannot be duplicated (citext: case insensitive string)
  email citext [unique, note: 'nullable until guest claims account']
  phone text [unique]
  avatar_bucket text
  avatar_path text
  status user_status [not null] // active status of user
  created_at timestamptz [not null] //timestamptz: PostgresSQL UTC Time
  updated_at timestamptz [not null]
}

Table events {
  id uuid [pk]
  event_name text [not null]
  event_description text
  event_type event_type [not null] // categorical variable
  status event_status [not null] // categorical variable
  visibility event_visibility [not null] //categorical variable + row-level security
  starts_at timestamptz [not null] //Time event starts, entered by creator of event
  ends_at timestamptz [note: 'triggers story generation when set'] // automatically triggered when creator ends event
  timezone text [not null, note: 'IANA tz like America/Los_Angeles']
  location_name text
  location_lat numeric
  location_lng numeric
  cover_media_id uuid [ref: > media.id] // why is this here?
  created_by_user_id uuid [not null, ref: > users.id]
  update_count int [not null, default: 0, note: 'trigger-maintained']
  reaction_count int [not null, default: 0, note: 'trigger-maintained']
  comment_count int [not null, default: 0, note: 'trigger-maintained']
  event_member_count int [not null, default: 0, note: 'trigger-maintained']
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
  deleted_at timestamptz
}

Table event_members {
  id uuid [pk]
  event_id uuid [not null, ref: > events.id]
  user_id uuid [not null, ref: > users.id]
  role member_role [not null]
  status member_status [not null]
  invited_by_user_id uuid [ref: > users.id]
  invite_token text [unique, note: 'only set while status=invited']
  invite_expires_at timestamptz
  joined_at timestamptz
  last_seen_update_id uuid [ref: > updates.id, note: 'unread tracking']
  last_seen_at timestamptz
  created_at timestamptz [not null]
  updated_at timestamptz [not null]

  Indexes {
    (event_id, user_id) [unique]
    (user_id, status)
    (event_id, status)
  }
}

// ============================================================
// Timeline & content
// ============================================================

Table updates {
  id uuid [pk]
  event_id uuid [not null, ref: > events.id]
  author_user_id uuid [not null, ref: > users.id]
  body_text text [note: 'nullable for media-only updates']
  posted_at timestamptz [not null, note: 'allows backfill; differs from created_at']
  pinned boolean [not null, default: false]
  reaction_count int [not null, default: 0]
  comment_count int [not null, default: 0]
  media_count int [not null, default: 0]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
  deleted_at timestamptz

  Indexes {
    (event_id, posted_at)
  }
}

Table comments {
  id uuid [pk]
  update_id uuid [not null, ref: > updates.id]
  parent_comment_id uuid [ref: > comments.id, note: 'threading']
  author_user_id uuid [not null, ref: > users.id]
  body_text text
  reaction_count int [not null, default: 0]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
  deleted_at timestamptz

  Indexes {
    (update_id, created_at)
  }
}

Table media {
  id uuid [pk]
  event_id uuid [not null, ref: > events.id, note: 'denormalized for RLS perf']
  update_id uuid [ref: > updates.id, note: 'exactly one of update_id/comment_id set']
  comment_id uuid [ref: > comments.id]
  uploader_user_id uuid [not null, ref: > users.id]
  storage_bucket text [not null]
  storage_path text [not null]
  thumbnail_path text
  mime_type text [not null]
  file_size_bytes bigint [not null]
  width int
  height int
  duration_seconds int
  created_at timestamptz [not null]
  deleted_at timestamptz

  Indexes {
    (event_id, created_at)
    update_id
    comment_id
  }
}

// ============================================================
// Signals — participation layer
// ============================================================

Table reactions {
  id uuid [pk]
  event_id uuid [not null, ref: > events.id, note: 'denormalized for RLS perf']
  target_type reaction_target [not null]
  target_id uuid [not null, note: 'polymorphic FK to updates.id or comments.id']
  user_id uuid [not null, ref: > users.id]
  reaction_type text [not null, note: 'emoji shortcode: heart sob party pray ...']
  created_at timestamptz [not null]

  Indexes {
    (target_type, target_id, user_id, reaction_type) [unique]
    (target_type, target_id)
  }
}

Table prompts {
  id uuid [pk]
  event_id uuid [not null, ref: > events.id]
  created_by_user_id uuid [not null, ref: > users.id]
  kind prompt_kind [not null]
  question text [not null]
  value_type prompt_value_type [not null]
  choices jsonb [note: 'only for value_type=choice']
  unit text [note: 'lbs, minutes, etc.']
  closes_at timestamptz
  resolved_at timestamptz [note: 'prediction only']
  actual_value jsonb [note: 'prediction only']
  response_count int [not null, default: 0]
  created_at timestamptz [not null]
}

Table responses {
  id uuid [pk]
  prompt_id uuid [not null, ref: > prompts.id]
  user_id uuid [not null, ref: > users.id]
  value jsonb [not null, note: 'shape depends on prompts.value_type']
  created_at timestamptz [not null]
  updated_at timestamptz [not null]

  Indexes {
    (prompt_id, user_id) [unique]
  }
}

// ============================================================
// Notifications
// ============================================================

Table notifications {
  id uuid [pk]
  recipient_user_id uuid [not null, ref: > users.id]
  event_id uuid [not null, ref: > events.id]
  actor_user_id uuid [ref: > users.id]
  type notification_type [not null]
  payload jsonb [not null, note: 'deep-link payload']
  read_at timestamptz
  created_at timestamptz [not null]

  Indexes {
    (recipient_user_id, read_at, created_at)
  }
}

// ============================================================
// Exports (not now — placeholder for v2)
// ============================================================

Table event_exports {
  id uuid [pk]
  event_id uuid [not null, ref: > events.id]
  requested_by_user_id uuid [not null, ref: > users.id]
  status text [not null]
  file_url text
  created_at timestamptz [not null]
  completed_at timestamptz
}