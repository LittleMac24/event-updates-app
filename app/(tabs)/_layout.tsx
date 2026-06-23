import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#0b0b0f" },
        headerTintColor: "#ececf1",
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: "#0b0b0f",
          borderTopColor: "#2a2a36",
        },
        tabBarActiveTintColor: "#7c5cff",
        tabBarInactiveTintColor: "#9a9aae",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Spaces",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="planet-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Notifications",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
