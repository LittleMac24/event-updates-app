import { ScrollView, View, Text, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useRecap } from "@/lib/queries";
import { timeAgo, joinNames } from "@/lib/format";

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <View className="flex-1 items-center rounded-2xl border border-border bg-surface py-4">
      <Text className="text-2xl font-bold text-text">{value}</Text>
      <Text className="mt-1 text-xs text-muted">{label}</Text>
    </View>
  );
}

export default function Recap() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: recap, isLoading } = useRecap(id);

  if (isLoading || !recap) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color="#7c5cff" />
      </View>
    );
  }

  // Intimate events get a celebratory, non-ranking recap.
  const intimate = recap.memberCount <= 20;

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerClassName="p-4">
      <Text className="text-2xl font-bold text-text">{recap.eventName}</Text>
      <Text className="mt-1 text-muted">The story so far ✨</Text>

      <View className="mt-4 flex-row gap-3">
        <Stat value={recap.memberCount} label="members" />
        <Stat value={recap.updateCount} label="moments" />
        <Stat value={recap.predictions.length} label="resolved" />
      </View>

      {recap.topContributor && (
        <View className="mt-3 rounded-2xl border border-border bg-surface p-4">
          <Text className="text-xs uppercase text-muted">
            {intimate ? "Showed up the most" : "Most active"}
          </Text>
          <Text className="mt-1 text-lg font-semibold text-text">
            {recap.topContributor.name} 🎈
          </Text>
        </View>
      )}

      {(recap.firstUpdateAt || recap.lastUpdateAt) && (
        <View className="mt-3 rounded-2xl border border-border bg-surface p-4">
          <Text className="text-xs uppercase text-muted">Timeline</Text>
          <Text className="mt-1 text-sm text-text">
            First moment {timeAgo(recap.firstUpdateAt)} ago · latest{" "}
            {timeAgo(recap.lastUpdateAt)} ago
          </Text>
        </View>
      )}

      {recap.predictions.length > 0 && (
        <View className="mt-3">
          <Text className="mb-2 text-xs uppercase text-muted">
            Prediction outcomes
          </Text>
          {recap.predictions.map((p, i) => (
            <View
              key={i}
              className="mb-2 rounded-2xl border border-border bg-surface p-4"
            >
              <Text className="text-base font-semibold text-text">
                {p.title}
              </Text>
              <Text className="mt-1 text-sm text-accent2">
                Answer: {String(p.answer).replace(/"/g, "")}
              </Text>
              <Text className="mt-1 text-sm text-text">
                {p.winners.length > 0
                  ? `🏆 ${joinNames(p.winners)} called it`
                  : "No one guessed it!"}
              </Text>
              <Text className="mt-0.5 text-xs text-muted">
                {p.totalVotes} {p.totalVotes === 1 ? "vote" : "votes"}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View className="mt-3 rounded-2xl border border-border bg-surface p-4">
        <Text className="mb-2 text-xs uppercase text-muted">Who was here</Text>
        {recap.members.map((m) => (
          <Text key={m.id} className="py-0.5 text-sm text-text">
            {m.name}
          </Text>
        ))}
      </View>

      <Text className="mt-6 text-center text-xs text-muted">
        Full network analytics &amp; AI story export come later — this recap is
        the celebratory, no-rankings view for intimate events.
      </Text>
    </ScrollView>
  );
}
