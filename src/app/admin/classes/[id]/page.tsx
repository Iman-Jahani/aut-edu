"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Copy, ExternalLink, Users2 } from "lucide-react";
import { useAdminData } from "@/components/admin/AdminShell";
import { Avatar, Bar, Chip, Column, DataTable, Empty, PageHeader, Panel, StatStrip, Tabs } from "@/components/admin/ui";
import { ActivityChart, Columns, HBars, StatusDonut } from "@/components/admin/charts";
import { DifficultyBadge, TopicBadge } from "@/components/DifficultyBadge";
import { ClassStats, StudentInClass, ago, classStats, fa, pct } from "@/lib/adminStats";
import { useToast } from "@/components/ToastProvider";

type TabId = "summary" | "students" | "exercises" | "structure";

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { ix } = useAdminData();
  const toast = useToast();
  const [tab, setTab] = useState<TabId>("summary");
  const cs = useMemo(() => (ix ? classStats(ix, id) : null), [ix, id]);

  if (!ix) return null;
  if (!cs) {
    return (
      <>
        <PageHeader title="کلاس پیدا نشد" back={{ href: "/admin/classes", label: "همه‌ی کلاس‌ها" }} />
        <Empty>این کلاس وجود نداره یا حذف شده.</Empty>
      </>
    );
  }

  return (
    <>
      <PageHeader
        back={{ href: "/admin/classes", label: "همه‌ی کلاس‌ها" }}
        title={cs.title}
        subtitle={
          <span className="flex items-center gap-x-3 gap-y-1 flex-wrap">
            <button
              onClick={() => {
                navigator.clipboard?.writeText(cs.code);
                toast("کد کپی شد", "ok");
              }}
              className="inline-flex items-center gap-1.5 font-mono tracking-widest text-ink bg-white border border-line rounded-lg px-2 py-0.5 text-xs hover:border-primary"
              dir="ltr"
            >
              {cs.code} <Copy size={11} />
            </button>
            <span>معلم: {cs.teacherId ? <Link href="/admin/teachers" className="font-bold text-ink hover:underline">{cs.teacherName}</Link> : "—"}</span>
            <span>ساخته‌شده {ago(cs.createdAt)}</span>
            <span>آخرین فعالیت {ago(cs.lastActive)}</span>
          </span>
        }
        actions={
          <>
            <Link href={`/class/${cs.code}`} target="_blank" className="btn-ghost">
              <ExternalLink size={14} /> باز کردن کلاس
            </Link>
            <Link href={`/class/${cs.code}/students`} target="_blank" className="btn-ghost">
              <Users2 size={14} /> پاسخ‌ها
            </Link>
          </>
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "summary", label: "خلاصه" },
          { id: "students", label: "دانشجوها", count: cs.studentCount },
          { id: "exercises", label: "تمرین‌ها", count: cs.exercises.length },
          { id: "structure", label: "جلسه‌ها و تیم‌ها", count: cs.meetings.length },
        ]}
      />

      {tab === "summary" && <Summary cs={cs} />}
      {tab === "students" && <StudentsTab cs={cs} />}
      {tab === "exercises" && <ExercisesTab cs={cs} />}
      {tab === "structure" && <StructureTab cs={cs} />}
    </>
  );
}

