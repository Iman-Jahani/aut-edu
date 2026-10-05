"use client";

import { useEffect, useState } from "react";
import { AVATAR_PALETTE, randomAvatar } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ToastProvider";
import { Sparkles, Shuffle, User, GraduationCap, BookOpen } from "lucide-react";
import type { UserRole } from "@/lib/types";
import { getErrorMessage } from "@/lib/errors";

export default function ProfileModal({
  open,
  firstTime = false,
  onClose,
}: {
  open: boolean;
  firstTime?: boolean;
  onClose: () => void;
}) {
  const { displayName, avatar, role, pendingProfileHint, saveProfile } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(displayName);
  const [pickedAvatar, setPickedAvatar] = useState(avatar);
  const [pickedRole, setPickedRole] = useState<UserRole>(role || "student");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      // After an email-confirmation round trip, recover what they picked at sign-up.
      setName(displayName || pendingProfileHint?.display_name || "");
      setPickedAvatar(avatar || pendingProfileHint?.avatar || "🙂");
      setPickedRole(role || pendingProfileHint?.role || "student");
    }
  }, [open, displayName, avatar, role, pendingProfileHint]);

  if (!open) return null;

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return toast("اسمت رو وارد کن", "err");
    if (trimmed.length > 40) return toast("حداکثر ۴۰ کاراکتر", "err");
    setSaving(true);
    try {
      await saveProfile(trimmed, pickedAvatar, pickedRole);
      toast(firstTime ? `خوش آمدی ${trimmed}!` : "پروفایل ذخیره شد", "ok");
      onClose();
    } catch (e) {
      toast("خطا: " + getErrorMessage(e), "err");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm anim-fade flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !firstTime) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl anim-pop w-full max-w-md max-h-[85vh] overflow-y-auto p-6">
        <h2 className="text-lg font-extrabold mb-1">
          <span className="inline-flex items-center gap-1.5">
            {firstTime ? <Sparkles size={18} /> : <User size={18} />}
            {firstTime ? "خوش آمدی!" : "پروفایل شما"}
          </span>
        </h2>
        <p className="text-sm text-muted mb-4">
          {firstTime
            ? "قبل از شروع، بگو کی هستی و یه آواتار هم برات انتخاب کن."
            : "اسم (یا شماره دانشجویی) و آواتارت رو اینجا می‌تونی عوض کنی."}
        </p>

        <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-slate-50 border border-line">
          <div className="w-14 h-14 rounded-full bg-white grid place-items-center text-3xl border">
            {pickedAvatar}
          </div>
          <div className="font-bold text-ink">{name.trim() || "اسمت رو بنویس..."}</div>
        </div>

        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="اسم یا شماره دانشجویی"
          className="w-full border border-line rounded-xl px-4 py-2.5 mb-4 outline-none focus:border-primary transition"
        />

        <div className="text-sm font-bold text-muted mb-2">نقش شما</div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            type="button"
            onClick={() => setPickedRole("student")}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold border transition ${
              pickedRole === "student" ? "border-primary bg-indigo-50 text-primary" : "border-line text-muted"
            }`}
          >
            <BookOpen size={15} /> دانشجو
          </button>
          <button
            type="button"
            onClick={() => setPickedRole("teacher")}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold border transition ${
              pickedRole === "teacher" ? "border-primary bg-indigo-50 text-primary" : "border-line text-muted"
            }`}
          >
            <GraduationCap size={15} /> معلم
          </button>
        </div>
        <p className="text-[11px] text-muted -mt-2 mb-4">
          فقط معلم‌ها می‌تونن کلاس بسازن. توی کلاسِ یه معلم دیگه، حتی اکانت معلم هم به‌صورت پیش‌فرض دانشجو حساب می‌شه مگر اینکه صاحب کلاس بهش دسترسی بده.
        </p>

        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-muted">انتخاب آواتار</span>
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-primary font-bold"
            onClick={() => setPickedAvatar(randomAvatar(pickedAvatar))}
          >
            <Shuffle size={12} /> تصادفی
          </button>
        </div>
        <div className="grid grid-cols-8 gap-1.5 max-h-40 overflow-y-auto mb-5 p-2 border border-line rounded-xl">
          {AVATAR_PALETTE.map((a) => (
            <button
              type="button"
              key={a}
              onClick={() => setPickedAvatar(a)}
              className={`text-xl rounded-lg p-1.5 hover:bg-slate-100 transition ${
                a === pickedAvatar ? "bg-indigo-100 ring-2 ring-primary" : ""
              }`}
            >
              {a}
            </button>
          ))}
        </div>

        <div className="flex gap-2 justify-end">
          {!firstTime && (
            <button
              onClick={onClose}
              className="btn-ghost px-4 py-2 rounded-md border border-line text-sm font-bold"
            >
              لغو
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-md text-sm font-bold text-white bg-gradient-to-br from-primary to-primary2 shadow disabled:opacity-50"
          >
            {saving ? "در حال ذخیره…" : "ذخیره"}
          </button>
        </div>
      </div>
    </div>
  );
}
