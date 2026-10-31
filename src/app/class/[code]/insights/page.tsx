"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { GraduationCap, Trophy, X } from "lucide-react";
import { useClassAccess } from "@/hooks/useClassAccess";
import ClassChrome from "@/components/ClassChrome";
import { ClassPageSkeleton, Skeleton } from "@/components/Skeleton";
import { Avatar, Bar, Chip, Column, DataTable, Empty, Panel, SearchBox, StatStrip, Tabs } from "@/components/admin/ui";
import { ActivityChart, Columns, HBars, StatusDonut } from "@/components/admin/charts";
import { DifficultyBadge, TopicBadge } from "@/components/DifficultyBadge";
import StudentDetailModal from "@/components/dash/StudentDetailModal";
import { loadInsightData, InsightData } from "@/lib/classData";
import {
  ClassStats,
  Index,
  STATUS_LABEL,
  StudentInClass,
  ago,
  buildIndex,
  classStats,
  competitionResults,
  fa,
  pct,
  quizQuestionStats,
  studentClassDetail,
} from "@/lib/adminStats";

type TabId = "summary" | "students" | "exercises" | "quizzes" | "competitions";
const toneOf = { correct: "ok", partial: "warn", wrong: "bad", error: "neutral", pending: "neutral" } as const;
const DAY = 86_400_000;

export default function InsightsPage() {
  const { code } = useParams<{ code: string }>();
  const access = useClassAccess(code);
  const { ready, session, notFound, isTeacher, coTeacherIds } = access;
  const searchParams = useSearchParams();
  const [insight, setInsight] = useState<InsightData | null>(null);
  const [tab, setTab] = useState<TabId>(searchParams.get("student") ? "students" : "summary");
  const [studentId, setStudentId] = useState<string | null>(searchParams.get("student"));

  useEffect(() => {
    if (!session || !isTeacher) return;
    let cancelled = false;
    loadInsightData([session.id], { quizDetail: true }).then((d) => !cancelled && setInsight(d));
    return () => {
      cancelled = true;
    };
  }, [session, isTeacher]);

  const ix = useMemo(() => (insight ? buildIndex(insight.data) : null), [insight]);
  const cs = useMemo(() => (ix && session ? classStats(ix, session.id) : null), [ix, session]);

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
  if (!ready || !session || coTeacherIds === null) return <ClassPageSkeleton variant="students" />;

  if (!isTeacher) {
    return (
      <ClassChrome access={access} section="insights">
        <main className="max-w-4xl mx-auto px-4 py-16 text-center">
          <GraduationCap size={44} className="mx-auto mb-3 text-primary/40" />
          <h2 className="font-extrabold mb-1">این صفحه مخصوص معلم‌های کلاسه</h2>
          <p className="text-sm text-muted">فقط سازنده‌ی کلاس و معلم‌های همکار می‌تونن آمار کلاس رو ببینن. آمار خودت رو توی داشبورد ببین.</p>
        </main>
      </ClassChrome>
    );
  }

  return (
    <ClassChrome access={access} section="insights">
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-5">
          <h2 className="font-black text-xl">آمار {session.title}</h2>
          <p className="text-xs text-muted mt-1">پیشرفت کلاس و هر دانشجو، نتیجه‌ی تمرین‌ها، کوییزها و مسابقه‌ها.</p>
        </div>

        {!ix || !cs || !insight ? (
          <div className="space-y-5">
            <Skeleton className="h-24 rounded-2xl" />
            <div className="grid lg:grid-cols-3 gap-5">
              <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
              <Skeleton className="h-72 rounded-2xl" />
            </div>
          </div>
        ) : (
          <>
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { id: "summary", label: "خلاصه" },
                { id: "students", label: "دانشجوها", count: cs.studentCount },
                { id: "exercises", label: "تمرین‌ها", count: cs.exercises.length },
                { id: "quizzes", label: "کوییزها", count: cs.quizzes.length },
                { id: "competitions", label: "مسابقه‌ها", count: cs.competitions.length },
              ]}
            />
            {tab === "summary" && <Summary cs={cs} ix={ix} classId={session.id} />}
            {tab === "students" && <StudentsTab cs={cs} ix={ix} classId={session.id} onOpen={setStudentId} />}
            {tab === "exercises" && <ExercisesTab cs={cs} />}
            {tab === "quizzes" && <QuizzesTab cs={cs} ix={ix} insight={insight} />}
            {tab === "competitions" && <CompetitionsTab ix={ix} classId={session.id} />}
            {studentId && <StudentDetailModal cs={cs} ix={ix} classId={session.id} code={session.code} userId={studentId} onClose={() => setStudentId(null)} />}
          </>
        )}
      </main>
    </ClassChrome>
  );
}