function Summary({ cs }: { cs: ClassStats }) {
  const buckets = useMemo(() => {
    const b = [0, 0, 0, 0, 0];
    cs.students.filter((s) => s.attempts > 0).forEach((s) => (b[Math.min(4, Math.floor(s.avgScore / 20))]++));
    return ["۰–۲۰", "۲۰–۴۰", "۴۰–۶۰", "۶۰–۸۰", "۸۰–۱۰۰"].map((label, i) => ({ label, students: b[i] }));
  }, [cs]);
  const top = cs.students.filter((s) => s.solved > 0).slice(0, 5);

  return (
    <div className="space-y-5">
      <StatStrip
        items={[
          { label: "دانشجو", value: fa(cs.studentCount), hint: `${fa(cs.activeStudents7d)} فعال در ۷ روز اخیر` },
          { label: "جلسه", value: fa(cs.meetings.length) },
          { label: "سلول کد", value: fa(cs.cellCount), hint: `${fa(cs.commentCount)} نظر` },
          { label: "پاسخ تمرین", value: fa(cs.submissionCount), hint: `${fa(pct(cs.correctCount, cs.submissionCount))}٪ درست` },
          { label: "نرخ حل تمرین‌ها", value: `${fa(cs.solveRate)}٪`, hint: `${fa(cs.exercises.length)} تمرین` },
          { label: "میانگین نمره", value: fa(cs.avgScore), hint: "بهترین پاسخ هر نفر" },
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
          <Columns data={buckets} xKey="label" bars={[{ key: "students", name: "دانشجو" }]} height={190} />
        </Panel>
        <Panel className="lg:col-span-4" title="سخت‌ترین تمرین‌ها" subtitle="کمترین درصد حل‌کننده، بین تمرین‌هایی که تلاش شده">
          <HBars
            rows={cs.exercises
              .filter((e) => e.attempts > 0)
              .map((e) => ({ label: e.title, value: pct(e.solvers, cs.studentCount), sub: `${fa(e.attempts)} تلاش`, href: undefined }))
              .sort((a, b) => a.value - b.value)
              .slice(0, 5)}
            suffix="٪ حل کردن"
            max={100}
            emptyText="هنوز تلاشی روی تمرین‌ها نشده."
          />
        </Panel>
        <Panel className="lg:col-span-3" title="جلوتری‌ها" subtitle="بیشترین تمرین حل‌شده">
          {top.length === 0 ? (
            <Empty>هنوز کسی تمرینی حل نکرده.</Empty>
          ) : (
            <ol className="space-y-3">
              {top.map((s, i) => (
                <li key={s.userId}>
                  <Link href={`/admin/students/${s.userId}`} className="flex items-center gap-2.5 hover:opacity-70">
                    <span className="w-5 text-xs font-black text-muted tabular-nums">{fa(i + 1)}</span>
                    <Avatar name={s.name} avatar={s.avatar} size={28} />
                    <span className="flex-1 min-w-0 text-sm font-bold truncate">{s.name}</span>
                    <span className="text-xs text-muted tabular-nums">{fa(s.solved)} حل</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}

function StudentsTab({ cs }: { cs: ClassStats }) {
  const total = cs.exercises.length;
  const columns: Column<StudentInClass>[] = [
    {
      key: "name",
      label: "دانشجو",
      sort: (r) => r.name,
      render: (r) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={r.name} avatar={r.avatar} size={30} />
          <span className="font-bold">{r.name}</span>
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
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: r.teamColor || "#a1a1aa" }} />
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
    { key: "attempts", label: "تلاش", sort: (r) => r.attempts, hideOnMobile: true, render: (r) => <span className="tabular-nums">{fa(r.attempts)}</span> },
    { key: "cells", label: "سلول", sort: (r) => r.cells, hideOnMobile: true, render: (r) => <span className="tabular-nums">{fa(r.cells)}</span> },
    { key: "comments", label: "نظر", sort: (r) => r.comments, hideOnMobile: true, render: (r) => <span className="tabular-nums">{fa(r.comments)}</span> },
    {
      key: "last",
      label: "آخرین فعالیت",
      sort: (r) => (r.lastActive ? new Date(r.lastActive).getTime() : 0),
      render: (r) => <Chip tone={r.lastActive && Date.now() - new Date(r.lastActive).getTime() < 7 * 86_400_000 ? "ok" : "neutral"}>{ago(r.lastActive)}</Chip>,
    },
  ];
  return (
    <Panel flush title="دانشجوهای کلاس" subtitle="روی هر نفر بزن تا آمار کاملش (توی همه‌ی کلاس‌ها) باز بشه.">
      <DataTable rows={cs.students} columns={columns} rowKey={(r) => r.userId} href={(r) => `/admin/students/${r.userId}`} defaultSort={{ key: "solved", dir: "desc" }} empty="هنوز دانشجویی توی این کلاس نیست" />
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
    {
      key: "due",
      label: "مهلت",
      sort: (r) => (r.dueAt ? new Date(r.dueAt).getTime() : 0),
      hideOnMobile: true,
      render: (r) => (r.dueAt ? <span className="text-xs">{new Date(r.dueAt).toLocaleDateString("fa-IR")}</span> : <span className="text-muted">—</span>),
    },
  ];
  return (
    <div className="space-y-5">
      {cs.exercises.length > 0 && cs.studentCount > 0 && (
        <Panel title="درصد حل‌کننده‌ی هر تمرین" subtitle="از کل دانشجوهای کلاس">
          <Columns
            data={[...cs.exercises].reverse().map((e, i) => ({ label: `${fa(i + 1)}`, solved: pct(e.solvers, cs.studentCount) }))}
            xKey="label"
            bars={[{ key: "solved", name: "درصد حل‌کننده" }]}
            unit="٪"
            domain={[0, 100]}
            height={170}
          />
          <p className="text-[11px] text-muted mt-2">ترتیب از قدیمی‌ترین تمرین به جدیدترینه.</p>
        </Panel>
      )}
      <Panel flush title="تمرین‌ها">
        <DataTable rows={cs.exercises} columns={columns} rowKey={(r) => r.id} empty="این کلاس هنوز تمرینی نداره" />
      </Panel>
    </div>
  );
}

function StructureTab({ cs }: { cs: ClassStats }) {
  return (
    <div className="grid lg:grid-cols-12 gap-5">
      <Panel className="lg:col-span-7" title="جلسه‌ها" subtitle="تعداد سلول و نظر در هر جلسه">
        {cs.meetings.length === 0 ? (
          <Empty>هنوز جلسه‌ای ساخته نشده.</Empty>
        ) : (
          <Columns
            data={cs.meetings.map((m) => ({ label: m.title.length > 10 ? m.title.slice(0, 10) + "…" : m.title, cells: m.cells, comments: m.comments }))}
            xKey="label"
            bars={[
              { key: "cells", name: "سلول", color: "#0a0a0a" },
              { key: "comments", name: "نظر", color: "#d4d4d8" },
            ]}
            height={220}
          />
        )}
      </Panel>
      <Panel className="lg:col-span-5" title="تیم‌ها" flush>
        {cs.teams.length === 0 ? (
          <Empty>تیمی ساخته نشده.</Empty>
        ) : (
          <ul className="divide-y divide-line/70">
            {cs.teams.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: t.color }} />
                <span className="font-bold flex-1 truncate">{t.name}</span>
                <span className="text-xs text-muted tabular-nums">{fa(t.members)} نفر</span>
                <span className="text-xs text-muted tabular-nums">{fa(t.cells)} سلول</span>
                <span className="text-xs font-bold tabular-nums">{fa(t.solved)} حل</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel className="lg:col-span-6" title="کوییزها" flush>
        {cs.quizzes.length === 0 ? (
          <Empty>کوییزی نبوده.</Empty>
        ) : (
          <ul className="divide-y divide-line/70">
            {cs.quizzes.map((q) => (
              <li key={q.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="font-bold flex-1 truncate">{q.title}</span>
                <Chip tone={q.status === "active" ? "ok" : "neutral"}>{q.status === "active" ? "در حال برگزاری" : q.status === "ended" ? "پایان‌یافته" : "پیش‌نویس"}</Chip>
                <span className="text-xs text-muted tabular-nums">{fa(q.participants)} شرکت‌کننده</span>
                <span className="text-xs font-bold tabular-nums w-12 text-left">{q.participants ? `${fa(q.avgPct)}٪` : "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel className="lg:col-span-6" title="مسابقه‌ها" flush>
        {cs.competitions.length === 0 ? (
          <Empty>مسابقه‌ای نبوده.</Empty>
        ) : (
          <ul className="divide-y divide-line/70">
            {cs.competitions.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="font-bold flex-1 truncate">{c.title}</span>
                <Chip tone={c.status === "active" ? "ok" : "neutral"}>{c.status === "active" ? "در حال برگزاری" : c.status === "ended" ? "پایان‌یافته" : "پیش‌نویس"}</Chip>
                <span className="text-xs text-muted tabular-nums">{fa(c.submissions)} ارسال</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
