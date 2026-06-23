// Hand-written row types matching supabase/migrations. Once the schema
// stabilizes, replace with `supabase gen types typescript`.

export type UpdateKind =
  | "text"
  | "photo"
  | "video"
  | "voice"
  | "poll"
  | "prediction";

export type ResponseType = "free_response" | "multiple_choice";

export type UserRow = {
  id: string;
  name: string;
  email: string | null;
  status: string;
  avatar_bucket: string | null;
  avatar_path: string | null;
};

export type EventRow = {
  id: string;
  name: string;
  description: string | null;
  event_type: string;
  status: string;
  visibility: string;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
  created_by_user_id: string;
  member_count: number;
  update_count: number;
};

export type UpdateRow = {
  id: string;
  event_id: string;
  author_user_id: string;
  update_type: UpdateKind;
  body_text: string | null;
  title: string | null;
  posted_at: string;
  pinned: boolean;
  storage_bucket: string | null;
  storage_path: string | null;
  thumbnail_path: string | null;
  mime_type: string | null;
  response_type: ResponseType | null;
  response_value: string | null;
  value_set: string[] | null;
  prediction_answer: unknown | null;
  prediction_resolved_at: string | null;
  closes_at: string | null;
  // joined
  author?: { name: string } | null;
};

export type ReactionRow = {
  id: string;
  event_id: string;
  reaction_for: "update" | "comment";
  target_id: string;
  user_id: string;
  reaction_type: string;
  created_at: string;
};

export type PromptResponseRow = {
  id: string;
  update_id: string;
  user_id: string;
  value: unknown;
  created_at: string;
};

export type NotificationRow = {
  id: string;
  recipient_user_id: string;
  event_id: string;
  actor_user_id: string | null;
  type: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};
