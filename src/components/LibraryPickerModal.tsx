"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProvider";
import { fmtRelative } from "@/lib/utils";
import type { SharedExercise } from "@/lib/types";
import { ListSkeleton } from "@/components/Skeleton";
import { DifficultyBadge, TopicBadge } from "@/components/DifficultyBadge";
import { DIFFICULTIES } from "@/lib/difficulty";
import { useLibrarySearch } from "@/lib/library";
import { BookOpen, X, Check } from "lucide-react";

export default function LibraryPickerModal({
  onClose,
  onPick,
  multi,
}: {
  onClose: () => void;
  onPick: (ex: SharedExercise) => void;
  /** Multi-select mode (adding several questions to a series at once). `onPick` is unused then. */
  multi?: { confirmLabel: (n: number) => string; onConfirm: (list: SharedExercise[]) => void | Promise<void> };
}) {
  const toast = useToast();
  // Kept across searches/pages, so a teacher can pick from several searches.
  const [selected, setSelected] = useState<Map<string, SharedExercise>>(new Map());
  const [confirming, setConfirming] = useState(false);
  const toggle = (ex: SharedExercise) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(ex.id)) next.delete(ex.id);
      else next.set(ex.id, ex);
      return next;
    });
  const confirm = async () => {
    if (!multi || !selected.size) return;
    setConfirming(true);
    try {
      const list = Array.from(selected.values());
      await multi.onConfirm(list);
      list.forEach((ex) => supabase.rpc("bump_shared_exercise_use", { p_id: ex.id }).then(() => undefined));
    } finally {
      setConfirming(false);
    }
  };
  // search, filters and paging run in the database (the library can hold far more than 1000 exercises)
  const lib = useLibrarySearch({ sort: "popular", mode: "append" });
  const { q, diff, topic, topics, items, loading } = lib;
  const setQ = lib.setQ;
  const setDiff = lib.setDiff;
  const setTopic = lib.setTopic;
  const hasFilter = lib.hasFilter;
  const filtered = items;

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
          {(hasFilter || lib.total > 0) && (
            <div className="text-[11px] text-muted flex items-center gap-2">
              {lib.total.toLocaleString("fa-IR")} تمرین{hasFilter ? " پیدا شد" : ""}
              {hasFilter && (
                <button onClick={lib.clear} className="text-primary font-bold">
                  پاک کردن فیلترها
                </button>
              )}
            </div>
          )}
        </div>
        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-2">
          {lib.error ? (
            <div className="text-center text-sm text-danger py-10">خطا در جستجو: {lib.error}</div>
          ) : loading && items.length === 0 ? (
            <ListSkeleton rows={4} pill={false} />
          ) : filtered.length === 0 ? (
            <div className="text-center text-sm text-muted py-10">{hasFilter ? "چیزی پیدا نشد" : "کتابخانه خالیه"}</div>
          ) : (
            filtered.map((ex) => (
              <div
                key={ex.id}
                className="flex items-start gap-2 border border-line rounded-lg p-3 hover:border-primary/40 cursor-pointer"
                onClick={() => (multi ? toggle(ex) : pick(ex))}
              >
                {multi && (
                  <span className={`mt-0.5 w-5 h-5 rounded-md border grid place-items-center shrink-0 ${selected.has(ex.id) ? "bg-primary border-primary text-white" : "border-line bg-white"}`}>
                    {selected.has(ex.id) && <Check size={13} />}
                  </span>
                )}
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
          {lib.hasMore && !lib.error && (
            <button onClick={lib.loadMore} disabled={loading} className="btn-ghost w-full justify-center disabled:opacity-50">
              {loading ? "در حال بارگذاری…" : `نمایش بیشتر (${(lib.total - items.length).toLocaleString("fa-IR")} تمرین دیگه)`}
            </button>
          )}
        </div>
        {multi && (
          <div className="px-6 py-3 border-t border-line flex items-center justify-between gap-2">
            <span className="text-xs text-muted">{selected.size ? `${selected.size.toLocaleString("fa-IR")} سؤال انتخاب شده` : "سؤال‌ها رو انتخاب کن"}</span>
            <button onClick={confirm} disabled={!selected.size || confirming} className="btn-primary disabled:opacity-50">
              {confirming ? "در حال افزودن…" : multi.confirmLabel(selected.size)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
