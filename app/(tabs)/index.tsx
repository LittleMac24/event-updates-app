import { View, Text, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/AuthProvider";
import { useMyEvents } from "@/lib/queries";
import { initials } from "@/lib/format";

const EVENT_EMOJI: Record<string, string> = {
  birth: "👶",
  wedding: "💍",
  hospital: "🏥",
  trip: "✈️",
  other: "✨",
};

export default function Spaces() {
  const { profile } = useAuth();
  const router = useRouter();
  const { data: events, isLoading } = useMyEvents(profile?.id);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color="#7c5cff" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      <FlatList
        contentContainerClassName="p-4"
        data={events ?? []}
        keyExtractor={(e) => e.id}
        ListEmptyComponent={
          <Text className="mt-12 text-center text-muted">
            No spaces yet. Seeded data lives in the “Baby Whitfield” event.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/event/${item.id}`)}
            className="mb-3 flex-row items-center rounded-2xl border border-border bg-surface p-4"
          >
            <View className="h-12 w-12 items-center justify-center rounded-xl bg-surface2">
              <Text className="text-2xl">
                {EVENT_EMOJI[item.event_type] ?? "✨"}
              </Text>
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-base font-semibold text-text">
                {item.name}
              </Text>
              {item.description && (
                <Text className="mt-0.5 text-xs text-muted" numberOfLines={1}>
                  {item.description}
                </Text>
              )}
            </View>
            <View
              className={`rounded-full px-2 py-1 ${
                item.status === "active" ? "bg-accent2/20" : "bg-surface2"
              }`}
            >
              <Text
                className={`text-[10px] font-semibold ${
                  item.status === "active" ? "text-accent2" : "text-muted"
                }`}
              >
                {item.status}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
