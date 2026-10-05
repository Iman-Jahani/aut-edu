"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProvider";
import { fmtRelative } from "@/lib/utils";
import { getErrorMessage } from "@/lib/errors";
import { BookOpen, Trash2, X } from "lucide-react";
import type { SharedQuiz } from "@/lib/types";

export default function QuizLibraryPickerModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (quiz: SharedQuiz) => void;
}) {
  const toast = useToast();
  const [items, setItems] = useState<SharedQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("shared_quizzes").select("*").order("use_count", { ascending: false }).order("created_at", { ascending: false });
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = q.trim() ? items.filter((e) => (e.title || "").toLowerCase().includes(q.toLowerCase())) : items;

  const pick = async (quiz: SharedQuiz) => {
    onPick(quiz);
    supabase
      .from("shared_quizzes")
      .update({ use_count: (quiz.use_count || 0) + 1 })
      .eq("id", quiz.id)
      .then(() => undefined);
    toast("از کتابخانه بارگذاری شد", "ok");
  };

  const del = async (quiz: SharedQuiz) => {
    if (!confirm(`کوییز «${quiz.title}» از کتابخانه حذف شود؟`)) return;
    const { error } = await supabase.from("shared_quizzes").delete().eq("id", quiz.id);
    if (error) return toast("خطا: " + getErrorMessage(error), "err");
    toast("حذف شد", "ok");
    load();
  };

  return (
    <div
      className="fixed inset-0 z-[120] bg-slate-900/50 backdrop-blur-sm anim-fade flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl anim-pop w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="font-extrabold flex items-center gap-2">
            <BookOpen size={18} /> کتابخانه‌ی کوییزها
          </h2>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={17} />
          </button>
        </div>
        <div className="px-6 pt-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="جستجو…"
            className="w-full border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-2">
          {loading ? (
            <div className="text-center text-sm text-muted py-10">در حال بارگذاری…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-sm text-muted py-10">{items.length ? "چیزی پیدا نشد" : "کتابخانه خالیه"}</div>
          ) : (
            filtered.map((quiz) => (
              <div
                key={quiz.id}
                className="flex items-start gap-2 border border-line rounded-lg p-3 hover:border-primary/40 cursor-pointer"
                onClick={() => pick(quiz)}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm">{quiz.title}</div>
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted">
                    <span className="px-1.5 py-0.5 bg-slate-100 rounded">{(quiz.questions || []).length} سوال</span>
                    <span className="px-1.5 py-0.5 bg-slate-100 rounded">{quiz.time_limit} دقیقه</span>
                    <span className="px-1.5 py-0.5 bg-slate-100 rounded">{quiz.use_count || 0} بار</span>
                    <span className="mr-auto">
                      {quiz.created_by_name || "ناشناس"} · {fmtRelative(quiz.created_at)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    del(quiz);
                  }}
                  className="text-danger text-sm shrink-0"
                  title="حذف"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
