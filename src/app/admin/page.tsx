"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/Skeleton";
import {
  Lock,
  RefreshCw,
  LogOut,
  Search,
  GraduationCap,
  Users,
  Code2,
  MessageSquare,
  BookOpen,
  Brain,
  Flag,
  ChevronDown,
  Copy,
  CheckCircle2,
  CircleDot,
  Square,
  Pencil,
  Trophy,
} from "lucide-react";
import type {
  ClassSession,
  Team,
  TeamMember,
  Cell,
  Comment,
  Exercise,
  ExerciseSubmission,
  Quiz,
  QuizAnswer,
  Competition,
  CompetitionSubmission,
} from "@/lib/types";

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "admin2025";

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (sessionStorage.getItem("adminAuth") === "true") setAuthed(true);
  }, []);

  const login = () => {
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem("adminAuth", "true");
      setAuthed(true);
    } else {
      setError("رمز عبور اشتباه است");
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen grid place-items-center p-4">
        <div className="bg-white border border-line rounded-2xl shadow-xl p-8 w-full max-w-sm">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 text-amber-600 grid place-items-center mb-3">
            <Lock size={26} />
          </div>
          <h1 className="font-extrabold text-lg text-center mb-6">پنل مدیریت</h1>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            placeholder="رمز عبور"
            className="w-full border border-line rounded-lg px-3 py-2.5 mb-2 outline-none focus:border-primary"
          />
          {error && <div className="text-danger text-xs mb-3">{error}</div>}
          <button
            onClick={login}
            className="w-full py-2.5 rounded-lg text-sm font-bold text-white bg-gradient-to-br from-primary to-primary2 mt-2"
          >
            ورود
          </button>
        </div>
      </div>
    );
  }

  return (
    <Dashboard
      onLogout={() => {
        sessionStorage.removeItem("adminAuth");
        setAuthed(false);
      }}
    />
  );
}

// ---------------------------------------------------------------------------

interface AllData {
  sessions: ClassSession[];
  teams: Team[];
  members: TeamMember[];
  cells: Cell[];
  comments: Comment[];
  exercises: Exercise[];
  exSubs: ExerciseSubmission[];
  quizzes: Quiz[];
  quizAnswers: QuizAnswer[];
  competitions: Competition[];
  compSubs: CompetitionSubmission[];
}

