"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ToastProvider";
import type { Quiz, QuizQuestion } from "@/lib/types";
import { Brain, Pencil, X, BookOpen, RefreshCw } from "lucide-react";
import RichTextHint from "@/components/RichTextHint";
import { getErrorMessage } from "@/lib/errors";
import { useAuth } from "@/context/AuthContext";

function emptyQuestion(): QuizQuestion {
  return { question: "", options: ["", "", "", ""], correct: 0 };
}

function QuestionTextArea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="متن سوال… می‌تونی کد هم بذاری"
        rows={2}
        dir="auto"
        className="w-full border border-line rounded-lg px-3 py-2 text-sm mb-1.5 outline-none focus:border-primary resize-y font-mono"
      />
      <RichTextHint textareaRef={ref} value={value} onChange={onChange} />
    </div>
  );
}

export default function QuizFormModal({
  classId,
  quiz,
  template,
  onClose,
  onSaved,
}: {
  classId: string;
  quiz?: Quiz | null;
  template?: { title: string; time_limit: number; questions: QuizQuestion[] } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const { displayName } = useAuth();
  const [title, setTitle] = useState(quiz?.title || template?.title || "");
  const [timeLimit, setTimeLimit] = useState(quiz?.time_limit || template?.time_limit || 5);
  const [questions, setQuestions] = useState<QuizQuestion[]>(
    quiz?.questions?.length
      ? quiz.questions.map((q) => ({ ...q, options: [...q.options] }))
      : template?.questions?.length
      ? template.questions.map((q) => ({ ...q, options: [...q.options] }))
      : [emptyQuestion()]
  );
  const [addToLibrary, setAddToLibrary] = useState(false);
  const [saving, setSaving] = useState(false);

  const updateQuestion = (i: number, text: string) =>
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, question: text } : q)));
  const updateOption = (i: number, j: number, value: string) =>
    setQuestions((prev) =>
      prev.map((q, idx) => (idx === i ? { ...q, options: q.options.map((o, oi) => (oi === j ? value : o)) } : q))
    );
  const setCorrect = (i: number, j: number) =>
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, correct: j } : q)));
  const removeQuestion = (i: number) => setQuestions((prev) => prev.filter((_, idx) => idx !== i));
  const addQuestion = () => setQuestions((prev) => [...prev, emptyQuestion()]);

  const save = async () => {
    const t = title.trim();
    if (!t) return toast("عنوان کوییز رو وارد کن", "err");
    const clean = questions
      .map((q) => ({
        question: (q.question || "").trim(),
        options: (q.options || []).map((o) => (o || "").trim()).filter((o) => o),
        correct: q.correct,
      }))
      .filter((q) => q.question && q.options.length >= 2 && q.correct < q.options.length);
    if (!clean.length) return toast("حداقل یه سوال با متن و ۲ گزینه لازمه", "err");

    setSaving(true);
    try {
      if (quiz) {
        const { error } = await supabase
          .from("quizzes")
          .update({ title: t, time_limit: timeLimit, questions: clean })
          .eq("id", quiz.id);
        if (error) throw error;
        if (addToLibrary) {
          if (quiz.shared_quiz_id) {
            await supabase
              .from("shared_quizzes")
              .update({ title: t, time_limit: timeLimit, questions: clean, created_by_name: displayName })
              .eq("id", quiz.shared_quiz_id);
            toast("ویرایش شد + کتابخانه به‌روز شد", "ok");
          } else {
            const { data: lib } = await supabase
              .from("shared_quizzes")
              .insert({ title: t, time_limit: timeLimit, questions: clean, created_by_name: displayName })
              .select()
              .single();
            if (lib) await supabase.from("quizzes").update({ shared_quiz_id: lib.id }).eq("id", quiz.id);
            toast("ویرایش شد + به کتابخانه اضافه شد", "ok");
          }
        } else {
          toast("کوییز ویرایش شد", "ok");
        }
      } else {
        const { data: newQuiz, error } = await supabase
          .from("quizzes")
          .insert({ class_id: classId, title: t, time_limit: timeLimit, questions: clean, status: "draft" })
          .select()
          .single();
        if (error) throw error;
        if (addToLibrary) {
          const { data: lib } = await supabase
            .from("shared_quizzes")
            .insert({ title: t, time_limit: timeLimit, questions: clean, created_by_name: displayName })
            .select()
            .single();
          if (lib && newQuiz) await supabase.from("quizzes").update({ shared_quiz_id: lib.id }).eq("id", newQuiz.id);
          toast("ساخته شد + به کتابخانه اضافه شد", "ok");
        } else {
          toast("کوییز ساخته شد", "ok");
        }
      }
      onSaved();
    } catch (e) {
      toast("خطا: " + getErrorMessage(e), "err");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[115] bg-slate-900/50 backdrop-blur-sm anim-fade flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl anim-pop w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="font-extrabold flex items-center gap-2">
            {quiz ? <Pencil size={17} /> : <Brain size={17} />}
            {quiz ? "ویرایش کوییز" : "کوییز جدید"}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={17} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4 flex-1 space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="عنوان کوییز"
            className="w-full border border-line rounded-lg px-3 py-2 outline-none focus:border-primary"
          />
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted whitespace-nowrap">زمان (دقیقه)</label>
            <input
              type="number"
              min={1}
              value={timeLimit}
              onChange={(e) => setTimeLimit(parseInt(e.target.value) || 5)}
              className="w-24 border border-line rounded-lg px-3 py-2 outline-none focus:border-primary"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-sm font-bold text-muted">سوالات</span>
            <button onClick={addQuestion} className="text-xs font-bold text-primary">
              + سوال جدید
            </button>
          </div>

          {questions.map((q, i) => (
            <div key={i} className="border border-line rounded-lg p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold">سوال {i + 1}</span>
                {questions.length > 1 && (
                  <button onClick={() => removeQuestion(i)} className="text-danger text-xs">
                    حذف ×
                  </button>
                )}
              </div>
              <QuestionTextArea value={q.question} onChange={(v) => updateQuestion(i, v)} />
              <div className="text-[11px] font-bold text-muted mb-1.5 mt-2.5 uppercase">گزینه‌ها — گزینه‌ی صحیح رو انتخاب کن</div>
              <div className="space-y-1.5">
                {q.options.map((opt, j) => (
                  <div key={j} className="flex items-start gap-2">
                    <input
                      type="radio"
                      name={`correct-${i}`}
                      checked={q.correct === j}
                      onChange={() => setCorrect(i, j)}
                      className="accent-primary w-4 h-4 shrink-0 mt-2.5"
                    />
                    <span className="font-bold text-primary w-5 text-center shrink-0 mt-1.5">{String.fromCharCode(65 + j)}</span>
                    <textarea
                      value={opt}
                      onChange={(e) => updateOption(i, j, e.target.value)}
                      placeholder={`گزینه ${String.fromCharCode(65 + j)} — می‌تونه کد هم باشه: \`کد\``}
                      rows={1}
                      dir="auto"
                      className="flex-1 border border-line rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-primary resize-y font-mono"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          <label className="flex items-center gap-2 text-sm pt-2 cursor-pointer">
            <input type="checkbox" checked={addToLibrary} onChange={(e) => setAddToLibrary(e.target.checked)} />
            {quiz?.shared_quiz_id ? <RefreshCw size={14} className="shrink-0" /> : <BookOpen size={14} className="shrink-0" />}
            {quiz?.shared_quiz_id ? "نسخه‌ی کتابخانه رو با تغییرات فعلی به‌روزرسانی کن" : "این کوییز رو به کتابخانه اشتراکی اضافه کن"}
          </label>
        </div>

        <div className="px-6 py-4 border-t border-line flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold border border-line">
            لغو
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-gradient-to-br from-primary to-primary2 disabled:opacity-50"
          >
            {saving ? "در حال ذخیره…" : "ذخیره"}
          </button>
        </div>
      </div>
    </div>
  );
}
