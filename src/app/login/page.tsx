"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ToastProvider";
import { Mail, Lock, Loader2 } from "lucide-react";
import GoogleIcon from "@/components/GoogleIcon";

export default function LoginPage() {
  const { user, ready, needsProfile, signInWithEmail, signInWithGoogle } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    if (ready && user && !needsProfile) router.replace("/dashboard");
  }, [ready, user, needsProfile, router]);

  const submit = async () => {
    if (!email.trim() || !password) return toast("ایمیل و رمز عبور رو وارد کن", "err");
    setBusy(true);
    const { error } = await signInWithEmail(email.trim(), password);
    setBusy(false);
    if (error) return toast("ورود ناموفق: ایمیل یا رمز اشتباهه", "err");
    router.replace("/dashboard");
  };

  const withGoogle = async () => {
    setGoogleBusy(true);
    const { error } = await signInWithGoogle();
    if (error) {
      setGoogleBusy(false);
      toast("خطا: " + error, "err");
    }
  };

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <div className="card w-full max-w-sm p-7 anim-pop">
        <div className="text-center mb-6">
          <Link href="/" className="w-12 h-12 mx-auto rounded-2xl grid place-items-center text-white text-xl shadow-glow mb-3" style={{ background: "var(--grad)" }}>
            🐍
          </Link>
          <h1 className="font-extrabold text-xl">ورود</h1>
          <p className="text-sm text-muted mt-1">به دفترچه‌ی کلاس پایتون خوش اومدی</p>
        </div>

        <button
          onClick={withGoogle}
          disabled={googleBusy}
          className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-line font-bold text-sm mb-4 hover:shadow-soft transition disabled:opacity-50"
        >
          {googleBusy ? <Loader2 size={16} className="animate-spin" /> : <GoogleIcon size={16} />}
          ورود با گوگل
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="h-px bg-line flex-1" />
          <span className="text-xs text-muted">یا با ایمیل</span>
          <div className="h-px bg-line flex-1" />
        </div>

        <div className="space-y-3 mb-5">
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
              placeholder="رمز عبور"
              dir="ltr"
              className="w-full border border-line rounded-xl pr-9 pl-3 py-2.5 outline-none focus:border-primary text-right"
            />
          </div>
        </div>

        <button onClick={submit} disabled={busy} className="btn-primary w-full !py-3">
          {busy ? <Loader2 size={16} className="animate-spin" /> : null} ورود
        </button>

        <p className="text-center text-sm text-muted mt-5">
          حساب نداری؟{" "}
          <Link href="/signup" className="text-primary font-bold">
            ثبت‌نام کن
          </Link>
        </p>
      </div>
    </div>
  );
}
