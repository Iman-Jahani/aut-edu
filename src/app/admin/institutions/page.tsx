"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { AdminOnly, useAdminData } from "@/components/admin/AdminShell";
import { Chip, Column, DataTable, PageHeader, Panel, StatStrip } from "@/components/admin/ui";
import { useToast } from "@/components/ToastProvider";
import { adminJson, jsonBody } from "@/lib/adminFetch";
import { InstitutionRow, ago, fa, institutionRows } from "@/lib/adminStats";

export default function InstitutionsPage() {
  return (
    <AdminOnly>
      <Inner />
    </AdminOnly>
  );
}

function Inner() {
  const toast = useToast();
  const { ix, reload } = useAdminData();
  const rows = useMemo(() => (ix ? institutionRows(ix) : []), [ix]);
  const [name, setName] = useState("");
  const [seats, setSeats] = useState("");
  const [busy, setBusy] = useState(false);
  const [edits, setEdits] = useState<Record<string, { name: string; seats: string }>>({});

  const create = async () => {
    if (!name.trim()) return toast("اسم موسسه رو بنویس", "err");
    setBusy(true);
    try {
      await adminJson("/api/admin/institutions", { method: "POST", ...jsonBody({ name, max_teachers: seats }) });
      toast("موسسه ساخته شد", "ok");
      setName("");
      setSeats("");
      await reload();
    } catch (e) {
      toast("خطا: " + (e instanceof Error ? e.message : ""), "err");
    } finally {
      setBusy(false);
    }
  };

  const save = async (r: InstitutionRow) => {
    const e = edits[r.id];
    if (!e) return;
    try {
      await adminJson("/api/admin/institutions", { method: "PATCH", ...jsonBody({ id: r.id, name: e.name, max_teachers: e.seats }) });
      toast("ذخیره شد", "ok");
      setEdits((p) => {
        const n = { ...p };
        delete n[r.id];
        return n;
      });
      await reload();
    } catch (err) {
      toast("خطا: " + (err instanceof Error ? err.message : ""), "err");
    }
  };

  const del = async (r: InstitutionRow) => {
    if (!confirm(`موسسه‌ی «${r.name}» حذف شود؟`)) return;
    try {
      await adminJson(`/api/admin/institutions?id=${r.id}`, { method: "DELETE" });
      await reload();
    } catch (err) {
      toast("خطا: " + (err instanceof Error ? err.message : ""), "err");
    }
  };

  const inputCls = "bg-white border border-line rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-primary";
  const cur = (r: InstitutionRow) => edits[r.id] || { name: r.name, seats: r.maxTeachers === null ? "" : String(r.maxTeachers) };
  const patch = (r: InstitutionRow, p: Partial<{ name: string; seats: string }>) => setEdits((prev) => ({ ...prev, [r.id]: { ...cur(r), ...p } }));

  const columns: Column<InstitutionRow>[] = [
    {
      key: "name",
      label: "موسسه",
      sort: (r) => r.name,
      render: (r) => (
        <div className="flex items-center gap-2">
          <input value={cur(r).name} onChange={(e) => patch(r, { name: e.target.value })} dir="auto" className={inputCls + " w-44 font-bold"} />
          <Link href={`/admin/institutions/${r.id}`} className="text-xs font-bold text-muted hover:text-ink whitespace-nowrap">
            جزئیات ←
          </Link>
        </div>
      ),
    },
    {
      key: "seats",
      label: "ظرفیت معلم",
      sort: (r) => r.teachers,
      render: (r) => (
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-bold tabular-nums">{fa(r.teachers)}</span> از
          <input value={cur(r).seats} onChange={(e) => patch(r, { seats: e.target.value })} inputMode="numeric" placeholder="∞" className={inputCls + " w-14 text-center !py-1"} />
        </div>
      ),
    },
    {
      key: "managers",
      label: "مدیر",
      render: (r) => (r.managers.length ? <span className="text-xs">{r.managers.map((m) => m.name).join("، ")}</span> : <Chip tone="warn">بدون مدیر</Chip>),
      hideOnMobile: true,
    },
    { key: "classes", label: "کلاس", sort: (r) => r.classes, render: (r) => <span className="tabular-nums">{fa(r.classes)}</span> },
    { key: "students", label: "دانشجو", sort: (r) => r.students, render: (r) => <span className="tabular-nums">{fa(r.students)}</span>, hideOnMobile: true },
    { key: "last", label: "آخرین فعالیت", sort: (r) => (r.lastActive ? new Date(r.lastActive).getTime() : 0), render: (r) => <span className="text-xs text-muted">{ago(r.lastActive)}</span>, hideOnMobile: true },
    {
      key: "act",
      label: "",
      render: (r) => (
        <span className="flex items-center gap-2">
          <button onClick={() => save(r)} disabled={!edits[r.id]} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-primary disabled:opacity-30 disabled:cursor-not-allowed">
            <Save size={12} /> ذخیره
          </button>
          <button onClick={() => del(r)} title="حذف" className="text-danger hover:opacity-70">
            <Trash2 size={14} />
          </button>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="موسسه‌ها" subtitle="هر موسسه مدیر و معلم‌های خودش رو داره و مدیرش فقط داده‌های همین موسسه رو می‌بینه. معلم‌های بدون موسسه هم می‌تونن عضو بشن." />
      <StatStrip
        cols="xl:grid-cols-4"
        items={[
          { label: "موسسه", value: fa(rows.length) },
          { label: "معلم در موسسه‌ها", value: fa(rows.reduce((a, r) => a + r.teachers, 0)) },
          { label: "کلاس در موسسه‌ها", value: fa(rows.reduce((a, r) => a + r.classes, 0)) },
          { label: "بدون مدیر", value: fa(rows.filter((r) => r.managers.length === 0).length), hint: "کد مدیر بساز" },
        ]}
      />
      <Panel className="mt-5" title="موسسه‌ی جدید" subtitle="می‌تونی بعداً از صفحه‌ی «معلم‌ها و کد معرف» برایش کد مدیر بسازی، یا موقع ساخت کد، اسم موسسه‌ی جدید بنویسی.">
        <div className="flex gap-2.5 flex-wrap items-end">
          <label className="block flex-1 min-w-[200px]">
            <span className="text-[11px] text-muted block mb-1">اسم</span>
            <input value={name} onChange={(e) => setName(e.target.value)} dir="auto" placeholder="مثلاً دبیرستان البرز" className={inputCls + " w-full"} />
          </label>
          <label className="block w-36">
            <span className="text-[11px] text-muted block mb-1">سقف معلم (خالی = نامحدود)</span>
            <input value={seats} onChange={(e) => setSeats(e.target.value)} inputMode="numeric" placeholder="∞" className={inputCls + " w-full"} />
          </label>
          <button onClick={create} disabled={busy} className="btn-primary disabled:opacity-50">
            <Plus size={14} /> بساز
          </button>
        </div>
      </Panel>
      <Panel className="mt-5" flush title="همه‌ی موسسه‌ها">
        <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} defaultSort={{ key: "classes", dir: "desc" }} empty="هنوز موسسه‌ای نساخته‌ای" />
      </Panel>
    </>
  );
}
