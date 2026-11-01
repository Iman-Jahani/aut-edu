"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProvider";
import { fmtRelative } from "@/lib/utils";
import type { SharedExercise } from "@/lib/types";
import { ListSkeleton } from "@/components/Skeleton";
import { DifficultyBadge, TopicBadge } from "@/components/DifficultyBadge";
import { DIFFICULTIES } from "@/lib/difficulty";
import { BookOpen, X } from "lucide-react";

export default function LibraryPickerModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (ex: SharedExercise) => void;
}) {
  const toast = useToast();
  const [items, setItems] = useState<SharedExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [diff, setDiff] = useState<number | null>(null);
  const [topic, setTopic] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("shared_exercises")
      .select("*")
      .order("use_count", { ascending: false })
      .order("created_at", { ascending: false });
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const topics = useMemo(
    () => Array.from(new Set(items.map((e) => (e.topic || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [items]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((e) => {
      if (diff !== null && e.difficulty !== diff) return false;
      if (topic && (e.topic || "").trim() !== topic) return false;
      if (!needle) return true;
      return (e.title || "").toLowerCase().includes(needle) || (e.description || "").toLowerCase().includes(needle);
    });
  }, [items, q, diff, topic]);

  const hasFilter = diff !== null || !!topic || !!q.trim();

  const pick = async (ex: SharedExercise) => {
    onPick(ex);
    // Teachers can't UPDATE library rows directly any more; a small DB function bumps the counter.
    supabase.rpc("bump_shared_exercise_use", { p_id: ex.id }).then(() => undefined);
    toast("از کتابخانه بارگذاری شد", "ok");
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-slate-900/50 backdrop-blur-sm anim-fade flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl anim-pop w-full max-w-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="font-extrabold flex items-center gap-2"><BookOpen size={18} /> کتابخانه‌ی تمرین‌ها</h2>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={17} />
          </button>
        </div>
        <div className="px-6 pt-4 space-y-2.5">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجو…"
            className="w-full border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div className="flex gap-2 flex-wrap items-center">
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => setDiff(null)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${diff === null ? "bg-primary text-white border-primary" : "border-line text-muted"}`}
              >
                همه‌ی سختی‌ها
              </button>
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDiff(diff === d.value ? null : d.value)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${diff === d.value ? d.cls + " ring-2 ring-primary/30" : "border-line text-muted"}`}
                >
                  {d.fa}
                </button>
              ))}
            </div>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              dir="auto"
              className="mr-auto border border-line rounded-lg px-2 py-1 text-xs outline-none focus:border-primary bg-white"
            >
              <option value="">همه‌ی موضوع‌ها</option>
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          {hasFilter && !loading && (
            <div className="text-[11px] text-muted flex items-center gap-2">
              {filtered.length} از {items.length} تمرین
              <button
                onClick={() => {
                  setQ("");
                  setDiff(null);
                  setTopic("");
                }}
                className="text-primary font-bold"
              >
                پاک کردن فیلترها
              </button>
            </div>
          )}
        </div>
        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-2">
          {loading ? (
            <ListSkeleton rows={4} pill={false} />
          ) : filtered.length === 0 ? (
            <div className="text-center text-sm text-muted py-10">{items.length ? "چیزی پیدا نشد" : "کتابخانه خالیه"}</div>
          ) : (
            filtered.map((ex) => (
              <div
                key={ex.id}
                className="flex items-start gap-2 border border-line rounded-lg p-3 hover:border-primary/40 cursor-pointer"
                onClick={() => pick(ex)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-sm">{ex.title}</span>
                    <DifficultyBadge value={ex.difficulty} />
                    <TopicBadge value={ex.topic} />
                  </div>
                  {ex.description && <div className="text-xs text-muted line-clamp-2 mt-0.5">{ex.description}</div>}
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted">
                    <span className="px-1.5 py-0.5 bg-slate-100 rounded">{(ex.test_cases || []).length} تست</span>
                    <span className="px-1.5 py-0.5 bg-slate-100 rounded">{ex.use_count || 0} بار</span>
                    <span className="mr-auto">
                      {ex.created_by_name || "ناشناس"} · {fmtRelative(ex.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
