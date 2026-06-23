import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { PresenceVisibility } from "./AuthProvider";

export type OnlineMember = { id: string; name: string };

type Me = { id: string; name: string } | null;

const EPHEMERAL_MS = 3000;

/**
 * Figma-style ambient presence for a single event, built on Supabase
 * Realtime Presence (who's here) + Broadcast (ephemeral "typing/voted").
 *
 * Mobile + consent rules:
 *  - "lurk" visibility joins the channel but never `track()`s you.
 *  - Ephemeral signals auto-decay; nothing is persisted.
 *  - The caller is responsible for mounting this only while the event
 *    screen is focused (foreground-only presence).
 */
export function useEventPresence(
  eventId: string | undefined,
  me: Me,
  visibility: PresenceVisibility
) {
  const [online, setOnline] = useState<OnlineMember[]>([]);
  const [typing, setTyping] = useState<Record<string, string>>({});
  const [voting, setVoting] = useState<Record<string, string>>({});
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Subscribe once per (event, me).
  useEffect(() => {
    if (!eventId || !me) return;

    const channel = supabase.channel(`presence:${eventId}`, {
      config: { presence: { key: me.id } },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<{ id: string; name: string }>();
      const seen = new Map<string, OnlineMember>();
      Object.values(state)
        .flat()
        .forEach((p) => seen.set(p.id, { id: p.id, name: p.name }));
      setOnline(Array.from(seen.values()));
    });

    const flash = (
      setter: React.Dispatch<React.SetStateAction<Record<string, string>>>,
      id: string,
      name: string
    ) => {
      setter((prev) => ({ ...prev, [id]: name }));
      setTimeout(() => {
        setter((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }, EPHEMERAL_MS);
    };

    channel.on("broadcast", { event: "typing" }, ({ payload }) => {
      if (payload?.id && payload.id !== me.id) flash(setTyping, payload.id, payload.name);
    });
    channel.on("broadcast", { event: "voted" }, ({ payload }) => {
      if (payload?.id && payload.id !== me.id) flash(setVoting, payload.id, payload.name);
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED" && visibility === "visible") {
        await channel.track({ id: me.id, name: me.name });
      }
    });

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // visibility handled in the effect below to avoid resubscribe churn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, me?.id]);

  // React to visibility toggles without tearing down the channel.
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !me) return;
    if (visibility === "visible") {
      channel.track({ id: me.id, name: me.name });
    } else {
      channel.untrack();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibility]);

  const sendTyping = () => {
    if (!me || visibility !== "visible") return;
    channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { id: me.id, name: me.name },
    });
  };

  const sendVoted = () => {
    if (!me || visibility !== "visible") return;
    channelRef.current?.send({
      type: "broadcast",
      event: "voted",
      payload: { id: me.id, name: me.name },
    });
  };

  return {
    online,
    typingNames: Object.values(typing),
    votingNames: Object.values(voting),
    sendTyping,
    sendVoted,
  };
}
