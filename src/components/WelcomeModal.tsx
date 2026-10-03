"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ToastProvider";
import { generateSessionCode } from "@/lib/utils";
import { GraduationCap } from "lucide-react";

export default function WelcomeModal({
  open,
  defaultTab = "join",
  onClose,
}: {
  open: boolean;
  defaultTab?: "join" | "create";
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"join" | "create">(defaultTab);
  const [joinCode, setJoinCode] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const { user, role, displayName } = useAuth();
  const toast = useToast();
  const router = useRouter();

  if (!open) return null;
  const canCreate = role === "teacher";

  const handleJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return toast("کد کلاس رو وارد کن", "err");
    if (code.length < 4) return toast("کد کلاس حداقل ۴ کاراکتره", "err");
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("class_sessions")
        .select("*")
        .eq("code", code)
        .maybeSingle();
      if (error || !data) {
        toast("کلاسی با این کد پیدا نشد", "err");
        return;
      }
      localStorage.setItem("lastSessionCode", data.code);
      onClose();
      router.push(`/class/${data.code}`);
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    const t = title.trim();
    if (!t || t.length < 2) return toast("نام کلاس رو وارد کن (حداقل ۲ کاراکتر)", "err");
    if (!user) return toast("اول وارد حساب کاربری‌ت شو", "err");
    setBusy(true);
    try {
      let created = null;
      for (let i = 0; i < 6; i++) {
        const code = generateSessionCode();
        const { data, error } = await supabase
          .from("class_sessions")
          .insert({ code, title: t, created_by: user.id })
          .select()
          .single();
        if (!error) {
          created = data;
          break;
        }
        if (error.code !== "23505") {
          toast("خطا: " + error.message, "err");
          setBusy(false);
          return;
        }
      }
      if (!created) {
        toast("کد یکتا پیدا نشد، دوباره تلاش کن", "err");
        return;
      }
      // Owner counts as the class's teacher automatically — no need for a class_members row.
      localStorage.setItem("lastSessionCode", created.code);
      toast(`کلاس «${t}» ساخته شد! کد: ${created.code}`, "ok");
      onClose();
      router.push(`/class/${created.code}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm anim-fade flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl anim-pop w-full max-w-md p-6">
        <div className="flex gap-2 mb-5 bg-slate-100 p-1 rounded-xl">
          {(["join", "create"] as const).map((tKey) => (
            <button
              key={tKey}
              onClick={() => setTab(tKey)}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${
                tab === tKey ? "bg-white shadow text-primary" : "text-muted"
              }`}
            >
              {tKey === "join" ? "پیوستن به کلاس" : "ساخت کلاس جدید"}
            </button>
          ))}
        </div>

        {tab === "join" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">کد کلاسی که معلمت بهت داده رو وارد کن.</p>
            <input
              value={joinCode}
              onChange={(e) =>
                setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
              }
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              placeholder="مثلاً: A1B2C3"
              className="w-full border border-line rounded-xl px-4 py-3 text-center tracking-widest font-bold outline-none focus:border-primary"
            />
            <button
              onClick={handleJoin}
              disabled={busy}
              className="w-full py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-br from-primary to-primary2 shadow disabled:opacity-50"
            >
              {busy ? "در حال بررسی…" : "ورود به کلاس"}
            </button>
          </div>
        ) : !canCreate ? (
          <div className="text-center py-6">
            <GraduationCap size={34} className="mx-auto mb-3 text-primary/40" />
            <h3 className="font-bold mb-1">این بخش مخصوص معلم‌هاست</h3>
            <p className="text-sm text-muted">
              حساب شما به‌عنوان «دانشجو» ثبت شده، پس {displayName ? `${displayName} جان، ` : ""}فقط می‌تونی به کلاس بپیوندی.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted">یه کلاس جدید بساز و کد اون رو با دانشجوهات به اشتراک بذار.</p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="نام کلاس (مثلاً: پایتون مقدماتی - ترم ۲)"
              className="w-full border border-line rounded-xl px-4 py-2.5 outline-none focus:border-primary"
            />
            <button
              onClick={handleCreate}
              disabled={busy}
              className="w-full py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-br from-primary to-primary2 shadow disabled:opacity-50"
            >
              {busy ? "در حال ساخت…" : "ساخت کلاس"}
            </button>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full text-center text-xs text-muted mt-4 hover:text-ink"
        >
          بستن
        </button>
      </div>
    </div>
  );
}
