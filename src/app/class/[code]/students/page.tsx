"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Search,
  Users,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Brain,
  Code2,
  Clock,
  ChevronDown,
  BookOpen,
  Flag,
  GraduationCap,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useClassAccess } from "@/hooks/useClassAccess";
import ClassChrome from "@/components/ClassChrome";
import { ClassPageSkeleton, Skeleton } from "@/components/Skeleton";
import { fetchAvatars, colorOf, initials, fmtRelative } from "@/lib/utils";
import { stripRich } from "@/components/RichText";
import type { Exercise, ExerciseSubmission, Quiz, QuizAnswer, Team } from "@/lib/types";

type Health = "active" | "slow" | "inactive";

interface StudentRow {
  userId: string;
  name: string;
  avatar: string | null;
  team: Team | null;
  cells: number;
  solved: number;
  attempted: number; // exercises with any submission
  exerciseScoreAvg: number | null; // 0..100 across attempted exercises
  quizTaken: number;
  quizAvgPct: number | null; // 0..100
  lastActive: string | null;
  health: Health;
  atRisk: boolean;
  exStatus: Record<string, string>; // exerciseId -> status
  quizScores: { quizId: string; pct: number }[];
}

const DAY = 24 * 60 * 60 * 1000;

function healthOf(lastActive: string | null): Health {
  if (!lastActive) return "inactive";
  const age = Date.now() - new Date(lastActive).getTime();
  if (age <= 3 * DAY) return "active";
  if (age <= 10 * DAY) return "slow";
  return "inactive";
}

