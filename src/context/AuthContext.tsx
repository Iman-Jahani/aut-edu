"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { UserProfile, UserRole } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  /** Convenience aliases over `profile`, kept for the many components that read these directly. */
  displayName: string;
  avatar: string;
  role: UserRole | null;
  email: string | null;
  ready: boolean;
  /** Signed in, but no row in user_profiles yet (fresh Google sign-in). */
  needsProfile: boolean;
  signUpWithEmail: (email: string, password: string, displayName: string, avatar: string, role: UserRole) => Promise<{ error: string | null }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  saveProfile: (name: string, avatar: string, role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadProfile(userId: string): Promise<UserProfile | null> {
  const { data } = await supabase.from("user_profiles").select("*").eq("user_id", userId).maybeSingle();
  return (data as UserProfile) || null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const settle = async (u: User | null) => {
      // Older deployments of this app auto-created anonymous sessions. Those have
      // no password and no email, so they can't really be "a teacher" or "a
      // student" account — treat them as logged out and send people through
      // sign-up/sign-in instead, rather than building real accounts on top of them.
      if (u?.is_anonymous) {
        await supabase.auth.signOut();
        u = null;
      }
      if (cancelled) return;
      setUser(u);
      setProfile(u ? await loadProfile(u.id) : null);
      setReady(true);
    };

    supabase.auth.getUser().then(({ data }) => settle(data.user));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      settle(session?.user ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signUpWithEmail = useCallback(
    async (emailAddr: string, password: string, name: string, avatar: string, role: UserRole) => {
      const { data, error } = await supabase.auth.signUp({ email: emailAddr, password });
      if (error) return { error: error.message };
      const u = data.user;
      if (!u) return { error: "ثبت‌نام ناموفق بود" };
      const { error: profileError } = await supabase.from("user_profiles").upsert(
        { user_id: u.id, display_name: name, avatar, email: emailAddr, role, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      if (profileError) return { error: profileError.message };
      setUser(u);
      setProfile({ user_id: u.id, display_name: name, avatar, email: emailAddr, role, updated_at: new Date().toISOString() });
      return { error: null };
    },
    []
  );

  const signInWithEmail = useCallback(async (emailAddr: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: emailAddr, password });
    return { error: error?.message || null };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
    });
    return { error: error?.message || null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  const saveProfile = useCallback(
    async (name: string, newAvatar: string, role: UserRole) => {
      if (!user) return;
      const oldName = profile?.display_name || "";
      const nameChanged = name !== oldName && oldName !== "";

      if (nameChanged) {
        await Promise.all([
          supabase.from("cells").update({ author_name: name }).eq("author_id", user.id),
          supabase.from("team_members").update({ display_name: name }).eq("user_id", user.id),
          supabase.from("comments").update({ author_name: name }).eq("author_id", user.id),
          supabase.from("class_teachers").update({ display_name: name }).eq("user_id", user.id),
          supabase.from("class_members").update({ display_name: name }).eq("user_id", user.id),
        ]);
      }

      await supabase.from("user_profiles").upsert(
        {
          user_id: user.id,
          display_name: name,
          avatar: newAvatar,
          email: profile?.email ?? user.email ?? null,
          role,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      setProfile((p) => ({
        user_id: user.id,
        display_name: name,
        avatar: newAvatar,
        email: p?.email ?? user.email ?? null,
        role,
        updated_at: new Date().toISOString(),
      }));
    },
    [user, profile]
  );

  const value: AuthContextValue = {
    user,
    profile,
    displayName: profile?.display_name || "",
    avatar: profile?.avatar || "🙂",
    role: profile?.role || null,
    email: profile?.email || user?.email || null,
    ready,
    needsProfile: ready && !!user && !profile,
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    signOut,
    saveProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
