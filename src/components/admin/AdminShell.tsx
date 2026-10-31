"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { BookMarked, Building2, GraduationCap, KeyRound, LayoutDashboard, RefreshCw, School, ShieldCheck, ArrowUpRight, ShieldAlert } from "lucide-react";
import { AdminData, Index, buildIndex } from "@/lib/adminStats";
import { Panel } from "@/components/admin/ui";
import { useAuth } from "@/context/AuthContext";
import { adminFetch } from "@/lib/adminFetch";
import UserMenu from "@/components/UserMenu";

export interface ActorInfo {
  userId: string;
  email: string | null;
  role: "admin" | "manager";
  institutionId: string | null;
  institutionName: string | null;
}

interface Ctx {
  actor: ActorInfo;
  isAdmin: boolean;
  data: AdminData | null;
  ix: Index | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}
const AdminDataContext = createContext<Ctx | null>(null);

export function useAdminData(): Ctx {
  const c = useContext(AdminDataContext);
  if (!c) throw new Error("useAdminData must be used inside <AdminShell>");
  return c;
}

const NAV = [
  { href: "/admin", label: "نمای کلی", icon: LayoutDashboard, exact: true, roles: ["admin", "manager"] },
  { href: "/admin/classes", label: "کلاس‌ها", icon: School, roles: ["admin", "manager"] },
  { href: "/admin/students", label: "دانشجوها", icon: GraduationCap, roles: ["admin", "manager"] },
  { href: "/admin/teachers", label: "معلم‌ها و کد معرف", icon: KeyRound, roles: ["admin", "manager"] },
  { href: "/admin/institutions", label: "موسسه‌ها", icon: Building2, roles: ["admin"] },
  { href: "/admin/users", label: "کاربران و نقش‌ها", icon: ShieldCheck, roles: ["admin"] },
  { href: "/admin/library", label: "کتابخانه‌ی تمرین", icon: BookMarked, roles: ["admin"] },
];

/**
 * The admin area is for signed-in accounts whose role is admin or manager. The server re-checks the
 * role on every API call; this component only decides what to show.
 */
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const { ready, user } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<{ status: "checking" | "forbidden" | "ready" | "error"; actor?: ActorInfo; message?: string }>({ status: "checking" });

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login?next=/admin");
      return;
    }
    let cancelled = false;
    adminFetch("/api/admin/session")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (r.ok && d.ok) setState({ status: "ready", actor: d as ActorInfo });
        else if (r.status === 401 || r.status === 403) setState({ status: "forbidden" });
        else setState({ status: "error", message: d.error || "خطای سرور" });
      })
      .catch(() => !cancelled && setState({ status: "error", message: "ارتباط با سرور برقرار نشد" }));
    return () => {
      cancelled = true;
    };
  }, [ready, user, router]);

  if (state.status === "checking") return <div className="min-h-screen bg-deep" />;
  if (state.status === "forbidden" || state.status === "error") return <Blocked message={state.status === "error" ? state.message : undefined} />;
  return (
    <DataProvider actor={state.actor!}>
      <Frame>{children}</Frame>
    </DataProvider>
  );
}

function Blocked({ message }: { message?: string }) {
  return (
    <div className="min-h-screen bg-deep grid place-items-center p-5">
      <div className="w-full max-w-sm text-center">
        <div className="w-12 h-12 rounded-2xl bg-white/10 text-white grid place-items-center mx-auto mb-5">
          <ShieldAlert size={22} />
        </div>
        <h1 className="text-white text-2xl font-black mb-2">{message ? "مشکلی پیش اومد" : "اینجا برای تو نیست"}</h1>
        <p className="text-white/55 text-sm leading-7 mb-7">{message || "پنل مدیریت فقط برای ادمین سایت و مدیر موسسه‌هاست. اگه باید دسترسی داشته باشی، از ادمین بخواه نقشت رو عوض کنه."}</p>
        <Link href="/dashboard" className="inline-block rounded-xl bg-white text-primary font-extrabold text-sm px-6 py-3">
          بازگشت به سایت
        </Link>
      </div>
    </div>
  );
}

