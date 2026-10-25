import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const ADMIN_COOKIE = "admin_session";
const SESSION_MS = 12 * 60 * 60 * 1000;

/** Server-only password. NEXT_PUBLIC_ADMIN_PASSWORD is only a legacy fallback (it is visible to everyone). */
export function adminPassword(): string {
  return process.env.ADMIN_PASSWORD || process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "";
}

function secret(): string {
  return process.env.ADMIN_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || adminPassword();
}

function hmac(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function makeSessionToken(): { token: string; maxAgeSec: number } {
  const exp = String(Date.now() + SESSION_MS);
  return { token: `${exp}.${hmac(exp)}`, maxAgeSec: SESSION_MS / 1000 };
}

export function isAdminRequest(req: NextRequest): boolean {
  if (!adminPassword()) return false;
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, hmac(exp));
}

/** Returns an error response if the caller isn't the admin, otherwise null. */
export function requireAdmin(req: NextRequest): NextResponse | null {
  return isAdminRequest(req) ? null : NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
}

/** Supabase client with the service-role key — bypasses RLS. Never import this from client code. */
export function adminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY تنظیم نشده (فایل .env.local)");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function toIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

export function fail(e: unknown, status = 500) {
  const message = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "خطا";
  return NextResponse.json({ error: message }, { status });
}
