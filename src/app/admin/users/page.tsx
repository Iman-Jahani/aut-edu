"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { AdminOnly, useAdminData } from "@/components/admin/AdminShell";
import { Avatar, Chip, Column, DataTable, PageHeader, Panel, SearchBox } from "@/components/admin/ui";
import { useToast } from "@/components/ToastProvider";
import { adminJson, jsonBody } from "@/lib/adminFetch";
import { ago } from "@/lib/adminStats";

type Role = "admin" | "manager" | "teacher" | "student";
interface UserRow {
  user_id: string;
  display_name: string;
  avatar: string | null;
  email: string | null;
  role: Role;
  institution_id: string | null;
  institution_name: string | null;
  updated_at: string;
}

const ROLE_LABEL: Record<Role, string> = { admin: "ادمین", manager: "مدیر موسسه", teacher: "معلم", student: "دانشجو" };
const ROLE_HELP: Record<Role, string> = {
  admin: "دسترسی کامل به پنل مدیریت و همه‌ی داده‌ها، و می‌تونه به بقیه نقش بده.",
  manager: "پنل مدیریت فقط برای موسسه‌ی انتخاب‌شده. معلم‌ها و کد معرف همون موسسه رو مدیریت می‌کنه.",
  teacher: "می‌تونه کلاس بسازه. می‌تونی یه موسسه هم بهش بدی.",
  student: "نقش عادی. نقش ویژه‌اش (و موسسه) برداشته می‌شه.",
};
const tone = (r: Role) => (r === "admin" ? "dark" : r === "manager" ? "warn" : r === "teacher" ? "ok" : "neutral");

export default function UsersPage() {
  return (
    <AdminOnly>
      <Inner />
    </AdminOnly>
  );
}

