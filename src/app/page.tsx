"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ProfileModal from "@/components/ProfileModal";
import { Users, Zap, MessageCircle, BookOpen, Brain, Flag } from "lucide-react";

export default function LandingPage() {
  const { ready, user, needsProfile } = useAuth();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);

  // Fresh Google sign-in landed here with no profile row yet: finish it, then go in.
  useEffect(() => {
    if (ready && user && needsProfile) {
      const t = setTimeout(() => setProfileOpen(true), 300);
      return () => clearTimeout(t);
    }
  }, [ready, user, needsProfile]);

  return (
    <div className="min-h-screen overflow-x-hidden">
      <nav className="sticky top-0 z-50 glass px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <span className="font-extrabold text-ink flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl grid place-items-center text-white shadow-glow" style={{ background: "var(--grad)" }}>
              🐍
            </span>
            دفترچه کلاس پایتون
          </span>
          <div className="flex-1" />
          {ready && user && !needsProfile ? (
            <Link href="/dashboard" className="btn-primary">
              برو به داشبورد
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">
                ورود
              </Link>
              <Link href="/signup" className="btn-primary">
                ثبت‌نام
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="relative px-6 pt-16 pb-20 max-w-5xl mx-auto">
        <div className="absolute -top-10 -right-24 w-80 h-80 rounded-full bg-primary2/20 blur-3xl pointer-events-none" />
        <div className="absolute top-40 -left-24 w-72 h-72 rounded-full bg-pink-400/15 blur-3xl pointer-events-none" />
        <div className="relative grid md:grid-cols-2 gap-14 items-center">
          <div className="anim-pop">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white border border-primary/20 text-primary rounded-full text-xs font-bold mb-5 shadow-soft">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              زنده، تیمی و همزمان
            </span>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-[1.3] tracking-tight mb-5">
              کلاس پایتونت رو <span className="grad-text">زنده و تعاملی</span> کن
            </h1>
            <p className="text-muted leading-8 max-w-md mb-8">
              دانشجوها در تیم کد می‌نویسن، همون لحظه اجرا می‌کنن، با هم چت می‌کنن و توی کوییز و مسابقه‌ی زنده رقابت می‌کنن؛ همه‌چیز توی مرورگر، بدون نصب.
            </p>
            <div className="flex flex-wrap gap-3">
              {ready && user && !needsProfile ? (
                <Link href="/dashboard" className="btn-primary !px-7 !py-3.5 !text-[15px]">
                  برو به داشبورد ←
                </Link>
              ) : (
                <Link href="/signup" className="btn-primary !px-7 !py-3.5 !text-[15px]">
                  شروع کن ←
                </Link>
              )}
              <Link href="/admin" className="btn-ghost !px-6 !py-3.5">
                پنل مدیریت
              </Link>
            </div>
          </div>

          <div className="anim-float">
            <div className="card overflow-hidden shadow-lift [backface-visibility:hidden] [transform:translateZ(0)]">
              <div className="flex items-center gap-2.5 p-3.5 border-b border-line bg-slate-50/80">
                <span className="w-9 h-9 rounded-full bg-indigo-100 grid place-items-center text-lg">🧑‍💻</span>
                <div className="text-sm font-bold">سارا</div>
                <span className="mr-auto text-[11px] font-bold px-2.5 py-1 rounded-full text-white bg-emerald-500">تیم آلفا</span>
              </div>
              <div className="bg-[#0b1020]">
              <pre className="bg-[#282a36] text-[#f8f8f2] p-5 text-[13.5px] leading-7 font-mono text-left" dir="ltr">
{`def greet(name):
    return f"Hello, {name}!"

print(greet("world"))
10 / 2`}
              </pre>
              <div className="p-3 bg-[#0b1020] text-emerald-400 font-mono text-[13px] text-left leading-6 whitespace-pre-line" dir="ltr">
                Hello, world!{"\n"}5.0
              </div>
              </div>
              <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-t border-line text-xs text-muted">
                💬 <span>علی: عالیه، بریم سراغ تمرین بعدی!</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <h2 className="text-center font-extrabold text-2xl mb-2">همه‌چیز برای یه کلاس زنده</h2>
        <p className="text-center text-sm text-muted mb-8">از نوشتن اولین خط کد تا مسابقه‌ی تیمی</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: <Users size={22} />, title: "کار تیمی", desc: "تیم بساز، سلول‌های مشترک داشته باش و ویرایش هم‌تیمی‌ها رو زنده ببین." },
            { icon: <Zap size={22} />, title: "اجرای آنی", desc: "کد پایتون مستقیم توی مرورگر با Pyodide اجرا می‌شه." },
            { icon: <MessageCircle size={22} />, title: "چت تیمی", desc: "اعضای هر تیم توی یه چت خصوصی و زنده با هم هماهنگ می‌شن." },
            { icon: <BookOpen size={22} />, title: "تمرین با تست خودکار", desc: "معلم تست‌کیس تعریف می‌کنه و پاسخ دانشجو همون لحظه چک می‌شه." },
            { icon: <Brain size={22} />, title: "کوییز زنده", desc: "سوال چندگزینه‌ای با تایمر و رتبه‌بندی لحظه‌ای." },
            { icon: <Flag size={22} />, title: "مسابقه‌ی تیمی", desc: "همه‌ی تیم‌ها یه سوال رو با محدودیت زمان حل می‌کنن." },
          ].map((f) => (
            <div key={f.title} className="card p-6 hover:shadow-lift hover:-translate-y-1 transition duration-300">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 grid place-items-center text-primary mb-3.5">{f.icon}</div>
              <h3 className="font-bold mb-1.5">{f.title}</h3>
              <p className="text-sm text-muted leading-7">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="card p-8 md:p-10 grid md:grid-cols-3 gap-8 text-center">
          {[
            { n: "۱", t: "معلم کلاس می‌سازه", d: "اسم کلاس و یه رمز مدیریت — یه کد ۶ حرفی می‌گیره." },
            { n: "۲", t: "دانشجوها وارد می‌شن", d: "با کد یا لینک وارد می‌شن و توی یه تیم عضو می‌شن." },
            { n: "۳", t: "کد، چت و رقابت", d: "می‌نویسن، اجرا می‌کنن، تمرین حل می‌کنن و مسابقه می‌دن." },
          ].map((s) => (
            <div key={s.n}>
              <div className="w-12 h-12 mx-auto rounded-full grid place-items-center text-white font-extrabold text-lg shadow-glow mb-3" style={{ background: "var(--grad)" }}>
                {s.n}
              </div>
              <h3 className="font-bold mb-1">{s.t}</h3>
              <p className="text-sm text-muted leading-7">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="text-center text-xs text-muted pb-10">ساخته‌شده با Next.js + Supabase · Python در مرورگر با Pyodide</footer>

      <ProfileModal
        open={profileOpen}
        firstTime
        onClose={() => {
          setProfileOpen(false);
          router.replace("/dashboard");
        }}
      />
    </div>
  );
}
