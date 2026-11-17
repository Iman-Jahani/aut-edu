"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { growGarden } from "@/lib/garden";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ToastProvider";
import { gradeOnServer } from "@/lib/grade";
import { noPaste } from "@/lib/editor";
import { ListSkeleton } from "@/components/Skeleton";
import RichText from "@/components/RichText";
import { HintButton, HintBox, useHint } from "@/components/HintPanel";
import { getWindowState, formatDateTime, formatRemaining } from "@/lib/schedule";
import type { Exercise, ExerciseSubmission, TestResult } from "@/lib/types";
import { FileText, Target, Lightbulb, CheckCircle2, XCircle, Play, X, Lock, CalendarClock, EyeOff } from "lucide-react";
import { getErrorMessage } from "@/lib/errors";

export default function ExerciseSolveModal({
  exercise,
  mySubmission,
  onClose,
  onSubmitted,
}: {
  exercise: Exercise;
  mySubmission?: ExerciseSubmission;
  onClose: () => void;
  onSubmitted: (sub: ExerciseSubmission) => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const draftKey = `exercise_draft_${exercise.id}`;
  const [code, setCode] = useState(
    () => mySubmission?.code || (typeof window !== "undefined" ? localStorage.getItem(draftKey) : "") || ""
  );
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [summary, setSummary] = useState<{ passed: number; total: number; status: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const extensions = useMemo(() => [python(), noPaste(() => toast("پیست کردن غیرفعاله", "err"))], [toast]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, code);
      } catch {
        /* ignore */
      }
    }, 500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [code, draftKey]);

  const testCount = Math.max(1, (exercise.test_cases?.length || 0) + (exercise.private_tests || 0));

  // Submission window: after the deadline the exercise is view-only. (The database
  // enforces the same rule, so this is a convenience, not the only guard.)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const windowState = getWindowState(exercise, now);
  const closed = windowState === "closed";
  const msLeft = exercise.due_at ? new Date(exercise.due_at).getTime() - now : null;

  const hintState = useHint({
    code,
    context: [exercise.description, exercise.hint].filter(Boolean).join("\n"),
    error: results?.find((r) => !r.passed)?.actual,
  });

  const run = async () => {
    if (!user) return;
    if (closed) return toast("مهلت این تمرین تموم شده", "err");
    setRunning(true);
    setResults(null);
    try {
      // The server runs the tests, judges them and records the submission (nothing is trusted from the browser).
      const { saved, submission, results: r } = await gradeOnServer(exercise.id, code);
      setResults(r);
      const status = submission.status;
      setSummary({ passed: submission.passed_tests, total: submission.total_tests, status });
      if (saved) {
        onSubmitted(submission);
        growGarden(status === "correct" ? 15 : 5, status === "correct" ? "solved" : "submit");
        if (status === "correct") toast("🎉 پاس شد!", "ok");
        else if (status === "partial") toast(`${submission.passed_tests} از ${submission.total_tests}`, "info");
      } else {
        toast("نتیجه‌ی آزمایشی (چون معلمی، ثبت نشد)", "info");
      }
    } catch (e) {
      toast(getErrorMessage(e), "err");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-sm anim-fade flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl anim-pop w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="font-extrabold flex items-center gap-2"><FileText size={17} /> {exercise.title}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={17} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4 flex-1 space-y-4">
          {exercise.description && <div className="text-sm text-ink/80"><RichText text={exercise.description} /></div>}
          <div className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 flex items-center gap-1.5">
            <Target size={13} className="shrink-0" /> {testCount} تست — کدت باید برای همه‌ی ورودی‌ها خروجی درست بده
          </div>
          {exercise.hint && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-900 flex items-start gap-1.5">
              <Lightbulb size={13} className="shrink-0 mt-0.5" /> <span><b>راهنمایی:</b> <RichText text={exercise.hint} /></span>
            </div>
          )}

          {exercise.due_at && !closed && msLeft !== null && (
            <div className={`rounded-lg px-3 py-2 text-xs flex items-center gap-1.5 border ${msLeft <= 3 * 3600_000 ? "bg-red-50 border-red-200 text-red-800" : "bg-sky-50 border-sky-100 text-sky-900"}`}>
              <CalendarClock size={13} className="shrink-0" /> مهلت تحویل: {formatDateTime(exercise.due_at)} — {formatRemaining(msLeft)} مونده
            </div>
          )}
          {closed && (
            <div className="rounded-lg px-3 py-2 text-xs flex items-center gap-1.5 border bg-slate-100 border-slate-200 text-slate-700">
              <Lock size={13} className="shrink-0" /> مهلت این تمرین ({formatDateTime(exercise.due_at)}) تموم شده؛ فقط می‌تونی مرورش کنی.
            </div>
          )}

          <CodeMirror
            value={code}
            editable={!closed}
            readOnly={closed}
            onChange={setCode}
            theme={dracula}
            height="220px"
            extensions={extensions}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                e.preventDefault();
                run();
              }
            }}
          />

          <HintBox state={hintState} />

          {running && <ListSkeleton rows={2} />}

          {summary && !running && (
            <div
              className={`rounded-xl p-4 flex items-center gap-4 ${
                summary.status === "correct"
                  ? "bg-emerald-50 border border-emerald-200"
                  : summary.status === "partial"
                  ? "bg-amber-50 border border-amber-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              <div className="text-xl font-extrabold">
                {summary.passed}/{summary.total}
              </div>
              <div className="text-sm font-bold">
                {summary.status === "correct"
                  ? "🎉 همه پاس!"
                  : summary.status === "partial"
                  ? "نزدیک بودی"
                  : "دوباره تلاش کن"}
              </div>
            </div>
          )}

          {results && !running && (
            <div className="space-y-2">
              {results.map((r, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-3 text-xs ${
                    r.passed ? "border-emerald-200 bg-emerald-50/50" : "border-red-200 bg-red-50/50"
                  }`}
                >
                  <div className="flex justify-between font-bold mb-1.5">
                    <span>تست {i + 1}</span>
                    <span className="flex items-center gap-1">{r.passed ? <CheckCircle2 size={13} /> : <XCircle size={13} />} {r.passed ? "پاس" : "ناموفق"}</span>
                  </div>
                  {r.hidden || r.kind === "checker" ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-muted">
                        <EyeOff size={12} /> {r.kind === "checker" ? `تست شبیه‌سازی (${r.runs_passed ?? 0}/${r.runs ?? 1} اجرا درست)` : "تست مخفی"}
                      </div>
                      {r.message && <div className="font-bold">{r.message}</div>}
                      {r.error && <div className="font-mono whitespace-pre-wrap break-words text-danger" dir="ltr">{r.error}</div>}
                      {!r.passed && r.actual && !r.hidden && (
                        <div className="font-mono whitespace-pre-wrap break-words" dir="ltr">
                          <div className="text-muted mb-0.5">خروجی تو</div>
                          {r.actual}
                        </div>
                      )}
                    </div>
                  ) : (
                  <div className="grid grid-cols-3 gap-2 font-mono" dir="ltr">
                    <div>
                      <div className="text-muted mb-0.5">ورودی</div>
                      <div className="whitespace-pre-wrap break-words">{r.input || "(خالی)"}</div>
                    </div>
                    <div>
                      <div className="text-muted mb-0.5">انتظار</div>
                      <div className="whitespace-pre-wrap break-words">{r.expected || "(خالی)"}</div>
                    </div>
                    <div>
                      <div className="text-muted mb-0.5">خروجی تو</div>
                      <div className="whitespace-pre-wrap break-words">{r.actual || "(خالی)"}</div>
                    </div>
                  </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-line flex justify-end gap-2">
          {!closed && <HintButton onClick={hintState.ask} loading={hintState.loading} />}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold border border-line">
            بستن
          </button>
          <button
            onClick={run}
            disabled={running || closed}
            className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-gradient-to-br from-primary to-primary2 disabled:opacity-50"
          >
            <span className="flex items-center gap-1.5">{!running && <Play size={14} />} {running ? "در حال اجرا…" : "اجرا (Ctrl+Enter)"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
