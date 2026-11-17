"use client";

import { useCallback, useEffect, useState } from "react";
import { stripRich } from "@/components/RichText";
import { getWindowState, formatDateTime, formatRemaining, urgency } from "@/lib/schedule";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ToastProvider";
import { fmtRelative } from "@/lib/utils";
import ExerciseSolveModal from "@/components/ExerciseSolveModal";
import ExerciseFormModal from "@/components/ExerciseFormModal";
import SubmissionsModal from "@/components/SubmissionsModal";
import LibraryPickerModal from "@/components/LibraryPickerModal";
import ExerciseSetFormModal from "@/components/ExerciseSetFormModal";
import { getErrorMessage } from "@/lib/errors";
import type { Exercise, ExerciseSet, ExerciseSubmission, SharedExercise } from "@/lib/types";
import { CardGridSkeleton } from "@/components/Skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import { DifficultyBadge, TopicBadge } from "@/components/DifficultyBadge";
import { BookOpen, Plus, FileText, CheckCircle2, Eye, Pencil, Trash2, Play, RotateCcw, X, Lock, CalendarClock, Layers, ChevronDown } from "lucide-react";

export default function ExercisesModal({
  classId,
  teacherMode,
  onClose,
}: {
  classId: string;
  teacherMode: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [mySubs, setMySubs] = useState<Record<string, ExerciseSubmission>>({});
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const [solving, setSolving] = useState<Exercise | null>(null);
  const [editing, setEditing] = useState<Exercise | null | "new">(null);
  const [templateForNew, setTemplateForNew] = useState<SharedExercise | null>(null);
  const [viewingSubs, setViewingSubs] = useState<Exercise | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  // Series ("سری تمرین"): a named group of questions
  const [sets, setSets] = useState<ExerciseSet[]>([]);
  const [setForm, setSetForm] = useState<ExerciseSet | null | "new">(null);
  const [targetSet, setTargetSet] = useState<ExerciseSet | null>(null); // series a NEW question is being added to
  const [librarySet, setLibrarySet] = useState<ExerciseSet | null>(null); // series the library picker adds into (null = standalone)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("exercises")
      .select("*")
      .eq("class_id", classId)
      .order("created_at", { ascending: true });
    const list = data || [];
    setExercises(list);
    // Tolerant of databases that haven't run migration_exercise_sets.sql yet (no series then).
    const { data: setData, error: setErr } = await supabase.from("exercise_sets").select("*").eq("class_id", classId).order("created_at", { ascending: true });
    setSets(setErr ? [] : ((setData || []) as ExerciseSet[]));
    if (list.length && user) {
      const { data: subs } = await supabase
        .from("exercise_submissions")
        .select("*")
        .in(
          "exercise_id",
          list.map((e) => e.id)
        )
        .eq("user_id", user.id);
      const map: Record<string, ExerciseSubmission> = {};
      (subs || []).forEach((s) => (map[s.exercise_id] = s));
      setMySubs(map);
    } else {
      setMySubs({});
    }
    setLoading(false);
  }, [classId, user]);

  useEffect(() => {
    load();
  }, [load]);

  const deleteExercise = async (ex: Exercise) => {
    if (!confirm(`تمرین «${ex.title}» حذف شود؟`)) return;
    const { error } = await supabase.from("exercises").delete().eq("id", ex.id);
    if (error) return toast("خطا: " + error.message, "err");
    toast("حذف شد", "ok");
    load();
  };

  const deleteSet = async (st: ExerciseSet) => {
    const n = exercises.filter((e) => e.set_id === st.id).length;
    const msg = n
      ? `سری «${st.title}» با ${n.toLocaleString("fa-IR")} سؤال و همه‌ی پاسخ‌های دانشجوها حذف می‌شه. مطمئنی؟`
      : `سری «${st.title}» حذف شود؟`;
    if (!confirm(msg)) return;
    const { error } = await supabase.from("exercise_sets").delete().eq("id", st.id);
    if (error) return toast("خطا: " + error.message, "err");
    toast("سری حذف شد", "ok");
    load();
  };

  // Several library questions → one series, in one go (each becomes its own editable question).
  const addFromLibrary = async (st: ExerciseSet, list: SharedExercise[]) => {
    const hasMeta = list.some((x) => x.difficulty || x.topic);
    const sched = st.opens_at || st.due_at ? { opens_at: st.opens_at, due_at: st.due_at } : {};
    const rows = list.map((x) => ({
      class_id: classId,
      set_id: st.id,
      title: x.title,
      description: x.description || "",
      hint: x.hint || "",
      test_cases: x.test_cases || [],
      ...(hasMeta ? { difficulty: x.difficulty ?? null, topic: x.topic || null } : {}),
      ...sched,
    }));
    const { error } = await supabase.from("exercises").insert(rows);
    if (error) return toast("خطا: " + getErrorMessage(error), "err");
    toast(`${list.length.toLocaleString("fa-IR")} سؤال به «${st.title}» اضافه شد`, "ok");
    setLibraryOpen(false);
    setLibrarySet(null);
    load();
  };

  const renderCard = (ex: Exercise) => {
    const sub = mySubs[ex.id];
    const status = sub?.status || "pending";
    const total = (ex.test_cases?.length || 0) + (ex.private_tests || 0) || 1;
    const solved = status === "correct";
    const partial = status === "partial";
    const ws = getWindowState(ex, now);
    const locked = !teacherMode && ws === "upcoming";
    const closed = ws === "closed";
    const msLeft = ex.due_at ? new Date(ex.due_at).getTime() - now : null;
    const urg = msLeft !== null && ws === "open" && !solved ? urgency(msLeft) : null;
    return (
      <div key={ex.id} className={`border rounded-xl p-4 ${solved ? "border-emerald-300 bg-emerald-50/40" : partial ? "border-amber-300 bg-amber-50/30" : "border-line"}`}>
      <div className="font-bold text-sm mb-1 flex items-center gap-1.5"><FileText size={14} className="text-primary shrink-0" /> {ex.title}</div>
      {(ex.difficulty || ex.topic) && (
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          <DifficultyBadge value={ex.difficulty} />
          <TopicBadge value={ex.topic} />
        </div>
      )}
      {ex.description && <p className="text-xs text-muted mb-2 line-clamp-2">{stripRich(ex.description)}</p>}
      {ws !== "none" && (
        <div
          className={`text-[11px] font-bold mb-2 flex items-center gap-1.5 rounded-lg px-2 py-1 ${
            locked
              ? "bg-slate-100 text-slate-600"
              : closed
              ? "bg-slate-100 text-slate-500"
              : urg === "soon"
              ? "bg-red-50 text-red-700"
              : urg === "today"
              ? "bg-amber-50 text-amber-700"
              : "bg-sky-50 text-sky-800"
          }`}
        >
          <CalendarClock size={12} className="shrink-0" />
          {ws === "upcoming"
            ? `شروع: ${formatDateTime(ex.opens_at)}`
            : closed
            ? `مهلت تموم شد (${formatDateTime(ex.due_at)})`
            : msLeft !== null
            ? `${formatRemaining(msLeft)} تا مهلت تحویل`
            : "باز"}
        </div>
      )}
      {teacherMode && ws !== "none" && (
        <div className="text-[11px] text-muted mb-2 leading-5">
          {ex.opens_at && <div>شروع: {formatDateTime(ex.opens_at)}</div>}
          {ex.due_at && <div>پایان: {formatDateTime(ex.due_at)}</div>}
        </div>
      )}
      {teacherMode && ex.shared_exercise_id && (
        <div className="text-[11px] text-emerald-600 font-bold mb-1 flex items-center gap-1"><CheckCircle2 size={12} /> در کتابخانه اشتراکی</div>
      )}
      <div className="flex items-center gap-2 text-[11px] text-muted mb-3">
        {!teacherMode && (
          <StatusBadge
            status={status as "correct" | "partial" | "wrong" | "error" | "pending"}
            text={partial ? `${sub?.passed_tests || 0}/${total}` : undefined}
          />
        )}
        <span className="px-2 py-0.5 rounded-full bg-slate-100">{total} تست</span>
        {teacherMode && <span>{fmtRelative(ex.created_at)}</span>}
      </div>

      {teacherMode ? (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setViewingSubs(ex)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-line">
            <Eye size={13} /> پاسخ‌ها
          </button>
          <button onClick={() => setSolving(ex)} title="با کد راه‌حل خودت تصحیح خودکار رو امتحان کن (ثبت نمی‌شه)" className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-line">
            <Play size={13} /> امتحان
          </button>
          <button
            onClick={() => {
              setTemplateForNew(null);
              setEditing(ex);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-line"
          >
            <Pencil size={13} /> ویرایش
          </button>
          <button
            onClick={() => deleteExercise(ex)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-danger border border-red-200"
          >
            <Trash2 size={13} /> حذف
          </button>
        </div>
      ) : (
        <button
          onClick={() => !locked && setSolving(ex)}
          disabled={locked}
          className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${
            locked ? "bg-slate-100 text-slate-400 cursor-not-allowed" : closed ? "border border-line text-ink bg-white" : "text-white bg-gradient-to-br from-primary to-primary2"
          }`}
        >
          {locked ? <Lock size={13} /> : closed ? <Eye size={13} /> : solved ? <RotateCcw size={13} /> : <Play size={13} />}
          {locked ? "هنوز باز نشده" : closed ? "مرور" : solved ? "دوباره حل کن" : "حل کن"}
        </button>
      )}
      </div>
    );
  };

  const standalone = exercises.filter((e) => !e.set_id || !sets.some((st) => st.id === e.set_id));

  return (
    <div
      className="fixed inset-0 z-[105] bg-slate-900/50 backdrop-blur-sm anim-fade flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl anim-pop w-full max-w-3xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="font-extrabold flex items-center gap-2"><FileText size={18} /> تمرین‌ها</h2>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={17} />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1">
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <span className="text-sm text-muted">{sets.length ? `${sets.length.toLocaleString("fa-IR")} سری · ` : ""}{exercises.length.toLocaleString("fa-IR")} سؤال</span>
            {teacherMode && (
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setSetForm("new")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-primary/40 text-primary bg-primary/5"
                >
                  <Layers size={14} /> سری جدید
                </button>
                <button
                  onClick={() => {
                    setLibrarySet(null);
                    setLibraryOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-line"
                >
                  <BookOpen size={14} /> از کتابخانه
                </button>
                <button
                  onClick={() => {
                    setTemplateForNew(null);
                    setTargetSet(null);
                    setEditing("new");
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-br from-primary to-primary2"
                >
                  <Plus size={14} /> تمرین مستقل
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <CardGridSkeleton count={4} />
          ) : exercises.length === 0 && sets.length === 0 ? (
            <div className="text-center py-16">
              <FileText size={40} className="mx-auto mb-3 text-primary/40" />
              <h3 className="font-bold">{teacherMode ? "هنوز تمرینی نساختی" : "هنوز تمرینی نیست"}</h3>
            </div>
          ) : (
            <div className="space-y-5">
              {sets.map((st) => {
                const qs = exercises.filter((e) => e.set_id === st.id);
                const solvedN = qs.filter((q) => mySubs[q.id]?.status === "correct").length;
                const ws = getWindowState(st, now);
                const msLeft = st.due_at ? new Date(st.due_at).getTime() - now : null;
                const isOpen = !collapsed[st.id];
                return (
                  <section key={st.id} className="border border-line rounded-2xl overflow-hidden">
                    <div className="bg-slate-50 px-4 py-3 flex items-start gap-3 flex-wrap">
                      <button
                        onClick={() => setCollapsed((c) => ({ ...c, [st.id]: isOpen }))}
                        className="flex items-start gap-2 text-right flex-1 min-w-0"
                        aria-expanded={isOpen}
                      >
                        <ChevronDown size={16} className={`mt-1 shrink-0 text-muted transition ${isOpen ? "" : "-rotate-90"}`} />
                        <div className="min-w-0">
                          <div className="font-extrabold text-sm flex items-center gap-1.5">
                            <Layers size={15} className="text-primary shrink-0" /> {st.title}
                          </div>
                          {st.description && <p className="text-xs text-muted mt-0.5 line-clamp-2">{stripRich(st.description)}</p>}
                          <div className="flex items-center gap-1.5 flex-wrap mt-1.5 text-[11px]">
                            <span className="px-2 py-0.5 rounded-full bg-white border border-line text-muted">{qs.length.toLocaleString("fa-IR")} سؤال</span>
                            {!teacherMode && qs.length > 0 && (
                              <span className={`px-2 py-0.5 rounded-full font-bold ${solvedN === qs.length ? "bg-emerald-100 text-emerald-700" : "bg-white border border-line text-muted"}`}>
                                {solvedN.toLocaleString("fa-IR")} از {qs.length.toLocaleString("fa-IR")} حل شده
                              </span>
                            )}
                            {ws !== "none" && (
                              <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 font-bold flex items-center gap-1">
                                <CalendarClock size={11} />
                                {ws === "upcoming"
                                  ? `شروع: ${formatDateTime(st.opens_at)}`
                                  : ws === "closed"
                                  ? `مهلت تموم شد (${formatDateTime(st.due_at)})`
                                  : msLeft !== null
                                  ? `${formatRemaining(msLeft)} تا مهلت تحویل`
                                  : "باز"}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                      {teacherMode && (
                        <div className="flex gap-1.5 flex-wrap">
                          <button
                            onClick={() => {
                              setTemplateForNew(null);
                              setTargetSet(st);
                              setEditing("new");
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-br from-primary to-primary2"
                          >
                            <Plus size={13} /> سؤال جدید
                          </button>
                          <button
                            onClick={() => {
                              setLibrarySet(st);
                              setLibraryOpen(true);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-line bg-white"
                          >
                            <BookOpen size={13} /> از کتابخانه
                          </button>
                          <button onClick={() => setSetForm(st)} title="ویرایش سری" className="p-1.5 rounded-lg border border-line bg-white">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => deleteSet(st)} title="حذف سری" className="p-1.5 rounded-lg border border-red-200 bg-white text-danger">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                    {isOpen && (
                      <div className="p-3">
                        {qs.length === 0 ? (
                          <p className="text-center text-xs text-muted py-6">{teacherMode ? "هنوز سؤالی توی این سری نیست؛ «سؤال جدید» یا «از کتابخانه» رو بزن." : "هنوز سؤالی توی این سری گذاشته نشده."}</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{qs.map(renderCard)}</div>
                        )}
                      </div>
                    )}
                  </section>
                );
              })}

              {standalone.length > 0 && (
                <div>
                  {sets.length > 0 && <div className="text-xs font-bold text-muted mb-2">تمرین‌های مستقل</div>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{standalone.map(renderCard)}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {solving && (
        <ExerciseSolveModal
          exercise={solving}
          mySubmission={mySubs[solving.id]}
          onClose={() => setSolving(null)}
          onSubmitted={(sub) => {
            setMySubs((prev) => ({ ...prev, [sub.exercise_id]: sub }));
          }}
        />
      )}

      {editing && (
        <ExerciseFormModal
          classId={classId}
          exercise={editing === "new" ? null : editing}
          set={editing === "new" ? targetSet : null}
          template={
            templateForNew
              ? {
                  title: templateForNew.title,
                  description: templateForNew.description || "",
                  hint: templateForNew.hint || "",
                  test_cases: templateForNew.test_cases || [],
                  difficulty: templateForNew.difficulty ?? null,
                  topic: templateForNew.topic || "",
                }
              : null
          }
          onClose={() => {
            setEditing(null);
            setTemplateForNew(null);
            setTargetSet(null);
          }}
          onSaved={() => {
            setEditing(null);
            setTemplateForNew(null);
            setTargetSet(null);
            load();
          }}
        />
      )}

      {viewingSubs && <SubmissionsModal exercise={viewingSubs} onClose={() => setViewingSubs(null)} />}

      {setForm && (
        <ExerciseSetFormModal
          classId={classId}
          set={setForm === "new" ? null : setForm}
          onClose={() => setSetForm(null)}
          onSaved={() => {
            setSetForm(null);
            load();
          }}
        />
      )}

      {libraryOpen && (
        <LibraryPickerModal
          multi={
            librarySet
              ? {
                  confirmLabel: (n) => `افزودن ${n.toLocaleString("fa-IR")} سؤال به «${librarySet.title}»`,
                  onConfirm: (list) => addFromLibrary(librarySet, list),
                }
              : undefined
          }
          onClose={() => {
            setLibraryOpen(false);
            setLibrarySet(null);
          }}
          onPick={(ex) => {
            setTemplateForNew(ex);
            setLibraryOpen(false);
            setEditing("new");
          }}
        />
      )}
    </div>
  );
}
