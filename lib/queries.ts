import { useEffect } from "react";
import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { supabase } from "./supabase";
import { logInteraction } from "./interactions";
import type {
  EventRow,
  NotificationRow,
  PromptResponseRow,
  ReactionRow,
  UpdateRow,
} from "./types";

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export function useMyEvents(userId: string | undefined) {
  return useQuery({
    queryKey: ["my-events", userId],
    enabled: !!userId,
    queryFn: async (): Promise<EventRow[]> => {
      const { data, error } = await supabase
        .from("event_members")
        .select("events(*)")
        .eq("user_id", userId!)
        .eq("status", "active");
      if (error) throw error;
      return (data ?? [])
        .map((row: any) => row.events)
        .filter(Boolean) as EventRow[];
    },
  });
}

export function useEvent(eventId: string | undefined) {
  return useQuery({
    queryKey: ["event", eventId],
    enabled: !!eventId,
    queryFn: async (): Promise<EventRow> => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId!)
        .single();
      if (error) throw error;
      return data as EventRow;
    },
  });
}

/** Live event feed: fetch active updates + subscribe to inserts/updates. */
export function useEventFeed(eventId: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["updates", eventId],
    enabled: !!eventId,
    queryFn: async (): Promise<UpdateRow[]> => {
      const { data, error } = await supabase
        .from("updates")
        .select("*, author:users!author_user_id(name)")
        .eq("event_id", eventId!)
        .is("deleted_at", null)
        .order("pinned", { ascending: false })
        .order("posted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as UpdateRow[];
    },
  });

  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`feed:${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "updates",
          filter: `event_id=eq.${eventId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["updates", eventId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, qc]);

  return query;
}

/** Live reactions for the whole event (counters aren't trigger-maintained yet). */
export function useEventReactions(eventId: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["reactions", eventId],
    enabled: !!eventId,
    queryFn: async (): Promise<ReactionRow[]> => {
      const { data, error } = await supabase
        .from("reactions")
        .select("*")
        .eq("event_id", eventId!);
      if (error) throw error;
      return (data ?? []) as ReactionRow[];
    },
  });

  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`reactions:${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reactions",
          filter: `event_id=eq.${eventId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["reactions", eventId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, qc]);

  return query;
}

