import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { UserRow } from "./types";

export type PresenceVisibility = "visible" | "lurk";

type AuthState = {
  session: Session | null;
  profile: UserRow | null;
  loading: boolean;
  /** Consent-first presence: "lurk" joins channels without broadcasting you. */
  visibility: PresenceVisibility;
  setVisibility: (v: PresenceVisibility) => void;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  session: null,
  profile: null,
  loading: true,
  visibility: "visible",
  setVisibility: () => {},
  signIn: async () => ({}),
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const VISIBILITY_KEY = "presence_visibility";

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibility, setVisibilityState] =
    useState<PresenceVisibility>("visible");

  // Bootstrap session + persisted presence preference.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) =>
      setSession(next)
    );
    AsyncStorage.getItem(VISIBILITY_KEY).then((v) => {
      if (v === "visible" || v === "lurk") setVisibilityState(v);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load the public.users profile whenever the session changes.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!session?.user) {
        setProfile(null);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("users")
        .select("id, name, email, status, avatar_bucket, avatar_path")
        .eq("id", session.user.id)
        .single();
      if (active) {
        setProfile((data as UserRow) ?? null);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [session]);

  const setVisibility = (v: PresenceVisibility) => {
    setVisibilityState(v);
    AsyncStorage.setItem(VISIBILITY_KEY, v);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return { error: error?.message };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        visibility,
        setVisibility,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
