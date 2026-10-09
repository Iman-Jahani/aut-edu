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
  /** Signed in, but no row in user_profiles yet (fresh Google sign-in, or first login after email confirmation). */
  needsProfile: boolean;
  /** Name/avatar/role chosen during sign-up, recovered after an email-confirmation round trip. */
  pendingProfileHint: { display_name: string; avatar: string; role: UserRole } | null;
  signUpWithEmail: (
    email: string,
    password: string,
    displayName: string,
    avatar: string,
    role: UserRole
  ) => Promise<{ error: string | null; needsEmailConfirmation?: boolean }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  saveProfile: (name: string, avatar: string, role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Turns Supabase's (English) auth error strings into clear Persian messages. */
function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("email not confirmed") || m.includes("email_not_confirmed")) {
    return "ایمیلت هنوز تایید نشده. یه ایمیل با لینک تایید برات فرستاده بودیم — اینباکس (و پوشه‌ی اسپم) رو چک کن و لینکش رو بزن، بعد دوباره وارد شو.";
  }
  if (m.includes("invalid login credentials")) {
    return "ایمیل یا رمز عبور اشتباهه.";
  }
  if (m.includes("user already registered") || m.includes("already registered")) {
    return "این ایمیل قبلاً ثبت‌نام کرده — به‌جاش وارد شو.";
  }
  if (m.includes("password") && m.includes("least")) {
    return "رمز عبور خیلی کوتاهه (حداقل ۶ کاراکتر).";
  }
  return message;
}

async function loadProfile(userId: string): Promise<UserProfile | null> {
  const { data } = await supabase.from("user_profiles").select("*").eq("user_id", userId).maybeSingle();
  return (data as UserProfile) || null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [pendingProfileHint, setPendingProfileHint] = useState<AuthContextValue["pendingProfileHint"]>(null);

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
      let loadedProfile = u ? await loadProfile(u.id) : null;
      // Signed up with email: name/avatar/role were saved on the account itself, so
      // create the profile row now instead of asking the person for them again
      // (covers confirming the email on another device, and the sign-up race).
      if (u && !loadedProfile) {
        const meta = (u.user_metadata || {}) as { display_name?: string; avatar?: string; role?: string };
        if (meta.display_name && (meta.role === "teacher" || meta.role === "student")) {
          const row = {
            user_id: u.id,
            display_name: meta.display_name,
            avatar: meta.avatar || "🙂",
            email: u.email ?? null,
            role: meta.role as UserRole,
            updated_at: new Date().toISOString(),
          };
          const { error: healError } = await supabase.from("user_profiles").upsert(row, { onConflict: "user_id" });
          if (!healError) loadedProfile = row;
        }
      }
      setProfile(loadedProfile);
      if (u && !loadedProfile) {
        try {
          const raw = localStorage.getItem("pendingProfile");
          setPendingProfileHint(raw ? JSON.parse(raw) : null);
        } catch {
          setPendingProfileHint(null);
        }
      } else {
        setPendingProfileHint(null);
      }
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
      const { data, error } = await supabase.auth.signUp({
        email: emailAddr,
        password,
        options: { data: { display_name: name, avatar, role } },
      });
      if (error) return { error: friendlyAuthError(error.message) };
      const u = data.user;
      if (!u) return { error: "ثبت‌نام ناموفق بود" };

      // If the Supabase project requires email confirmation, `signUp` returns a
      // user but NO session — `auth.uid()` is null server-side until they click
      // the confirmation link, so writing user_profiles now would just fail an
      // RLS check with a confusing error. Stash the chosen name/avatar/role so
      // ProfileModal can prefill them once the user actually logs in later.
      if (!data.session) {
        try {
          localStorage.setItem("pendingProfile", JSON.stringify({ display_name: name, avatar, role }));
        } catch {
          /* ignore */
        }
        return { error: null, needsEmailConfirmation: true };
      }

      const { error: profileError } = await supabase.from("user_profiles").upsert(
        { user_id: u.id, display_name: name, avatar, email: emailAddr, role, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      if (profileError) return { error: friendlyAuthError(profileError.message) };
      setUser(u);
      setProfile({ user_id: u.id, display_name: name, avatar, email: emailAddr, role, updated_at: new Date().toISOString() });
      return { error: null };
    },
    []
  );

  const signInWithEmail = useCallback(async (emailAddr: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: emailAddr, password });
    return { error: error ? friendlyAuthError(error.message) : null };
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
      try {
        localStorage.removeItem("pendingProfile");
      } catch {
        /* ignore */
      }
      setPendingProfileHint(null);
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
    pendingProfileHint,
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
