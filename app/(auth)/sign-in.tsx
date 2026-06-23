import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/AuthProvider";

export default function SignIn() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("alice@example.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setBusy(true);
    setError(null);
    const { error } = await signIn(email, password);
    if (error) setError(error);
    setBusy(false);
    // success -> RootNavigator redirects automatically
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <KeyboardAvoidingView
        className="flex-1 justify-center px-6"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Text className="text-3xl font-bold text-text">Welcome back</Text>
        <Text className="mt-1 text-muted">
          Sign in to your shared events.
        </Text>

        <View className="mt-8 gap-3">
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="email"
            placeholderTextColor="#9a9aae"
            className="rounded-xl border border-border bg-surface px-4 py-3 text-text"
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="password"
            placeholderTextColor="#9a9aae"
            className="rounded-xl border border-border bg-surface px-4 py-3 text-text"
          />
        </View>

        {error && <Text className="mt-3 text-sm text-danger">{error}</Text>}

        <Pressable
          disabled={busy}
          onPress={onSubmit}
          className={`mt-6 items-center rounded-xl py-3.5 ${
            busy ? "bg-surface2" : "bg-accent"
          }`}
        >
          <Text className="font-semibold text-white">
            {busy ? "Signing in…" : "Sign in"}
          </Text>
        </Pressable>

        <View className="mt-8 rounded-xl border border-border bg-surface p-3">
          <Text className="text-xs text-muted">
            Local seed users (password: password123):
          </Text>
          <Text className="mt-1 text-xs text-text">
            alice@example.com · bob@example.com · charlie@example.com
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
