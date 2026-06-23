import { View, Text, Switch, Pressable } from "react-native";
import { useAuth } from "@/lib/AuthProvider";
import { initials } from "@/lib/format";

export default function Profile() {
  const { profile, visibility, setVisibility, signOut } = useAuth();

  return (
    <View className="flex-1 bg-bg p-4">
      <View className="items-center py-6">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-accent">
          <Text className="text-2xl font-bold text-white">
            {initials(profile?.name)}
          </Text>
        </View>
        <Text className="mt-3 text-xl font-bold text-text">
          {profile?.name ?? "—"}
        </Text>
        <Text className="text-sm text-muted">{profile?.email ?? ""}</Text>
      </View>

      {/* Presence consent */}
      <View className="mt-4 rounded-2xl border border-border bg-surface p-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-4">
            <Text className="text-base font-semibold text-text">
              Show my presence
            </Text>
            <Text className="mt-0.5 text-xs text-muted">
              When off (lurk mode), you can still read everything, but others
              won’t see that you’re here or what you’re doing.
            </Text>
          </View>
          <Switch
            value={visibility === "visible"}
            onValueChange={(on) => setVisibility(on ? "visible" : "lurk")}
            trackColor={{ true: "#7c5cff", false: "#2a2a36" }}
          />
        </View>
      </View>

      <Pressable
        onPress={signOut}
        className="mt-auto items-center rounded-xl border border-border bg-surface py-3.5"
      >
        <Text className="font-semibold text-danger">Sign out</Text>
      </Pressable>
    </View>
  );
}
