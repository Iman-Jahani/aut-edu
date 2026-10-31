"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle, Brain, Flag, LineChart, Plus, UserX } from "lucide-react";
import { Avatar, Bar, Chip, Column, DataTable, Empty, Panel, StatStrip } from "@/components/admin/ui";
import { ActivityChart, StatusDonut } from "@/components/admin/charts";
import ProgressRing from "@/components/dash/ProgressRing";
import { ClassStats, Index, TeacherOverview, ago, fa, pct } from "@/lib/adminStats";

const STATUS: Record<string, string> = { active: "در حال برگزاری", ended: "پایان‌یافته", draft: "پیش‌نویس" };

export default function TeacherDashboard({
  ov,
  ix,
  ownedIds,
  name,
  avatar,
  canCreate,
  onCreate,
  onOpenStudent,
}: {
  ov: TeacherOverview;
  ix: Index;
  ownedIds: Set<string>;
  name: string;
  avatar: string;
  canCreate: boolean;
  onCreate: () => void;
  /** Open one student's progress without leaving the dashboard. */
  onOpenStudent: (classId: string, userId: string) => void;
}) {
  const T = ov.totals;
  const live = useMemo(() => {
    const quiz = new Set(ix.data.quizzes.filter((q) => q.status === "active").map((q) => q.class_id));
    const comp = new Set(ix.data.competitions.filter((c) => c.status === "active").map((c) => c.class_id));
    return { quiz, comp };
  }, [ix]);

  const columns: Column<ClassStats>[] = [
    {
      key: "title",
      label: "کلاس",
      sort: (r) => r.title,
      render: (r) => (
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold">{r.title}</span>
            {!ownedIds.has(r.id) && <Chip tone="warn">همکار</Chip>}
            {live.quiz.has(r.id) && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                <Brain size={11} /> کوییز فعال
              </span>
            )}
            {live.comp.has(r.id) && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                <Flag size={11} /> مسابقه فعال
              </span>
            )}
          </div>
          <div className="font-mono text-[11px] text-muted tracking-widest mt-0.5" dir="ltr">
            {r.code}
          </div>
        </div>
      ),
    },
    {
      key: "students",
      label: "دانشجو",
      sort: (r) => r.studentCount,
      render: (r) => (
        <span className="text-sm">
          <b className="tabular-nums">{fa(r.studentCount)}</b>
          <span className="text-[11px] text-muted mr-1.5">{fa(r.activeStudents7d)} فعال</span>
        </span>
      ),
    },
    {
      key: "solve",
      label: "نرخ حل تمرین‌ها",
      sort: (r) => r.solveRate,
      className: "w-44",
      render: (r) =>
        r.exercises.length && r.studentCount ? (
          <div className="flex items-center gap-2">
            <Bar value={r.solveRate} />
            <span className="text-xs font-bold tabular-nums w-9 text-left">{fa(r.solveRate)}٪</span>
          </div>
        ) : (
          <span className="text-muted text-xs">{r.exercises.length ? "—" : "بدون تمرین"}</span>
        ),
    },
    { key: "avg", label: "میانگین نمره", sort: (r) => r.avgScore, hideOnMobile: true, render: (r) => (r.submissionCount ? <span className="font-bold tabular-nums">{fa(r.avgScore)}</span> : <span className="text-muted">—</span>) },
    { key: "last", label: "آخرین فعالیت", sort: (r) => (r.lastActive ? new Date(r.lastActive).getTime() : 0), hideOnMobile: true, render: (r) => <span className="text-xs text-muted">{ago(r.lastActive)}</span> },
    {
      key: "act",
      label: "",
      render: (r) => (
        <Link href={`/class/${r.code}/insights`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-xs font-bold text-ink hover:underline whitespace-nowrap">
          <LineChart size={13} /> آمار کلاس
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <section className="hero-panel relative overflow-hidden rounded-3xl text-white p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-12 h-12 rounded-full bg-white/10 grid place-items-center text-2xl">{avatar}</span>
              <div>
                <div className="text-white/50 text-sm">سلام</div>
                <h1 className="text-2xl md:text-3xl font-black leading-tight">{name}</h1>
              </div>
            </div>
            <p className="text-white/70 text-[15px] leading-8 max-w-lg">
              {T.classes === 0
                ? "هنوز کلاسی نداری. اولین کلاست رو بساز و کدش رو بین دانشجوها پخش کن."
                : `${fa(T.classes)} کلاس و ${fa(T.students)} دانشجو. ${ov.attention.length ? `${fa(ov.attention.length)} نفر نیاز به توجه دارن.` : "الان همه‌چیز روبه‌راهه."}`}
            </p>
            {canCreate && (
              <button onClick={onCreate} className="inline-flex items-center gap-1.5 rounded-xl bg-accent text-ink font-extrabold text-sm px-5 py-2.5 mt-5 hover:opacity-90">
                <Plus size={15} /> کلاس جدید
              </button>
            )}
          </div>
          {T.students > 0 && <ProgressRing value={pct(T.activeStudents7d, T.students)} onDark label={`${fa(T.activeStudents7d)}`} sub={`از ${fa(T.students)} دانشجو فعال بودن`} />}
        </div>
      </section>

      {T.classes > 0 && (
        <>
          <StatStrip
            items={[
              { label: "کلاس", value: fa(T.classes) },
              { label: "دانشجو", value: fa(T.students), hint: `${fa(T.activeStudents7d)} فعال در ۷ روز اخیر` },
              { label: "نرخ حل تمرین‌ها", value: `${fa(T.solveRate)}٪` },
              { label: "میانگین نمره", value: T.submissions ? fa(T.avgScore) : "—", hint: `${fa(T.submissions)} پاسخ` },
              { label: "فعالیت این هفته", value: fa(T.weekEvents), delta: T.weekDelta, hint: "نسبت به هفته‌ی قبل" },
              { label: "سلول کد", value: fa(T.cells) },
            ]}
          />

          <div className="grid lg:grid-cols-12 gap-5">
            <Panel className="lg:col-span-8" title="فعالیت ۳۰ روز اخیر همه‌ی کلاس‌ها">
              <ActivityChart data={ov.activity} />
            </Panel>
            <Panel className="lg:col-span-4" title="نتیجه‌ی پاسخ‌ها">
              <StatusDonut counts={ov.statusCounts} />
            </Panel>

            <Panel className="lg:col-span-12" flush title="کلاس‌های من" subtitle="روی هر ردیف بزن تا وارد کلاس بشی؛ «آمار کلاس» نمودار هر دانشجو، کوییزها و مسابقه‌ها رو نشون می‌ده.">
              <DataTable rows={ov.classes} columns={columns} rowKey={(r) => r.id} href={(r) => `/class/${r.code}`} defaultSort={{ key: "last", dir: "desc" }} />
            </Panel>

            <Panel className="lg:col-span-5" title="نیاز به توجه" subtitle="غایب‌ها و عقب‌افتاده‌ها" flush>
              {ov.attention.length === 0 ? (
                <Empty>همه‌ی دانشجوها فعالن و پیش می‌رن.</Empty>
              ) : (
                <ul className="divide-y divide-line/70">
                  {ov.attention.map((a) => (
                    <li key={a.classId + a.userId}>
                      <button onClick={() => onOpenStudent(a.classId, a.userId)} className="w-full text-right flex items-center gap-3 px-5 py-3 hover:bg-stone-50 transition">
                        <Avatar name={a.name} avatar={a.avatar} size={32} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-bold truncate">{a.name}</span>
                          <span className="block text-[11px] text-muted truncate">
                            {a.detail} · {a.classTitle}
                          </span>
                        </span>
                        <span className={`w-7 h-7 rounded-full grid place-items-center shrink-0 ${a.reason === "inactive" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}>
                          {a.reason === "inactive" ? <UserX size={14} /> : <AlertTriangle size={14} />}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel className="lg:col-span-4" title="نتیجه‌ی کوییزها" flush>
              {ov.quizzes.length === 0 ? (
                <Empty>هنوز کوییزی برگزار نشده.</Empty>
              ) : (
                <ul className="divide-y divide-line/70">
                  {ov.quizzes.map((q) => (
                    <li key={q.id} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-sm font-bold truncate">{q.title}</span>
                        <b className="text-sm tabular-nums">{q.participants ? `${fa(q.avgPct)}٪` : "—"}</b>
                      </div>
                      <Bar value={q.participants ? q.avgPct : 0} />
                      <div className="text-[11px] text-muted mt-1 truncate">
                        {q.classTitle} · {fa(q.participants)} شرکت‌کننده · {STATUS[q.status] || q.status}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel className="lg:col-span-3" title="مسابقه‌ها" flush>
              {ov.competitions.length === 0 ? (
                <Empty>هنوز مسابقه‌ای نبوده.</Empty>
              ) : (
                <ul className="divide-y divide-line/70">
                  {ov.competitions.map((c) => (
                    <li key={c.id} className="px-5 py-3">
                      <div className="text-sm font-bold truncate">{c.title}</div>
                      <div className="flex items-center justify-between text-[11px] text-muted mt-1">
                        <span className="truncate">{c.classTitle}</span>
                        <span className="tabular-nums whitespace-nowrap">
                          {fa(c.submittedTeams)}/{fa(c.totalTeams)} تیم
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
