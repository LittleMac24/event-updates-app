import { Stack } from "expo-router";

export default function EventLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#0b0b0f" },
        headerTintColor: "#ececf1",
        headerShadowVisible: false,
        contentStyle: { backgroundColor: "#0b0b0f" },
      }}
    >
      <Stack.Screen name="index" options={{ title: "" }} />
      <Stack.Screen name="recap" options={{ title: "Recap", presentation: "modal" }} />
    </Stack>
  );
}
