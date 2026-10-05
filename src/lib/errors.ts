/**
 * Safely turns anything a catch block might receive (Error, Supabase's
 * PostgrestError, a thrown string, or even `undefined`/`null`) into a
 * readable message — never throws itself, unlike `(e as Error).message`
 * which crashes if `e` doesn't actually have a `.message`.
 */
export function getErrorMessage(e: unknown): string {
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
