"use client";

import { useMemo, useState } from "react";
import { useAdminData } from "@/components/admin/AdminShell";
import { Avatar, Chip, Column, DataTable, PageHeader, Panel, SearchBox, StatStrip } from "@/components/admin/ui";
import { HBars } from "@/components/admin/charts";
import { StudentRow, ago, fa, studentRows } from "@/lib/adminStats";

export default function StudentsPage() {
  const { ix } = useAdminData();
  const [q, setQ] = useState("");
  const rows = useMemo(() => (ix ? studentRows(ix) : []), [ix]);
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? rows.filter((r) => r.name.toLowerCase().includes(n) || (r.email || "").toLowerCase().includes(n)) : rows;
  }, [rows, q]);

  const week = Date.now() - 7 * 86_400_000;
  const active = rows.filter((r) => r.lastActive && new Date(r.lastActive).getTime() > week).length;
  const withAttempts = rows.filter((r) => r.attempts > 0);
  const avg = withAttempts.length ? Math.round(withAttempts.reduce((a, r) => a + r.avgScore, 0) / withAttempts.length) : 0;
  const top = [...rows].filter((r) => r.solved > 0).sort((a, b) => b.solved - a.solved).slice(0, 8);

  const columns: Column<StudentRow>[] = [
    {
      key: "name",
      label: "دانشجو",
      sort: (r) => r.name,
      render: (r) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={r.name} avatar={r.avatar} size={32} />
          <span>
            <span className="block font-bold leading-tight">{r.name}</span>
            {r.email && (
              <span className="block text-[11px] text-muted" dir="ltr">
                {r.email}
              </span>
            )}
          </span>
        </span>
      ),
    },
    { key: "classes", label: "کلاس", sort: (r) => r.classes, render: (r) => <span className="tabular-nums">{fa(r.classes)}</span> },
    { key: "solved", label: "حل‌شده", sort: (r) => r.solved, render: (r) => <span className="font-bold tabular-nums">{fa(r.solved)}</span> },
    { key: "avg", label: "میانگین نمره", sort: (r) => r.avgScore, render: (r) => (r.attempts ? <span className="tabular-nums">{fa(r.avgScore)}</span> : <span className="text-muted">—</span>) },
    { key: "attempts", label: "تلاش", sort: (r) => r.attempts, hideOnMobile: true, render: (r) => <span className="tabular-nums">{fa(r.attempts)}</span> },
    { key: "cells", label: "سلول", sort: (r) => r.cells, hideOnMobile: true, render: (r) => <span className="tabular-nums">{fa(r.cells)}</span> },
    {
      key: "last",
      label: "آخرین فعالیت",
      sort: (r) => (r.lastActive ? new Date(r.lastActive).getTime() : 0),
      render: (r) => <Chip tone={r.lastActive && new Date(r.lastActive).getTime() > week ? "ok" : "neutral"}>{ago(r.lastActive)}</Chip>,
    },
  ];

  return (
    <>
      <PageHeader title="دانشجوها" subtitle="همه‌ی دانشجوها در همه‌ی کلاس‌ها. روی هر نفر بزن تا نمودار و جزئیات کاملش باز بشه." />
      <StatStrip
        cols="xl:grid-cols-4"
        items={[
          { label: "دانشجو", value: fa(rows.length) },
          { label: "فعال در ۷ روز اخیر", value: fa(active), hint: `${fa(rows.length - active)} غیرفعال` },
          { label: "پاسخ‌دهنده به تمرین", value: fa(withAttempts.length) },
          { label: "میانگین نمره", value: fa(avg), hint: "بین پاسخ‌دهنده‌ها" },
        ]}
      />
      <div className="grid lg:grid-cols-12 gap-5 mt-5 items-start">
        <Panel className="lg:col-span-8" flush title="همه‌ی دانشجوها" right={<SearchBox value={q} onChange={setQ} placeholder="اسم یا ایمیل…" />}>
          <DataTable rows={filtered} columns={columns} rowKey={(r) => r.userId} href={(r) => `/admin/students/${r.userId}`} defaultSort={{ key: "last", dir: "desc" }} maxHeight="640px" empty="دانشجویی پیدا نشد" />
        </Panel>
        <Panel className="lg:col-span-4" title="بیشترین تمرین حل‌شده" subtitle="مجموع در همه‌ی کلاس‌ها">
          <HBars rows={top.map((r) => ({ label: r.name, value: r.solved, href: `/admin/students/${r.userId}` }))} emptyText="هنوز کسی تمرینی حل نکرده." />
        </Panel>
      </div>
    </>
  );
}
