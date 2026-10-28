import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminDb, fail, requireActor, toIntOrNull } from "@/lib/adminServer";

export const dynamic = "force-dynamic";

// No 0/O/1/I/L so codes are easy to read out loud.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function makeCode(): string {
  const pick = () => Array.from({ length: 4 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join("");
  return `${pick()}-${pick()}`;
}

const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

/** admin: every code. manager: only the teacher codes of their own institution. */
export async function GET(req: NextRequest) {
  const a = await requireActor(req);
  if ("error" in a) return a.error;
  const { actor } = a;
  try {
    const db = adminDb();
    let q = db.from("invite_codes").select("*").order("created_at", { ascending: false });
    if (actor.role === "manager") q = q.eq("institution_id", actor.institutionId!).eq("role", "teacher");
    const [{ data: codes, error }, { data: uses }, { data: insts }] = await Promise.all([
      q,
      db.from("invite_code_uses").select("code_id, user_id, used_at"),
      db.from("institutions").select("id, name"),
    ]);
    if (error) throw error;
    const codeIds = new Set((codes || []).map((c) => c.id));
    const myUses = (uses || []).filter((u) => codeIds.has(u.code_id));
    const userIds = Array.from(new Set(myUses.map((u) => u.user_id)));
    const { data: profiles } = userIds.length
      ? await db.from("user_profiles").select("user_id, display_name, email").in("user_id", userIds)
      : { data: [] as { user_id: string; display_name: string; email: string | null }[] };
    const pmap = new Map((profiles || []).map((p) => [p.user_id, p]));
    const imap = new Map((insts || []).map((i) => [i.id, i.name as string]));
    const items = (codes || []).map((c) => ({
      ...c,
      institution_name: c.institution_id ? imap.get(c.institution_id) || null : null,
      used_by: myUses
        .filter((u) => u.code_id === c.id)
        .map((u) => ({ user_id: u.user_id, name: pmap.get(u.user_id)?.display_name || "—", email: pmap.get(u.user_id)?.email || null, used_at: u.used_at })),
    }));
    return NextResponse.json({ items });
  } catch (e) {
    return fail(e);
  }
}

/**
 * admin: any role. Teacher codes may belong to an institution or not (independent teachers).
 *        Manager codes either attach to an existing institution or create a new one (new_institution_name).
 * manager: teacher codes for their own institution only.
 */
export async function POST(req: NextRequest) {
  const a = await requireActor(req);
  if ("error" in a) return a.error;
  const { actor } = a;
  try {
    const b = await req.json().catch(() => ({}));
    const role: "teacher" | "manager" = actor.role === "manager" ? "teacher" : b.role === "manager" ? "manager" : "teacher";
    let institutionId: string | null = actor.role === "manager" ? actor.institutionId : typeof b.institution_id === "string" && b.institution_id ? b.institution_id : null;
    const newName = actor.role === "admin" && role === "manager" && !institutionId && typeof b.new_institution_name === "string" ? b.new_institution_name.trim() : "";

    if (role === "manager" && !institutionId && !newName) return bad("برای کد مدیر، یا یه موسسه انتخاب کن یا اسم موسسه‌ی جدید رو بنویس");
    if (institutionId) {
      const { data: inst } = await adminDb().from("institutions").select("id").eq("id", institutionId).maybeSingle();
      if (!inst) return bad("موسسه پیدا نشد");
    }
    if (role === "manager") institutionId = institutionId || null;

    const count = Math.min(Math.max(toIntOrNull(b.count) ?? 1, 1), 20);
    // a manager code creates one institution, so it can't be a many-use code unless it points at an existing one
    const maxUses = role === "manager" && newName ? 1 : Math.max(toIntOrNull(b.max_uses) ?? 1, 1);
    const days = toIntOrNull(b.expires_in_days);
    const rows = Array.from({ length: role === "manager" && newName ? 1 : count }, () => ({
      code: makeCode(),
      role,
      institution_id: institutionId,
      new_institution_name: newName || null,
      note: typeof b.note === "string" && b.note.trim() ? b.note.trim() : null,
      max_uses: maxUses,
      max_classes: role === "teacher" ? toIntOrNull(b.max_classes) : null,
      max_meetings: role === "teacher" ? toIntOrNull(b.max_meetings) : null,
      expires_at: days ? new Date(Date.now() + days * 86_400_000).toISOString() : null,
      created_by: actor.userId,
    }));
    const { data, error } = await adminDb().from("invite_codes").insert(rows).select();
    if (error) throw error;
    return NextResponse.json({ items: data });
  } catch (e) {
    return fail(e);
  }
}

/** A manager may only touch codes that belong to their institution. */
async function canTouch(actor: { role: string; institutionId: string | null }, id: string): Promise<boolean> {
  if (actor.role === "admin") return true;
  const { data } = await adminDb().from("invite_codes").select("institution_id, role").eq("id", id).maybeSingle();
  return !!data && data.institution_id === actor.institutionId && data.role === "teacher";
}

export async function PATCH(req: NextRequest) {
  const a = await requireActor(req);
  if ("error" in a) return a.error;
  try {
    const b = await req.json();
    if (!(await canTouch(a.actor, b.id))) return bad("دسترسی نداری", 403);
    const { error } = await adminDb().from("invite_codes").update({ disabled: !!b.disabled }).eq("id", b.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: NextRequest) {
  const a = await requireActor(req);
  if ("error" in a) return a.error;
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return bad("id لازمه");
    if (!(await canTouch(a.actor, id))) return bad("دسترسی نداری", 403);
    // People who already used this code keep their account.
    const { error } = await adminDb().from("invite_codes").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
