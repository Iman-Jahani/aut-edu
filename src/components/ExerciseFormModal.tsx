"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ToastProvider";
import type { Exercise, ExerciseSet, TestCase } from "@/lib/types";
import { Pencil, FileText, BookOpen, X, CalendarClock, EyeOff, Dices } from "lucide-react";
import { toLocalInput, fromLocalInput } from "@/lib/schedule";
import RichTextHint from "@/components/RichTextHint";
import { getErrorMessage } from "@/lib/errors";
import DifficultyTopicFields from "@/components/DifficultyTopicFields";

const CHECKER_EXAMPLE = `def check(ctx):
    # ctx.stdout: خروجی برنامه · ctx.numbers(): همه‌ی عددهای چاپ‌شده
    # ctx.results_of("randint"): مقدارهایی که randint واقعاً برگردونده (به ترتیب)
    nums = ctx.numbers()
    assert len(nums) == 1, "باید فقط یک عدد چاپ کنی"
    assert 1 <= nums[0] <= 6, "عدد باید بین ۱ تا ۶ باشه"


def check_all(ctxs):
    # بعد از اجرای همه‌ی دفعه‌ها: جلوی hardcode کردن رو بگیر
    assert len({c.stdout for c in ctxs}) > 1, "خروجی توی همه‌ی اجراها یکسانه؛ مقدار رو ثابت ننویس"
`;

function normalizeTest(t: TestCase): TestCase {
  return { ...t, input: t.input || "", expected: t.expected || "", kind: t.kind === "checker" ? "checker" : "exact" };
}

