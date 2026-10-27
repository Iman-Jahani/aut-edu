"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useAdminData } from "@/components/admin/AdminShell";
import { Avatar, Bar, Chip, Column, DataTable, Empty, PageHeader, Panel, StatStrip } from "@/components/admin/ui";
import { ActivityChart, HBars, StatusDonut, TopicRadar } from "@/components/admin/charts";
import { STATUS_LABEL, StudentStats, ago, fa, studentStats } from "@/lib/adminStats";

const toneOf = { correct: "ok", partial: "warn", wrong: "bad", error: "neutral", pending: "neutral" } as const;

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { ix } = useAdminData();
  const st = useMemo(() => (ix ? studentStats(ix, id) : null), [ix, id]);

  if (!ix) return null;
  if (!st) {
    return (
      <>
        <PageHeader title="دانشجو پیدا نشد" back={{ href: "/admin/students", label: "همه‌ی دانشجوها" }} />
        <Empty>این کاربر وجود نداره.</Empty>
      </>
    );
  }
  const r = st.row;
  const totalSolved = st.classes.reduce((a, c) => a + c.totalExercises, 0);

  const classCols: Column<StudentStats["classes"][number]>[] = [
    { key: "title", label: "کلاس", sort: (c) => c.title, render: (c) => <span className="font-bold">{c.title}</span> },
    {
      key: "solved",
      label: "پیشرفت تمرین‌ها",
      sort: (c) => (c.totalExercises ? c.solved / c.totalExercises : 0),
      className: "w-48",
      render: (c) =>
        c.totalExercises ? (
          <div className="flex items-center gap-2">
            <Bar value={(c.solved / c.totalExercises) * 100} />
            <span className="text-xs font-bold tabular-nums whitespace-nowrap">
              {fa(c.solved)}/{fa(c.totalExercises)}
            </span>
          </div>
        ) : (
          <span className="text-muted">بدون تمرین</span>
        ),
    },
    { key: "avg", label: "میانگین", sort: (c) => c.avgScore, render: (c) => <span className="tabular-nums">{fa(c.avgScore)}</span> },
    { key: "rank", label: "رتبه", sort: (c) => c.rank, render: (c) => <span className="tabular-nums">{fa(c.rank)} از {fa(c.of)}</span> },
    { key: "last", label: "آخرین فعالیت", sort: (c) => (c.lastActive ? new Date(c.lastActive).getTime() : 0), hideOnMobile: true, render: (c) => <span className="text-xs text-muted">{ago(c.lastActive)}</span> },
  ];

  return (
    <>
      <PageHeader
        back={{ href: "/admin/students", label: "همه‌ی دانشجوها" }}
        lead={<Avatar name={r.name} avatar={r.avatar} size={56} />}
        title={r.name}
        subtitle={
          <span className="flex items-center gap-x-3 gap-y-1 flex-wrap">
            {r.email && <span dir="ltr">{r.email}</span>}
            {st.joinedAt && <span>اولین ورود {ago(st.joinedAt)}</span>}
            <span>آخرین فعالیت {ago(r.lastActive)}</span>
            {st.profileRole === "teacher" && <Chip tone="dark">معلم</Chip>}
          </span>
        }
      />

      <StatStrip
        items={[
          { label: "کلاس", value: fa(st.classes.length) },
          { label: "تمرین حل‌شده", value: fa(r.solved), hint: totalSolved ? `از ${fa(totalSolved)} تمرین` : undefined },
          { label: "میانگین نمره", value: r.attempts ? fa(r.avgScore) : "—", hint: `${fa(r.attempts)} تلاش` },
          { label: "سلول کد", value: fa(r.cells) },
          { label: "نظر نوشته", value: fa(st.commentsWritten) },
          { label: "نظر دریافتی", value: fa(st.commentsReceived), hint: "روی کدهاش" },
        ]}
      />

      <div className="grid lg:grid-cols-12 gap-5 mt-5">
        <Panel className="lg:col-span-8" title="فعالیت ۳۰ روز اخیر">
          <ActivityChart data={st.activity} />
        </Panel>
        <Panel className="lg:col-span-4" title="نتیجه‌ی پاسخ‌ها">
          <StatusDonut counts={st.statusCounts} />
        </Panel>

        <Panel className="lg:col-span-5" title="درصد درست بر اساس سختی" subtitle="روی تمرین‌هایی که سختی دارن">
          {st.byDifficulty.some((d) => d.attempts > 0) ? (
            <HBars rows={st.byDifficulty.map((d) => ({ label: d.label, value: d.correctRate, sub: `${fa(d.attempts)} تلاش` }))} suffix="٪" max={100} />
          ) : (
            <Empty>هنوز روی تمرینِ سختی‌دار پاسخی نداده.</Empty>
          )}
        </Panel>
        <Panel className="lg:col-span-7" title="نقاط قوت بر اساس موضوع" subtitle="درصد درست در هر موضوع">
          {st.byTopic.length >= 3 ? (
            <TopicRadar data={st.byTopic} />
          ) : st.byTopic.length > 0 ? (
            <HBars rows={st.byTopic.map((t) => ({ label: t.topic, value: t.correctRate, sub: `${fa(t.attempts)} تلاش` }))} suffix="٪" max={100} />
          ) : (
            <Empty>هنوز روی تمرینِ موضوع‌دار پاسخی نداده.</Empty>
          )}
        </Panel>

        <Panel className="lg:col-span-12" flush title="کلاس‌ها">
          <DataTable rows={st.classes} columns={classCols} rowKey={(c) => c.id} href={(c) => `/admin/classes/${c.id}`} defaultSort={{ key: "title", dir: "asc" }} empty="توی هیچ کلاسی عضو نیست" />
        </Panel>

        <Panel className="lg:col-span-7" title="آخرین پاسخ‌ها" flush>
          {st.recentSubs.length === 0 ? (
            <Empty>هنوز پاسخی نفرستاده.</Empty>
          ) : (
            <ul className="divide-y divide-line/70">
              {st.recentSubs.map((s, i) => (
                <li key={i} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <Chip tone={toneOf[s.status]}>{STATUS_LABEL[s.status]}</Chip>
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold truncate">{s.title}</span>
                    {s.classTitle && <span className="block text-[11px] text-muted truncate">{s.classTitle}</span>}
                  </span>
                  <span className="text-xs font-bold tabular-nums">{fa(s.score)}</span>
                  <span className="text-xs text-muted w-20 text-left">{ago(s.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel className="lg:col-span-5" title="کوییزها" flush>
          {st.quizzes.length === 0 ? (
            <Empty>در کوییزی شرکت نکرده.</Empty>
          ) : (
            <ul className="divide-y divide-line/70">
              {st.quizzes.map((q, i) => (
                <li key={i} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <span className="flex-1 min-w-0 font-bold truncate">{q.title}</span>
                  <span className="w-24">
                    <Bar value={q.pct} />
                  </span>
                  <span className="text-xs font-bold tabular-nums w-10 text-left">{fa(q.pct)}٪</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <p className="text-[11px] text-muted mt-4">
        <Link href="/admin/students" className="hover:underline">
          بازگشت به لیست دانشجوها
        </Link>
      </p>
    </>
  );
}
