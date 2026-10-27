"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAdminData } from "@/components/admin/AdminShell";
import { Bar, Chip, Column, DataTable, PageHeader, Panel, SearchBox, StatStrip } from "@/components/admin/ui";
import { ClassRow, ago, classRows, fa } from "@/lib/adminStats";

export default function ClassesPage() {
  const { ix } = useAdminData();
  const [q, setQ] = useState("");
  const [teacher, setTeacher] = useState("");
  const rows = useMemo(() => (ix ? classRows(ix) : []), [ix]);

  const teachers = useMemo(() => Array.from(new Set(rows.map((r) => r.teacherName))).sort((a, b) => a.localeCompare(b, "fa")), [rows]);
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows.filter((r) => (!teacher || r.teacherName === teacher) && (!n || r.title.toLowerCase().includes(n) || r.code.toLowerCase().includes(n) || r.teacherName.toLowerCase().includes(n)));
  }, [rows, q, teacher]);

  const columns: Column<ClassRow>[] = [
    {
      key: "title",
      label: "کلاس",
      sort: (r) => r.title,
      render: (r) => (
        <div>
          <Link href={`/admin/classes/${r.id}`} className="font-bold hover:underline">
            {r.title}
          </Link>
          <div className="mt-0.5">
            <span className="font-mono text-[11px] text-muted tracking-widest" dir="ltr">
              {r.code}
            </span>
          </div>
        </div>
      ),
    },
    { key: "teacher", label: "معلم", sort: (r) => r.teacherName, render: (r) => r.teacherName, hideOnMobile: true },
    { key: "students", label: "دانشجو", sort: (r) => r.students, render: (r) => <span className="tabular-nums">{fa(r.students)}</span> },
    { key: "meetings", label: "جلسه", sort: (r) => r.meetings, render: (r) => <span className="tabular-nums">{fa(r.meetings)}</span>, hideOnMobile: true },
    { key: "exercises", label: "تمرین", sort: (r) => r.exercises, render: (r) => <span className="tabular-nums">{fa(r.exercises)}</span>, hideOnMobile: true },
    { key: "submissions", label: "پاسخ‌ها", sort: (r) => r.submissions, render: (r) => <span className="tabular-nums">{fa(r.submissions)}</span> },
    {
      key: "solve",
      label: "نرخ حل",
      sort: (r) => r.solveRate,
      className: "w-36",
      render: (r) =>
        r.exercises && r.students ? (
          <div className="flex items-center gap-2">
            <Bar value={r.solveRate} />
            <span className="text-xs font-bold tabular-nums w-9 text-left">{fa(r.solveRate)}٪</span>
          </div>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: "last",
      label: "آخرین فعالیت",
      sort: (r) => (r.lastActive ? new Date(r.lastActive).getTime() : 0),
      render: (r) => {
        const recent = r.lastActive && Date.now() - new Date(r.lastActive).getTime() < 7 * 86_400_000;
        return <Chip tone={recent ? "ok" : "neutral"}>{ago(r.lastActive)}</Chip>;
      },
    },
  ];

  const active = rows.filter((r) => r.lastActive && Date.now() - new Date(r.lastActive).getTime() < 7 * 86_400_000).length;

  return (
    <>
      <PageHeader title="کلاس‌ها" subtitle="همه‌ی کلاس‌های همه‌ی معلم‌ها. روی هر ردیف بزن تا آمار کامل همون کلاس باز بشه." />
      <StatStrip
        cols="xl:grid-cols-4"
        items={[
          { label: "کلاس", value: fa(rows.length) },
          { label: "فعال در ۷ روز اخیر", value: fa(active), hint: `${fa(rows.length - active)} ساکت` },
          { label: "جمع دانشجوها", value: fa(rows.reduce((a, r) => a + r.students, 0)), hint: "با احتساب تکراری بین کلاس‌ها" },
          { label: "جمع پاسخ‌ها", value: fa(rows.reduce((a, r) => a + r.submissions, 0)) },
        ]}
      />
      <Panel
        className="mt-5"
        flush
        title="همه‌ی کلاس‌ها"
        right={
          <div className="flex gap-2 flex-wrap">
            <select value={teacher} onChange={(e) => setTeacher(e.target.value)} className="bg-white border border-line rounded-xl px-3 py-2 text-sm outline-none focus:border-primary max-w-[180px]">
              <option value="">همه‌ی معلم‌ها</option>
              {teachers.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <SearchBox value={q} onChange={setQ} placeholder="اسم کلاس، کد یا معلم…" />
          </div>
        }
      >
        <DataTable rows={filtered} columns={columns} rowKey={(r) => r.id} href={(r) => `/admin/classes/${r.id}`} defaultSort={{ key: "last", dir: "desc" }} empty="کلاسی با این مشخصات پیدا نشد" />
      </Panel>
    </>
  );
}
