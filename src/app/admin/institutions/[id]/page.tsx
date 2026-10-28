"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { AdminOnly, useAdminData } from "@/components/admin/AdminShell";
import { Avatar, Bar, Chip, Column, DataTable, Empty, PageHeader, Panel, StatStrip } from "@/components/admin/ui";
import { ActivityChart } from "@/components/admin/charts";
import { ClassRow, ago, activitySeries, classRows, fa, institutionRows } from "@/lib/adminStats";

export default function InstitutionDetailPage() {
  return (
    <AdminOnly>
      <Inner />
    </AdminOnly>
  );
}

function Inner() {
  const { id } = useParams<{ id: string }>();
  const { ix } = useAdminData();
  const inst = useMemo(() => (ix ? institutionRows(ix).find((r) => r.id === id) : null), [ix, id]);
  const teacherIds = useMemo(() => new Set((ix?.data.grants || []).filter((g) => g.institution_id === id && g.role === "teacher").map((g) => g.user_id)), [ix, id]);
  const classes = useMemo(() => (ix ? classRows(ix).filter((c) => c.teacherId && teacherIds.has(c.teacherId)) : []), [ix, teacherIds]);
  const activity = useMemo(() => {
    if (!ix) return [];
    const cs = new Set(classes.map((c) => c.id));
    const cells = ix.data.cells.filter((c) => cs.has(c.class_id));
    const cellIds = new Set(cells.map((c) => c.id));
    const exIds = new Set(ix.data.exercises.filter((e) => cs.has(e.class_id)).map((e) => e.id));
    return activitySeries(30, {
      cells: cells.map((c) => c.created_at),
      submissions: ix.data.exSubs.filter((x) => exIds.has(x.exercise_id)).map((x) => x.submitted_at),
      comments: ix.data.comments.filter((c) => cellIds.has(c.cell_id)).map((c) => c.created_at),
    });
  }, [ix, classes]);

  if (!ix) return null;
  if (!inst) {
    return (
      <>
        <PageHeader title="موسسه پیدا نشد" back={{ href: "/admin/institutions", label: "همه‌ی موسسه‌ها" }} />
        <Empty>این موسسه وجود نداره.</Empty>
      </>
    );
  }

  const teachers = Array.from(teacherIds).map((uid) => ({
    id: uid,
    name: ix.nameOf(uid),
    email: ix.profileById.get(uid)?.email || null,
    avatar: ix.profileById.get(uid)?.avatar || null,
    classes: classes.filter((c) => c.teacherId === uid).length,
  }));

  const classCols: Column<ClassRow>[] = [
    { key: "title", label: "کلاس", sort: (r) => r.title, render: (r) => <Link href={`/admin/classes/${r.id}`} className="font-bold hover:underline">{r.title}</Link> },
    { key: "teacher", label: "معلم", sort: (r) => r.teacherName, render: (r) => r.teacherName, hideOnMobile: true },
    { key: "students", label: "دانشجو", sort: (r) => r.students, render: (r) => <span className="tabular-nums">{fa(r.students)}</span> },
    { key: "solve", label: "نرخ حل", sort: (r) => r.solveRate, className: "w-36", render: (r) => (r.exercises && r.students ? <div className="flex items-center gap-2"><Bar value={r.solveRate} /><span className="text-xs font-bold tabular-nums w-9 text-left">{fa(r.solveRate)}٪</span></div> : <span className="text-muted">—</span>) },
    { key: "last", label: "آخرین فعالیت", sort: (r) => (r.lastActive ? new Date(r.lastActive).getTime() : 0), render: (r) => <span className="text-xs text-muted">{ago(r.lastActive)}</span> },
  ];

  return (
    <>
      <PageHeader
        back={{ href: "/admin/institutions", label: "همه‌ی موسسه‌ها" }}
        title={inst.name}
        subtitle={inst.managers.length ? `مدیر: ${inst.managers.map((m) => m.name).join("، ")}` : "هنوز مدیری نداره؛ از «معلم‌ها و کد معرف» کد مدیر بساز."}
      />
      <StatStrip
        cols="xl:grid-cols-5"
        items={[
          { label: "معلم", value: fa(inst.teachers), hint: inst.maxTeachers != null ? `ظرفیت ${fa(inst.maxTeachers)}` : "ظرفیت نامحدود" },
          { label: "کلاس", value: fa(inst.classes) },
          { label: "دانشجو", value: fa(inst.students) },
          { label: "پاسخ تمرین", value: fa(inst.submissions) },
          { label: "فعالیت ۳۰ روز", value: fa(inst.activity30) },
        ]}
      />
      <div className="grid lg:grid-cols-12 gap-5 mt-5">
        <Panel className="lg:col-span-8" title="فعالیت ۳۰ روز اخیر موسسه">
          <ActivityChart data={activity} />
        </Panel>
        <Panel className="lg:col-span-4" title="معلم‌ها" flush>
          {teachers.length === 0 ? (
            <Empty>هنوز معلمی ندارد.</Empty>
          ) : (
            <ul className="divide-y divide-line/70">
              {teachers.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={t.name} avatar={t.avatar} size={30} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold truncate">{t.name}</span>
                    {t.email && <span className="block text-[11px] text-muted truncate" dir="ltr">{t.email}</span>}
                  </span>
                  <Chip>{fa(t.classes)} کلاس</Chip>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel className="lg:col-span-12" flush title="کلاس‌ها">
          <DataTable rows={classes} columns={classCols} rowKey={(r) => r.id} href={(r) => `/admin/classes/${r.id}`} defaultSort={{ key: "last", dir: "desc" }} empty="هنوز کلاسی نساخته‌اند" />
        </Panel>
      </div>
    </>
  );
}
