"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ToastProvider";
import { supabase } from "@/lib/supabase";
import { DEFAULT_AVATAR } from "@/lib/utils";
import type { UserRole } from "@/lib/types";
import { GraduationCap, BookOpen, Building2, Mail, Lock, User as UserIcon, Loader2, MailCheck, KeyRound } from "lucide-react";
import GoogleIcon from "@/components/GoogleIcon";

export default function SignupPage() {
  const { user, ready, needsProfile, signUpWithEmail, signInWithGoogle } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<string | null>(null);

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
    if (role === "teacher" || role === "manager") {
      // Check the code BEFORE creating the account so a typo doesn't leave a half-made account behind.
      const code = inviteCode.trim();
      if (!code) {
        setBusy(false);
        return toast("برای این نقش، کد معرف لازمه", "err");
      }
      const { data: info, error: checkError } = await supabase.rpc("check_invite_code", { p_code: code });
      if (checkError || !info) {
        setBusy(false);
        return toast(checkError ? "خطا: " + checkError.message : "کد معرف نامعتبره، منقضی شده یا ظرفیتش پر شده", "err");
      }
      if (info.role !== role) {
        setBusy(false);
        return toast(`این کد برای نقش «${info.role === "manager" ? "مدیر موسسه" : "معلم"}» صادر شده؛ نقش درست رو انتخاب کن`, "err");
      }
    }
    const { error, needsEmailConfirmation } = await signUpWithEmail(e, password, n, DEFAULT_AVATAR, role, inviteCode);
    setBusy(false);
    if (error) return toast("خطا: " + error, "err");
    if (needsEmailConfirmation) {
      setAwaitingConfirmation(e);
      return;
    }
    toast(`خوش آمدی ${n}!`, "ok");
    router.replace("/dashboard");
  };

  if (awaitingConfirmation) {
    return (
      <div className="min-h-screen grid place-items-center p-4">
        <div className="card w-full max-w-md p-8 text-center anim-pop">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 grid place-items-center mb-4">
            <MailCheck size={28} />
          </div>
          <h1 className="font-extrabold text-lg mb-2">ایمیلت رو چک کن</h1>
          <p className="text-sm text-muted leading-7 mb-1">
            یه لینک تایید به <b dir="ltr" className="font-mono">{awaitingConfirmation}</b> فرستادیم.
          </p>
          <p className="text-sm text-muted leading-7 mb-6">
            اینباکس (و پوشه‌ی اسپم) رو چک کن، روی لینک بزن، بعد از همین صفحه وارد شو.
          </p>
          <Link href="/login" className="btn-primary w-full !py-3 inline-flex justify-center">
            برو به صفحه‌ی ورود
          </Link>
        </div>
      </div>
    );
  }

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
          <Link href="/" className="w-12 h-12 mx-auto rounded-2xl grid place-items-center text-white text-base font-mono font-black bg-primary mb-3">
            {">"}<span className="text-accent">_</span>
          </Link>
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

        <div className="text-sm font-bold text-muted mt-4 mb-2">نقش شما</div>
        <div className="grid grid-cols-3 gap-2 mb-2">
          {(
            [
              ["student", "دانشجو", BookOpen],
              ["teacher", "معلم", GraduationCap],
              ["manager", "مدیر موسسه", Building2],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              onClick={() => setRole(value)}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold border transition ${
                role === value ? "border-primary bg-stone-100 text-primary" : "border-line text-muted"
              }`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted mb-5">
          {role === "student"
            ? "با کد کلاس که معلمت می‌ده وارد کلاس می‌شی."
            : role === "teacher"
            ? "معلم‌ها کلاس می‌سازن. حساب معلم کد معرف می‌خواد؛ اگه موسسه‌ای هستی از مدیرش بگیر، وگرنه از ادمین سایت."
            : "مدیر موسسه معلم‌ها و آمار موسسه‌ی خودش رو می‌بینه. حساب مدیر کد معرف می‌خواد که ادمین سایت می‌ده."}
        </p>
        {role !== "student" && (
          <div className="relative mb-5">
            <KeyRound size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="کد معرف (مثلا ABCD-EF23)"
              dir="ltr"
              className="w-full border border-line rounded-xl pr-9 pl-3 py-2.5 outline-none focus:border-primary text-right font-mono tracking-widest"
            />
          </div>
        )}

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