function DataProvider({ children, actor }: { children: React.ReactNode; actor: ActorInfo }) {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch("/api/admin/data");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "دریافت داده ناموفق بود");
      setData(d as AdminData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const ix = useMemo(() => (data ? buildIndex(data) : null), [data]);
  const value = useMemo(() => ({ actor, isAdmin: actor.role === "admin", data, ix, loading, error, reload }), [actor, data, ix, loading, error, reload]);
  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

function Frame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data, loading, reload, error, actor } = useAdminData();
  const nav = NAV.filter((n) => n.roles.includes(actor.role));
  const title = actor.role === "admin" ? "پنل مدیریت" : "پنل مدیر";
  const sub = actor.role === "admin" ? "دفترچه کلاس پایتون" : actor.institutionName || "موسسه";
  const active = (n: (typeof NAV)[number]) => (n.exact ? pathname === n.href : pathname.startsWith(n.href));

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-deep text-white sticky top-0 h-screen px-4 py-6">
        <Link href="/admin" className="flex items-center gap-2.5 px-2 mb-8">
          <span className="w-9 h-9 rounded-xl bg-white text-primary grid place-items-center font-black font-mono text-sm">{">_"}</span>
          <span className="leading-tight">
            <span className="block font-extrabold text-[15px]">{title}</span>
            <span className="block text-[11px] text-white/50 max-w-[9.5rem] truncate">{sub}</span>
          </span>
        </Link>
        <nav className="space-y-1 flex-1">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition ${
                active(n) ? "bg-white text-primary" : "text-white/65 hover:text-white hover:bg-white/10"
              }`}
            >
              <n.icon size={17} />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-1 border-t border-white/10 pt-4">
          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-white/65 hover:text-white hover:bg-white/10">
            <ArrowUpRight size={16} /> بازگشت به سایت
          </Link>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        {/* Top bar */}
        <div className="sticky top-0 z-30 bg-[#fbf8f1]/90 backdrop-blur border-b border-line">
          <div className="lg:hidden bg-deep text-white px-4 pt-3 flex items-center gap-2">
            <span className="font-extrabold text-sm flex-1">{title}</span>
            <Link href="/dashboard" className="text-xs text-white/70 px-2 py-1">
              سایت
            </Link>
          </div>
          <nav className="lg:hidden bg-deep flex gap-1 overflow-x-auto px-3 pb-2 pt-1">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold ${active(n) ? "bg-white text-primary" : "text-white/70"}`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="px-4 lg:px-8 py-2 flex items-center gap-3 text-xs text-muted">
            <span className="flex-1">
              {data ? `آخرین به‌روزرسانی: ${new Date(data.generatedAt).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}` : "در حال دریافت داده…"}
            </span>
            <button onClick={reload} disabled={loading} className="inline-flex items-center gap-1.5 font-bold text-ink hover:opacity-70 disabled:opacity-40">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> به‌روزرسانی
            </button>
            <UserMenu />
          </div>
        </div>

        <main className="px-4 lg:px-8 py-6 max-w-[1400px]">
          {data?.warnings?.length ? (
            <div className="mb-5 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3">
              بعضی جدول‌ها خونده نشدن (احتمالاً مایگریشن‌شون اجرا نشده): {data.warnings.slice(0, 3).join(" · ")}
            </div>
          ) : null}
          {error && !data ? (
            <Panel title="دریافت داده ناموفق بود">
              <p className="text-sm text-danger mb-2">{error}</p>
              <p className="text-xs text-muted mb-4">مطمئن شو SUPABASE_SERVICE_ROLE_KEY توی تنظیمات سرور (.env.local یا Vercel) گذاشته شده.</p>
              <button onClick={reload} className="btn-primary">
                تلاش دوباره
              </button>
            </Panel>
          ) : loading && !data ? (
            <Skeleton />
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-9 w-56 bg-stone-200 rounded-lg" />
      <div className="h-24 bg-stone-200/70 rounded-2xl" />
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 h-72 bg-stone-200/70 rounded-2xl" />
        <div className="h-72 bg-stone-200/70 rounded-2xl" />
      </div>
    </div>
  );
}

/** Wrap pages only the site admin may use (managers get a plain notice; the API refuses them anyway). */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAdminData();
  if (isAdmin) return <>{children}</>;
  return (
    <Panel>
      <div className="text-center py-10 text-sm text-muted">این بخش فقط برای ادمین سایته.</div>
    </Panel>
  );
}
