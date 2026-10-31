"use client";

import { useEffect, useState } from "react";
import { AVATAR_PALETTE, DEFAULT_AVATAR, randomAvatar } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ToastProvider";
import { Sparkles, Shuffle, User, GraduationCap, BookOpen, Building2, KeyRound } from "lucide-react";
import type { UserRole } from "@/lib/types";
import Portal from "@/components/Portal";
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
  const [inviteCode, setInviteCode] = useState("");
  const [saving, setSaving] = useState(false);
  const needsInvite = (pickedRole === "teacher" || pickedRole === "manager") && role !== pickedRole;
  // Admins and managers can't change their own role from here.
  const roleLocked = role === "admin" || role === "manager";

  useEffect(() => {
    if (open) {
      // After an email-confirmation round trip, recover what they picked at sign-up.
      setName(displayName || pendingProfileHint?.display_name || "");
      setPickedAvatar(firstTime ? DEFAULT_AVATAR : avatar || DEFAULT_AVATAR);
      setPickedRole(role || pendingProfileHint?.role || "student");
    }
  }, [open, firstTime, displayName, avatar, role, pendingProfileHint]);

  if (!open) return null;

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return toast("اسمت رو وارد کن", "err");
    if (trimmed.length > 40) return toast("حداکثر ۴۰ کاراکتر", "err");
    if (needsInvite && !inviteCode.trim()) return toast("برای این نقش، کد معرف لازمه", "err");
    setSaving(true);
    try {
      await saveProfile(trimmed, pickedAvatar, pickedRole, inviteCode);
      toast(firstTime ? `خوش آمدی ${trimmed}!` : "پروفایل ذخیره شد", "ok");
      onClose();
    } catch (e) {
      toast("خطا: " + getErrorMessage(e), "err");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Portal>
    <div
      className="fixed inset-0 z-[100] bg-stone-900/50 backdrop-blur-sm anim-fade flex items-center justify-center p-4"
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
            ? "قبل از شروع، بگو کی هستی. آواتارت رو بعداً از منوی پروفایل می‌تونی عوض کنی."
            : "اسم (یا شماره دانشجویی) و آواتارت رو اینجا می‌تونی عوض کنی."}
        </p>

        <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-stone-50 border border-line">
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

        {!roleLocked && (
          <>
            <div className="text-sm font-bold text-muted mb-2">نقش شما</div>
            <div className="grid grid-cols-3 gap-2 mb-4">
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
                  onClick={() => setPickedRole(value)}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold border transition ${
                    pickedRole === value ? "border-primary bg-stone-100 text-primary" : "border-line text-muted"
                  }`}
                >
                  <Icon size={15} /> {label}
                </button>
              ))}
            </div>
            {needsInvite && (
              <div className="relative mb-4">
                <KeyRound size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="کد معرف (از مدیر موسسه یا ادمین سایت بگیر)"
                  dir="ltr"
                  className="w-full border border-line rounded-xl pr-9 pl-3 py-2.5 outline-none focus:border-primary text-right font-mono tracking-widest"
                />
              </div>
            )}
            <p className="text-[11px] text-muted -mt-2 mb-4">
              فقط معلم‌ها می‌تونن کلاس بسازن. توی کلاسِ یه معلم دیگه، حتی اکانت معلم هم به‌صورت پیش‌فرض دانشجو حساب می‌شه مگر اینکه صاحب کلاس بهش دسترسی بده.
            </p>
          </>
        )}

        {!firstTime && (
          <>
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
              className={`text-xl rounded-lg p-1.5 hover:bg-stone-100 transition ${
                a === pickedAvatar ? "bg-stone-200 ring-2 ring-primary" : ""
              }`}
            >
              {a}
            </button>
          ))}
        </div>
          </>
        )}

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
    </Portal>
  );
}
