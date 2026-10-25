/**
 * Safely turns anything a catch block might receive (Error, Supabase's
 * PostgrestError, a thrown string, or even `undefined`/`null`) into a
 * readable message — never throws itself, unlike `(e as Error).message`
 * which crashes if `e` doesn't actually have a `.message`.
 */
export function getErrorMessage(e: unknown): string {
  return friendly(rawMessage(e));
}

/** Exceptions raised by our Postgres triggers/functions (see supabase/migration_teacher_invites_and_library_lock.sql). */
const KNOWN_DB_ERRORS: Record<string, string> = {
  INVALID_INVITE_CODE: "کد معرف نامعتبره، منقضی شده یا ظرفیتش پر شده.",
  TEACHER_INVITE_REQUIRED: "برای داشتن حساب معلم کد معرف لازمه.",
  CLASS_LIMIT_REACHED: "به سقف تعداد کلاس‌های مجازت رسیدی. برای افزایشش با ادمین تماس بگیر.",
  MEETING_LIMIT_REACHED: "به سقف تعداد جلسه‌های مجاز رسیدی. برای افزایشش با ادمین تماس بگیر.",
  NOT_TEACHER: "فقط حساب معلم می‌تونه این کار رو انجام بده.",
};

function friendly(msg: string): string {
  for (const key of Object.keys(KNOWN_DB_ERRORS)) if (msg.includes(key)) return KNOWN_DB_ERRORS[key];
  return msg;
}

function rawMessage(e: unknown): string {
  if (!e) return "خطای نامشخص";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && "message" in e && typeof (e as { message?: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  try {
    return JSON.stringify(e);
  } catch {
    return "خطای نامشخص";
  }
}
