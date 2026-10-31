"use client";

import { useRef, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import type { SharedExercise, TestCase } from "@/lib/types";
import { Pencil, X } from "lucide-react";
import RichTextHint from "@/components/RichTextHint";
import DifficultyTopicFields from "@/components/DifficultyTopicFields";
import { getErrorMessage } from "@/lib/errors";
import { adminFetch } from "@/lib/adminFetch";

/**
 * Edits a record of the shared library in place. Goes through the admin-only API
 * (the database refuses library edits from normal teacher sessions).
 * It never creates a new exercise, and doesn't touch copies that teachers already
 * made in their classes.
 */
export default function SharedExerciseEditModal({
  exercise,
  topicOptions,
  onClose,
  onSaved,
}: {
  exercise: SharedExercise;
  topicOptions: string[];
  onClose: () => void;
  onSaved: (updated: SharedExercise) => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState(exercise.title || "");
  const [description, setDescription] = useState(exercise.description || "");
  const [hint, setHint] = useState(exercise.hint || "");
  const [difficulty, setDifficulty] = useState<number | null>(exercise.difficulty ?? null);
  const [topic, setTopic] = useState(exercise.topic || "");
  const [tests, setTests] = useState<TestCase[]>(exercise.test_cases?.length ? exercise.test_cases : [{ input: "", expected: "" }]);
  const [saving, setSaving] = useState(false);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const hintRef = useRef<HTMLTextAreaElement>(null);

  const updateTest = (i: number, field: keyof TestCase, value: string) =>
    setTests((prev) => prev.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)));

  const save = async () => {
    const t = title.trim();
    if (!t) return toast("عنوان رو وارد کن", "err");
    const cleanTests = tests.map((tc) => ({ input: tc.input || "", expected: tc.expected || "" })).filter((tc) => tc.expected.trim() !== "");
    if (cleanTests.length === 0) return toast("حداقل یه تست با خروجی لازمه", "err");

    const patch = { title: t, description, hint, test_cases: cleanTests, difficulty, topic: topic.trim() || null };
    setSaving(true);
    try {
      const res = await adminFetch(`/api/admin/library/${exercise.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "ذخیره نشد");
      toast("تمرین کتابخانه ویرایش شد", "ok");
      onSaved({ ...exercise, ...patch });
    } catch (e) {
      toast("خطا: " + getErrorMessage(e), "err");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[130] bg-stone-900/60 backdrop-blur-sm anim-fade flex items-center justify-center p-4 text-ink"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl anim-pop w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="font-extrabold flex items-center gap-2">
            <Pencil size={17} /> ویرایش تمرین کتابخانه
          </h2>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={17} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4 flex-1 space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="عنوان تمرین"
            className="w-full border border-line rounded-lg px-3 py-2 outline-none focus:border-primary"
          />
          <textarea
            ref={descRef}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="توضیح تمرین"
            rows={4}
            className="w-full border border-line rounded-lg px-3 py-2 outline-none focus:border-primary resize-none font-mono text-sm"
            dir="auto"
          />
          <RichTextHint textareaRef={descRef} value={description} onChange={setDescription} />
          <textarea
            ref={hintRef}
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder="راهنمایی (اختیاری)"
            rows={2}
            className="w-full border border-line rounded-lg px-3 py-2 outline-none focus:border-primary resize-none font-mono text-sm"
            dir="auto"
          />
          <RichTextHint textareaRef={hintRef} value={hint} onChange={setHint} />

          <DifficultyTopicFields difficulty={difficulty} topic={topic} onDifficulty={setDifficulty} onTopic={setTopic} topicOptions={topicOptions} />

          <div className="flex items-center justify-between pt-2">
            <span className="text-sm font-bold text-muted">تست‌ها</span>
            <button onClick={() => setTests((p) => [...p, { input: "", expected: "" }])} className="text-xs font-bold text-primary">
              + تست جدید
            </button>
          </div>
          {tests.map((tc, i) => (
            <div key={i} className="border border-line rounded-lg p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold">تست {i + 1}</span>
                {tests.length > 1 && (
                  <button onClick={() => setTests((p) => p.filter((_, idx) => idx !== i))} className="text-danger text-xs">
                    حذف ×
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-muted block mb-1">ورودی (stdin)</label>
                  <textarea
                    value={tc.input}
                    onChange={(e) => updateTest(i, "input", e.target.value)}
                    rows={2}
                    className="w-full border border-line rounded-lg px-2 py-1.5 text-xs font-mono outline-none focus:border-primary resize-none"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted block mb-1">خروجی مورد انتظار</label>
                  <textarea
                    value={tc.expected}
                    onChange={(e) => updateTest(i, "expected", e.target.value)}
                    rows={2}
                    className="w-full border border-line rounded-lg px-2 py-1.5 text-xs font-mono outline-none focus:border-primary resize-none"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>
          ))}
          <p className="text-[11px] text-muted">
            این تغییرات فقط روی خود رکورد کتابخانه اعمال میشه (تمرین جدیدی ساخته نمیشه) و روی تمرین‌هایی که قبلاً توی کلاس‌ها از روش کپی شدن اثری نداره.
          </p>
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
