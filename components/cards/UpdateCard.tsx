import { useEffect } from "react";
import { View, Text } from "react-native";
import type { ReactionRow, UpdateRow } from "@/lib/types";
import { timeAgo, initials } from "@/lib/format";
import { ReactionBar } from "@/components/ReactionBar";
import { PredictionCard } from "@/components/cards/PredictionCard";

export function UpdateCard({
  update,
  eventId,
  userId,
  reactions,
  onView,
  onVoted,
}: {
  update: UpdateRow;
  eventId: string;
  userId: string;
  /** All event reactions; filtered to this card internally. */
  reactions: ReactionRow[];
  onView?: (updateId: string, authorId: string) => void;
  onVoted?: () => void;
}) {
  // Author -> Viewer signal (batched upstream).
  useEffect(() => {
    onView?.(update.id, update.author_user_id);
  }, [update.id]);

  const mine = reactions.filter(
    (r) => r.reaction_for === "update" && r.target_id === update.id
  );
  const isPrompt =
    update.update_type === "prediction" || update.update_type === "poll";

  return (
    <View className="mb-3 rounded-2xl border border-border bg-surface p-4">
      {/* header */}
      <View className="mb-2 flex-row items-center">
        <View className="h-8 w-8 items-center justify-center rounded-full bg-surface2">
          <Text className="text-xs font-bold text-text">
            {initials(update.author?.name)}
          </Text>
        </View>
        <Text className="ml-2 text-sm font-semibold text-text">
          {update.author?.name ?? "Someone"}
        </Text>
        <Text className="ml-2 text-xs text-muted">
          · {timeAgo(update.posted_at)}
        </Text>
        {update.pinned && (
          <Text className="ml-auto text-xs text-accent">📌 pinned</Text>
        )}
      </View>

      {/* body */}
      {update.update_type === "text" && (
        <Text className="text-[15px] leading-5 text-text">
          {update.body_text}
        </Text>
      )}

      {(update.update_type === "photo" ||
        update.update_type === "video" ||
        update.update_type === "voice") && (
        <View>
          <View className="aspect-[4/3] items-center justify-center rounded-xl bg-surface2">
            <Text className="text-3xl">
              {update.update_type === "photo"
                ? "🖼️"
                : update.update_type === "video"
                  ? "🎬"
                  : "🎙️"}
            </Text>
            <Text className="mt-1 text-xs text-muted">
              {update.update_type} · media preview
            </Text>
          </View>
          {update.body_text && (
            <Text className="mt-2 text-[15px] leading-5 text-text">
              {update.body_text}
            </Text>
          )}
        </View>
      )}

      {isPrompt && (
        <PredictionCard
          update={update}
          eventId={eventId}
          userId={userId}
          onVoted={onVoted}
        />
      )}

      {/* reactions */}
      <ReactionBar
        eventId={eventId}
        targetId={update.id}
        authorUserId={update.author_user_id}
        userId={userId}
        reactions={mine}
      />
    </View>
  );
}
