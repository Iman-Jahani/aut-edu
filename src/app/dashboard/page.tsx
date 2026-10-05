"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import ProfileModal from "@/components/ProfileModal";
import WelcomeModal from "@/components/WelcomeModal";
import { Skeleton } from "@/components/Skeleton";
import {
  GraduationCap,
  BookOpen,
  Plus,
  LogOut,
  Code2,
  Copy,
  ArrowLeft,
  Shield,
  Users,
  CalendarDays,
  Brain,
  Flag,
  CircleDot,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { StudentProgressChart, TeacherActivityChart } from "@/components/ProgressChart";
import type { ClassSession } from "@/lib/types";

interface TeacherClassRow extends ClassSession {
  isOwner: boolean;
  meetingCount: number;
  teamCount: number;
  studentCount: number;
  cellCount: number;
  activeQuiz: boolean;
  activeCompetition: boolean;
}

interface StudentClassRow extends ClassSession {
  lastSeenAt: string;
  exercisesSolved: number;
  exercisesTotal: number;
  needsAttention: boolean; // an active quiz/competition they haven't answered yet
}

export default function DashboardPage() {
  const { ready, user, needsProfile, displayName, avatar, role, signOut } = useAuth();
  const router = useRouter();

  const [profileOpen, setProfileOpen] = useState(false);
  const [welcome, setWelcome] = useState<"join" | "create" | null>(null);

  const [teacherClasses, setTeacherClasses] = useState<TeacherClassRow[] | null>(null);
  const [studentClasses, setStudentClasses] = useState<StudentClassRow[] | null>(null);

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  // ---------------- Teacher classes + stats ----------------
  const loadTeacherClasses = useCallback(async () => {
    if (!user) return;
    const [{ data: owned }, { data: coRows }] = await Promise.all([
      supabase.from("class_sessions").select("*").eq("created_by", user.id).order("created_at", { ascending: false }),
      supabase.from("class_teachers").select("class_id").eq("user_id", user.id),
    ]);
    const coIds = (coRows || []).map((r) => r.class_id);
    let coTaught: ClassSession[] = [];
    if (coIds.length) {
      const { data } = await supabase.from("class_sessions").select("*").in("id", coIds);
      coTaught = data || [];
    }
    const base = [...(owned || []).map((c) => ({ ...c, isOwner: true })), ...coTaught.map((c) => ({ ...c, isOwner: false }))];
    const ids = base.map((c) => c.id);
    if (!ids.length) {
      setTeacherClasses([]);
      return;
    }

    const [teamsRes, cellsRes, meetingsRes, quizzesRes, compsRes] = await Promise.all([
      supabase.from("teams").select("id, class_id").in("class_id", ids),
      supabase.from("cells").select("class_id, author_name").in("class_id", ids),
      supabase.from("class_meetings").select("id, class_id").in("class_id", ids),
      supabase.from("quizzes").select("class_id, status").in("class_id", ids),
      supabase.from("competitions").select("class_id, status").in("class_id", ids),
    ]);

    const teamIds = (teamsRes.data || []).map((t) => t.id);
    let members: { team_id: string; display_name: string }[] = [];
    if (teamIds.length) {
      const { data } = await supabase.from("team_members").select("team_id, display_name").in("team_id", teamIds);
      members = data || [];
    }
    const teamToClass = new Map((teamsRes.data || []).map((t) => [t.id, t.class_id] as const));

    const merged: TeacherClassRow[] = base.map((c) => {
      const teamCount = (teamsRes.data || []).filter((t) => t.class_id === c.id).length;
      const classCells = (cellsRes.data || []).filter((x) => x.class_id === c.id);
      const names = new Set<string>();
      classCells.forEach((x) => x.author_name && names.add(x.author_name));
      members.forEach((m) => {
        if (teamToClass.get(m.team_id) === c.id && m.display_name) names.add(m.display_name);
      });
      return {
        ...c,
        isOwner: (c as TeacherClassRow).isOwner,
        meetingCount: (meetingsRes.data || []).filter((m) => m.class_id === c.id).length,
        teamCount,
        studentCount: names.size,
        cellCount: classCells.length,
        activeQuiz: (quizzesRes.data || []).some((q) => q.class_id === c.id && q.status === "active"),
        activeCompetition: (compsRes.data || []).some((x) => x.class_id === c.id && x.status === "active"),
      };
    });
    setTeacherClasses(merged);
  }, [user]);

  // ---------------- Student classes + stats ----------------
  const loadStudentClasses = useCallback(async () => {
    if (!user) return;
    const { data: memberRows } = await supabase.from("class_members").select("class_id, last_seen_at").eq("user_id", user.id);
    const ids = (memberRows || []).map((r) => r.class_id);
    if (!ids.length) {
      setStudentClasses([]);
      return;
    }
    const lastSeenMap = new Map((memberRows || []).map((r) => [r.class_id, r.last_seen_at] as const));

    const [{ data: sessions }, exRes, quizRes, compRes] = await Promise.all([
      supabase.from("class_sessions").select("*").in("id", ids),
      supabase.from("exercises").select("id, class_id").in("class_id", ids),
      supabase.from("quizzes").select("id, class_id, status").in("class_id", ids),
      supabase.from("competitions").select("id, class_id, status").in("class_id", ids),
    ]);

    const exIds = (exRes.data || []).map((e) => e.id);
    let exSubs: { exercise_id: string; status: string }[] = [];
    if (exIds.length) {
      const { data } = await supabase.from("exercise_submissions").select("exercise_id, status").in("exercise_id", exIds).eq("user_id", user.id);
      exSubs = data || [];
    }
    const exToClass = new Map((exRes.data || []).map((e) => [e.id, e.class_id] as const));

    const activeQuizIds = (quizRes.data || []).filter((q) => q.status === "active").map((q) => q.id);
    const activeCompIds = (compRes.data || []).filter((c) => c.status === "active").map((c) => c.id);
    let answeredQuizIds = new Set<string>();
    if (activeQuizIds.length) {
      const { data } = await supabase.from("quiz_answers").select("quiz_id").in("quiz_id", activeQuizIds).eq("user_id", user.id);
      answeredQuizIds = new Set((data || []).map((a) => a.quiz_id));
    }

    const rows: StudentClassRow[] = (sessions || []).map((c) => {
      const classExIds = (exRes.data || []).filter((e) => e.class_id === c.id).map((e) => e.id);
      const classExSubs = exSubs.filter((s) => exToClass.get(s.exercise_id) === c.id);
      const hasUnansweredActiveQuiz = activeQuizIds.some((id) => (quizRes.data || []).find((q) => q.id === id)?.class_id === c.id && !answeredQuizIds.has(id));
      const hasActiveComp = activeCompIds.some((id) => (compRes.data || []).find((x) => x.id === id)?.class_id === c.id);
      return {
        ...c,
        lastSeenAt: lastSeenMap.get(c.id) || c.created_at,
        exercisesTotal: classExIds.length,
        exercisesSolved: classExSubs.filter((s) => s.status === "correct").length,
        needsAttention: hasUnansweredActiveQuiz || hasActiveComp,
      };
    });
    rows.sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());
    setStudentClasses(rows);
  }, [user]);

  useEffect(() => {
    if (user) {
      loadTeacherClasses();
      loadStudentClasses();
    }
  }, [user, loadTeacherClasses, loadStudentClasses]);

  if (!ready || !user) {
    return (
      <div className="min-h-screen p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-12 w-full !rounded-2xl" />
        <Skeleton className="h-40 w-full !rounded-2xl" />
        <Skeleton className="h-40 w-full !rounded-2xl" />
      </div>
    );
  }

  const showTeacherSection = role === "teacher" || (teacherClasses && teacherClasses.length > 0);

  const teacherTotals = teacherClasses && {
    classes: teacherClasses.length,
    cells: teacherClasses.reduce((s, c) => s + c.cellCount, 0),
    live: teacherClasses.filter((c) => c.activeQuiz || c.activeCompetition).length,
  };
  const teacherStudentTotal = teacherClasses?.reduce((s, c) => s + c.studentCount, 0) ?? 0;

  const studentTotals = studentClasses && {
    classes: studentClasses.length,
    solved: studentClasses.reduce((s, c) => s + c.exercisesSolved, 0),
    total: studentClasses.reduce((s, c) => s + c.exercisesTotal, 0),
    needsAttention: studentClasses.filter((c) => c.needsAttention).length,
  };

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-40 glass px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/" className="font-extrabold text-ink flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl grid place-items-center text-white shadow-glow" style={{ background: "var(--grad)" }}>
              🐍
            </span>
            <span className="hidden sm:inline">دفترچه کلاس پایتون</span>
          </Link>
          <div className="flex-1" />
          <Link href="/admin" className="btn-ghost hidden sm:inline-flex" title="پنل مدیریت کلی">
            <Shield size={15} />
          </Link>
          <Link href="/playground" className="btn-ghost">
            <Code2 size={15} /> پلی‌گراند
          </Link>
          <button
            onClick={() => setProfileOpen(true)}
            className="flex items-center gap-2 pl-3 pr-1.5 py-1 bg-white border border-line rounded-full text-sm font-bold text-primary hover:shadow-soft transition"
          >
            <span className="w-7 h-7 rounded-full bg-indigo-50 grid place-items-center text-base">{avatar}</span>
            {displayName}
          </button>
          <button onClick={() => signOut().then(() => router.replace("/"))} className="btn-ghost" title="خروج">
            <LogOut size={15} />
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-10">
        <Link
          href="/playground"
          className="card p-5 flex items-center gap-4 hover:shadow-lift hover:-translate-y-0.5 transition group"
          style={{ background: "linear-gradient(135deg, rgba(99,102,241,.06), rgba(236,72,153,.06))" }}
        >
          <div className="w-12 h-12 rounded-xl grid place-items-center text-white shadow-glow shrink-0" style={{ background: "var(--grad)" }}>
            <Code2 size={22} />
          </div>
          <div className="flex-1">
            <div className="font-bold">پلی‌گراند — کد بزن، بدون نیاز به هیچ کلاسی</div>
            <div className="text-sm text-muted">دفترچه‌ی شخصی کد که همیشه در دسترسته.</div>
          </div>
          <span className="text-primary font-bold text-sm shrink-0 group-hover:translate-x-[-2px] transition">برو ←</span>
        </Link>

        {showTeacherSection && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-extrabold text-lg flex items-center gap-2">
                <GraduationCap size={19} className="text-primary" /> کلاس‌های من (معلم)
              </h2>
              {role === "teacher" && (
                <button onClick={() => setWelcome("create")} className="btn-primary">
                  <Plus size={15} /> کلاس جدید
                </button>
              )}
            </div>

            {teacherClasses && teacherClasses.length > 0 && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
                  <MiniStatCard icon={<GraduationCap size={14} />} label="کلاس" value={teacherTotals!.classes} />
                  <MiniStatCard icon={<Users size={14} />} label="دانشجو" value={teacherStudentTotal} />
                  <MiniStatCard icon={<Code2 size={14} />} label="سلول کد" value={teacherTotals!.cells} />
                  <MiniStatCard icon={<CircleDot size={14} className="text-emerald-500" />} label="فعال الان" value={teacherTotals!.live} highlight={teacherTotals!.live > 0} />
                </div>
                <TeacherActivityChart classIds={teacherClasses.map((c) => c.id)} />
              </>
            )}

            {teacherClasses === null ? (
              <div className="grid sm:grid-cols-2 gap-3">
                <Skeleton className="h-32 !rounded-2xl" />
                <Skeleton className="h-32 !rounded-2xl" />
              </div>
            ) : teacherClasses.length === 0 ? (
              <div className="card text-center py-10 px-6">
                <BookOpen size={34} className="mx-auto mb-3 text-primary/40" />
                <p className="text-sm text-muted">هنوز کلاسی نساختی.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {teacherClasses.map((c) => (
                  <TeacherClassCard key={c.id} cls={c} />
                ))}
              </div>
            )}
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-extrabold text-lg flex items-center gap-2">
              <BookOpen size={19} className="text-primary" /> کلاس‌های من (دانشجو)
            </h2>
            <button onClick={() => setWelcome("join")} className="btn-ghost">
              <Plus size={15} /> پیوستن با کد
            </button>
          </div>

          {studentClasses && studentClasses.length > 0 && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
                <MiniStatCard icon={<BookOpen size={14} />} label="کلاس" value={studentTotals!.classes} />
                <MiniStatCard icon={<CheckCircle2 size={14} />} label="تمرین حل‌شده" value={`${studentTotals!.solved}/${studentTotals!.total}`} />
                <MiniStatCard
                  icon={<CircleDot size={14} className="text-red-500" />}
                  label="نیاز به توجه"
                  value={studentTotals!.needsAttention}
                  highlight={studentTotals!.needsAttention > 0}
                />
              </div>
              {user && <StudentProgressChart userId={user.id} />}
            </>
          )}

          {studentClasses === null ? (
            <div className="grid sm:grid-cols-2 gap-3">
              <Skeleton className="h-32 !rounded-2xl" />
              <Skeleton className="h-32 !rounded-2xl" />
            </div>
          ) : studentClasses.length === 0 ? (
            <div className="card text-center py-10 px-6">
              <Users size={34} className="mx-auto mb-3 text-primary/40" />
              <p className="text-sm text-muted mb-4">هنوز به کلاسی نپیوستی.</p>
              <button onClick={() => setWelcome("join")} className="btn-primary mx-auto">
                پیوستن به یه کلاس
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {studentClasses.map((c) => (
                <StudentClassCard key={c.id} cls={c} />
              ))}
            </div>
          )}
        </section>
      </main>

      <ProfileModal open={profileOpen || needsProfile} firstTime={needsProfile} onClose={() => setProfileOpen(false)} />
      <WelcomeModal open={welcome !== null} defaultTab={welcome || "join"} onClose={() => setWelcome(null)} />
    </div>
  );
}

function MiniStatCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: number | string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-3 text-center border ${highlight ? "border-emerald-200 bg-emerald-50" : "border-line bg-white"}`}>
      <div className={`flex items-center justify-center gap-1 text-lg font-extrabold ${highlight ? "text-emerald-700" : "text-ink"}`}>
        {icon} {value}
      </div>
      <div className="text-[10px] text-muted mt-0.5">{label}</div>
    </div>
  );
}

function CodeHeader() {
  return (
    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 grid place-items-center text-primary shrink-0">
      <GraduationCap size={20} />
    </div>
  );
}

function CopyCode({ code }: { code: string }) {
  return (
    <span
      onClick={(e) => {
        e.preventDefault();
        navigator.clipboard.writeText(code);
      }}
      className="font-mono tracking-widest flex items-center gap-1 hover:text-primary"
      title="کپی کد"
    >
      {code} <Copy size={10} />
    </span>
  );
}

function TeacherClassCard({ cls }: { cls: TeacherClassRow }) {
  return (
    <Link href={`/class/${cls.code}`} className="card p-4 hover:shadow-lift hover:-translate-y-0.5 transition group">
      <div className="flex items-center gap-3 mb-3">
        <CodeHeader />
        <div className="min-w-0 flex-1">
          <div className="font-bold text-sm truncate flex items-center gap-1.5">
            {cls.title}
            {!cls.isOwner && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">همکار</span>}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted mt-0.5">
            <CopyCode code={cls.code} />
            <span>· {new Date(cls.created_at).toLocaleDateString("fa-IR")}</span>
          </div>
        </div>
        <ArrowLeft size={16} className="text-muted group-hover:text-primary group-hover:-translate-x-0.5 transition shrink-0" />
      </div>
      <div className="flex items-center gap-3 text-[11px] text-muted flex-wrap">
        <StatChip icon={<CalendarDays size={11} />} value={cls.meetingCount} label="جلسه" />
        <StatChip icon={<Users size={11} />} value={cls.teamCount} label="تیم" />
        <StatChip icon={<GraduationCap size={11} />} value={cls.studentCount} label="دانشجو" />
        <StatChip icon={<Code2 size={11} />} value={cls.cellCount} label="کد" />
        {cls.activeQuiz && (
          <span className="flex items-center gap-1 text-emerald-600 font-bold">
            <Brain size={11} /> کوییز فعال
          </span>
        )}
        {cls.activeCompetition && (
          <span className="flex items-center gap-1 text-emerald-600 font-bold">
            <Flag size={11} /> مسابقه فعال
          </span>
        )}
      </div>
    </Link>
  );
}

function StudentClassCard({ cls }: { cls: StudentClassRow }) {
  const pct = cls.exercisesTotal > 0 ? Math.round((cls.exercisesSolved / cls.exercisesTotal) * 100) : null;
  return (
    <Link href={`/class/${cls.code}`} className="card p-4 hover:shadow-lift hover:-translate-y-0.5 transition group">
      <div className="flex items-center gap-3 mb-3">
        <CodeHeader />
        <div className="min-w-0 flex-1">
          <div className="font-bold text-sm truncate flex items-center gap-1.5">
            {cls.title}
            {cls.needsAttention && <span className="w-2 h-2 rounded-full bg-danger shrink-0" title="فعالیت جدید منتظرته" />}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted mt-0.5">
            <CopyCode code={cls.code} />
          </div>
        </div>
        <ArrowLeft size={16} className="text-muted group-hover:text-primary group-hover:-translate-x-0.5 transition shrink-0" />
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted mb-1.5">
        <span className="flex items-center gap-1">
          <CheckCircle2 size={11} /> {cls.exercisesSolved}/{cls.exercisesTotal} تمرین
        </span>
        <span className="flex items-center gap-1">
          <Clock size={11} /> آخرین بازدید {new Date(cls.lastSeenAt).toLocaleDateString("fa-IR")}
        </span>
      </div>
      {pct !== null && (
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-l from-primary to-primary2" style={{ width: `${pct}%` }} />
        </div>
      )}
    </Link>
  );
}

function StatChip({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <span className="flex items-center gap-1">
      {icon} {value} {label}
    </span>
  );
}
