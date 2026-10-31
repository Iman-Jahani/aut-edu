"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ProfileModal from "@/components/ProfileModal";
import UserMenu from "@/components/UserMenu";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Types `text` out while `run` is true; restarts every time `run` flips back on. */
function useTyped(text: string, run: boolean, speed = 30) {
  const reduced = usePrefersReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) return setN(0);
    if (reduced) return setN(text.length);
    let i = 0;
    setN(0);
    const id = setInterval(() => {
      i++;
      setN(i);
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [run, text, speed, reduced]);
  return text.slice(0, n);
}

/** Tiny Python highlighter: keywords bright, literals mid, everything else dim. */
function Hl({ code }: { code: string }) {
  const parts = code.split(/(\b(?:def|return|print|for|in|if|len|sum)\b|"[^"]*"|\b\d+(?:\.\d+)?\b)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (!p) return null;
        if (/^(def|return|print|for|in|if|len|sum)$/.test(p)) return <span key={i} className="text-white font-bold">{p}</span>;
        if (/^"/.test(p) || /^\d/.test(p)) return <span key={i} className="text-stone-300">{p}</span>;
        return <span key={i} className="text-stone-500">{p}</span>;
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// The scenes shown inside the sticky panel (one per step of the story)
// ---------------------------------------------------------------------------

const CODE = `def mean(xs):
    return sum(xs) / len(xs)

print(mean([14, 18, 20]))`;

function SceneCode({ on }: { on: boolean }) {
  const typed = useTyped(CODE, on, 34);
  const done = typed.length === CODE.length;
  const [ran, setRan] = useState(false);
  useEffect(() => {
    if (!on || !done) return setRan(false);
    const id = setTimeout(() => setRan(true), 500);
    return () => clearTimeout(id);
  }, [on, done]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-5">
        <span className="w-9 h-9 rounded-full bg-white/10 grid place-items-center text-sm font-bold">س</span>
        <div className="leading-tight">
          <div className="text-sm font-bold">سارا</div>
          <div className="text-[11px] text-white/45">تیم آلفا · جلسه‌ی ۳</div>
        </div>
        <span className="mr-auto text-[11px] text-white/45">{done ? "ذخیره شد" : "در حال نوشتن…"}</span>
      </div>
      <pre dir="ltr" className="font-mono text-[14px] sm:text-[15px] md:text-base leading-8 text-left flex-1 overflow-hidden whitespace-pre">
        <Hl code={typed} />
        {!done && <span className="lp-caret inline-block w-[9px] h-[1.1em] bg-white align-middle ml-px" />}
      </pre>
      <div className="border-t border-white/10 pt-4 flex items-center gap-4 min-h-[64px]">
        <span className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-bold transition ${ran ? "bg-accent text-ink" : "bg-white/10 text-white/60"}`}>
          ▶ اجرا
        </span>
        {ran && (
          <output dir="ltr" className="font-mono text-base text-white lp-rise">
            17.333333333333332
          </output>
        )}
      </div>
    </div>
  );
}

function SceneJoin({ on }: { on: boolean }) {
  const people = [
    ["🚀", "سارا", "آلفا"],
    ["🎯", "علی", "آلفا"],
    ["🌊", "مریم", "بتا"],
    ["⚡", "رضا", "بتا"],
  ];
  return (
    <div key={on ? "on" : "off"} className="flex flex-col h-full">
      <div className="text-sm text-white/50 mb-2">کد کلاس</div>
      <div dir="ltr" className="font-mono font-extrabold text-[2.6rem] sm:text-6xl md:text-7xl tracking-[0.16em] text-left mb-8 leading-none">
        K7QM2R
      </div>
      <ul className="space-y-2.5 flex-1">
        {people.map(([e, n, t], i) => (
          <li key={n} className="lp-rise flex items-center gap-3" style={{ ["--d" as string]: `${0.3 + i * 0.35}s` }}>
            <span className="w-9 h-9 rounded-full bg-white/10 grid place-items-center">{e}</span>
            <span className="font-bold text-sm">{n}</span>
            <span className="mr-auto text-[11px] text-white/55 border border-white/15 rounded-full px-2.5 py-0.5">تیم {t}</span>
          </li>
        ))}
      </ul>
      <div className="border-t border-white/10 pt-4 text-sm text-white/55 lp-rise" style={{ ["--d" as string]: "1.8s" }}>
        ۴ نفر وارد شدن. لازم نیست چیزی نصب کنن.
      </div>
    </div>
  );
}

function SceneExercise({ on }: { on: boolean }) {
  const tests: [string, string, boolean][] = [
    ["14 18 20", "17.33", true],
    ["5", "5.0", true],
    ["(خالی)", "ZeroDivisionError", false],
  ];
  return (
    <div key={on ? "on" : "off"} className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="font-extrabold text-lg">میانگین نمره‌ها</div>
        <span className="text-[11px] font-bold rounded-full bg-white/10 px-2.5 py-0.5">آسان</span>
        <span className="text-[11px] font-bold rounded-full bg-white/10 px-2.5 py-0.5" dir="ltr">Python</span>
      </div>
      <ul className="space-y-3 flex-1">
        {tests.map(([i, o, ok], k) => (
          <li key={k} className="lp-rise flex items-center gap-3 rounded-xl border border-white/10 px-4 py-3" style={{ ["--d" as string]: `${0.3 + k * 0.5}s` }}>
            <span className={`w-6 h-6 rounded-full grid place-items-center text-xs font-black ${ok ? "bg-emerald-500 text-ink" : "bg-red-500 text-white"}`}>{ok ? "✓" : "✗"}</span>
            <span className="text-sm text-white/55">ورودی</span>
            <span dir="ltr" className="font-mono text-sm">{i}</span>
            <span dir="ltr" className="font-mono text-sm mr-auto text-white/70">{o}</span>
          </li>
        ))}
      </ul>
      <div className="border-t border-white/10 pt-4 flex items-end gap-3 lp-rise" style={{ ["--d" as string]: "1.9s" }}>
        <span className="text-5xl font-black leading-none tabular-nums">۶۷</span>
        <span className="text-sm text-white/55 pb-1">نمره · ۲ تست از ۳ تست درست</span>
      </div>
    </div>
  );
}

function SceneComment({ on }: { on: boolean }) {
  return (
    <div key={on ? "on" : "off"} className="flex flex-col h-full relative">
      <span className="lp-pop absolute top-0 left-0 inline-flex items-center gap-2 rounded-full bg-accent text-ink text-xs font-bold px-3 py-1.5" style={{ ["--d" as string]: "1.5s" }}>
        <span className="w-2 h-2 rounded-full bg-red-500" /> یک نظر جدید روی کد تو
      </span>
      <div className="text-sm text-white/50 mb-4 mt-11">کد علی · جلسه‌ی ۳</div>
      <pre dir="ltr" className="font-mono text-[14px] sm:text-[15px] leading-8 text-left rounded-xl border border-white/10 px-4 py-3 whitespace-pre overflow-hidden">
        <Hl code={`def mean(xs):\n    return sum(xs) / len(xs)`} />
      </pre>
      <div className="lp-rise mt-5 rounded-2xl rounded-tr-sm bg-white text-ink px-4 py-3 max-w-[92%]" style={{ ["--d" as string]: "0.6s" }}>
        <div className="text-xs font-bold text-stone-500 mb-1">استاد</div>
        <div className="text-sm leading-7">اگه لیست خالی باشه چی؟ <span dir="ltr" className="font-mono text-[13px] bg-stone-100 rounded px-1">len(xs)</span> صفر می‌شه.</div>
      </div>
      <div className="lp-rise mt-auto text-sm text-white/55" style={{ ["--d" as string]: "2s" }}>
        علی با باز کردن کلاس، پنل نظر رو بازشده می‌بینه.
      </div>
    </div>
  );
}

function SceneQuiz({ on }: { on: boolean }) {
  const rows: [string, number][] = [["سارا", 92], ["علی", 78], ["مریم", 64], ["رضا", 41]];
  const len = 2 * Math.PI * 52;
  return (
    <div key={on ? "on" : "off"} className="flex flex-col h-full">
      <div className="flex items-center gap-6 mb-8">
        <div className="relative w-[130px] h-[130px] shrink-0">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90" aria-hidden>
            <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="8" />
            <circle cx="60" cy="60" r="52" fill="none" stroke="#f2a93b" strokeWidth="8" strokeLinecap="round" strokeDasharray={len} className="lp-ring" style={{ ["--len" as string]: `${len * 0.68}` }} />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <span className="text-3xl font-black tabular-nums" dir="ltr">0:42</span>
          </div>
        </div>
        <div>
          <div className="font-extrabold text-lg">کوییز ۲ · لیست‌ها</div>
          <div className="text-sm text-white/55 mt-1">همه‌ی دانشجوها همزمان می‌بینن و جواب می‌دن.</div>
        </div>
      </div>
      <ul className="space-y-3.5 flex-1">
        {rows.map(([n, v], i) => (
          <li key={n}>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="font-bold">{n}</span>
              <span className="text-white/60 tabular-nums">{v.toLocaleString("fa-IR")}٪</span>
            </div>
            <span className="block h-2.5 rounded-full bg-white/10 overflow-hidden">
              <span className="lp-growx block h-full rounded-full bg-accent" style={{ ["--w" as string]: `${v}%`, ["--d" as string]: `${0.2 + i * 0.2}s` }} />
            </span>
          </li>
        ))}
      </ul>
      <div className="border-t border-white/10 pt-4 text-sm text-white/55">رتبه‌بندی لحظه‌ای، قبل از اینکه زمان تموم بشه.</div>
    </div>
  );
}

function SceneStats({ on }: { on: boolean }) {
  const bars = [9, 8, 8, 7, 6, 5, 3, 2];
  const names = ["س", "ع", "م", "ر", "ن", "ح", "پ", "ب"];
  return (
    <div key={on ? "on" : "off"} className="flex flex-col h-full">
      <div className="mb-6">
        <div className="text-sm text-white/50">پایتون ۱ · نرخ حل تمرین‌ها</div>
        <div className="flex items-end gap-3 mt-1">
          <span className="text-6xl md:text-7xl font-black leading-none tabular-nums">۶۸٪</span>
          <span className="text-sm text-white/55 pb-2">از ۱۰ تمرین</span>
        </div>
      </div>
      <div dir="ltr" className="flex items-end gap-2.5 flex-1 min-h-[140px] border-b border-white/15 pb-0">
        {bars.map((b, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
            <span className="lp-growy block w-full rounded-t-md bg-accent" style={{ ["--h" as string]: `${b * 10}%`, ["--d" as string]: `${0.15 + i * 0.1}s`, opacity: i > 5 ? 0.45 : 1 }} />
          </div>
        ))}
      </div>
      <div dir="ltr" className="flex gap-2.5 mt-2">
        {names.map((n) => (
          <span key={n} className="flex-1 text-center text-[11px] text-white/45">{n}</span>
        ))}
      </div>
      <div className="mt-5 text-sm text-white/55">دو نفر عقب‌ترن، پیش از اینکه کسی بگه چیزی ببینی.</div>
    </div>
  );
}

const SCENES = [SceneCode, SceneJoin, SceneExercise, SceneComment, SceneQuiz, SceneStats];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const STEPS = [
  { id: "code", title: "کد بنویس، همون‌جا اجرا کن", body: "هر سلول یه ادیتور پایتونه که توی خود مرورگر اجرا می‌شه. هم‌تیمی‌ها تغییرات هم رو زنده می‌بینن و هیچ‌کس فایلی برای کسی نمی‌فرسته." },
  { id: "join", title: "با یه کد شش‌حرفی وارد کلاس شو", body: "معلم کلاس می‌سازه و کد رو پخش می‌کنه. دانشجوها با کد یا لینک وارد می‌شن و توی یه تیم عضو می‌شن." },
  { id: "exercise", title: "تمرین بده، تست‌ها خودشون چک می‌شن", body: "ورودی و خروجی مورد انتظار رو تعریف می‌کنی. هر پاسخ همون لحظه روی همه‌ی تست‌ها اجرا می‌شه و دانشجو می‌بینه کدوم‌ها رد شدن." },
  { id: "comment", title: "زیر کد هر نفر نظر بذار", body: "نظرت براش اعلان می‌شه. وقتی کلاس رو باز می‌کنه، همون سلول با نظرِ بازشده منتظرشه." },
  { id: "quiz", title: "کوییز و مسابقه، همون لحظه", body: "سؤال چندگزینه‌ای با تایمر، یا یه مسئله که تیم‌ها با هم حلش می‌کنن. رتبه‌ها زنده عوض می‌شن." },
  { id: "stats", title: "ببین کلاس کجاست", body: "نرخ حل هر تمرین، پیشرفت هر دانشجو و فعالیت هفته، بدون اینکه جدول دستی درست کنی." },
];

export default function LandingPage() {
  const { ready, user, needsProfile } = useAuth();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [code, setCode] = useState("");
  const stepRefs = useRef<(HTMLElement | null)[]>([]);
  const loggedIn = ready && user && !needsProfile;

  // Fresh Google sign-in landed here with no profile row yet: finish it, then go in.
  useEffect(() => {
    if (ready && user && needsProfile) {
      const t = setTimeout(() => setProfileOpen(true), 300);
      return () => clearTimeout(t);
    }
  }, [ready, user, needsProfile]);

  // Which story step is closest to the reading line decides what the panel shows.
  useEffect(() => {
    let raf = 0;
    const calc = () => {
      raf = 0;
      const line = window.innerHeight * (window.innerWidth < 1024 ? 0.8 : 0.5);
      let best = 0;
      let bestD = Infinity;
      stepRefs.current.forEach((el, i) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - line);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      setActive(best);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(calc);
    };
    calc();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const join = () => {
    const c = code.trim().toUpperCase();
    if (c) router.push("/class/" + c);
  };

  return (
    <div className="min-h-screen overflow-x-clip bg-[#fbf8f1]">
      <nav className="sticky top-0 z-50 bg-[#fbf8f1]/85 backdrop-blur-xl border-b border-line">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 h-16 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 font-extrabold">
            <span className="w-9 h-9 rounded-xl bg-primary text-white grid place-items-center font-mono text-sm font-black">{">"}<span className="text-accent">_</span></span>
            <span className="hidden sm:inline">دفترچه کلاس پایتون</span>
          </Link>
          <div className="flex-1" />
          {loggedIn ? (
            <>
              <Link href="/dashboard" className="btn-primary">
                رفتن به داشبورد
              </Link>
              <UserMenu />
            </>
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

      {/* The story: text on one side, one sticky panel that plays the current moment on the other */}
      <section className="max-w-7xl mx-auto px-5 lg:px-8 lg:grid lg:grid-cols-12 lg:gap-12">
        <div className="order-1 lg:order-2 lg:col-span-7 sticky top-16 lg:top-[5.5rem] z-20 lg:self-start pt-3 lg:pt-8 bg-[#fbf8f1] lg:bg-transparent -mx-5 px-5 lg:mx-0 lg:px-0">
          <div className="hero-panel relative rounded-[24px] lg:rounded-[32px] text-white overflow-hidden h-[54vh] lg:h-[min(660px,calc(100vh-8rem))] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.55)]">
            {SCENES.map((Scene, i) => (
              <div key={i} className={`absolute inset-0 p-5 pb-8 md:p-8 md:pb-10 transition-opacity duration-500 ${active === i ? "opacity-100" : "opacity-0 pointer-events-none"}`} aria-hidden={active !== i}>
                <Scene on={active === i} />
              </div>
            ))}
            <div className="absolute bottom-0 inset-x-0 flex gap-1 p-3 pointer-events-none" aria-hidden>
              {STEPS.map((s, i) => (
                <span key={s.id} className={`h-[3px] flex-1 rounded-full transition-colors duration-300 ${i === active ? "bg-accent" : "bg-white/20"}`} />
              ))}
            </div>
          </div>
        </div>

        <div className="order-2 lg:order-1 lg:col-span-5">
          {STEPS.map((s, i) => (
            <article
              key={s.id}
              ref={(el) => {
                stepRefs.current[i] = el;
              }}
              className={`flex flex-col justify-center ${i === 0 ? "min-h-[78vh] lg:min-h-[calc(100vh-4rem)] py-10" : "min-h-[72vh] lg:min-h-[80vh] py-10"}`}
            >
              {i === 0 ? (
                <>
                  <h1 className="text-[2.6rem] sm:text-6xl lg:text-[4.4rem] font-black leading-[1.18] tracking-tight mb-6">
                    کدِ همه‌ی کلاس، روی <span className="underline decoration-accent decoration-[7px] underline-offset-[12px]">یک صفحه</span>.
                  </h1>
                  <p className="text-[17px] leading-9 text-stone-600 max-w-md mb-9">
                    دانشجوها توی مرورگر پایتون می‌نویسن و اجرا می‌کنن، تمرین‌هاشون خودکار تست می‌شه و تو زیر هر سلول نظر می‌ذاری. بدون نصب، بدون فایل فرستادن.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {loggedIn ? (
                      <Link href="/dashboard" className="btn-primary !px-8 !py-3.5 !text-[15px]">
                        رفتن به داشبورد
                      </Link>
                    ) : (
                      <Link href="/signup" className="btn-primary !px-8 !py-3.5 !text-[15px]">
                        ساخت کلاس
                      </Link>
                    )}
                    <a href="#join" className="btn-ghost !px-7 !py-3.5 !text-[15px]">
                      کد کلاس دارم
                    </a>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-3xl md:text-[2.6rem] font-black leading-[1.3] tracking-tight mb-4">{s.title}</h2>
                  <p className="text-[16px] leading-9 text-stone-600 max-w-md">{s.body}</p>
                </>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* Join / create */}
      <section id="join" className="hero-panel text-white mt-10">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-24 md:py-32">
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-black leading-[1.2] tracking-tight max-w-4xl">
            معلمی؟ کلاس بساز.
            <br />
            دانشجویی؟ کدش رو بزن.
          </h2>
          <div className="mt-12 flex flex-col md:flex-row gap-4 md:items-end max-w-3xl">
            <label className="flex-1 block">
              <span className="block text-sm text-white/55 mb-2">کد کلاس</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && join()}
                maxLength={12}
                dir="ltr"
                placeholder="K7QM2R"
                className="w-full bg-transparent border-b-2 border-white/30 focus:border-accent outline-none font-mono font-extrabold text-4xl md:text-5xl tracking-[0.2em] py-3 placeholder:text-white/20 text-left"
              />
            </label>
            <button onClick={join} disabled={!code.trim()} className="rounded-xl bg-accent text-ink font-extrabold px-8 py-4 text-[15px] disabled:opacity-30 transition hover:opacity-90">
              ورود به کلاس
            </button>
          </div>
          <p className="mt-10 text-white/60 leading-8 max-w-xl">
            اگه معلمی، با{" "}
            <Link href="/signup" className="text-white underline underline-offset-4">
              ثبت‌نام
            </Link>{" "}
            شروع کن. ساخت حساب معلم کد معرف می‌خواد؛ اون رو از مدیر سایت بگیر.
          </p>
        </div>
        <footer className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-5 lg:px-8 py-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/45">
            <span>ساخته‌شده با Next.js و Supabase؛ پایتون با Pyodide توی مرورگر اجرا می‌شه.</span>
            <span className="flex-1" />
            <Link href="/login" className="hover:text-white">ورود</Link>
            <Link href="/signup" className="hover:text-white">ثبت‌نام</Link>
          </div>
        </footer>
      </section>

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
