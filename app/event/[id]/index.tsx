import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/AuthProvider";
import {
  useEvent,
  useEventFeed,
  useEventReactions,
  postTextUpdate,
} from "@/lib/queries";
import { useEventPresence } from "@/lib/presence";
import { ViewBatcher } from "@/lib/interactions";
import { Facepile } from "@/components/presence/Facepile";
import { PresenceLine } from "@/components/presence/PresenceLine";
import { UpdateCard } from "@/components/cards/UpdateCard";
import type { UpdateRow } from "@/lib/types";

type Lens = "overview" | "predictions" | "discussions";
const LENSES: { key: Lens; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "predictions", label: "Predictions" },
  { key: "discussions", label: "Discussions" },
];

export default function EventSpace() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = id!;
  const router = useRouter();
  const qc = useQueryClient();
  const { profile, visibility } = useAuth();

  const { data: event } = useEvent(eventId);
  const { data: updates = [], isLoading } = useEventFeed(eventId);
  const { data: reactions = [] } = useEventReactions(eventId);

  const me = useMemo(
    () => (profile ? { id: profile.id, name: profile.name } : null),
    [profile?.id, profile?.name]
  );
  const { online, typingNames, votingNames, sendTyping, sendVoted } =
    useEventPresence(eventId, me, visibility);

  const [lens, setLens] = useState<Lens>("overview");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  // Batched "viewed" interactions for this event session.
  const batcher = useRef<ViewBatcher | null>(null);
  useEffect(() => {
    if (!profile) return;
    const b = new ViewBatcher(eventId, profile.id);
    b.start();
    batcher.current = b;
    return () => {
      void b.stop();
      batcher.current = null;
    };
  }, [eventId, profile?.id]);

  // Throttle typing broadcasts.
  const lastTyping = useRef(0);
  const onChangeDraft = (text: string) => {
    setDraft(text);
    const now = Date.now();
    if (now - lastTyping.current > 1500) {
      lastTyping.current = now;
      sendTyping();
    }
  };

  const send = async () => {
    if (!draft.trim() || !profile) return;
    setSending(true);
    try {
      await postTextUpdate({
        eventId,
        authorUserId: profile.id,
        body: draft,
      });
      setDraft("");
      qc.invalidateQueries({ queryKey: ["updates", eventId] });
    } finally {
      setSending(false);
    }
  };

  const filtered = useMemo(() => {
    if (lens === "predictions")
      return updates.filter(
        (u) => u.update_type === "prediction" || u.update_type === "poll"
      );
    if (lens === "discussions")
      return updates.filter((u) => u.update_type === "text");
    return updates;
  }, [updates, lens]);

  const isOwner = !!profile && event?.created_by_user_id === profile.id;

  const renderItem = ({ item }: { item: UpdateRow }) => (
    <UpdateCard
      update={item}
      eventId={eventId}
      userId={profile!.id}
      reactions={reactions}
      onView={(uid, author) => batcher.current?.record(uid, author)}
      onVoted={sendVoted}
    />
  );

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen
        options={{
          title: event?.name ?? "Event",
          headerRight: () =>
            isOwner ? (
              <Pressable onPress={() => router.push(`/event/${eventId}/recap`)}>
                <Ionicons name="sparkles-outline" size={20} color="#7c5cff" />
              </Pressable>
            ) : null,
        }}
      />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#7c5cff" />
          </View>
        ) : (
          <FlatList
            contentContainerClassName="px-4 pb-4"
            data={filtered}
            keyExtractor={(u) => u.id}
            renderItem={renderItem}
            ListHeaderComponent={
              <View className="pb-3 pt-1">
                {/* presence */}
                <View className="mb-2 flex-row items-center justify-between">
                  <Facepile members={online} />
                </View>
                <PresenceLine
                  typingNames={typingNames}
                  votingNames={votingNames}
                />
                {/* lens chips */}
                <View className="mt-2 flex-row gap-2">
                  {LENSES.map((l) => (
                    <Pressable
                      key={l.key}
                      onPress={() => setLens(l.key)}
                      className={`rounded-full border px-3 py-1.5 ${
                        lens === l.key
                          ? "border-accent bg-accent/20"
                          : "border-border bg-surface"
                      }`}
                    >
                      <Text
                        className={`text-xs font-medium ${
                          lens === l.key ? "text-accent" : "text-muted"
                        }`}
                      >
                        {l.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            }
            ListEmptyComponent={
              <Text className="mt-12 text-center text-muted">
                Nothing here yet.
              </Text>
            }
          />
        )}

        {/* compose */}
        <View className="flex-row items-end gap-2 border-t border-border bg-bg px-4 py-2">
          <TextInput
            value={draft}
            onChangeText={onChangeDraft}
            placeholder="Share an update…"
            placeholderTextColor="#9a9aae"
            multiline
            className="max-h-28 flex-1 rounded-2xl border border-border bg-surface px-4 py-2.5 text-text"
          />
          <Pressable
            disabled={!draft.trim() || sending}
            onPress={send}
            className={`h-10 w-10 items-center justify-center rounded-full ${
              draft.trim() && !sending ? "bg-accent" : "bg-surface2"
            }`}
          >
            <Ionicons name="arrow-up" size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
