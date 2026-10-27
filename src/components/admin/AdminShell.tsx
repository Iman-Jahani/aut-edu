"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { BookMarked, GraduationCap, KeyRound, LayoutDashboard, Loader2, Lock, LogOut, RefreshCw, School, ArrowUpRight } from "lucide-react";
import { AdminData, Index, buildIndex } from "@/lib/adminStats";
import { Panel } from "@/components/admin/ui";

interface Ctx {
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
  { href: "/admin", label: "نمای کلی", icon: LayoutDashboard, exact: true },
  { href: "/admin/classes", label: "کلاس‌ها", icon: School },
  { href: "/admin/students", label: "دانشجوها", icon: GraduationCap },
  { href: "/admin/teachers", label: "معلم‌ها و کد معرف", icon: KeyRound },
  { href: "/admin/library", label: "کتابخانه‌ی تمرین", icon: BookMarked },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/admin/session")
      .then((r) => r.json())
      .then((d) => setAuthed(!!d.ok))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) return <div className="min-h-screen bg-primary" />;
  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  return (
    <DataProvider onUnauthorized={() => setAuthed(false)}>
      <Frame onLogout={() => fetch("/api/admin/login", { method: "DELETE" }).finally(() => setAuthed(false))}>{children}</Frame>
    </DataProvider>
  );
}

function DataProvider({ children, onUnauthorized }: { children: React.ReactNode; onUnauthorized: () => void }) {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/data", { cache: "no-store" });
      if (res.status === 401) return onUnauthorized();
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "دریافت داده ناموفق بود");
      setData(d as AdminData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا");
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    reload();
  }, [reload]);

  const ix = useMemo(() => (data ? buildIndex(data) : null), [data]);
  const value = useMemo(() => ({ data, ix, loading, error, reload }), [data, ix, loading, error, reload]);
  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

function Frame({ children, onLogout }: { children: React.ReactNode; onLogout: () => void }) {
  const pathname = usePathname();
  const { data, loading, reload, error } = useAdminData();
  const active = (n: (typeof NAV)[number]) => (n.exact ? pathname === n.href : pathname.startsWith(n.href));

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-primary text-white sticky top-0 h-screen px-4 py-6">
        <Link href="/admin" className="flex items-center gap-2.5 px-2 mb-8">
          <span className="w-9 h-9 rounded-xl bg-white text-primary grid place-items-center font-black font-mono text-sm">{">_"}</span>
          <span className="leading-tight">
            <span className="block font-extrabold text-[15px]">پنل مدیریت</span>
            <span className="block text-[11px] text-white/50">دفترچه کلاس پایتون</span>
          </span>
        </Link>
        <nav className="space-y-1 flex-1">
          {NAV.map((n) => (
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
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-white/65 hover:text-white hover:bg-white/10">
            <LogOut size={16} /> خروج
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        {/* Top bar */}
        <div className="sticky top-0 z-30 bg-[#fafafa]/90 backdrop-blur border-b border-line">
          <div className="lg:hidden bg-primary text-white px-4 pt-3 flex items-center gap-2">
            <span className="font-extrabold text-sm flex-1">پنل مدیریت</span>
            <Link href="/dashboard" className="text-xs text-white/70 px-2 py-1">
              سایت
            </Link>
            <button onClick={onLogout} className="text-xs text-white/70 px-2 py-1">
              خروج
            </button>
          </div>
          <nav className="lg:hidden bg-primary flex gap-1 overflow-x-auto px-3 pb-2 pt-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold ${active(n) ? "bg-white text-primary" : "text-white/70"}`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="px-4 lg:px-8 py-2.5 flex items-center gap-3 text-xs text-muted">
            <span className="flex-1">
              {data ? `آخرین به‌روزرسانی: ${new Date(data.generatedAt).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}` : "در حال دریافت داده…"}
            </span>
            <button onClick={reload} disabled={loading} className="inline-flex items-center gap-1.5 font-bold text-ink hover:opacity-70 disabled:opacity-40">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> به‌روزرسانی
            </button>
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
      <div className="h-9 w-56 bg-zinc-200 rounded-lg" />
      <div className="h-24 bg-zinc-200/70 rounded-2xl" />
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 h-72 bg-zinc-200/70 rounded-2xl" />
        <div className="h-72 bg-zinc-200/70 rounded-2xl" />
      </div>
    </div>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy || !password) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const d = await res.json().catch(() => ({}));
      if (res.ok) onDone();
      else setError(d.error || "ورود ناموفق بود");
    } catch {
      setError("ارتباط با سرور برقرار نشد");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-primary grid place-items-center p-5">
      <div className="w-full max-w-sm">
        <div className="w-12 h-12 rounded-2xl bg-white text-primary grid place-items-center font-black font-mono mb-6">{">_"}</div>
        <h1 className="text-white text-3xl font-black mb-2">پنل مدیریت</h1>
        <p className="text-white/50 text-sm mb-8">آمار همه‌ی کلاس‌ها، دانشجوها و معلم‌ها یک‌جا.</p>
        <div className="relative mb-3">
          <Lock size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="رمز عبور"
            className="w-full bg-white/10 border border-white/15 text-white placeholder:text-white/35 rounded-xl pr-11 pl-4 py-3 outline-none focus:border-white/60"
          />
        </div>
        {error && <div className="text-red-400 text-xs mb-3">{error}</div>}
        <button onClick={submit} disabled={busy} className="w-full py-3 rounded-xl bg-white text-primary font-extrabold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
          {busy && <Loader2 size={15} className="animate-spin" />} ورود
        </button>
        <Link href="/dashboard" className="block text-center text-white/45 text-xs mt-6 hover:text-white/80">
          بازگشت به سایت
        </Link>
      </div>
    </div>
  );
}