export default function ExerciseFormModal({
  classId,
  exercise,
  template,
  set,
  onClose,
  onSaved,
}: {
  classId: string;
  exercise?: Exercise | null;
  /** When adding a NEW question to a series: the series (schedule is inherited from it). */
  set?: ExerciseSet | null;
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
      ? exercise.test_cases.map(normalizeTest)
      : template?.test_cases?.length
      ? template.test_cases.map(normalizeTest)
      : exercise?.private_tests
      ? []
      : [{ input: "", expected: "", kind: "exact" }]
  );
  // Hidden tests / checkers live in a teacher-only table. Saving before they're loaded would wipe them.
  const [privLoaded, setPrivLoaded] = useState(!exercise?.private_tests);
  const [difficulty, setDifficulty] = useState<number | null>(exercise?.difficulty ?? template?.difficulty ?? null);
  const [topic, setTopic] = useState(exercise?.topic || template?.topic || "");
  const [addToLibrary, setAddToLibrary] = useState(false);
  const [opensAt, setOpensAt] = useState(toLocalInput(exercise?.opens_at));
  const [dueAt, setDueAt] = useState(toLocalInput(exercise?.due_at));
  const [saving, setSaving] = useState(false);
  // Questions of a series follow the series' schedule, so the schedule fields are hidden for them.
  const inSet = !!(set || exercise?.set_id);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const hintRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setAddToLibrary(false);
  }, [exercise]);

  useEffect(() => {
    if (!exercise?.private_tests) return;
    let alive = true;
    supabase
      .from("exercise_graders")
      .select("tests")
      .eq("exercise_id", exercise.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) return toast("تست‌های مخفی بارگذاری نشد: " + error.message, "err");
        const priv = ((data?.tests as TestCase[] | null) || []).map((t) => ({ ...normalizeTest(t), hidden: t.kind === "checker" ? undefined : true }));
        setTests((prev) => (prev.length || priv.length ? [...prev, ...priv] : [{ input: "", expected: "", kind: "exact" }]));
        setPrivLoaded(true);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.id]);

  const updateTest = (i: number, patch: Partial<TestCase>) => {
    setTests((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  };
  const removeTest = (i: number) => setTests((prev) => prev.filter((_, idx) => idx !== i));
  const addTest = () => setTests((prev) => [...prev, { input: "", expected: "", kind: "exact" }]);

  const save = async () => {
    const t = title.trim();
    if (!t) return toast("عنوان رو وارد کن", "err");
    if (!privLoaded) return toast("صبر کن تا تست‌های مخفی بارگذاری بشه", "err");
    for (const [i, tc] of tests.entries()) {
      if (tc.kind === "checker" && !/def\s+check(_all)?\s*\(/.test(tc.checker || "")) return toast(`تست ${i + 1}: چک‌کننده باید تابع check(ctx) رو تعریف کنه`, "err");
    }
    const isUsable = (tc: TestCase) => (tc.kind === "checker" ? !!(tc.checker || "").trim() : (tc.expected || "").trim() !== "");
    const usable = tests.filter(isUsable);
    if (usable.length === 0) return toast("حداقل یه تست با خروجی (یا چک‌کننده) لازمه", "err");
    // Public tests keep the old shape in exercises.test_cases (students and the library see these);
    // hidden tests and checkers go to exercise_graders (teacher-only, read by the grading server).
    const toStored = (tc: TestCase): TestCase =>
      tc.kind === "checker"
        ? { kind: "checker", input: tc.input || "", expected: "", checker: tc.checker || "", runs: Math.max(1, Math.min(20, Number(tc.runs) || 5)), ...(tc.random?.trim() ? { random: tc.random.trim() } : {}) }
        : { input: tc.input || "", expected: tc.expected || "", ...(tc.hidden ? { hidden: true } : {}), ...(tc.random?.trim() ? { random: tc.random.trim() } : {}) };
    const cleanTests = usable.filter((tc) => tc.kind !== "checker" && !tc.hidden).map(toStored);
    const privateTests = usable.filter((tc) => tc.kind === "checker" || tc.hidden).map(toStored);
    if (addToLibrary && cleanTests.length === 0) return toast("برای کتابخانه حداقل یه تست عمومی (غیرمخفی) لازمه", "err");
    // Only send the new column when it's used, so databases without the migration keep working.
    const privCol = privateTests.length || exercise?.private_tests ? { private_tests: privateTests.length } : {};
    const saveGraders = async (exerciseId: string) => {
      if (privateTests.length) {
        const { error } = await supabase.from("exercise_graders").upsert({ exercise_id: exerciseId, class_id: classId, tests: privateTests, updated_at: new Date().toISOString() }, { onConflict: "exercise_id" });
        if (error) throw error;
      } else if (exercise?.private_tests) {
        const { error } = await supabase.from("exercise_graders").delete().eq("exercise_id", exerciseId);
        if (error) throw error;
      }
    };

    const opensIso = fromLocalInput(opensAt);
    const dueIso = fromLocalInput(dueAt);
    if (!inSet && opensIso && dueIso && new Date(dueIso) <= new Date(opensIso)) return toast("زمان پایان باید بعد از زمان شروع باشه", "err");
    // Only send the schedule columns when they're used, so everything keeps working
    // on databases that haven't added them yet. Series questions: new ones inherit the series' schedule,
    // existing ones are never touched here (the series owns the schedule).
    const schedule = inSet
      ? set && (set.opens_at || set.due_at)
        ? { opens_at: set.opens_at, due_at: set.due_at }
        : {}
      : opensIso || dueIso || exercise?.opens_at || exercise?.due_at
      ? { opens_at: opensIso, due_at: dueIso }
      : {};

    // Same idea as the schedule: only send difficulty/topic when they're used, so
    // databases that haven't run the migration yet keep working.
    const cleanTopic = topic.trim();
    const meta = difficulty || cleanTopic || exercise?.difficulty || exercise?.topic ? { difficulty, topic: cleanTopic || null } : {};

    setSaving(true);
    try {
      if (exercise) {
        const { error } = await supabase
          .from("exercises")
          .update({ title: t, description, hint, test_cases: cleanTests, ...privCol, ...meta, ...schedule, updated_at: new Date().toISOString() })
          .eq("id", exercise.id);
        if (error) throw error;
        await saveGraders(exercise.id);
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
          .insert({ class_id: classId, ...(set ? { set_id: set.id } : {}), title: t, description, hint, test_cases: cleanTests, ...privCol, ...meta, ...schedule })
          .select()
          .single();
        if (error) throw error;
        if (newEx) await saveGraders(newEx.id);
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
            {exercise ? "ویرایش تمرین" : set ? `سؤال جدید · ${set.title}` : "تمرین جدید"}
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

          {tests.map((tc, i) => {
            const isChecker = tc.kind === "checker";
            return (
              <div key={i} className="border border-line rounded-lg p-3 space-y-2">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    تست {i + 1}
                    {(isChecker || tc.hidden) && (
                      <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-muted">
                        <EyeOff size={10} /> مخفی
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-3">
                    <select
                      value={isChecker ? "checker" : "exact"}
                      onChange={(e) => updateTest(i, { kind: e.target.value as "exact" | "checker", runs: e.target.value === "checker" ? tc.runs || 5 : tc.runs })}
                      className="text-[11px] border border-line rounded-lg px-2 py-1 bg-white outline-none"
                    >
                      <option value="exact">خروجی دقیق</option>
                      <option value="checker">شبیه‌سازی / random (چک‌کننده)</option>
                    </select>
                    {!isChecker && (
                      <label className="flex items-center gap-1 text-[11px] cursor-pointer" title="ورودی و خروجی این تست به دانشجو نشون داده نمی‌شه">
                        <input type="checkbox" checked={!!tc.hidden} onChange={(e) => updateTest(i, { hidden: e.target.checked })} /> مخفی
                      </label>
                    )}
                    {tests.length > 1 && (
                      <button onClick={() => removeTest(i)} className="text-danger text-xs">
                        حذف ×
                      </button>
                    )}
                  </div>
                </div>

                <div className={isChecker ? "" : "grid grid-cols-2 gap-2"}>
                  <div>
                    <label className="text-[11px] text-muted block mb-1">ورودی (stdin){isChecker ? " — اختیاری" : ""}</label>
                    <textarea
                      value={tc.input}
                      onChange={(e) => updateTest(i, { input: e.target.value })}
                      rows={2}
                      className="w-full border border-line rounded-lg px-2 py-1.5 text-xs font-mono outline-none focus:border-primary resize-none"
                      dir="ltr"
                    />
                  </div>
                  {!isChecker && (
                    <div>
                      <label className="text-[11px] text-muted block mb-1">خروجی مورد انتظار</label>
                      <textarea
                        value={tc.expected}
                        onChange={(e) => updateTest(i, { expected: e.target.value })}
                        rows={2}
                        className="w-full border border-line rounded-lg px-2 py-1.5 text-xs font-mono outline-none focus:border-primary resize-none"
                        dir="ltr"
                      />
                    </div>
                  )}
                </div>

                {isChecker && (
                  <>
                    <div className="flex items-center gap-2 text-[11px]">
                      <label className="text-muted">تعداد اجرا با seedهای مختلف</label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={tc.runs ?? 5}
                        onChange={(e) => updateTest(i, { runs: Number(e.target.value) })}
                        className="w-16 border border-line rounded-lg px-2 py-1 text-xs outline-none focus:border-primary"
                        dir="ltr"
                      />
                      <span className="text-muted">برنامه‌ی دانشجو باید در همه‌ی اجراها پاس بشه</span>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] text-muted">کد چک‌کننده (Python)</label>
                        <button type="button" onClick={() => updateTest(i, { checker: CHECKER_EXAMPLE })} className="text-[11px] font-bold text-primary">
                          درج نمونه
                        </button>
                      </div>
                      <textarea
                        value={tc.checker || ""}
                        onChange={(e) => updateTest(i, { checker: e.target.value })}
                        rows={7}
                        spellCheck={false}
                        placeholder={"def check(ctx):\n    ..."}
                        className="w-full border border-line rounded-lg px-2 py-1.5 text-xs font-mono outline-none focus:border-primary resize-y"
                        dir="ltr"
                      />
                      <p className="text-[11px] text-muted mt-1 leading-5">
                        <code dir="ltr">ctx.stdout</code> · <code dir="ltr">ctx.lines</code> · <code dir="ltr">ctx.numbers()</code> · <code dir="ltr">ctx.calls_of("randint")</code> · <code dir="ltr">ctx.results_of("randint")</code>. برای رد کردن
                        <code dir="ltr"> assert cond, "پیام"</code> یا <code dir="ltr">return False</code>. اختیاری: <code dir="ltr">check_all(ctxs)</code> برای بررسی همه‌ی اجراها با هم
                        (مثلاً «خروجی همیشه یکسان نباشه» یا میانگین نزدیک مقدار درست باشه). با دکمه‌ی «امتحان» روی تمرین، با کد راه‌حل خودت تستش کن.
                      </p>
                    </div>
                  </>
                )}

                <details className="text-[11px]" open={!!tc.random?.trim()}>
                  <summary className="cursor-pointer text-muted flex items-center gap-1 w-fit">
                    <Dices size={12} /> کنترل random این تست <span>(اختیاری)</span>
                  </summary>
                  <textarea
                    value={tc.random || ""}
                    onChange={(e) => updateTest(i, { random: e.target.value })}
                    rows={3}
                    spellCheck={false}
                    placeholder={"seed: 7\nrandint: 4, 2, 6\nchoice: 0, 2"}
                    className="mt-1.5 w-full border border-line rounded-lg px-2 py-1.5 text-xs font-mono outline-none focus:border-primary resize-none"
                    dir="ltr"
                  />
                  <p className="text-muted mt-1 leading-5">
                    هر خط یک تنظیم: <code dir="ltr">seed</code> (seed ثابت برای بقیه‌ی random ها)، <code dir="ltr">randint</code>، <code dir="ltr">randrange</code>، <code dir="ltr">random</code>،{" "}
                    <code dir="ltr">uniform</code> (مقدارهای پشت‌سرهم) و <code dir="ltr">choice</code> (اندیسِ عنصر انتخابی). ترتیب فقط بین فراخوانی‌های <b>یک تابع</b> مهمه؛ مثلاً randint و choice از هم مستقلن.
                    اگه برنامه بیشتر از تعداد مقدارها صدا بزنه، دانشجو پیغام روشن می‌گیره.
                  </p>
                </details>
              </div>
            );
          })}

          {!inSet && (
          <div className="border border-line rounded-lg p-3 space-y-2.5">
            <div className="flex items-center gap-1.5 text-sm font-bold text-muted">
              <CalendarClock size={15} /> بازه‌ی مجاز پاسخ‌دادن <span className="text-[11px] font-normal">(اختیاری)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
          )}
          {inSet && <p className="text-[11px] text-muted">بازه‌ی زمانیِ این سؤال همون بازه‌ی سری‌ه (از «ویرایش سری» عوضش کن).</p>}

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
          {tests.some((t) => t.kind === "checker" || t.hidden) && (
            <p className="text-[11px] text-muted flex items-start gap-1.5">
              <EyeOff size={12} className="shrink-0 mt-0.5" /> تست‌های مخفی و چک‌کننده‌ها فقط سمت سرور نگه‌داری می‌شن و به کتابخانه (که عمومیه) نمی‌رن.
            </p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-line flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold border border-line">
            لغو
          </button>
          <button
            onClick={save}
            disabled={saving || !privLoaded}
            className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-gradient-to-br from-primary to-primary2 disabled:opacity-50"
          >
            {saving ? "در حال ذخیره…" : "ذخیره"}
          </button>
        </div>
      </div>
    </div>
  );
}
