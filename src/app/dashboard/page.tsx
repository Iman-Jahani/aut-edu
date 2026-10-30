"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Code2, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import ProfileModal from "@/components/ProfileModal";
import Brand from "@/components/Brand";
import { HeaderActions } from "@/components/UserMenu";
import WelcomeModal from "@/components/WelcomeModal";
import { Skeleton, DashboardSkeleton } from "@/components/Skeleton";
import { Tabs } from "@/components/admin/ui";
import StudentDashboard from "@/components/dash/StudentDashboard";
import TeacherDashboard from "@/components/dash/TeacherDashboard";
import { buildIndex, Index, teacherOverview, TeacherOverview } from "@/lib/adminStats";
import { loadInsightData, loadStudentData } from "@/lib/classData";
import { buildStudentDash, StudentDash } from "@/lib/studentDash";

interface Teaching {
  ix: Index;
  ov: TeacherOverview;
  ownedIds: Set<string>;
}

export default function DashboardPage() {
  const { ready, user, needsProfile, displayName, avatar, role } = useAuth();
  const router = useRouter();

  const [welcome, setWelcome] = useState<"join" | "create" | null>(null);
  const [teach, setTeach] = useState<Teaching | null>(null);
  const [learn, setLearn] = useState<StudentDash | null>(null);
  const [tab, setTab] = useState<"teach" | "learn" | null>(null);

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  // ---- classes I teach (owned + co-taught): load everything once, then aggregate ----
  const loadTeaching = useCallback(async () => {
    if (!user) return;
    const [{ data: owned }, { data: coRows }] = await Promise.all([
      supabase.from("class_sessions").select("id").eq("created_by", user.id),
      supabase.from("class_teachers").select("class_id").eq("user_id", user.id),
    ]);
    const ownedIds = new Set((owned || []).map((c) => c.id as string));
    const ids = Array.from(new Set([...ownedIds, ...(coRows || []).map((r) => r.class_id as string)]));
    const insight = await loadInsightData(ids);
    const ix = buildIndex(insight.data);
    setTeach({ ix, ownedIds, ov: teacherOverview(ix, ids) });
  }, [user]);

  // ---- classes I attend: only my own rows ----
  const loadLearning = useCallback(async () => {
    if (!user) return;
    setLearn(buildStudentDash(await loadStudentData(user.id)));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadTeaching().catch(() => setTeach({ ix: buildIndex(emptyData()), ov: emptyOverview(), ownedIds: new Set() }));
    loadLearning().catch(() => undefined);
  }, [user, loadTeaching, loadLearning]);

  const hasTeach = role === "teacher" || (teach?.ov.classes.length ?? 0) > 0;
  const hasLearn = (learn?.classes.length ?? 0) > 0;
  const both = hasTeach && hasLearn;
  const active = useMemo<"teach" | "learn">(() => tab ?? (hasTeach ? "teach" : "learn"), [tab, hasTeach]);

  if (!ready || !user) return <DashboardSkeleton />;

  const name = displayName || "دوست من";
  const loading = (active === "teach" && !teach) || (active === "learn" && !learn);

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-40 glass px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Brand href="/dashboard" />
          <div className="flex-1" />
          <HeaderActions showPlayground />
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-5 md:px-6 py-6 md:py-8">
        {both && (
          <Tabs
            value={active}
            onChange={setTab}
            tabs={[
              { id: "teach", label: "تدریس", count: teach?.ov.classes.length },
              { id: "learn", label: "یادگیری", count: learn?.classes.length },
            ]}
          />
        )}

        {loading ? (
          <div className="space-y-5">
            <Skeleton className="h-56 rounded-3xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <div className="grid lg:grid-cols-3 gap-5">
              <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
              <Skeleton className="h-72 rounded-2xl" />
            </div>
          </div>
        ) : active === "teach" && teach ? (
          <TeacherDashboard ov={teach.ov} ix={teach.ix} ownedIds={teach.ownedIds} name={name} avatar={avatar} canCreate={role === "teacher"} onCreate={() => setWelcome("create")} />
        ) : learn ? (
          <StudentDashboard dash={learn} name={name} avatar={avatar} onJoin={() => setWelcome("join")} />
        ) : null}

        <Link href="/playground" className="mt-8 flex items-center gap-4 rounded-2xl border border-line bg-white px-5 py-4 hover:shadow-soft transition group">
          <span className="w-10 h-10 rounded-xl bg-primary text-white grid place-items-center shrink-0">
            <Code2 size={18} />
          </span>
          <span className="flex-1">
            <span className="block font-extrabold text-sm">پلی‌گراند</span>
            <span className="block text-xs text-muted">بدون کلاس هم می‌تونی پایتون بنویسی و اجرا کنی.</span>
          </span>
          <ArrowLeft size={16} className="text-muted group-hover:-translate-x-1 transition" />
        </Link>
      </main>

      <ProfileModal open={needsProfile} firstTime={needsProfile} onClose={() => undefined} />
      <WelcomeModal
        open={welcome !== null}
        defaultTab={welcome || "join"}
        onClose={() => {
          setWelcome(null);
          loadTeaching().catch(() => undefined);
          loadLearning().catch(() => undefined);
        }}
      />
    </div>
  );
}

// Fallbacks so a failed load shows an empty dashboard instead of a spinner forever.
function emptyData() {
  return {
    sessions: [], meetings: [], teams: [], teamMembers: [], classMembers: [], classTeachers: [], profiles: [], cells: [], comments: [],
    exercises: [], exSubs: [], quizzes: [], quizAnswers: [], competitions: [], compSubs: [], institutions: [], grants: [],
    scope: { role: "admin" as const, institutionId: null, institutionName: null }, warnings: [], generatedAt: new Date().toISOString(),
  };
}
function emptyOverview(): TeacherOverview {
  return {
    classes: [],
    totals: { classes: 0, students: 0, activeStudents7d: 0, solveRate: 0, avgScore: 0, submissions: 0, cells: 0, weekEvents: 0, weekDelta: null },
    activity: [],
    statusCounts: { correct: 0, partial: 0, wrong: 0, error: 0, pending: 0 },
    attention: [],
    quizzes: [],
    competitions: [],
  };
}
