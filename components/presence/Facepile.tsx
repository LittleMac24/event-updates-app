import { View, Text } from "react-native";
import type { OnlineMember } from "@/lib/presence";
import { initials } from "@/lib/format";

const MAX = 5;

export function Facepile({ members }: { members: OnlineMember[] }) {
  const shown = members.slice(0, MAX);
  const extra = members.length - shown.length;

  return (
    <View className="flex-row items-center">
      <View className="flex-row">
        {shown.map((m, i) => (
          <View
            key={m.id}
            style={{ marginLeft: i === 0 ? 0 : -8 }}
            className="h-7 w-7 items-center justify-center rounded-full border border-bg bg-accent"
          >
            <Text className="text-[10px] font-bold text-white">
              {initials(m.name)}
            </Text>
          </View>
        ))}
        {extra > 0 && (
          <View
            style={{ marginLeft: -8 }}
            className="h-7 w-7 items-center justify-center rounded-full border border-bg bg-surface2"
          >
            <Text className="text-[10px] font-semibold text-muted">+{extra}</Text>
          </View>
        )}
      </View>
      <Text className="ml-2 text-xs text-muted">
        {members.length === 0
          ? "no one online"
          : `${members.length} online`}
      </Text>
    </View>
  );
}
