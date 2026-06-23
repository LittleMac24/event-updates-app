import { View, Text, FlatList } from "react-native";
import { useAuth } from "@/lib/AuthProvider";
import { useNotifications } from "@/lib/queries";
import { timeAgo } from "@/lib/format";

export default function Notifications() {
  const { profile } = useAuth();
  const { data: items } = useNotifications(profile?.id);

  return (
    <View className="flex-1 bg-bg">
      <FlatList
        contentContainerClassName="p-4"
        data={items ?? []}
        keyExtractor={(n) => n.id}
        ListEmptyComponent={
          <Text className="mt-12 text-center text-muted">
            You’re all caught up.
          </Text>
        }
        renderItem={({ item }) => (
          <View className="mb-2 rounded-xl border border-border bg-surface p-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-semibold uppercase text-accent">
                {item.type}
              </Text>
              <Text className="text-xs text-muted">
                {timeAgo(item.created_at)}
              </Text>
            </View>
            <Text className="mt-1 text-sm text-text">
              {(item.payload?.message as string) ?? JSON.stringify(item.payload)}
            </Text>
          </View>
        )}
      />
    </View>
  );
}
