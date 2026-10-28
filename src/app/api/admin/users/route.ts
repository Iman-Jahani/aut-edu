import { NextRequest, NextResponse } from "next/server";
import { adminDb, fail, requireActor } from "@/lib/adminServer";

export const dynamic = "force-dynamic";

const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const ROLES = ["admin", "manager", "teacher", "student"] as const;

/** Everyone with an account, for the role-management page (admin only). */
export async function GET(req: NextRequest) {
  const a = await requireActor(req, { adminOnly: true });
  if ("error" in a) return a.error;
  try {
    const db = adminDb();
    const [{ data: profiles, error }, { data: insts }] = await Promise.all([
      db.from("user_profiles").select("user_id, display_name, avatar, email, role, institution_id, updated_at").order("updated_at", { ascending: false }),
      db.from("institutions").select("id, name"),
    ]);
    if (error) throw error;
    const imap = new Map((insts || []).map((i) => [i.id, i.name as string]));
    return NextResponse.json({
      items: (profiles || []).map((p) => ({ ...p, institution_name: p.institution_id ? imap.get(p.institution_id) || null : null })),
    });
  } catch (e) {
    return fail(e);
  }
}

/**
 * Change someone's role (admin only).
 *  - admin:   just flips the role
 *  - manager: needs an institution (institution_id)
 *  - teacher: optional institution; also makes sure the teacher has a limits row
 *  - student: removes the staff grant
 * The last remaining admin can't be demoted.
 */
export async function PATCH(req: NextRequest) {
  const a = await requireActor(req, { adminOnly: true });
  if ("error" in a) return a.error;
  try {
    const b = await req.json();
    const role = b.role as (typeof ROLES)[number];
    if (!b.user_id || !ROLES.includes(role)) return bad("درخواست نامعتبره");
    const db = adminDb();

    const { data: target } = await db.from("user_profiles").select("user_id, role").eq("user_id", b.user_id).maybeSingle();
    if (!target) return bad("کاربر پیدا نشد", 404);

    if (target.role === "admin" && role !== "admin") {
      const { count } = await db.from("user_profiles").select("user_id", { count: "exact", head: true }).eq("role", "admin");
      if ((count || 0) <= 1) return bad("حداقل یک ادمین باید بمونه");
    }

    const instId = typeof b.institution_id === "string" && b.institution_id ? b.institution_id : null;
    if (role === "manager" && !instId) return bad("برای نقش مدیر، موسسه رو انتخاب کن");
    if (instId) {
      const { data: inst } = await db.from("institutions").select("id").eq("id", instId).maybeSingle();
      if (!inst) return bad("موسسه پیدا نشد");
    }

    // 1) the grant (what the database trigger checks), 2) then the profile role itself
    if (role === "teacher" || role === "manager") {
      const { error } = await db.from("role_grants").upsert({ user_id: b.user_id, role, institution_id: instId }, { onConflict: "user_id" });
      if (error) throw error;
      if (role === "teacher") await db.from("teacher_limits").upsert({ user_id: b.user_id }, { onConflict: "user_id", ignoreDuplicates: true });
    } else {
      await db.from("role_grants").delete().eq("user_id", b.user_id);
    }
    const { error: pErr } = await db.from("user_profiles").update({ role, updated_at: new Date().toISOString() }).eq("user_id", b.user_id);
    if (pErr) throw pErr;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