const EMPTY: AllData = {
  sessions: [], teams: [], members: [], cells: [], comments: [],
  exercises: [], exSubs: [], quizzes: [], quizAnswers: [], competitions: [], compSubs: [],
};

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [data, setData] = useState<AllData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const loadData = async () => {
    setLoading(true);
    // Every table is fetched in parallel; missing tables (not yet created in an
    // older Supabase project) just resolve with an empty array instead of failing.
    const safe = async <T,>(q: PromiseLike<{ data: T[] | null }>): Promise<T[]> => {
      try {
        const { data } = await q;
        return data || [];
      } catch {
        return [];
      }
    };
    const [
      sessions, teams, members, cells, comments,
      exercises, exSubs, quizzes, quizAnswers, competitions, compSubs,
    ] = await Promise.all([
      safe<ClassSession>(supabase.from("class_sessions").select("*").order("created_at", { ascending: false })),
      safe<Team>(supabase.from("teams").select("*")),
      safe<TeamMember>(supabase.from("team_members").select("*")),
      safe<Cell>(supabase.from("cells").select("*")),
      safe<Comment>(supabase.from("comments").select("*")),
      safe<Exercise>(supabase.from("exercises").select("*")),
      safe<ExerciseSubmission>(supabase.from("exercise_submissions").select("*")),
      safe<Quiz>(supabase.from("quizzes").select("*")),
      safe<QuizAnswer>(supabase.from("quiz_answers").select("*")),
      safe<Competition>(supabase.from("competitions").select("*")),
      safe<CompetitionSubmission>(supabase.from("competition_submissions").select("*")),
    ]);
    setData({ sessions, teams, members, cells, comments, exercises, exSubs, quizzes, quizAnswers, competitions, compSubs });
    setLoading(false);
    setLastUpdated(new Date());
  };

  useEffect(() => {
    loadData();
  }, []);

  // ----- Per-class aggregation -----
  const byClass = useMemo(() => {
    const map = new Map<
      string,
      {
        session: ClassSession;
        teams: Team[];
        members: TeamMember[];
        cells: Cell[];
        comments: Comment[];
        exercises: Exercise[];
        exSubs: ExerciseSubmission[];
        quizzes: Quiz[];
        quizAnswers: QuizAnswer[];
        competitions: Competition[];
        compSubs: CompetitionSubmission[];
        studentCount: number;
      }
    >();
    data.sessions.forEach((s) => {
      map.set(s.id, {
        session: s,
        teams: [], members: [], cells: [], comments: [],
        exercises: [], exSubs: [], quizzes: [], quizAnswers: [],
        competitions: [], compSubs: [], studentCount: 0,
      });
    });
    const teamToClass = new Map<string, string>();
    data.teams.forEach((t) => {
      teamToClass.set(t.id, t.class_id);
      map.get(t.class_id)?.teams.push(t);
    });
    data.members.forEach((m) => {
      const cid = teamToClass.get(m.team_id);
      if (cid) map.get(cid)?.members.push(m);
    });
    data.cells.forEach((c) => map.get(c.class_id)?.cells.push(c));
    const cellToClass = new Map<string, string>();
    data.cells.forEach((c) => cellToClass.set(c.id, c.class_id));
    data.comments.forEach((cm) => {
      const cid = cellToClass.get(cm.cell_id);
      if (cid) map.get(cid)?.comments.push(cm);
    });
    const exToClass = new Map<string, string>();
    data.exercises.forEach((e) => {
      exToClass.set(e.id, e.class_id);
      map.get(e.class_id)?.exercises.push(e);
    });
    data.exSubs.forEach((s) => {
      const cid = exToClass.get(s.exercise_id);
      if (cid) map.get(cid)?.exSubs.push(s);
    });
    data.quizzes.forEach((q) => map.get(q.class_id)?.quizzes.push(q));
    const quizToClass = new Map<string, string>();
    data.quizzes.forEach((q) => quizToClass.set(q.id, q.class_id));
    data.quizAnswers.forEach((a) => {
      const cid = quizToClass.get(a.quiz_id);
      if (cid) map.get(cid)?.quizAnswers.push(a);
    });
    data.competitions.forEach((c) => map.get(c.class_id)?.competitions.push(c));
    const compToClass = new Map<string, string>();
    data.competitions.forEach((c) => compToClass.set(c.id, c.class_id));
    data.compSubs.forEach((s) => {
      const cid = compToClass.get(s.competition_id);
      if (cid) map.get(cid)?.compSubs.push(s);
    });

    map.forEach((v) => {
      const names = new Set<string>();
      v.members.forEach((m) => m.display_name && names.add(m.display_name));
      v.cells.forEach((c) => c.author_name && names.add(c.author_name));
      v.studentCount = names.size;
    });

    return map;
  }, [data]);

  const rows = useMemo(() => {
    const list = Array.from(byClass.values());
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((r) => r.session.title?.toLowerCase().includes(q) || r.session.code?.toLowerCase().includes(q));
  }, [byClass, search]);

  const totalStudents = useMemo(() => {
    const names = new Set<string>();
    data.members.forEach((m) => m.display_name && names.add(m.display_name));
    data.cells.forEach((c) => c.author_name && names.add(c.author_name));
    return names.size;
  }, [data]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const copyCode = (code: string) => navigator.clipboard.writeText(code);

  const firstLoad = loading && !lastUpdated;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur border-b border-slate-700 px-6 py-4 flex items-center gap-3">
        <h1 className="font-extrabold text-lg flex items-center gap-2">
          <Lock size={18} /> پنل مدیریت کلاس‌های پایتون
        </h1>
        <div className="flex-1" />
        <span className="text-xs text-slate-400">
          {loading ? "در حال بارگذاری…" : lastUpdated ? `آخرین به‌روزرسانی: ${lastUpdated.toLocaleTimeString("fa-IR")}` : ""}
        </span>
        <button onClick={loadData} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-700 hover:bg-slate-600">
          <RefreshCw size={13} className={loading && lastUpdated ? "animate-spin" : ""} /> بروزرسانی
        </button>
        <button onClick={onLogout} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600/80 hover:bg-red-600">
          <LogOut size={13} /> خروج
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Global stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-8">
          {firstLoad ? (
            Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} dark className="h-[84px] !rounded-2xl" />)
          ) : (
            <>
              <StatCard icon={<GraduationCap size={16} />} label="کلاس‌ها" value={data.sessions.length} />
              <StatCard icon={<Users size={16} />} label="دانشجوها" value={totalStudents} />
              <StatCard icon={<Users size={16} />} label="تیم‌ها" value={data.teams.length} />
              <StatCard icon={<Code2 size={16} />} label="کدها" value={data.cells.length} />
              <StatCard icon={<MessageSquare size={16} />} label="کامنت‌ها" value={data.comments.length} />
              <StatCard icon={<BookOpen size={16} />} label="تمرین‌ها" value={data.exercises.length} />
              <StatCard icon={<Brain size={16} />} label="کوییزها" value={data.quizzes.length} />
              <StatCard icon={<Flag size={16} />} label="مسابقه‌ها" value={data.competitions.length} />
            </>
          )}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-96 mb-5">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی کلاس با نام یا کد…"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pr-9 pl-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>

        {/* Per-class list */}
        <div className="space-y-3">
          {firstLoad ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} dark className="h-20 !rounded-2xl" />)
          ) : rows.length === 0 ? (
            <div className="text-center text-slate-500 py-16 bg-slate-800/40 rounded-2xl border border-slate-700">
              {data.sessions.length ? "کلاسی با این جستجو پیدا نشد." : "هنوز کلاسی ساخته نشده."}
            </div>
          ) : (
            rows.map((r) => {
              const isOpen = expanded.has(r.session.id);
              const solvedCount = r.exSubs.filter((s) => s.status === "correct").length;
              const activeQuiz = r.quizzes.find((q) => q.status === "active");
              const activeComp = r.competitions.find((c) => c.status === "active");
              return (
                <div key={r.session.id} className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
                  <button onClick={() => toggle(r.session.id)} className="w-full flex items-center gap-4 px-5 py-4 text-right hover:bg-slate-700/30 transition">
                    <ChevronDown size={16} className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold truncate">{r.session.title}</span>
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            copyCode(r.session.code);
                          }}
                          title="کپی کد"
                          className="inline-flex items-center gap-1 text-[11px] font-mono tracking-widest text-primary2 bg-primary/10 px-1.5 py-0.5 rounded cursor-pointer hover:bg-primary/20"
                        >
                          {r.session.code} <Copy size={10} />
                        </span>
                        {activeQuiz && (
                          <Pill icon={<CircleDot size={10} className="animate-pulse" />} className="bg-emerald-500/20 text-emerald-300">
                            کوییز فعال
                          </Pill>
                        )}
                        {activeComp && (
                          <Pill icon={<CircleDot size={10} className="animate-pulse" />} className="bg-emerald-500/20 text-emerald-300">
                            مسابقه فعال
                          </Pill>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {r.session.created_at ? new Date(r.session.created_at).toLocaleDateString("fa-IR") : "—"}
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-4 text-xs text-slate-400 shrink-0">
                      <MiniStat icon={<Users size={12} />} value={r.studentCount} />
                      <MiniStat icon={<Users size={12} />} value={r.teams.length} />
                      <MiniStat icon={<Code2 size={12} />} value={r.cells.length} />
                      <MiniStat icon={<BookOpen size={12} />} value={r.exercises.length} />
                      <MiniStat icon={<Brain size={12} />} value={r.quizzes.length} />
                      <MiniStat icon={<Flag size={12} />} value={r.competitions.length} />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 space-y-5 border-t border-slate-700/70">
                      {/* Teams */}
                      <Section title="تیم‌ها" icon={<Users size={13} />} count={r.teams.length}>
                        {r.teams.length === 0 ? (
                          <EmptyRow text="بدون تیم" />
                        ) : (
                          <div className="grid sm:grid-cols-2 gap-2">
                            {r.teams.map((t) => {
                              const tm = r.members.filter((m) => m.team_id === t.id);
                              const tc = r.cells.filter((c) => c.team_id === t.id);
                              return (
                                <div key={t.id} className="flex items-center gap-2.5 bg-slate-900/40 rounded-lg px-3 py-2 text-xs">
                                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                                  <span className="font-bold flex-1 truncate">{t.name}</span>
                                  <span className="text-slate-400">{tm.length} عضو</span>
                                  <span className="text-slate-400">{tc.length} کد</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </Section>

                      {/* Exercises */}
                      <Section title="تمرین‌ها" icon={<BookOpen size={13} />} count={r.exercises.length} extra={`${solvedCount} پاسخ کامل`}>
                        {r.exercises.length === 0 ? (
                          <EmptyRow text="بدون تمرین" />
                        ) : (
                          <div className="space-y-1.5">
                            {r.exercises.map((ex) => {
                              const subs = r.exSubs.filter((s) => s.exercise_id === ex.id);
                              const correct = subs.filter((s) => s.status === "correct").length;
                              return (
                                <div key={ex.id} className="flex items-center gap-2.5 bg-slate-900/40 rounded-lg px-3 py-2 text-xs">
                                  <span className="font-bold flex-1 truncate">{ex.title}</span>
                                  <span className="text-slate-400">{subs.length} پاسخ</span>
                                  <span className="text-emerald-400 flex items-center gap-1">
                                    <CheckCircle2 size={11} /> {correct}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </Section>

                      {/* Quizzes */}
                      <Section title="کوییزها" icon={<Brain size={13} />} count={r.quizzes.length}>
                        {r.quizzes.length === 0 ? (
                          <EmptyRow text="بدون کوییز" />
                        ) : (
                          <div className="space-y-1.5">
                            {r.quizzes.map((q) => {
                              const answers = r.quizAnswers.filter((a) => a.quiz_id === q.id);
                              const avg = answers.length
                                ? Math.round((answers.reduce((s, a) => s + a.score, 0) / answers.length) * 10) / 10
                                : 0;
                              return (
                                <div key={q.id} className="flex items-center gap-2.5 bg-slate-900/40 rounded-lg px-3 py-2 text-xs">
                                  <QuizCompStatusIcon status={q.status} />
                                  <span className="font-bold flex-1 truncate">{q.title}</span>
                                  <span className="text-slate-400">{answers.length} شرکت‌کننده</span>
                                  <span className="text-slate-400">میانگین {avg}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </Section>

                      {/* Competitions */}
                      <Section title="مسابقه‌ها" icon={<Flag size={13} />} count={r.competitions.length}>
                        {r.competitions.length === 0 ? (
                          <EmptyRow text="بدون مسابقه" />
                        ) : (
                          <div className="space-y-1.5">
                            {r.competitions.map((c) => {
                              const subs = r.compSubs.filter((s) => s.competition_id === c.id);
                              return (
                                <div key={c.id} className="flex items-center gap-2.5 bg-slate-900/40 rounded-lg px-3 py-2 text-xs">
                                  <QuizCompStatusIcon status={c.status} />
                                  <span className="font-bold flex-1 truncate">{c.title}</span>
                                  <span className="text-slate-400 flex items-center gap-1">
                                    <Trophy size={11} /> {subs.length} تیم ارسال کرد
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </Section>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 text-center">
      <div className="flex items-center justify-center gap-1.5 text-2xl font-extrabold bg-gradient-to-br from-primary to-primary2 bg-clip-text text-transparent">
        <span className="text-primary2/90">{icon}</span>
        {value}
      </div>
      <div className="text-[11px] text-slate-400 mt-1">{label}</div>
    </div>
  );
}

function MiniStat({ icon, value }: { icon: React.ReactNode; value: number }) {
  return (
    <span className="flex items-center gap-1">
      {icon} {value}
    </span>
  );
}

function Pill({ icon, children, className = "" }: { icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${className}`}>
      {icon} {children}
    </span>
  );
}

function Section({
  title,
  icon,
  count,
  extra,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  extra?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-300">
        {icon} {title} <span className="text-slate-500">({count})</span>
        {extra && <span className="text-slate-500 mr-auto">{extra}</span>}
      </div>
      {children}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <div className="text-xs text-slate-500 bg-slate-900/30 rounded-lg px-3 py-2">{text}</div>;
}

function QuizCompStatusIcon({ status }: { status: string }) {
  if (status === "active") return <CircleDot size={12} className="text-emerald-400 animate-pulse shrink-0" />;
  if (status === "ended") return <Square size={11} className="text-slate-400 shrink-0" />;
  return <Pencil size={11} className="text-amber-400 shrink-0" />;
}
