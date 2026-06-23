import { View, Text } from "react-native";
import { joinNames } from "@/lib/format";

/**
 * Subtle, contextual presence line. Renders nothing when quiet so it never
 * nags. Awareness, not interruption.
 */
export function PresenceLine({
  typingNames,
  votingNames,
}: {
  typingNames: string[];
  votingNames: string[];
}) {
  const parts: string[] = [];
  if (typingNames.length > 0) {
    const verb = typingNames.length === 1 ? "is typing" : "are typing";
    parts.push(`${joinNames(typingNames)} ${verb}…`);
  }
  if (votingNames.length > 0) {
    const verb = votingNames.length === 1 ? "just voted" : "just voted";
    parts.push(`${joinNames(votingNames)} ${verb}`);
  }

  if (parts.length === 0) return <View className="h-4" />;

  return (
    <View className="h-4 justify-center">
      <Text className="text-xs italic text-accent" numberOfLines={1}>
        {parts.join("  ·  ")}
      </Text>
    </View>
  );
}
