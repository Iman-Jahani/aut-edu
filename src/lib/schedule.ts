import type { Exercise } from "@/lib/types";

export type WindowState = "none" | "upcoming" | "open" | "closed";

export function getWindowState(ex: Pick<Exercise, "opens_at" | "due_at">, now = Date.now()): WindowState {
  const opens = ex.opens_at ? new Date(ex.opens_at).getTime() : null;
  const due = ex.due_at ? new Date(ex.due_at).getTime() : null;
  if (opens === null && due === null) return "none";
  if (opens !== null && now < opens) return "upcoming";
  if (due !== null && now > due) return "closed";
  return "open";
}

/** "YYYY-MM-DDTHH:mm" in the browser's local time, as <input type="datetime-local"> expects. */
export function toLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Persian (Jalali) date + time, e.g. «۱۴۰۴/۰۷/۲۰، ۱۴:۳۰». */
export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** "۲ روز و ۳ ساعت", "۴۵ دقیقه", … for a positive duration in ms. */
export function formatRemaining(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  const f = (n: number) => n.toLocaleString("fa-IR");
  if (days > 0) return hours ? `${f(days)} روز و ${f(hours)} ساعت` : `${f(days)} روز`;
  if (hours > 0) return m ? `${f(hours)} ساعت و ${f(m)} دقیقه` : `${f(hours)} ساعت`;
  return `${f(Math.max(1, m))} دقیقه`;
}

/** How urgent a deadline is, for colouring. */
export function urgency(msLeft: number): "soon" | "today" | "later" {
  if (msLeft <= 3 * 3600_000) return "soon";
  if (msLeft <= 24 * 3600_000) return "today";
  return "later";
}

export function friendlyWindowError(message: string): string | null {
  if (message.includes("EXERCISE_CLOSED")) return "مهلت این تمرین تموم شده و دیگه پاسخ ثبت نمی‌شه.";
  if (message.includes("EXERCISE_NOT_OPEN")) return "این تمرین هنوز باز نشده.";
  return null;
}