const HEALTH_META: Record<Health, { label: string; cls: string; dot: string }> = {
  active: { label: "فعال", cls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  slow: { label: "کم‌فعالیت", cls: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  inactive: { label: "غایب", cls: "bg-red-50 text-red-700", dot: "bg-red-500" },
};

export default function StudentsDashboardPage({ params }: { params: { code: string } }) {
  const access = useClassAccess(params.code);
  const { ready, session, notFound, isTeacher, isOwner, coTeacherIds } = access;

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exSolveRate, setExSolveRate] = useState<{ title: string; solved: number; attempted: number; total: number }[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [compCount, setCompCount] = useState(0);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | Health | "risk">("all");
  const [sort, setSort] = useState<"activity" | "progress" | "name" | "risk">("risk");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session || coTeacherIds === null) return;
    setLoading(true);

    const [membersRes, cellsRes, exRes, quizRes, teamsRes, compRes] = await Promise.all([
      supabase.from("class_members").select("user_id, display_name, joined_at, last_seen_at").eq("class_id", session.id),
      supabase.from("cells").select("author_id, author_name, created_at, updated_at").eq("class_id", session.id),
      supabase.from("exercises").select("*").eq("class_id", session.id).order("created_at", { ascending: true }),
      supabase.from("quizzes").select("*").eq("class_id", session.id).order("created_at", { ascending: true }),
      supabase.from("teams").select("*").eq("class_id", session.id),
      supabase.from("competitions").select("id").eq("class_id", session.id),
    ]);

    const exList = (exRes.data || []) as Exercise[];
    const quizList = (quizRes.data || []) as Quiz[];
    const teams = (teamsRes.data || []) as Team[];
    setExercises(exList);
    setQuizzes(quizList);
    setCompCount((compRes.data || []).length);

    const [subsRes, answersRes, tmRes] = await Promise.all([
      exList.length
        ? supabase.from("exercise_submissions").select("*").in("exercise_id", exList.map((e) => e.id))
        : Promise.resolve({ data: [] as ExerciseSubmission[] }),
      quizList.length
        ? supabase.from("quiz_answers").select("*").in("quiz_id", quizList.map((q) => q.id))
        : Promise.resolve({ data: [] as QuizAnswer[] }),
      teams.length
        ? supabase.from("team_members").select("team_id, user_id, display_name").in("team_id", teams.map((t) => t.id))
        : Promise.resolve({ data: [] as { team_id: string; user_id: string; display_name: string }[] }),
    ]);
    const subs = (subsRes.data || []) as ExerciseSubmission[];
    const answers = (answersRes.data || []) as QuizAnswer[];
    const teamMembers = (tmRes.data || []) as { team_id: string; user_id: string; display_name: string }[];

    // ---- who counts as a student: anyone who touched this class, minus the teachers ----
    const teacherIds = new Set<string>([session.created_by || "", ...(coTeacherIds || [])]);
    const people = new Map<string, { name: string; lastSeen: string | null }>();
    const touch = (id: string, name: string, seen?: string | null) => {
      if (!id || teacherIds.has(id)) return;
      const cur = people.get(id);
      const better = !cur || (seen && (!cur.lastSeen || seen > cur.lastSeen)) ? seen || cur?.lastSeen || null : cur.lastSeen;
      people.set(id, { name: name || cur?.name || "ناشناس", lastSeen: better });
    };
    (membersRes.data || []).forEach((m) => touch(m.user_id, m.display_name, m.last_seen_at));
    teamMembers.forEach((m) => touch(m.user_id, m.display_name));
    (cellsRes.data || []).forEach((c) => touch(c.author_id, c.author_name, c.updated_at || c.created_at));
    subs.forEach((s) => touch(s.user_id, s.author_name, s.submitted_at));
    answers.forEach((a) => touch(a.user_id, a.author_name, a.submitted_at));

    const avatars = await fetchAvatars(Array.from(people.keys()));
    const teamById = new Map(teams.map((t) => [t.id, t]));
    const teamOfUser = new Map<string, Team>();
    teamMembers.forEach((m) => {
      const t = teamById.get(m.team_id);
      if (t) teamOfUser.set(m.user_id, t);
    });

    const result: StudentRow[] = Array.from(people.entries()).map(([userId, p]) => {
      const mySubs = subs.filter((s) => s.user_id === userId);
      const myAnswers = answers.filter((a) => a.user_id === userId);
      const myCells = (cellsRes.data || []).filter((c) => c.author_id === userId);
      const solved = mySubs.filter((s) => s.status === "correct").length;
      const exStatus: Record<string, string> = {};
      mySubs.forEach((s) => (exStatus[s.exercise_id] = s.status));
      const exerciseScoreAvg = mySubs.length ? Math.round(mySubs.reduce((t, s) => t + (s.score || 0), 0) / mySubs.length) : null;
      const quizScores = myAnswers.map((a) => ({ quizId: a.quiz_id, pct: a.total_questions ? Math.round((a.score / a.total_questions) * 100) : 0 }));
      const quizAvgPct = quizScores.length ? Math.round(quizScores.reduce((t, q) => t + q.pct, 0) / quizScores.length) : null;

      const stamps = [p.lastSeen, ...mySubs.map((s) => s.submitted_at), ...myAnswers.map((a) => a.submitted_at), ...myCells.map((c) => c.updated_at || c.created_at)].filter(Boolean) as string[];
      const lastActive = stamps.length ? stamps.reduce((a, b) => (a > b ? a : b)) : null;
      const health = healthOf(lastActive);
      const solveRate = exList.length ? solved / exList.length : 1;
      const atRisk = health === "inactive" || (exList.length >= 2 && solveRate < 0.3) || (quizAvgPct !== null && quizAvgPct < 40);

      return {
        userId,
        name: p.name,
        avatar: avatars[userId] || null,
        team: teamOfUser.get(userId) || null,
        cells: myCells.length,
        solved,
        attempted: mySubs.length,
        exerciseScoreAvg,
        quizTaken: myAnswers.length,
        quizAvgPct,
        lastActive,
        health,
        atRisk,
        exStatus,
        quizScores,
      };
    });
    setRows(result);

    setExSolveRate(
      exList.map((e) => {
        const es = subs.filter((s) => s.exercise_id === e.id);
        return { title: stripRich(e.title, 18), solved: es.filter((s) => s.status === "correct").length, attempted: es.length, total: result.length };
      })
    );
    setLoading(false);
  }, [session, coTeacherIds]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => {
    const n = rows.length;
    const activeWeek = rows.filter((r) => r.lastActive && Date.now() - new Date(r.lastActive).getTime() <= 7 * DAY).length;
    const risk = rows.filter((r) => r.atRisk).length;
    const rate = exercises.length && n ? Math.round((rows.reduce((t, r) => t + r.solved, 0) / (exercises.length * n)) * 100) : 0;
    const quizRows = rows.filter((r) => r.quizAvgPct !== null);
    const quizAvg = quizRows.length ? Math.round(quizRows.reduce((t, r) => t + (r.quizAvgPct || 0), 0) / quizRows.length) : null;
    return { n, activeWeek, risk, rate, quizAvg };
  }, [rows, exercises.length]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows.filter((r) => (!q || r.name.toLowerCase().includes(q)) && (filter === "all" ? true : filter === "risk" ? r.atRisk : r.health === filter));
    const progress = (r: StudentRow) => (exercises.length ? r.solved / exercises.length : 0);
    list = [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "fa");
      if (sort === "progress") return progress(b) - progress(a);
      if (sort === "activity") return (b.lastActive || "").localeCompare(a.lastActive || "");
      // risk first, then least active first
      return Number(b.atRisk) - Number(a.atRisk) || (a.lastActive || "").localeCompare(b.lastActive || "");
    });
    return list;
  }, [rows, query, filter, sort, exercises.length]);

  if (notFound) {
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <div className="card p-10 max-w-sm">
          <h1 className="font-extrabold text-lg mb-4">کلاسی با این کد پیدا نشد</h1>
          <Link href="/dashboard" className="btn-primary">
            بازگشت به داشبورد
          </Link>
        </div>
      </div>
    );
  }
  if (!ready || !session || coTeacherIds === null) return <ClassPageSkeleton />;

  if (!isTeacher) {
    return (
      <ClassChrome access={access} section="students">
        <main className="max-w-4xl mx-auto px-4 py-16 text-center">
          <GraduationCap size={44} className="mx-auto mb-3 text-primary/40" />
          <h2 className="font-extrabold mb-1">این صفحه مخصوص معلم‌های کلاسه</h2>
          <p className="text-sm text-muted">فقط سازنده‌ی کلاس و معلم‌های همکار می‌تونن وضعیت دانشجوها رو ببینن.</p>
        </main>
      </ClassChrome>
    );
  }

  const chips: { key: typeof filter; label: string; count: number }[] = [
    { key: "all", label: "همه", count: rows.length },
    { key: "risk", label: "نیاز به توجه", count: rows.filter((r) => r.atRisk).length },
    { key: "active", label: "فعال", count: rows.filter((r) => r.health === "active").length },
    { key: "slow", label: "کم‌فعالیت", count: rows.filter((r) => r.health === "slow").length },
    { key: "inactive", label: "غایب", count: rows.filter((r) => r.health === "inactive").length },
  ];

  return (
    <ClassChrome access={access} section="students">
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        <div>
          <h2 className="font-extrabold text-lg flex items-center gap-2">
            <TrendingUp size={19} className="text-primary" /> وضعیت دانشجوهای {session.title}
          </h2>
          <p className="text-xs text-muted mt-0.5">پیشرفت، فعالیت و نقاط ضعف هر دانشجو در یک نگاه{isOwner ? "" : " (به‌عنوان معلم همکار)"}</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
          {loading ? (
            [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[78px] !rounded-xl" />)
          ) : (
            <>
              <Stat icon={<Users size={14} />} label="دانشجو" value={summary.n} />
              <Stat icon={<Activity size={14} />} label="فعال در ۷ روز اخیر" value={`${summary.activeWeek}/${summary.n}`} tone="good" />
              <Stat icon={<AlertTriangle size={14} />} label="نیاز به توجه" value={summary.risk} tone={summary.risk ? "bad" : undefined} />
              <Stat icon={<CheckCircle2 size={14} />} label="میانگین حل تمرین" value={exercises.length ? `${summary.rate}%` : "—"} />
              <Stat icon={<Brain size={14} />} label="میانگین کوییز" value={summary.quizAvg === null ? "—" : `${summary.quizAvg}%`} />
            </>
          )}
        </div>

        {/* Per-exercise solve rate */}
        {!loading && exSolveRate.length > 0 && rows.length > 0 && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen size={16} className="text-primary" />
              <h3 className="font-bold text-sm">چند نفر هر تمرین رو حل کردن؟</h3>
            </div>
            <p className="text-[11px] text-muted mb-3">تمرین‌هایی که میله‌ی کوتاهی دارن احتمالاً سخت بودن یا نیاز به توضیح دوباره دارن.</p>
            <div dir="ltr" className="h-48 -mr-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={exSolveRate} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f4" />
                  <XAxis dataKey="title" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} axisLine={false} tickLine={false} width={24} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #e2e8f0", direction: "rtl" }}
                    formatter={(v: unknown, name: unknown) => [String(v), name === "solved" ? "حل کامل" : "تلاش کرده"]}
                  />
                  <Bar dataKey="attempted" fill="#c7d2fe" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="solved" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجوی دانشجو…"
              className="w-full border border-line bg-white rounded-xl pr-9 pl-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="border border-line bg-white rounded-xl px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="risk">اول نیازمندترین</option>
            <option value="activity">آخرین فعالیت</option>
            <option value="progress">بیشترین پیشرفت</option>
            <option value="name">نام</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                filter === c.key ? "bg-primary text-white border-primary" : "bg-white border-line text-muted hover:border-primary/40"
              }`}
            >
              {c.label} <span className="opacity-70">{c.count}</span>
            </button>
          ))}
        </div>

        {/* Student list */}
        {loading ? (
          <div className="space-y-2.5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[72px] !rounded-xl" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="card text-center py-14 px-6">
            <Users size={40} className="mx-auto mb-3 text-primary/40" />
            <h3 className="font-bold mb-1">{rows.length === 0 ? "هنوز دانشجویی وارد کلاس نشده" : "دانشجویی با این فیلتر پیدا نشد"}</h3>
            {rows.length === 0 && <p className="text-sm text-muted">کد کلاس ({session.code}) رو بهشون بده تا بپیوندن.</p>}
          </div>
        ) : (
          <div className="space-y-2.5">
            {visible.map((r) => {
              const hm = HEALTH_META[r.health];
              const pct = exercises.length ? Math.round((r.solved / exercises.length) * 100) : null;
              const isOpen = open === r.userId;
              return (
                <div key={r.userId} className={`card overflow-hidden ${r.atRisk ? "border-red-200" : ""}`}>
                  <button onClick={() => setOpen(isOpen ? null : r.userId)} className="w-full flex items-center gap-3 px-4 py-3 text-right hover:bg-slate-50/60 transition">
                    <div className="w-10 h-10 rounded-full grid place-items-center text-lg shrink-0" style={{ background: colorOf(r.name) + "22" }}>
                      {r.avatar || initials(r.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm truncate">{r.name}</span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${hm.cls}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${hm.dot}`} /> {hm.label}
                        </span>
                        {r.atRisk && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700">
                            <AlertTriangle size={10} /> نیاز به توجه
                          </span>
                        )}
                        {r.team && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: r.team.color }}>
                            {r.team.name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted mt-1 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock size={11} /> {r.lastActive ? fmtRelative(r.lastActive) : "هیچ فعالیتی"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Code2 size={11} /> {r.cells} سلول
                        </span>
                        <span className="flex items-center gap-1">
                          <Brain size={11} /> {r.quizAvgPct === null ? "کوییز: —" : `کوییز ${r.quizAvgPct}%`}
                        </span>
                      </div>
                    </div>
                    <div className="hidden sm:block w-40 shrink-0">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-muted">تمرین</span>
                        <span className="font-bold">
                          {r.solved}/{exercises.length}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct ?? 0}%`,
                            background: pct === null ? "#cbd5e1" : pct >= 70 ? "#10b981" : pct >= 30 ? "#f59e0b" : "#ef4444",
                          }}
                        />
                      </div>
                    </div>
                    <ChevronDown size={16} className={`text-muted shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 pt-1 border-t border-line grid md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs font-bold text-muted mb-2 flex items-center gap-1.5">
                          <BookOpen size={12} /> وضعیت تمرین‌ها
                        </div>
                        {exercises.length === 0 ? (
                          <p className="text-xs text-muted">تمرینی تعریف نشده.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {exercises.map((e) => {
                              const st = r.exStatus[e.id];
                              const meta =
                                st === "correct"
                                  ? { t: "حل شد", c: "bg-emerald-50 text-emerald-700" }
                                  : st === "partial"
                                  ? { t: "ناقص", c: "bg-amber-50 text-amber-700" }
                                  : st
                                  ? { t: "نادرست", c: "bg-red-50 text-red-700" }
                                  : { t: "شروع نکرده", c: "bg-slate-100 text-slate-500" };
                              return (
                                <div key={e.id} className="flex items-center gap-2 text-xs">
                                  <span className="flex-1 truncate">{stripRich(e.title, 40)}</span>
                                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${meta.c}`}>{meta.t}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-muted mb-2 flex items-center gap-1.5">
                          <Brain size={12} /> نمره‌ی کوییزها
                        </div>
                        {quizzes.length === 0 ? (
                          <p className="text-xs text-muted">کوییزی ساخته نشده.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {quizzes
                              .filter((q) => q.status !== "draft")
                              .map((q) => {
                                const sc = r.quizScores.find((x) => x.quizId === q.id);
                                return (
                                  <div key={q.id} className="flex items-center gap-2 text-xs">
                                    <span className="flex-1 truncate">{q.title}</span>
                                    {sc ? (
                                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${sc.pct >= 70 ? "bg-emerald-50 text-emerald-700" : sc.pct >= 40 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                                        {sc.pct}%
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-slate-100 text-slate-500">شرکت نکرده</span>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        )}
                        {compCount > 0 && (
                          <p className="text-[11px] text-muted mt-3 flex items-center gap-1.5">
                            <Flag size={11} /> مسابقه‌ها تیمی‌ان؛ نتیجه‌شون توی بخش «مسابقه» دیده می‌شه.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </ClassChrome>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number | string; tone?: "good" | "bad" }) {
  const cls = tone === "bad" ? "border-red-200 bg-red-50 text-red-700" : tone === "good" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-line bg-white text-ink";
  return (
    <div className={`rounded-xl p-3 text-center border ${cls}`}>
      <div className="flex items-center justify-center gap-1.5 text-xl font-extrabold">
        {icon} {value}
      </div>
      <div className="text-[10px] opacity-80 mt-0.5">{label}</div>
    </div>
  );
}