// ---------------------------------------------------------------------------

/** Per-student quiz average and number of competitions joined. */
function usePerStudent(ix: Index, classId: string) {
  return useMemo(() => {
    const { data } = ix;
    const quizIds = new Set(data.quizzes.filter((q) => q.class_id === classId).map((q) => q.id));
    const quizAvg = new Map<string, number>();
    const sums = new Map<string, number[]>();
    data.quizAnswers.filter((a) => quizIds.has(a.quiz_id)).forEach((a) => sums.set(a.user_id, [...(sums.get(a.user_id) || []), pct(a.score, a.total_questions)]));
    sums.forEach((arr, uid) => quizAvg.set(uid, Math.round(arr.reduce((x, y) => x + y, 0) / arr.length)));

    const teamsOf = new Map<string, Set<string>>();
    data.teamMembers.forEach((m) => teamsOf.set(m.user_id, (teamsOf.get(m.user_id) || new Set()).add(m.team_id)));
    const compIds = new Set(data.competitions.filter((c) => c.class_id === classId).map((c) => c.id));
    const comps = new Map<string, number>();
    teamsOf.forEach((teams, uid) => {
      const joined = new Set(data.compSubs.filter((s) => compIds.has(s.competition_id) && teams.has(s.team_id)).map((s) => s.competition_id));
      if (joined.size) comps.set(uid, joined.size);
    });
    return { quizAvg, comps };
  }, [ix, classId]);
}

function Summary({ cs, ix, classId }: { cs: ClassStats; ix: Index; classId: string }) {
  const { quizAvg } = usePerStudent(ix, classId);
  const buckets = useMemo(() => {
    const b = [0, 0, 0, 0, 0];
    cs.students.filter((s) => s.attempts > 0).forEach((s) => b[Math.min(4, Math.floor(s.avgScore / 20))]++);
    return ["۰–۲۰", "۲۰–۴۰", "۴۰–۶۰", "۶۰–۸۰", "۸۰–۱۰۰"].map((label, i) => ({ label, students: b[i] }));
  }, [cs]);
  const quizVals = Array.from(quizAvg.values());
  const quizOverall = quizVals.length ? Math.round(quizVals.reduce((a, b) => a + b, 0) / quizVals.length) : null;

  return (
    <div className="space-y-5">
      <StatStrip
        items={[
          { label: "دانشجو", value: fa(cs.studentCount), hint: `${fa(cs.activeStudents7d)} فعال در ۷ روز اخیر` },
          { label: "نرخ حل تمرین‌ها", value: cs.exercises.length ? `${fa(cs.solveRate)}٪` : "—", hint: `${fa(cs.exercises.length)} تمرین` },
          { label: "میانگین نمره", value: cs.submissionCount ? fa(cs.avgScore) : "—", hint: `${fa(cs.submissionCount)} پاسخ` },
          { label: "میانگین کوییز", value: quizOverall === null ? "—" : `${fa(quizOverall)}٪`, hint: `${fa(cs.quizzes.length)} کوییز` },
          { label: "سلول کد", value: fa(cs.cellCount), hint: `${fa(cs.commentCount)} نظر` },
          { label: "مسابقه", value: fa(cs.competitions.length) },
        ]}
      />
      <div className="grid lg:grid-cols-12 gap-5">
        <Panel className="lg:col-span-8" title="فعالیت ۳۰ روز اخیر کلاس">
          <ActivityChart data={cs.activity} />
        </Panel>
        <Panel className="lg:col-span-4" title="نتیجه‌ی پاسخ‌ها">
          <StatusDonut counts={cs.statusCounts} />
        </Panel>
        <Panel className="lg:col-span-5" title="توزیع میانگین نمره‌ها" subtitle="چند نفر توی هر بازه هستن (فقط کسانی که پاسخ داده‌ان)">
          <Columns data={buckets} xKey="label" bars={[{ key: "students", name: "دانشجو" }]} height={200} />
        </Panel>
        <Panel className="lg:col-span-4" title="سخت‌ترین تمرین‌ها" subtitle="کمترین درصد حل‌کننده، بین تمرین‌هایی که تلاش شده">
          <HBars
            rows={cs.exercises
              .filter((e) => e.attempts > 0)
              .map((e) => ({ label: e.title, value: pct(e.solvers, cs.studentCount), sub: `${fa(e.attempts)} تلاش` }))
              .sort((a, b) => a.value - b.value)
              .slice(0, 5)}
            suffix="٪ حل کردن"
            max={100}
            emptyText="هنوز تلاشی روی تمرین‌ها نشده."
          />
        </Panel>
        <Panel className="lg:col-span-3" title="میانگین کوییزها">
          {cs.quizzes.some((q) => q.participants > 0) ? (
            <HBars rows={cs.quizzes.filter((q) => q.participants > 0).map((q) => ({ label: q.title, value: q.avgPct, sub: `${fa(q.participants)} نفر` }))} suffix="٪" max={100} />
          ) : (
            <Empty>هنوز کوییزی جواب داده نشده.</Empty>
          )}
        </Panel>
      </div>
    </div>
  );
}

