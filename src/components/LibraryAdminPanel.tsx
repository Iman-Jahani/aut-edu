"use client";

import { useToast } from "@/components/ToastProvider";
import type { SharedExercise } from "@/lib/types";
import { DIFFICULTIES } from "@/lib/difficulty";
import { DifficultyBadge, TopicBadge } from "@/components/DifficultyBadge";
import SharedExerciseEditModal from "@/components/SharedExerciseEditModal";
import { adminFetch } from "@/lib/adminFetch";
import { useLibrarySearch } from "@/lib/library";
import { ChevronLeft, ChevronRight, Loader2, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

/**
 * Admin view of the shared exercise library: search, filter, edit and delete records in place.
 * Search, filters and paging all run in the database, so it works with any number of exercises.
 */
export default function LibraryAdminPanel() {
  const toast = useToast();
  const lib = useLibrarySearch({ sort: "recent", mode: "pages" });
  const [editing, setEditing] = useState<SharedExercise | null>(null);
  const { items, topics } = lib;

  const del = async (ex: SharedExercise) => {
    if (!confirm(`تمرین «${ex.title}» از کتابخانه حذف شود؟`)) return;
    const res = await adminFetch(`/api/admin/library/${ex.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return toast("خطا: " + (d.error || "حذف نشد"), "err");
    }
    toast("حذف شد", "ok");
    lib.remove(ex.id);
    // that was the last row of this page: show the previous one, or refresh the list
    if (items.length === 1 && lib.page > 0) lib.setPage(lib.page - 1);
    else lib.reload();
  };

  const from = lib.total === 0 ? 0 : lib.page * 50 + 1;
  const to = lib.page * 50 + items.length;

  return (
    <div>
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap items-center">
          <input
            value={lib.q}
            onChange={(e) => lib.setQ(e.target.value)}
            placeholder="جستجو در عنوان، توضیح و موضوع…"
            className="bg-white border border-line rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary w-full sm:w-72"
          />
          <select
            value={lib.diff ?? ""}
            onChange={(e) => lib.setDiff(e.target.value ? Number(e.target.value) : null)}
            className="bg-white border border-line rounded-lg px-2 py-1.5 text-xs outline-none focus:border-primary"
          >
            <option value="">همه‌ی سختی‌ها</option>
            {DIFFICULTIES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.fa} ({d.en})
              </option>
            ))}
          </select>
          <select
            value={lib.topic}
            onChange={(e) => lib.setTopic(e.target.value)}
            dir="auto"
            className="bg-white border border-line rounded-lg px-2 py-1.5 text-xs outline-none focus:border-primary"
          >
            <option value="">همه‌ی موضوع‌ها</option>
            {topics.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {lib.hasFilter && (
            <button onClick={lib.clear} className="text-xs font-bold text-primary">
              پاک کردن فیلترها
            </button>
          )}
          <span className="text-xs text-muted mr-auto flex items-center gap-1.5">
            {lib.loading && <Loader2 size={12} className="animate-spin" />}
            {lib.total.toLocaleString("fa-IR")} تمرین{lib.hasFilter ? " پیدا شد" : ""}
          </span>
        </div>

        {lib.error ? (
          <div className="text-xs text-danger bg-red-50 rounded-lg px-3 py-3">خطا در جستجو: {lib.error}</div>
        ) : items.length === 0 && !lib.loading ? (
          <div className="text-xs text-muted bg-slate-50 rounded-lg px-3 py-4 text-center">{lib.hasFilter ? "چیزی پیدا نشد" : "کتابخانه خالیه"}</div>
        ) : (
          <div className={`space-y-1.5 max-h-[560px] overflow-y-auto transition-opacity ${lib.loading ? "opacity-50" : ""}`}>
            {items.map((ex) => (
              <div key={ex.id} className="flex items-center gap-2.5 bg-slate-50 rounded-lg px-3 py-2 text-xs">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold truncate">{ex.title}</span>
                    <DifficultyBadge value={ex.difficulty} />
                    <TopicBadge value={ex.topic} />
                  </div>
                  <div className="text-muted mt-0.5">
                    {(ex.test_cases || []).length} تست · {ex.use_count || 0} بار استفاده · {ex.created_by_name || "ناشناس"}
                  </div>
                </div>
                <button onClick={() => setEditing(ex)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold bg-slate-100 hover:bg-slate-200 shrink-0">
                  <Pencil size={12} /> ویرایش
                </button>
                <button onClick={() => del(ex)} className="text-danger hover:opacity-70 shrink-0" title="حذف">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {lib.total > 0 && (
          <div className="flex items-center justify-between gap-3 pt-1 text-xs text-muted">
            <span className="tabular-nums">
              {from.toLocaleString("fa-IR")}–{to.toLocaleString("fa-IR")} از {lib.total.toLocaleString("fa-IR")}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => lib.setPage(lib.page - 1)}
                disabled={lib.page === 0 || lib.loading}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-line bg-white font-bold text-ink disabled:opacity-35"
              >
                <ChevronRight size={13} /> قبلی
              </button>
              <span className="tabular-nums px-2">
                صفحه {(lib.page + 1).toLocaleString("fa-IR")} از {lib.pageCount.toLocaleString("fa-IR")}
              </span>
              <button
                onClick={() => lib.setPage(lib.page + 1)}
                disabled={lib.page + 1 >= lib.pageCount || lib.loading}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-line bg-white font-bold text-ink disabled:opacity-35"
              >
                بعدی <ChevronLeft size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {editing && (
        <SharedExerciseEditModal
          exercise={editing}
          topicOptions={topics}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            lib.replace(updated);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
