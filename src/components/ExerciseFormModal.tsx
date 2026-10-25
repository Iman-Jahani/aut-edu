"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ToastProvider";
import type { Exercise, TestCase } from "@/lib/types";
import { Pencil, FileText, BookOpen, X, CalendarClock } from "lucide-react";
import { toLocalInput, fromLocalInput } from "@/lib/schedule";
import RichTextHint from "@/components/RichTextHint";
import { getErrorMessage } from "@/lib/errors";
import DifficultyTopicFields from "@/components/DifficultyTopicFields";

export default function ExerciseFormModal({
  classId,
  exercise,
  template,
  onClose,
  onSaved,
}: {
  classId: string;
  exercise?: Exercise | null;
  template?: { title: string; description: string; hint: string; test_cases: TestCase[]; difficulty?: number | null; topic?: string | null } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { displayName } = useAuth();
  const toast = useToast();
  const [title, setTitle] = useState(exercise?.title || template?.title || "");
  const [description, setDescription] = useState(exercise?.description || template?.description || "");
  const [hint, setHint] = useState(exercise?.hint || template?.hint || "");
  const [tests, setTests] = useState<TestCase[]>(
    exercise?.test_cases?.length
      ? exercise.test_cases
      : template?.test_cases?.length
      ? template.test_cases
      : [{ input: "", expected: "" }]
  );
  const [difficulty, setDifficulty] = useState<number | null>(exercise?.difficulty ?? template?.difficulty ?? null);
  const [topic, setTopic] = useState(exercise?.topic || template?.topic || "");
  const [addToLibrary, setAddToLibrary] = useState(false);
  const [opensAt, setOpensAt] = useState(toLocalInput(exercise?.opens_at));
  const [dueAt, setDueAt] = useState(toLocalInput(exercise?.due_at));
  const [saving, setSaving] = useState(false);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const hintRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setAddToLibrary(false);
  }, [exercise]);

  const updateTest = (i: number, field: keyof TestCase, value: string) => {
    setTests((prev) => prev.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)));
  };
  const removeTest = (i: number) => setTests((prev) => prev.filter((_, idx) => idx !== i));
  const addTest = () => setTests((prev) => [...prev, { input: "", expected: "" }]);

  const save = async () => {
    const t = title.trim();
    if (!t) return toast("عنوان رو وارد کن", "err");
    const cleanTests = tests.map((tc) => ({ input: tc.input || "", expected: tc.expected || "" })).filter((tc) => tc.expected.trim() !== "");
    if (cleanTests.length === 0) return toast("حداقل یه تست با خروجی لازمه", "err");

    const opensIso = fromLocalInput(opensAt);
    const dueIso = fromLocalInput(dueAt);
    if (opensIso && dueIso && new Date(dueIso) <= new Date(opensIso)) return toast("زمان پایان باید بعد از زمان شروع باشه", "err");
    // Only send the schedule columns when they're used, so everything keeps working
    // on databases that haven't added them yet.
    const schedule = opensIso || dueIso || exercise?.opens_at || exercise?.due_at ? { opens_at: opensIso, due_at: dueIso } : {};

    // Same idea as the schedule: only send difficulty/topic when they're used, so
    // databases that haven't run the migration yet keep working.
    const cleanTopic = topic.trim();
    const meta = difficulty || cleanTopic || exercise?.difficulty || exercise?.topic ? { difficulty, topic: cleanTopic || null } : {};

    setSaving(true);
    try {
      if (exercise) {
        const { error } = await supabase
          .from("exercises")
          .update({ title: t, description, hint, test_cases: cleanTests, ...meta, ...schedule, updated_at: new Date().toISOString() })
          .eq("id", exercise.id);
        if (error) throw error;
        if (addToLibrary && !exercise.shared_exercise_id) {
          // Adding is allowed; editing an existing library record is admin-only.
          const { data: lib, error: libErr } = await supabase
            .from("shared_exercises")
            .insert({ title: t, description, hint, test_cases: cleanTests, ...meta, created_by_name: displayName })
            .select()
            .single();
          if (libErr) throw libErr;
          if (lib) await supabase.from("exercises").update({ shared_exercise_id: lib.id }).eq("id", exercise.id);
          toast("ویرایش شد + به کتابخانه اضافه شد", "ok");
        } else {
          toast("تمرین ویرایش شد", "ok");
        }
      } else {
        const { data: newEx, error } = await supabase
          .from("exercises")
          .insert({ class_id: classId, title: t, description, hint, test_cases: cleanTests, ...meta, ...schedule })
          .select()
          .single();
        if (error) throw error;
        if (addToLibrary) {
          const { data: lib, error: libErr } = await supabase
            .from("shared_exercises")
            .insert({ title: t, description, hint, test_cases: cleanTests, ...meta, created_by_name: displayName })
            .select()
            .single();
          if (libErr) throw libErr;
          if (lib && newEx) await supabase.from("exercises").update({ shared_exercise_id: lib.id }).eq("id", newEx.id);
          toast("ساخته شد + به کتابخانه اضافه شد", "ok");
        } else {
          toast("تمرین ساخته شد", "ok");
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
      className="fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-sm anim-fade flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl anim-pop w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="font-extrabold flex items-center gap-2">
            {exercise ? <Pencil size={17} /> : <FileText size={17} />}
            {exercise ? "ویرایش تمرین" : "تمرین جدید"}
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
            placeholder="توضیح تمرین (اختیاری) — می‌تونی مثال کد هم بذاری"
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

          <DifficultyTopicFields difficulty={difficulty} topic={topic} onDifficulty={setDifficulty} onTopic={setTopic} />

          <div className="flex items-center justify-between pt-2">
            <span className="text-sm font-bold text-muted">تست‌ها</span>
            <button onClick={addTest} className="text-xs font-bold text-primary">
              + تست جدید
            </button>
          </div>

          {tests.map((tc, i) => (
            <div key={i} className="border border-line rounded-lg p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold">تست {i + 1}</span>
                {tests.length > 1 && (
                  <button onClick={() => removeTest(i)} className="text-danger text-xs">
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

          <div className="border border-line rounded-lg p-3 space-y-2.5">
            <div className="flex items-center gap-1.5 text-sm font-bold text-muted">
              <CalendarClock size={15} /> بازه‌ی مجاز پاسخ‌دادن <span className="text-[11px] font-normal">(اختیاری)</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {(
                [
                  ["شروع", opensAt, setOpensAt],
                  ["پایان (مهلت تحویل)", dueAt, setDueAt],
                ] as const
              ).map(([label, value, setter]) => (
                <div key={label}>
                  <label className="text-[11px] text-muted block mb-1">{label}</label>
                  <div className="flex gap-1">
                    <input
                      type="datetime-local"
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      className="flex-1 min-w-0 border border-line rounded-lg px-2 py-1.5 text-sm outline-none focus:border-primary"
                    />
                    {value && (
                      <button type="button" onClick={() => setter("")} className="px-2 text-muted hover:text-danger" title="پاک کردن">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted">
              خالی بذاری یعنی همیشه باز. قبل از شروع دانشجوها تمرین رو قفل می‌بینن، و بعد از پایان فقط می‌تونن مرورش کنن. هر وقت خواستی از «ویرایش» عوضش کن.
            </p>
          </div>

          {exercise?.shared_exercise_id ? (
            <div className="flex items-start gap-2 text-[12px] text-muted pt-2">
              <BookOpen size={14} className="shrink-0 mt-0.5" />
              این تمرین توی کتابخانه‌ی اشتراکیه. تغییرات اینجا فقط روی تمرین همین کلاس اعمال میشه؛ ویرایش نسخه‌ی کتابخانه فقط از پنل ادمین ممکنه.
            </div>
          ) : (
            <label className="flex items-center gap-2 text-sm pt-2 cursor-pointer">
              <input type="checkbox" checked={addToLibrary} onChange={(e) => setAddToLibrary(e.target.checked)} />
              <BookOpen size={14} className="shrink-0" />
              این تمرین رو به کتابخانه اشتراکی اضافه کن
            </label>
          )}
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
