"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { fmtRelative, fetchAvatars, colorOf, initials } from "@/lib/utils";
import type { Comment } from "@/lib/types";
import { CommentsSkeleton } from "@/components/Skeleton";

export default function CommentsPanel({
  cellId,
  onCountChange,
  highlightIds = [],
}: {
  cellId: string;
  onCountChange?: (count: number) => void;
  /** Ids of comments the viewer hasn't seen yet — shown with a "جدید" mark. */
  highlightIds?: string[];
}) {
  const { user, displayName } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const firstNewRef = useRef<HTMLDivElement | null>(null);
  const scrolledRef = useRef(false);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    const { data } = await supabase
      .from("comments")
      .select("*")
      .eq("cell_id", cellId)
      .order("created_at", { ascending: true });
    const rows = data || [];
    const avatars = await fetchAvatars(rows.map((c) => c.author_id));
    setComments(rows.map((c) => ({ ...c, author_avatar: avatars[c.author_id] || null })));
    onCountChange?.(rows.length);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // Live updates: a comment written while this panel is open shows up without reopening it.
    const channel = supabase
      .channel("comments-" + cellId)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments", filter: `cell_id=eq.${cellId}` }, () => load(true))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cellId]);

  // Bring the first new comment into view (inside the panel's own scroll area) once.
  useEffect(() => {
    if (loading || scrolledRef.current || !highlightIds.length) return;
    const el = firstNewRef.current;
    if (!el) return;
    scrolledRef.current = true;
    requestAnimationFrame(() => el.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }, [loading, comments, highlightIds.length]);

  const submit = async () => {
    const t = text.trim();
    if (!t || !user) return;
    setSending(true);
    const { error } = await supabase
      .from("comments")
      .insert({ cell_id: cellId, author_id: user.id, author_name: displayName, text: t });
    setSending(false);
    if (!error) {
      setText("");
      load(true);
    }
  };

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="space-y-2.5 max-h-52 overflow-y-auto mb-3">
        {loading ? (
          <CommentsSkeleton />
        ) : comments.length === 0 ? (
          <div className="text-xs text-muted">هنوز کامنتی نیست.</div>
        ) : (
          comments.map((c) => {
            const isNew = highlightIds.includes(c.id);
            const isFirstNew = isNew && c.id === comments.find((x) => highlightIds.includes(x.id))?.id;
            return (
            <div key={c.id} ref={isFirstNew ? firstNewRef : undefined} className="flex gap-2">
              <div
                className="w-7 h-7 rounded-full grid place-items-center text-sm shrink-0 mt-0.5"
                style={{ background: colorOf(c.author_name) + "22" }}
              >
                {c.author_avatar || initials(c.author_name)}
              </div>
              <div className={`flex-1 min-w-0 rounded-lg px-3 py-2 text-sm ${isNew ? "bg-rose-50 ring-2 ring-rose-300" : "bg-slate-50"}`}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-bold text-xs flex items-center gap-1.5">
                    {c.author_name || "ناشناس"}
                    {isNew && <span className="text-[10px] font-extrabold text-white bg-rose-500 rounded-full px-1.5 py-px">جدید</span>}
                  </span>
                  <span className="text-[11px] text-muted">{fmtRelative(c.created_at)}</span>
                </div>
                <div className="text-ink/90 whitespace-pre-wrap">{c.text}</div>
              </div>
            </div>
            );
          })
        )}
      </div>
      <div className="flex gap-2 items-end">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submit();
          }}
          placeholder="نظرت رو بنویس… (Ctrl+Enter = ارسال)"
          rows={2}
          className="flex-1 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-primary resize-none"
        />
        <button
          onClick={submit}
          disabled={sending || !text.trim()}
          title="ارسال"
          aria-label="ارسال نظر"
          className="w-9 h-9 shrink-0 grid place-items-center rounded-lg text-white bg-primary hover:opacity-85 transition disabled:opacity-30"
        >
          <Send size={15} className="-scale-x-100" />
        </button>
      </div>
    </div>
  );
}