/** Live responses for a single prediction/poll update. */
export function usePredictionResponses(updateId: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["responses", updateId],
    enabled: !!updateId,
    queryFn: async (): Promise<PromptResponseRow[]> => {
      const { data, error } = await supabase
        .from("prompt_responses")
        .select("*")
        .eq("update_id", updateId!);
      if (error) throw error;
      return (data ?? []) as PromptResponseRow[];
    },
  });

  useEffect(() => {
    if (!updateId) return;
    const channel = supabase
      .channel(`responses:${updateId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "prompt_responses",
          filter: `update_id=eq.${updateId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["responses", updateId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [updateId, qc]);

  return query;
}

export function useNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("recipient_user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
  });
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

export async function postTextUpdate(params: {
  eventId: string;
  authorUserId: string;
  body: string;
}) {
  const { error } = await supabase.from("updates").insert({
    event_id: params.eventId,
    author_user_id: params.authorUserId,
    update_type: "text",
    body_text: params.body.trim(),
  });
  if (error) throw error;
}

/**
 * Toggle a reaction on an update. Adds it if absent, removes it if the
 * same (user, target, type) already exists. Logs the ledger edge on add.
 */
export async function toggleReaction(params: {
  eventId: string;
  targetId: string;
  authorUserId: string;
  userId: string;
  reactionType: string;
  existing?: ReactionRow;
}) {
  if (params.existing) {
    const { error } = await supabase
      .from("reactions")
      .delete()
      .eq("id", params.existing.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("reactions").insert({
    event_id: params.eventId,
    reaction_for: "update",
    target_id: params.targetId,
    user_id: params.userId,
    reaction_type: params.reactionType,
  });
  if (error) throw error;
  await logInteraction({
    eventId: params.eventId,
    actorUserId: params.userId,
    targetUserId: params.authorUserId,
    subjectType: "update",
    subjectId: params.targetId,
    verb: "reacted",
    metadata: { reaction_type: params.reactionType },
  });
}

/** Cast / change a vote on a prediction (one row per user via upsert). */
export async function castVote(params: {
  eventId: string;
  updateId: string;
  authorUserId: string;
  userId: string;
  value: unknown;
}) {
  const { error } = await supabase.from("prompt_responses").upsert(
    {
      update_id: params.updateId,
      user_id: params.userId,
      value: params.value,
    },
    { onConflict: "update_id,user_id" }
  );
  if (error) throw error;
  await logInteraction({
    eventId: params.eventId,
    actorUserId: params.userId,
    targetUserId: params.authorUserId,
    subjectType: "prediction",
    subjectId: params.updateId,
    verb: "voted",
    metadata: { value: params.value },
  });
}

/* ------------------------------------------------------------------ */
/* Recap (size-aware, celebratory — no rankings at small N)            */
/* ------------------------------------------------------------------ */

export type RecapMember = { id: string; name: string; joined_at: string | null };
export type PredictionOutcome = {
  title: string;
  answer: unknown;
  winners: string[];
  totalVotes: number;
};
export type Recap = {
  eventName: string;
  memberCount: number;
  updateCount: number;
  firstUpdateAt: string | null;
  lastUpdateAt: string | null;
  topContributor: { name: string; count: number } | null;
  members: RecapMember[];
  predictions: PredictionOutcome[];
};

export function useRecap(eventId: string | undefined) {
  return useQuery({
    queryKey: ["recap", eventId],
    enabled: !!eventId,
    queryFn: (): Promise<Recap> => fetchRecap(eventId!),
  });
}

async function fetchRecap(eventId: string): Promise<Recap> {
  const [eventRes, membersRes, updatesRes, interactionsRes] = await Promise.all([
    supabase.from("events").select("name").eq("id", eventId).single(),
    supabase
      .from("event_members")
      .select("user_id, joined_at, user:users!user_id(name)")
      .eq("event_id", eventId)
      .eq("status", "active"),
    supabase
      .from("updates")
      .select(
        "id, author_user_id, update_type, title, posted_at, prediction_answer, prediction_resolved_at, author:users!author_user_id(name)"
      )
      .eq("event_id", eventId)
      .is("deleted_at", null),
    supabase
      .from("interactions")
      .select("actor_user_id")
      .eq("event_id", eventId),
  ]);

  const members: RecapMember[] = (membersRes.data ?? []).map((m: any) => ({
    id: m.user_id,
    name: m.user?.name ?? "Someone",
    joined_at: m.joined_at,
  }));

  const updates = (updatesRes.data ?? []) as any[];
  const times = updates
    .map((u) => u.posted_at)
    .filter(Boolean)
    .sort();

  // Most active = most interactions logged (falls back to most updates posted).
  const counts = new Map<string, number>();
  for (const row of interactionsRes.data ?? []) {
    const id = (row as any).actor_user_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  if (counts.size === 0) {
    for (const u of updates) {
      counts.set(u.author_user_id, (counts.get(u.author_user_id) ?? 0) + 1);
    }
  }
  let topContributor: Recap["topContributor"] = null;
  for (const [id, count] of counts) {
    if (!topContributor || count > topContributor.count) {
      const name = members.find((m) => m.id === id)?.name ?? "Someone";
      topContributor = { name, count };
    }
  }

  // Resolved predictions -> winners (responses whose value equals the answer).
  const resolved = updates.filter(
    (u) => u.update_type === "prediction" && u.prediction_resolved_at
  );
  const predictions: PredictionOutcome[] = [];
  for (const pred of resolved) {
    const { data: resp } = await supabase
      .from("prompt_responses")
      .select("user_id, value")
      .eq("update_id", pred.id);
    const answer = JSON.stringify(pred.prediction_answer);
    const winnerIds = (resp ?? [])
      .filter((r: any) => JSON.stringify(r.value) === answer)
      .map((r: any) => r.user_id);
    predictions.push({
      title: pred.title ?? "Prediction",
      answer: pred.prediction_answer,
      winners: winnerIds.map(
        (id: string) => members.find((m) => m.id === id)?.name ?? "Someone"
      ),
      totalVotes: (resp ?? []).length,
    });
  }

  return {
    eventName: (eventRes.data as any)?.name ?? "Event",
    memberCount: members.length,
    updateCount: updates.length,
    firstUpdateAt: times[0] ?? null,
    lastUpdateAt: times[times.length - 1] ?? null,
    topContributor,
    members,
    predictions,
  };
}

/** Re-export so screens can invalidate after writes if needed. */
export type { QueryClient };
