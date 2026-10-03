"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ToastProvider";
import { AVATAR_PALETTE, randomAvatar } from "@/lib/utils";
import type { UserRole } from "@/lib/types";
import { GraduationCap, BookOpen, Shuffle, Mail, Lock, User as UserIcon, Loader2 } from "lucide-react";
import GoogleIcon from "@/components/GoogleIcon";

export default function SignupPage() {
  const { user, ready, needsProfile, signUpWithEmail, signInWithGoogle } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [avatar, setAvatar] = useState(() => AVATAR_PALETTE[Math.floor(Math.random() * AVATAR_PALETTE.length)]);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    if (ready && user && !needsProfile) router.replace("/dashboard");
  }, [ready, user, needsProfile, router]);

  const submit = async () => {
    const n = name.trim();
    const e = email.trim();
    if (!n) return toast("اسمت رو وارد کن", "err");
    if (!e) return toast("ایمیل رو وارد کن", "err");
    if (password.length < 6) return toast("رمز عبور حداقل ۶ کاراکتر", "err");
    setBusy(true);
    const { error } = await signUpWithEmail(e, password, n, avatar, role);
    setBusy(false);
    if (error) return toast("خطا: " + error, "err");
    toast(`خوش آمدی ${n}!`, "ok");
    router.replace("/dashboard");
  };

  const withGoogle = async () => {
    setGoogleBusy(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setGoogleBusy(false);
      toast("خطا: " + error, "err");
    }
    // on success the browser redirects away, so no need to reset busy state
  };

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <div className="card w-full max-w-md p-7 anim-pop">
        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto rounded-2xl grid place-items-center text-white text-xl shadow-glow mb-3" style={{ background: "var(--grad)" }}>
            🐍
          </div>
          <h1 className="font-extrabold text-xl">ساخت حساب کاربری</h1>
          <p className="text-sm text-muted mt-1">چه معلمی چه دانشجو، اول یه حساب بساز</p>
        </div>

        <button
          onClick={withGoogle}
          disabled={googleBusy}
          className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-line font-bold text-sm mb-4 hover:shadow-soft transition disabled:opacity-50"
        >
          {googleBusy ? <Loader2 size={16} className="animate-spin" /> : <GoogleIcon size={16} />}
          ثبت‌نام با گوگل
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="h-px bg-line flex-1" />
          <span className="text-xs text-muted">یا با ایمیل</span>
          <div className="h-px bg-line flex-1" />
        </div>

        <div className="space-y-3 mb-4">
          <div className="relative">
            <UserIcon size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم کامل"
              className="w-full border border-line rounded-xl pr-9 pl-3 py-2.5 outline-none focus:border-primary"
            />
          </div>
          <div className="relative">
            <Mail size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ایمیل"
              dir="ltr"
              className="w-full border border-line rounded-xl pr-9 pl-3 py-2.5 outline-none focus:border-primary text-right"
            />
          </div>
          <div className="relative">
            <Lock size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="رمز عبور (حداقل ۶ کاراکتر)"
              dir="ltr"
              className="w-full border border-line rounded-xl pr-9 pl-3 py-2.5 outline-none focus:border-primary text-right"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-full bg-slate-50 border border-line grid place-items-center text-xl shrink-0">{avatar}</div>
          <button
            type="button"
            onClick={() => setAvatar(randomAvatar(avatar))}
            className="flex items-center gap-1 text-xs text-primary font-bold"
          >
            <Shuffle size={12} /> آواتار تصادفی
          </button>
          <div className="flex-1 flex flex-wrap gap-1 justify-end max-w-[60%]">
            {AVATAR_PALETTE.slice(0, 6).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAvatar(a)}
                className={`text-base rounded-lg p-1 hover:bg-slate-100 ${a === avatar ? "bg-indigo-100 ring-2 ring-primary" : ""}`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <div className="text-sm font-bold text-muted mt-4 mb-2">نقش شما</div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <button
            type="button"
            onClick={() => setRole("student")}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold border transition ${
              role === "student" ? "border-primary bg-indigo-50 text-primary" : "border-line text-muted"
            }`}
          >
            <BookOpen size={15} /> دانشجو
          </button>
          <button
            type="button"
            onClick={() => setRole("teacher")}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold border transition ${
              role === "teacher" ? "border-primary bg-indigo-50 text-primary" : "border-line text-muted"
            }`}
          >
            <GraduationCap size={15} /> معلم
          </button>
        </div>
        <p className="text-[11px] text-muted mb-5">
          فقط معلم‌ها می‌تونن کلاس بسازن. توی کلاسِ یه معلم دیگه، همه (حتی اکانت معلم) به‌صورت پیش‌فرض دانشجو حساب می‌شن مگر اینکه صاحب کلاس دسترسی بده.
        </p>

        <button onClick={submit} disabled={busy} className="btn-primary w-full !py-3">
          {busy ? <Loader2 size={16} className="animate-spin" /> : null} ثبت‌نام
        </button>

        <p className="text-center text-sm text-muted mt-5">
          قبلاً حساب ساختی؟{" "}
          <Link href="/login" className="text-primary font-bold">
            وارد شو
          </Link>
        </p>
      </div>
    </div>
  );
}
