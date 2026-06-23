import { supabase } from "./supabase";

// Verbs mirror the `interaction_verb` enum in the ledger migration.
export type InteractionVerb =
  | "viewed"
  | "reacted"
  | "commented"
  | "replied"
  | "mentioned"
  | "voted"
  | "joined"
  | "pinned"
  | "profile_viewed";

export type SubjectType = "update" | "comment" | "prediction" | "member";

export type InteractionInput = {
  eventId: string;
  actorUserId: string;
  /** The user on the other end of the edge (e.g. content author). */
  targetUserId?: string | null;
  subjectType: SubjectType;
  subjectId?: string | null;
  verb: InteractionVerb;
  weight?: number;
  metadata?: Record<string, unknown>;
};

/**
 * Write a single meaningful interaction to the ledger. Fire-and-forget:
 * a failed log must never break the user action, so errors are swallowed
 * (and surfaced in dev).
 */
export async function logInteraction(input: InteractionInput): Promise<void> {
  const { error } = await supabase.from("interactions").insert({
    event_id: input.eventId,
    actor_user_id: input.actorUserId,
    target_user_id: input.targetUserId ?? null,
    subject_type: input.subjectType,
    subject_id: input.subjectId ?? null,
    verb: input.verb,
    weight: input.weight ?? 1,
    metadata: input.metadata ?? null,
  });
  if (error && __DEV__) {
    console.warn("logInteraction failed:", error.message);
  }
}

/**
 * "viewed" is firehose-volume, so it is batched on the client and flushed
 * periodically / on demand rather than written per render. One ViewBatcher
 * is created per open event.
 */
export class ViewBatcher {
  private seen = new Map<string, { authorId: string | null }>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private eventId: string,
    private actorUserId: string,
    private flushMs = 5000
  ) {}

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => void this.flush(), this.flushMs);
  }

  /** Record a view once per subject per session window. */
  record(subjectId: string, authorId: string | null) {
    if (authorId === this.actorUserId) return; // don't log viewing your own post
    if (this.seen.has(subjectId)) return;
    this.seen.set(subjectId, { authorId });
  }

  async flush() {
    if (this.seen.size === 0) return;
    const rows = Array.from(this.seen.entries()).map(([subjectId, meta]) => ({
      event_id: this.eventId,
      actor_user_id: this.actorUserId,
      target_user_id: meta.authorId,
      subject_type: "update",
      subject_id: subjectId,
      verb: "viewed",
      weight: 1,
    }));
    this.seen.clear();
    const { error } = await supabase.from("interactions").insert(rows);
    if (error && __DEV__) console.warn("ViewBatcher flush failed:", error.message);
  }

  async stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.flush();
  }
}
