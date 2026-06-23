import { useState } from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { castVote, usePredictionResponses } from "@/lib/queries";
import type { UpdateRow } from "@/lib/types";

export function PredictionCard({
  update,
  eventId,
  userId,
  onVoted,
}: {
  update: UpdateRow;
  eventId: string;
  userId: string;
  onVoted?: () => void;
}) {
  const qc = useQueryClient();
  const { data: responses = [] } = usePredictionResponses(update.id);
  const [guess, setGuess] = useState("");

  const resolved = !!update.prediction_resolved_at;
  const myVote = responses.find((r) => r.user_id === userId)?.value;
  const total = responses.length;

  const submit = async (value: unknown) => {
    try {
      await castVote({
        eventId,
        updateId: update.id,
        authorUserId: update.author_user_id,
        userId,
        value,
      });
      onVoted?.();
    } finally {
      qc.invalidateQueries({ queryKey: ["responses", update.id] });
    }
  };

  const answerStr = JSON.stringify(update.prediction_answer);

  return (
    <View className="mt-1">
      {update.title && (
        <Text className="text-base font-semibold text-text">{update.title}</Text>
      )}
      {update.body_text && (
        <Text className="mt-1 text-sm text-muted">{update.body_text}</Text>
      )}

      {update.response_type === "multiple_choice" && (
        <View className="mt-3 gap-2">
          {(update.value_set ?? []).map((choice) => {
            const votes = responses.filter(
              (r) => JSON.stringify(r.value) === JSON.stringify(choice)
            ).length;
            const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
            const mine = JSON.stringify(myVote) === JSON.stringify(choice);
            const correct = resolved && answerStr === JSON.stringify(choice);
            return (
              <Pressable
                key={choice}
                disabled={resolved}
                onPress={() => submit(choice)}
                className={`overflow-hidden rounded-xl border ${
                  correct
                    ? "border-accent2"
                    : mine
                      ? "border-accent"
                      : "border-border"
                }`}
              >
                {/* tally fill */}
                <View
                  className={`absolute bottom-0 left-0 top-0 ${
                    correct ? "bg-accent2/20" : "bg-accent/15"
                  }`}
                  style={{ width: `${pct}%` }}
                />
                <View className="flex-row items-center justify-between px-3 py-2.5">
                  <Text className="text-sm font-medium text-text">
                    {choice}
                    {correct ? "  ✓" : ""}
                    {mine && !correct ? "  •" : ""}
                  </Text>
                  <Text className="text-xs text-muted">
                    {votes} · {pct}%
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {update.response_type === "free_response" && (
        <View className="mt-3">
          {resolved ? null : (
            <View className="flex-row gap-2">
              <TextInput
                value={guess}
                onChangeText={setGuess}
                placeholder={myVote ? `Your guess: ${myVote}` : "Your guess…"}
                placeholderTextColor="#9a9aae"
                className="flex-1 rounded-xl border border-border bg-surface2 px-3 py-2 text-text"
              />
              <Pressable
                disabled={!guess.trim()}
                onPress={() => {
                  submit(guess.trim());
                  setGuess("");
                }}
                className={`items-center justify-center rounded-xl px-4 ${
                  guess.trim() ? "bg-accent" : "bg-surface2"
                }`}
              >
                <Text className="font-semibold text-white">Guess</Text>
              </Pressable>
            </View>
          )}
          <Text className="mt-2 text-xs text-muted">
            {total} {total === 1 ? "guess" : "guesses"} so far
          </Text>
        </View>
      )}

      {resolved && (
        <View className="mt-3 self-start rounded-full bg-accent2/20 px-2.5 py-1">
          <Text className="text-xs font-semibold text-accent2">
            Resolved: {String(update.prediction_answer).replace(/"/g, "")}
          </Text>
        </View>
      )}
    </View>
  );
}