function needsAttention(s: StudentInClass, total: number) {
  const idle = !s.lastActive || Date.now() - new Date(s.lastActive).getTime() >= 7 * DAY;
  const behind = total >= 3 && s.solved / total < 0.3;
  return idle || behind;
}

function StudentsTab({ cs, ix, classId, onOpen }: { cs: ClassStats; ix: Index; classId: string; onOpen: (id: string) => void }) {
  const { quizAvg, comps } = usePerStudent(ix, classId);
  const [q, setQ] = useState("");
  const [risk, setRisk] = useState(false);
  const total = cs.exercises.length;

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return cs.students.filter((s) => (!n || s.name.toLowerCase().includes(n)) && (!risk || needsAttention(s, total)));
  }, [cs, q, risk, total]);
  const riskCount = cs.students.filter((s) => needsAttention(s, total)).length;

  const columns: Column<StudentInClass>[] = [
    {
      key: "name",
      label: "دانشجو",
      sort: (r) => r.name,
      render: (r) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={r.name} avatar={r.avatar} size={30} />
          <span className="font-bold">{r.name}</span>
          {needsAttention(r, total) && <Chip tone="warn">نیاز به توجه</Chip>}
        </span>
      ),
    },
    {
      key: "team",
      label: "تیم",
      sort: (r) => r.teamName || "",
      hideOnMobile: true,
      render: (r) =>
        r.teamName ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: r.teamColor || "#a8a29e" }} />
            {r.teamName}
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: "solved",
      label: "تمرین حل‌شده",
      sort: (r) => r.solved,
      className: "w-44",
      render: (r) =>
        total ? (
          <div className="flex items-center gap-2">
            <Bar value={pct(r.solved, total)} />
            <span className="text-xs font-bold tabular-nums whitespace-nowrap">
              {fa(r.solved)}/{fa(total)}
            </span>
          </div>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    { key: "avg", label: "میانگین نمره", sort: (r) => r.avgScore, render: (r) => (r.attempts ? <span className="font-bold tabular-nums">{fa(r.avgScore)}</span> : <span className="text-muted">—</span>) },
    { key: "quiz", label: "کوییز", sort: (r) => quizAvg.get(r.userId) ?? -1, hideOnMobile: true, render: (r) => (quizAvg.has(r.userId) ? <span className="tabular-nums">{fa(quizAvg.get(r.userId)!)}٪</span> : <span className="text-muted">—</span>) },
    { key: "comp", label: "مسابقه", sort: (r) => comps.get(r.userId) || 0, hideOnMobile: true, render: (r) => <span className="tabular-nums">{fa(comps.get(r.userId) || 0)}</span> },
    { key: "cells", label: "سلول", sort: (r) => r.cells, hideOnMobile: true, render: (r) => <span className="tabular-nums">{fa(r.cells)}</span> },
    { key: "last", label: "آخرین فعالیت", sort: (r) => (r.lastActive ? new Date(r.lastActive).getTime() : 0), render: (r) => <Chip tone={r.lastActive && Date.now() - new Date(r.lastActive).getTime() < 7 * DAY ? "ok" : "neutral"}>{ago(r.lastActive)}</Chip> },
  ];

  return (
    <Panel
      flush
      title="دانشجوها"
      subtitle="روی هر نفر بزن تا نمودار پیشرفت و نتیجه‌ی همه‌ی تمرین‌ها، کوییزها و مسابقه‌هاش باز بشه."
      right={
        <div className="flex gap-2 flex-wrap items-center">
          <button onClick={() => setRisk((r) => !r)} className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition ${risk ? "bg-primary text-white border-primary" : "bg-white border-line text-muted hover:text-ink"}`}>
            نیاز به توجه <span className="opacity-60 mr-1">{fa(riskCount)}</span>
          </button>
          <SearchBox value={q} onChange={setQ} placeholder="اسم دانشجو…" />
        </div>
      }
    >
      <DataTable rows={rows} columns={columns} rowKey={(r) => r.userId} onRowClick={(r) => onOpen(r.userId)} defaultSort={{ key: "solved", dir: "desc" }} empty="دانشجویی پیدا نشد" />
    </Panel>
  );
}

function ExercisesTab({ cs }: { cs: ClassStats }) {
  const columns: Column<ClassStats["exercises"][number]>[] = [
    {
      key: "title",
      label: "تمرین",
      sort: (r) => r.title,
      render: (r) => (
        <div>
          <div className="font-bold">{r.title}</div>
          {(r.difficulty || r.topic) && (
            <div className="flex gap-1.5 mt-1">
              <DifficultyBadge value={r.difficulty} />
              <TopicBadge value={r.topic} />
            </div>
          )}
        </div>
      ),
    },
    {
      key: "solve",
      label: "حل‌کننده",
      sort: (r) => pct(r.solvers, cs.studentCount),
      className: "w-48",
      render: (r) => (
        <div className="flex items-center gap-2">
          <Bar value={pct(r.solvers, cs.studentCount)} />
          <span className="text-xs font-bold tabular-nums whitespace-nowrap">
            {fa(r.solvers)}/{fa(cs.studentCount)}
          </span>
        </div>
      ),
    },
    { key: "attempts", label: "تلاش‌ها", sort: (r) => r.attempts, render: (r) => <span className="tabular-nums">{fa(r.attempts)}</span> },
    { key: "avg", label: "میانگین نمره", sort: (r) => r.avgScore, render: (r) => (r.attempts ? <span className="font-bold tabular-nums">{fa(r.avgScore)}</span> : <span className="text-muted">—</span>) },
    { key: "due", label: "مهلت", sort: (r) => (r.dueAt ? new Date(r.dueAt).getTime() : 0), hideOnMobile: true, render: (r) => (r.dueAt ? <span className="text-xs">{new Date(r.dueAt).toLocaleDateString("fa-IR")}</span> : <span className="text-muted">—</span>) },
  ];
  return (
    <div className="space-y-5">
      {cs.exercises.length > 0 && cs.studentCount > 0 && (
        <Panel title="درصد حل‌کننده‌ی هر تمرین" subtitle="از کل دانشجوهای کلاس؛ از قدیمی‌ترین تمرین به جدیدترین">
          <Columns data={[...cs.exercises].reverse().map((e, i) => ({ label: fa(i + 1), solved: pct(e.solvers, cs.studentCount) }))} xKey="label" bars={[{ key: "solved", name: "درصد حل‌کننده" }]} unit="٪" domain={[0, 100]} height={180} />
        </Panel>
      )}
      <Panel flush title="تمرین‌ها">
        <DataTable rows={cs.exercises} columns={columns} rowKey={(r) => r.id} empty="این کلاس هنوز تمرینی نداره" />
      </Panel>
    </div>
  );
}

function QuizzesTab({ cs, ix, insight }: { cs: ClassStats; ix: Index; insight: InsightData }) {
  if (cs.quizzes.length === 0) return <Panel><Empty>هنوز کوییزی برگزار نشده.</Empty></Panel>;
  return (
    <div className="space-y-5">
      {cs.quizzes.map((q) => {
        const questions = insight.quizQuestions.get(q.id) || [];
        const sheets = insight.quizSheets.filter((s) => s.quiz_id === q.id).map((s) => s.answers);
        const stats = quizQuestionStats(questions, sheets);
        const results = ix.data.quizAnswers.filter((a) => a.quiz_id === q.id).map((a) => ({ id: a.user_id, name: ix.nameOf(a.user_id, a.author_name), pct: pct(a.score, a.total_questions) })).sort((a, b) => b.pct - a.pct);
        return (
          <Panel
            key={q.id}
            title={q.title}
            subtitle={`${fa(q.participants)} شرکت‌کننده · میانگین ${q.participants ? fa(q.avgPct) + "٪" : "—"}`}
            right={<Chip tone={q.status === "active" ? "ok" : "neutral"}>{q.status === "active" ? "در حال برگزاری" : q.status === "ended" ? "پایان‌یافته" : "پیش‌نویس"}</Chip>}
          >
            {q.participants === 0 ? (
              <Empty>هنوز کسی جواب نداده.</Empty>
            ) : (
              <div className="grid lg:grid-cols-2 gap-6">
                <div>
                  <div className="text-xs font-bold text-stone-600 mb-3">درصد پاسخ درست هر سؤال</div>
                  {stats.length ? (
                    <HBars rows={stats.map((s) => ({ label: `${fa(s.index + 1)}. ${s.question.length > 46 ? s.question.slice(0, 46) + "…" : s.question}`, value: s.correctRate, sub: `${fa(s.answered)} پاسخ` }))} suffix="٪" max={100} />
                  ) : (
                    <Empty>جزئیات سؤال‌ها در دسترس نیست.</Empty>
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-stone-600 mb-3">نمره‌ی دانشجوها</div>
                  <ul className="space-y-2 max-h-72 overflow-y-auto pl-1">
                    {results.map((r) => (
                      <li key={r.id} className="flex items-center gap-3 text-sm">
                        <span className="w-28 truncate font-semibold">{r.name}</span>
                        <Bar value={r.pct} />
                        <b className="w-10 text-left tabular-nums text-xs">{fa(r.pct)}٪</b>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </Panel>
        );
      })}
    </div>
  );
}

function CompetitionsTab({ ix, classId }: { ix: Index; classId: string }) {
  const results = useMemo(() => competitionResults(ix, classId), [ix, classId]);
  if (results.length === 0) return <Panel><Empty>هنوز مسابقه‌ای برگزار نشده.</Empty></Panel>;
  return (
    <div className="space-y-5">
      {results.map((c) => (
        <Panel
          key={c.id}
          title={c.title}
          subtitle={`${fa(c.submittedTeams)} از ${fa(c.totalTeams)} تیم تحویل دادن`}
          right={<Chip tone={c.status === "active" ? "ok" : "neutral"}>{c.status === "active" ? "در حال برگزاری" : c.status === "ended" ? "پایان‌یافته" : "پیش‌نویس"}</Chip>}
        >
          {c.ranking.length === 0 ? (
            <Empty>هنوز تیمی تحویل نداده.</Empty>
          ) : (
            <ol className="space-y-2">
              {c.ranking.map((r, i) => (
                <li key={r.team} className="flex items-center gap-3 rounded-xl border border-line px-4 py-2.5">
                  <span className={`w-7 h-7 rounded-full grid place-items-center text-xs font-black ${i === 0 ? "bg-primary text-white" : "bg-stone-100 text-stone-600"}`}>{i === 0 ? <Trophy size={13} /> : fa(i + 1)}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-sm truncate">{r.team}</span>
                    <span className="block text-[11px] text-muted truncate">تحویل توسط {r.author}</span>
                  </span>
                  <span className="text-xs font-bold tabular-nums">{r.minutes === null ? ago(r.at) : `${fa(r.minutes)} دقیقه`}</span>
                </li>
              ))}
            </ol>
          )}
          <p className="text-[11px] text-muted mt-3">ترتیب بر اساس زمان تحویل است؛ برای دیدن کد هر تیم از خود صفحه‌ی مسابقه استفاده کن.</p>
        </Panel>
      ))}
    </div>
  );
}