function Inner() {
  const toast = useToast();
  const { actor, data, reload } = useAdminData();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "">("");
  const [editing, setEditing] = useState<UserRow | null>(null);

  const load = useCallback(async () => {
    try {
      setRows((await adminJson<{ items: UserRow[] }>("/api/admin/users")).items);
    } catch (e) {
      toast("خطا: " + (e instanceof Error ? e.message : ""), "err");
    }
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<Role, number> = { admin: 0, manager: 0, teacher: 0, student: 0 };
    rows.forEach((r) => (c[r.role] = (c[r.role] || 0) + 1));
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows.filter((r) => (!roleFilter || r.role === roleFilter) && (!n || r.display_name.toLowerCase().includes(n) || (r.email || "").toLowerCase().includes(n)));
  }, [rows, q, roleFilter]);

  const columns: Column<UserRow>[] = [
    {
      key: "name",
      label: "کاربر",
      sort: (r) => r.display_name,
      render: (r) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={r.display_name} avatar={r.avatar} size={32} />
          <span>
            <span className="block font-bold leading-tight">
              {r.display_name} {r.user_id === actor.userId && <span className="text-[11px] font-semibold text-muted">(خودت)</span>}
            </span>
            {r.email && (
              <span className="block text-[11px] text-muted" dir="ltr">
                {r.email}
              </span>
            )}
          </span>
        </span>
      ),
    },
    { key: "role", label: "نقش", sort: (r) => r.role, render: (r) => <Chip tone={tone(r.role)}>{ROLE_LABEL[r.role]}</Chip> },
    { key: "inst", label: "موسسه", sort: (r) => r.institution_name || "", hideOnMobile: true, render: (r) => r.institution_name || <span className="text-muted">—</span> },
    { key: "updated", label: "آخرین به‌روزرسانی", sort: (r) => new Date(r.updated_at).getTime(), hideOnMobile: true, render: (r) => <span className="text-xs text-muted">{ago(r.updated_at)}</span> },
    {
      key: "act",
      label: "",
      render: (r) => (
        <button
          onClick={() => setEditing(r)}
          disabled={r.user_id === actor.userId}
          title={r.user_id === actor.userId ? "نقش خودت رو نمی‌تونی از اینجا عوض کنی" : undefined}
          className="btn-ghost !py-1.5 !px-3 !text-xs disabled:opacity-30 disabled:cursor-not-allowed"
        >
          تغییر نقش
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="کاربران و نقش‌ها" subtitle="ادمین بودن فقط از همین‌جا (یا با ADMIN_EMAILS) داده می‌شه. هیچ‌کس نمی‌تونه نقش خودش رو بالا ببره." />
      <div className="flex gap-2 flex-wrap mb-4">
        {(["", "admin", "manager", "teacher", "student"] as const).map((r) => (
          <button
            key={r || "all"}
            onClick={() => setRoleFilter(r)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition ${roleFilter === r ? "bg-primary text-white border-primary" : "bg-white border-line text-muted hover:text-ink"}`}
          >
            {r ? ROLE_LABEL[r] : "همه"} <span className="opacity-60 mr-1">{(r ? counts[r] : rows.length).toLocaleString("fa-IR")}</span>
          </button>
        ))}
      </div>
      <Panel flush right={<SearchBox value={q} onChange={setQ} placeholder="اسم یا ایمیل…" />} title="همه‌ی حساب‌ها">
        <DataTable rows={filtered} columns={columns} rowKey={(r) => r.user_id} defaultSort={{ key: "updated", dir: "desc" }} maxHeight="640px" empty="کاربری پیدا نشد" />
      </Panel>

      {editing && (
        <RoleDialog
          user={editing}
          institutions={data?.institutions || []}
          onClose={() => setEditing(null)}
          onDone={async () => {
            setEditing(null);
            await Promise.all([load(), reload()]);
          }}
        />
      )}
    </>
  );
}

function RoleDialog({ user, institutions, onClose, onDone }: { user: UserRow; institutions: { id: string; name: string }[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [role, setRole] = useState<Role>(user.role);
  const [inst, setInst] = useState(user.institution_id || "");
  const [busy, setBusy] = useState(false);
  const unchanged = role === user.role && (role === "manager" || role === "teacher" ? inst === (user.institution_id || "") : true);

  const save = async () => {
    if (role === "manager" && !inst) return toast("برای مدیر، موسسه رو انتخاب کن", "err");
    if (role === "admin" && !confirm(`«${user.display_name}» ادمین کامل سایت بشه؟ به همه‌ی داده‌ها دسترسی داره و می‌تونه به بقیه هم نقش بده.`)) return;
    setBusy(true);
    try {
      await adminJson("/api/admin/users", { method: "PATCH", ...jsonBody({ user_id: user.user_id, role, institution_id: role === "manager" || role === "teacher" ? inst || null : null }) });
      toast("نقش عوض شد", "ok");
      onDone();
    } catch (e) {
      toast("خطا: " + (e instanceof Error ? e.message : ""), "err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 anim-pop">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-extrabold text-lg">تغییر نقش</h2>
            <p className="text-sm text-muted mt-0.5">{user.display_name}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-2">
          {(["admin", "manager", "teacher", "student"] as Role[]).map((r) => (
            <label key={r} className={`flex gap-3 p-3 rounded-xl border cursor-pointer transition ${role === r ? "border-primary bg-zinc-50" : "border-line hover:border-zinc-300"}`}>
              <input type="radio" name="role" checked={role === r} onChange={() => setRole(r)} className="mt-1 accent-black" />
              <span>
                <span className="block font-bold text-sm">{ROLE_LABEL[r]}</span>
                <span className="block text-[11px] text-muted leading-5">{ROLE_HELP[r]}</span>
              </span>
            </label>
          ))}
        </div>
        {(role === "manager" || role === "teacher") && (
          <label className="block mt-4">
            <span className="text-xs text-muted block mb-1">{role === "manager" ? "موسسه (لازمه)" : "موسسه (اختیاری)"}</span>
            <select value={inst} onChange={(e) => setInst(e.target.value)} className="w-full border border-line rounded-xl px-3 py-2 text-sm outline-none focus:border-primary bg-white">
              <option value="">{role === "manager" ? "انتخاب کن…" : "بدون موسسه (معلم مستقل)"}</option>
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
            {institutions.length === 0 && <span className="text-[11px] text-muted block mt-1">اول از صفحه‌ی «موسسه‌ها» یه موسسه بساز.</span>}
          </label>
        )}
        <div className="flex gap-2 justify-end mt-6">
          <button onClick={onClose} className="btn-ghost">
            لغو
          </button>
          <button onClick={save} disabled={busy || unchanged} className="btn-primary disabled:opacity-40">
            {busy ? "در حال ذخیره…" : "ذخیره"}
          </button>
        </div>
      </div>
    </div>
  );
}
