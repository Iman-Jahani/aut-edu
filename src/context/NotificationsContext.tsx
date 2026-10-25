"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ToastProvider";
import type { AppNotification } from "@/lib/types";

interface NotificationsValue {
  items: AppNotification[];
  unreadCount: number;
  markRead: (ids: string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsValue | null>(null);

const LIMIT = 60;

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<AppNotification[]>([]);
  const userId = user?.id ?? null;
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const load = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(LIMIT);
    // If the migration hasn't been run yet the table doesn't exist — just show nothing.
    if (!error) setItems((data as AppNotification[]) || []);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      return;
    }
    load();

    const channel = supabase
      .channel("notifications-" + userId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (payload) => {
        const n = payload.new as AppNotification;
        setItems((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev].slice(0, LIMIT)));
        // No toast if they're already looking at that very meeting (its comment panel opens by itself).
        const here = n.meeting_id && typeof window !== "undefined" && window.location.pathname.includes(n.meeting_id);
        if (!here) {
          toastRef.current(`${n.actor_name || "کسی"} روی ${n.cell_author_id === userId ? "کد تو" : "یه کد"} نظر گذاشت`, "info");
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, (payload) => {
        const n = payload.new as AppNotification;
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, ...n } : x)));
      })
      .subscribe();

    // Realtime can silently drop while a tab sleeps; catch up when the tab is visible again.
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [userId, load]);

  const markRead = useCallback(
    async (ids: string[]) => {
      if (!userId || !ids.length) return;
      const now = new Date().toISOString();
      const set = new Set(ids);
      setItems((prev) => prev.map((n) => (set.has(n.id) && !n.read_at ? { ...n, read_at: now } : n)));
      await supabase.from("notifications").update({ read_at: now }).in("id", ids).eq("user_id", userId);
    },
    [userId]
  );

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    await supabase.from("notifications").update({ read_at: now }).eq("user_id", userId).is("read_at", null);
  }, [userId]);

  const value = useMemo<NotificationsValue>(
    () => ({ items, unreadCount: items.filter((n) => !n.read_at).length, markRead, markAllRead }),
    [items, markRead, markAllRead]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
