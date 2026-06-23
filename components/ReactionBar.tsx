import { View, Text, Pressable } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { toggleReaction } from "@/lib/queries";
import type { ReactionRow } from "@/lib/types";

const PALETTE = ["❤️", "🎉", "😮", "👏"];

export function ReactionBar({
  eventId,
  targetId,
  authorUserId,
  userId,
  reactions,
}: {
  eventId: string;
  targetId: string;
  authorUserId: string;
  userId: string;
  /** Reactions already filtered to this target. */
  reactions: ReactionRow[];
}) {
  const qc = useQueryClient();

  const onPress = async (emoji: string) => {
    const existing = reactions.find(
      (r) => r.user_id === userId && r.reaction_type === emoji
    );
    try {
      await toggleReaction({
        eventId,
        targetId,
        authorUserId,
        userId,
        reactionType: emoji,
        existing,
      });
    } finally {
      qc.invalidateQueries({ queryKey: ["reactions", eventId] });
    }
  };

  return (
    <View className="mt-3 flex-row flex-wrap gap-2">
      {PALETTE.map((emoji) => {
        const count = reactions.filter((r) => r.reaction_type === emoji).length;
        const mine = reactions.some(
          (r) => r.user_id === userId && r.reaction_type === emoji
        );
        return (
          <Pressable
            key={emoji}
            onPress={() => onPress(emoji)}
            className={`flex-row items-center rounded-full border px-2.5 py-1 ${
              mine ? "border-accent bg-accent/20" : "border-border bg-surface2"
            }`}
          >
            <Text className="text-sm">{emoji}</Text>
            {count > 0 && (
              <Text
                className={`ml-1 text-xs ${mine ? "text-accent" : "text-muted"}`}
              >
                {count}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
