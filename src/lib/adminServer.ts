import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/** Supabase client with the service-role key — bypasses RLS. Never import this from client code. */
export function adminDb(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY تنظیم نشده (فایل .env.local)");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type StaffRole = "admin" | "manager";

/** The signed-in person making an admin API call. */
export interface Actor {
  userId: string;
  email: string | null;
  role: StaffRole;
  /** Managers only: the institution they run. */
  institutionId: string | null;
  institutionName: string | null;
}

function bootstrapAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Identifies the caller from their Supabase access token (Authorization: Bearer …) and loads their
 * role from the database. Returns null if they aren't signed in or aren't staff (admin / manager).
 * `ADMIN_EMAILS` lets the site owner become the first admin without touching SQL.
 */
export async function getActor(req: NextRequest): Promise<Actor | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const db = adminDb();
  const { data: auth, error } = await db.auth.getUser(token);
  const u = auth?.user;
  if (error || !u) return null;

  const { data: profile } = await db.from("user_profiles").select("user_id, role, institution_id").eq("user_id", u.id).maybeSingle();
  let role: string | undefined = profile?.role;

  const email = u.email?.toLowerCase() || null;
  if (email && u.email_confirmed_at && bootstrapAdminEmails().includes(email)) {
    if (profile && role !== "admin") await db.from("user_profiles").update({ role: "admin" }).eq("user_id", u.id);
    role = "admin";
  }

  if (role === "admin") return { userId: u.id, email: u.email ?? null, role: "admin", institutionId: null, institutionName: null };
  if (role === "manager" && profile?.institution_id) {
    const { data: inst } = await db.from("institutions").select("name").eq("id", profile.institution_id).maybeSingle();
    return { userId: u.id, email: u.email ?? null, role: "manager", institutionId: profile.institution_id, institutionName: inst?.name ?? null };
  }
  return null;
}

/** Use at the top of every admin route: `const a = await requireActor(req); if ("error" in a) return a.error;` */
export async function requireActor(req: NextRequest, opts: { adminOnly?: boolean } = {}): Promise<{ actor: Actor } | { error: NextResponse }> {
  try {
    const actor = await getActor(req);
    if (!actor) return { error: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
    if (opts.adminOnly && actor.role !== "admin") return { error: NextResponse.json({ error: "ADMIN_ONLY" }, { status: 403 }) };
    return { actor };
  } catch (e) {
    return { error: fail(e) };
  }
}

/** Ids of the teachers that belong to an institution. */
export async function institutionTeacherIds(db: SupabaseClient, institutionId: string): Promise<string[]> {
  const { data } = await db.from("role_grants").select("user_id").eq("institution_id", institutionId).eq("role", "teacher");
  return (data || []).map((r) => r.user_id as string);
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
