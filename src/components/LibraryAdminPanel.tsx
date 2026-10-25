"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProvider";
import type { SharedExercise } from "@/lib/types";
import { DIFFICULTIES } from "@/lib/difficulty";
import { DifficultyBadge, TopicBadge } from "@/components/DifficultyBadge";
import SharedExerciseEditModal from "@/components/SharedExerciseEditModal";
import { BookOpen, ChevronDown, Pencil, Trash2 } from "lucide-react";

/** Admin view of the shared exercise library: browse, filter, edit and delete records in place. */
export default function LibraryAdminPanel() {
  const toast = useToast();
  const [items, setItems] = useState<SharedExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SharedExercise | null>(null);
  const [q, setQ] = useState("");
  const [diff, setDiff] = useState<number | null>(null);
  const [topic, setTopic] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("shared_exercises").select("*").order("created_at", { ascending: false });
    setItems(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  const del = async (ex: SharedExercise) => {
    if (!confirm(`تمرین «${ex.title}» از کتابخانه حذف شود؟`)) return;
    const res = await fetch(`/api/admin/library/${ex.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return toast("خطا: " + (d.error || "حذف نشد"), "err");
    }
    toast("حذف شد", "ok");
    setItems((prev) => prev.filter((e) => e.id !== ex.id));
  };

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden mb-6">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 px-5 py-4 text-right hover:bg-slate-700/30 transition">
        <ChevronDown size={16} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        <BookOpen size={16} className="text-primary2" />
        <span className="font-bold">کتابخانه‌ی تمرین‌ها</span>
        <span className="text-xs text-slate-400">({items.length})</span>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-3 border-t border-slate-700/70 space-y-3">
          <div className="flex gap-2 flex-wrap items-center">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="جستجو در کتابخانه…"
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary w-full sm:w-64"
            />
            <select
              value={diff ?? ""}
              onChange={(e) => setDiff(e.target.value ? Number(e.target.value) : null)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-primary"
            >
              <option value="">همه‌ی سختی‌ها</option>
              {DIFFICULTIES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.fa} ({d.en})
                </option>
              ))}
            </select>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              dir="auto"
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-primary"
            >
              <option value="">همه‌ی موضوع‌ها</option>
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-400 mr-auto">{filtered.length} تمرین</span>
          </div>

          {loading ? (
            <div className="text-xs text-slate-500 py-6 text-center">در حال بارگذاری…</div>
          ) : filtered.length === 0 ? (
            <div className="text-xs text-slate-500 bg-slate-900/30 rounded-lg px-3 py-4 text-center">
              {items.length ? "چیزی پیدا نشد" : "کتابخانه خالیه"}
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
              {filtered.map((ex) => (
                <div key={ex.id} className="flex items-center gap-2.5 bg-slate-900/40 rounded-lg px-3 py-2 text-xs">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold truncate">{ex.title}</span>
                      <DifficultyBadge value={ex.difficulty} />
                      <TopicBadge value={ex.topic} />
                    </div>
                    <div className="text-slate-400 mt-0.5">
                      {(ex.test_cases || []).length} تست · {ex.use_count || 0} بار استفاده · {ex.created_by_name || "ناشناس"}
                    </div>
                  </div>
                  <button
                    onClick={() => setEditing(ex)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold bg-slate-700 hover:bg-slate-600 shrink-0"
                  >
                    <Pencil size={12} /> ویرایش
                  </button>
                  <button onClick={() => del(ex)} className="text-red-400 hover:text-red-300 shrink-0" title="حذف">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editing && (
        <SharedExerciseEditModal
          exercise={editing}
          topicOptions={topics}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setItems((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
