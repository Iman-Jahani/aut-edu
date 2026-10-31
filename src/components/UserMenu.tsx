"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Code2, LayoutDashboard, LogOut, Shield, UserRound } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import ProfileModal from "@/components/ProfileModal";
import NotificationBell from "@/components/NotificationBell";

const ROLE_LABEL: Record<string, string> = { admin: "ادمین سایت", manager: "مدیر موسسه", teacher: "معلم", student: "دانشجو" };

/**
 * The one account control used in every header: avatar → profile, dashboard, playground,
 * admin panel (staff only) and sign out. Signed-out visitors get login / sign-up buttons instead.
 */
export default function UserMenu() {
  const { ready, user, displayName, avatar, role, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!ready) return <span className="w-24 h-9" aria-hidden />;
  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/login" className="btn-ghost">
          ورود
        </Link>
        <Link href="/signup" className="btn-primary">
          ثبت‌نام
        </Link>
      </div>
    );
  }

  const staff = role === "admin" || role === "manager";
  const item = "w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-ink hover:bg-stone-50 transition text-right";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 pl-2.5 pr-1 py-1 rounded-full bg-white border border-line hover:shadow-soft transition"
        aria-haspopup="menu"
        aria-expanded={open}
        title="حساب کاربری"
      >
        <span className="w-8 h-8 rounded-full bg-accent/20 grid place-items-center text-lg">{avatar}</span>
        <span className="text-xs font-bold max-w-[100px] truncate hidden sm:block">{displayName}</span>
        <ChevronDown size={13} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="fixed inset-x-3 top-16 z-[150] sm:absolute sm:inset-x-auto sm:top-auto sm:left-0 sm:mt-2 sm:w-64 bg-white border border-line rounded-2xl shadow-2xl anim-pop overflow-hidden"
        >
          <div className="flex items-center gap-3 px-4 py-4 border-b border-line">
            <span className="w-11 h-11 rounded-full bg-accent/20 grid place-items-center text-2xl shrink-0">{avatar}</span>
            <div className="min-w-0">
              <div className="font-extrabold text-sm truncate">{displayName}</div>
              <div className="text-[11px] text-muted">{ROLE_LABEL[role || "student"]}</div>
            </div>
          </div>
          <div className="py-1.5">
            <button
              className={item}
              onClick={() => {
                setOpen(false);
                setProfileOpen(true);
              }}
            >
              <UserRound size={16} className="text-muted" /> ویرایش پروفایل و آواتار
            </button>
            <Link href="/dashboard" className={item} onClick={() => setOpen(false)}>
              <LayoutDashboard size={16} className="text-muted" /> داشبورد
            </Link>
            <Link href="/playground" className={item} onClick={() => setOpen(false)}>
              <Code2 size={16} className="text-muted" /> پلی‌گراند
            </Link>
            {staff && (
              <Link href="/admin" className={item} onClick={() => setOpen(false)}>
                <Shield size={16} className="text-muted" /> {role === "admin" ? "پنل مدیریت" : "پنل مدیر"}
              </Link>
            )}
          </div>
          <div className="border-t border-line py-1.5">
            <button
              className={`${item} !text-danger`}
              onClick={() => {
                setOpen(false);
                signOut().then(() => router.replace("/"));
              }}
            >
              <LogOut size={16} /> خروج از حساب
            </button>
          </div>
        </div>
      )}

      <ProfileModal open={profileOpen} firstTime={false} onClose={() => setProfileOpen(false)} />
    </div>
  );
}

/** Everything that sits at the end of a header: (optional) playground, notifications, account menu. */
export function HeaderActions({ showPlayground = false }: { showPlayground?: boolean }) {
  const { user } = useAuth();
  return (
    <div className="flex items-center gap-2">
      {showPlayground && user && (
        <Link href="/playground" className="btn-ghost hidden sm:inline-flex">
          <Code2 size={15} /> پلی‌گراند
        </Link>
      )}
      {user && <NotificationBell />}
      <UserMenu />
    </div>
  );
}
