"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import ProfileModal from "@/components/ProfileModal";
import WelcomeModal from "@/components/WelcomeModal";
import { Skeleton } from "@/components/Skeleton";
import {
  GraduationCap,
  BookOpen,
  Plus,
  LogOut,
  Code2,
  Copy,
  ArrowLeft,
  Shield,
  Users,
} from "lucide-react";
import type { ClassSession } from "@/lib/types";

interface OwnedClass extends ClassSession {
  isOwner: boolean;
}

export default function DashboardPage() {
  const { ready, user, needsProfile, displayName, avatar, role, signOut } = useAuth();
  const router = useRouter();

  const [profileOpen, setProfileOpen] = useState(false);
  const [welcome, setWelcome] = useState<"join" | "create" | null>(null);

  const [teacherClasses, setTeacherClasses] = useState<OwnedClass[] | null>(null);
  const [studentClasses, setStudentClasses] = useState<ClassSession[] | null>(null);

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  const loadTeacherClasses = useCallback(async () => {
    if (!user) return;
    const [{ data: owned }, { data: coRows }] = await Promise.all([
      supabase.from("class_sessions").select("*").eq("created_by", user.id).order("created_at", { ascending: false }),
      supabase.from("class_teachers").select("class_id").eq("user_id", user.id),
    ]);
    const coIds = (coRows || []).map((r) => r.class_id);
    let coTaught: ClassSession[] = [];
    if (coIds.length) {
      const { data } = await supabase.from("class_sessions").select("*").in("id", coIds);
      coTaught = data || [];
    }
    const merged: OwnedClass[] = [
      ...(owned || []).map((c) => ({ ...c, isOwner: true })),
      ...coTaught.map((c) => ({ ...c, isOwner: false })),
    ];
    setTeacherClasses(merged);
  }, [user]);

  const loadStudentClasses = useCallback(async () => {
    if (!user) return;
    const { data: memberRows } = await supabase.from("class_members").select("class_id").eq("user_id", user.id);
    const ids = (memberRows || []).map((r) => r.class_id);
    if (!ids.length) {
      setStudentClasses([]);
      return;
    }
    const { data } = await supabase.from("class_sessions").select("*").in("id", ids).order("created_at", { ascending: false });
    setStudentClasses(data || []);
  }, [user]);

  useEffect(() => {
    if (user) {
      loadTeacherClasses();
      loadStudentClasses();
    }
  }, [user, loadTeacherClasses, loadStudentClasses]);

  if (!ready || !user) {
    return (
      <div className="min-h-screen p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-12 w-full !rounded-2xl" />
        <Skeleton className="h-40 w-full !rounded-2xl" />
        <Skeleton className="h-40 w-full !rounded-2xl" />
      </div>
    );
  }

  const showTeacherSection = role === "teacher" || (teacherClasses && teacherClasses.length > 0);

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-40 glass px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/" className="font-extrabold text-ink flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl grid place-items-center text-white shadow-glow" style={{ background: "var(--grad)" }}>
              🐍
            </span>
            <span className="hidden sm:inline">دفترچه کلاس پایتون</span>
          </Link>
          <div className="flex-1" />
          <Link href="/admin" className="btn-ghost hidden sm:inline-flex" title="پنل مدیریت کلی">
            <Shield size={15} />
          </Link>
          <Link href="/playground" className="btn-ghost">
            <Code2 size={15} /> پلی‌گراند
          </Link>
          <button
            onClick={() => setProfileOpen(true)}
            className="flex items-center gap-2 pl-3 pr-1.5 py-1 bg-white border border-line rounded-full text-sm font-bold text-primary hover:shadow-soft transition"
          >
            <span className="w-7 h-7 rounded-full bg-indigo-50 grid place-items-center text-base">{avatar}</span>
            {displayName}
          </button>
          <button onClick={() => signOut().then(() => router.replace("/"))} className="btn-ghost" title="خروج">
            <LogOut size={15} />
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-10">
        <Link
          href="/playground"
          className="card p-5 flex items-center gap-4 hover:shadow-lift hover:-translate-y-0.5 transition group"
          style={{ background: "linear-gradient(135deg, rgba(99,102,241,.06), rgba(236,72,153,.06))" }}
        >
          <div className="w-12 h-12 rounded-xl grid place-items-center text-white shadow-glow shrink-0" style={{ background: "var(--grad)" }}>
            <Code2 size={22} />
          </div>
          <div className="flex-1">
            <div className="font-bold">پلی‌گراند — کد بزن، بدون نیاز به هیچ کلاسی</div>
            <div className="text-sm text-muted">دفترچه‌ی شخصی کد که همیشه در دسترسته.</div>
          </div>
          <span className="text-primary font-bold text-sm shrink-0 group-hover:translate-x-[-2px] transition">برو ←</span>
        </Link>

        {showTeacherSection && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-extrabold text-lg flex items-center gap-2">
                <GraduationCap size={19} className="text-primary" /> کلاس‌های من (معلم)
              </h2>
              {role === "teacher" && (
                <button onClick={() => setWelcome("create")} className="btn-primary">
                  <Plus size={15} /> کلاس جدید
                </button>
              )}
            </div>

            {teacherClasses === null ? (
              <div className="grid sm:grid-cols-2 gap-3">
                <Skeleton className="h-28 !rounded-2xl" />
                <Skeleton className="h-28 !rounded-2xl" />
              </div>
            ) : teacherClasses.length === 0 ? (
              <div className="card text-center py-10 px-6">
                <BookOpen size={34} className="mx-auto mb-3 text-primary/40" />
                <p className="text-sm text-muted">هنوز کلاسی نساختی.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {teacherClasses.map((c) => (
                  <ClassCard key={c.id} cls={c} badge={c.isOwner ? null : "معلم همکار"} />
                ))}
              </div>
            )}
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-extrabold text-lg flex items-center gap-2">
              <BookOpen size={19} className="text-primary" /> کلاس‌های من (دانشجو)
            </h2>
            <button onClick={() => setWelcome("join")} className="btn-ghost">
              <Plus size={15} /> پیوستن با کد
            </button>
          </div>

          {studentClasses === null ? (
            <div className="grid sm:grid-cols-2 gap-3">
              <Skeleton className="h-28 !rounded-2xl" />
              <Skeleton className="h-28 !rounded-2xl" />
            </div>
          ) : studentClasses.length === 0 ? (
            <div className="card text-center py-10 px-6">
              <Users size={34} className="mx-auto mb-3 text-primary/40" />
              <p className="text-sm text-muted mb-4">هنوز به کلاسی نپیوستی.</p>
              <button onClick={() => setWelcome("join")} className="btn-primary mx-auto">
                پیوستن به یه کلاس
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {studentClasses.map((c) => (
                <ClassCard key={c.id} cls={c} badge={null} />
              ))}
            </div>
          )}
        </section>
      </main>

      <ProfileModal open={profileOpen || needsProfile} firstTime={needsProfile} onClose={() => setProfileOpen(false)} />
      <WelcomeModal open={welcome !== null} defaultTab={welcome || "join"} onClose={() => setWelcome(null)} />
    </div>
  );
}

function ClassCard({ cls, badge }: { cls: ClassSession; badge: string | null }) {
  return (
    <Link href={`/class/${cls.code}`} className="card p-4 flex items-center gap-3 hover:shadow-lift hover:-translate-y-0.5 transition group">
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 grid place-items-center text-primary shrink-0">
        <GraduationCap size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-bold text-sm truncate flex items-center gap-1.5">
          {cls.title}
          {badge && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">{badge}</span>}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted mt-0.5">
          <span
            onClick={(e) => {
              e.preventDefault();
              navigator.clipboard.writeText(cls.code);
            }}
            className="font-mono tracking-widest flex items-center gap-1 hover:text-primary"
            title="کپی کد"
          >
            {cls.code} <Copy size={10} />
          </span>
          <span>· {new Date(cls.created_at).toLocaleDateString("fa-IR")}</span>
        </div>
      </div>
      <ArrowLeft size={16} className="text-muted group-hover:text-primary group-hover:-translate-x-0.5 transition shrink-0" />
    </Link>
  );
}
