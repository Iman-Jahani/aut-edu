"use client";

import { useCallback, useEffect, useState } from "react";
import { AlarmClock, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatRemaining, getWindowState, urgency } from "@/lib/schedule";
import type { Exercise } from "@/lib/types";

const WARN_WITHIN_MS = 48 * 3600_000;

/**
 * Students see a reminder when an exercise they haven't solved yet is close to
 * its deadline. Dismissing hides it for this browser session only, and it comes
 * back (re-worded) as the deadline gets closer.
 */
export default function DeadlineReminder({ classId, userId, onOpen }: { classId: string; userId: string; onOpen: () => void }) {
  const [items, setItems] = useState<Exercise[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: exs, error } = await supabase.from("exercises").select("*").eq("class_id", classId).not("due_at", "is", null);
    if (error || !exs?.length) return setItems([]);
    const { data: subs } = await supabase
      .from("exercise_submissions")
      .select("exercise_id, status")
      .in("exercise_id", exs.map((e) => e.id))
      .eq("user_id", userId);
    const solved = new Set((subs || []).filter((s) => s.status === "correct").map((s) => s.exercise_id));
    setItems((exs as Exercise[]).filter((e) => !solved.has(e.id)));
  }, [classId, userId]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 5 * 60_000);
    return () => clearInterval(poll);
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setDismissed(sessionStorage.getItem("deadlineDismissed_" + classId));
  }, [classId]);

  const upcoming = items
    .filter((e) => getWindowState(e, now) === "open" && e.due_at)
    .map((e) => ({ e, left: new Date(e.due_at as string).getTime() - now }))
    .filter((x) => x.left > 0 && x.left <= WARN_WITHIN_MS)
    .sort((a, b) => a.left - b.left);

  if (!upcoming.length) return null;
  const first = upcoming[0];
  const key = first.e.id + ":" + urgency(first.left);
  if (dismissed === key) return null;
  const hot = urgency(first.left) === "soon";

  return (
    <div className={`border-b text-sm ${hot ? "bg-red-50 border-red-200 text-red-800" : "bg-amber-50 border-amber-200 text-amber-900"}`}>
      <div className="max-w-4xl mx-auto px-4 py-2 flex items-center gap-2.5">
        <AlarmClock size={16} className={`shrink-0 ${hot ? "animate-pulse" : ""}`} />
        <button onClick={onOpen} className="flex-1 min-w-0 text-right truncate">
          <b>«{first.e.title}»</b> تا {formatRemaining(first.left)} دیگه مهلت داره
          {upcoming.length > 1 ? ` (و ${upcoming.length - 1} تمرین دیگه نزدیک موعده)` : ""}
        </button>
        <button onClick={onOpen} className="text-xs font-bold underline shrink-0">
          حل کن
        </button>
        <button
          onClick={() => {
            sessionStorage.setItem("deadlineDismissed_" + classId, key);
            setDismissed(key);
          }}
          className="opacity-60 hover:opacity-100 shrink-0"
          aria-label="بستن"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
