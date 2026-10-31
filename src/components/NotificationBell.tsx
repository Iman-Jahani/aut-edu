"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, MessageCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationsContext";
import { fmtRelative } from "@/lib/utils";
import type { AppNotification } from "@/lib/types";

interface Group {
  cellId: string;
  latest: AppNotification;
  unreadIds: string[];
  allIds: string[];
}

export function notificationHref(n: AppNotification): string {
  if (!n.class_code) return "/dashboard";
  if (!n.meeting_id) return `/class/${n.class_code}`;
  return `/class/${n.class_code}/${n.meeting_id}${n.cell_id ? `?cell=${n.cell_id}` : ""}`;
}

/** Bell with an unread badge; the list groups comments by code cell and links straight to it. */
export default function NotificationBell() {
  const { user } = useAuth();
  const { items, unreadCount, markRead, markAllRead } = useNotifications();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    // items are newest-first, so the first one seen per cell is its latest
    items.forEach((n) => {
      const key = n.cell_id || n.id;
      const g = map.get(key) || { cellId: key, latest: n, unreadIds: [], allIds: [] };
      g.allIds.push(n.id);
      if (!n.read_at) g.unreadIds.push(n.id);
      map.set(key, g);
    });
    // unread groups first, then by recency
    return Array.from(map.values()).sort((a, b) => Number(b.unreadIds.length > 0) - Number(a.unreadIds.length > 0));
  }, [items]);

  const go = (g: Group) => {
    if (g.unreadIds.length) markRead(g.unreadIds);
    setOpen(false);
    router.push(notificationHref(g.latest));
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-9 h-9 grid place-items-center rounded-full bg-white border border-line hover:shadow-soft transition text-stone-600"
        title="اعلان‌ها"
        aria-label="اعلان‌ها"
      >
        <Bell size={16} className={unreadCount > 0 ? "text-primary" : ""} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-extrabold grid place-items-center leading-none">
            {unreadCount > 9 ? "۹+" : unreadCount.toLocaleString("fa-IR")}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-16 z-[150] sm:absolute sm:inset-x-auto sm:top-auto sm:left-0 sm:mt-2 sm:w-96 bg-white border border-line rounded-2xl shadow-2xl anim-pop overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <span className="font-extrabold text-sm">اعلان‌ها</span>
            {unreadCount > 0 && (
              <button onClick={() => markAllRead()} className="flex items-center gap-1 text-[11px] font-bold text-primary">
                <CheckCheck size={13} /> همه خوانده شد
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {groups.length === 0 ? (
              <div className="text-center text-sm text-muted py-10 px-4">
                <Bell size={28} className="mx-auto mb-2 text-primary/30" />
                هنوز اعلانی نداری. وقتی کسی روی کدت نظر بذاره اینجا می‌بینی.
              </div>
            ) : (
              groups.map((g) => {
                const n = g.latest;
                const unread = g.unreadIds.length > 0;
                const mine = n.cell_author_id === user?.id;
                return (
                  <button
                    key={g.cellId}
                    onClick={() => go(g)}
                    className={`w-full text-right flex gap-3 px-4 py-3 border-b border-line/60 last:border-0 hover:bg-stone-50 transition ${unread ? "bg-stone-100/50" : ""}`}
                  >
                    <span className={`w-8 h-8 rounded-full grid place-items-center shrink-0 ${unread ? "bg-primary/10 text-primary" : "bg-stone-100 text-muted"}`}>
                      <MessageCircle size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[13px] leading-5 ${unread ? "font-extrabold" : "font-semibold"}`}>
                        {n.actor_name || "کسی"} روی {mine ? "کد تو" : `کد ${n.cell_author_name || "یه نفر"}`} نظر گذاشت
                        {g.unreadIds.length > 1 && <span className="text-primary"> (+{(g.unreadIds.length - 1).toLocaleString("fa-IR")} نظر دیگر)</span>}
                      </span>
                      {n.preview && (
                        <span dir="auto" className="block text-xs text-muted line-clamp-2 mt-0.5">
                          {n.preview}
                        </span>
                      )}
                      <span className="block text-[11px] text-muted/80 mt-1">
                        {[n.class_title, n.meeting_title].filter(Boolean).join(" · ")}
                        {" · "}
                        {fmtRelative(n.created_at)}
                      </span>
                    </span>
                    {unread && <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 mt-2" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
