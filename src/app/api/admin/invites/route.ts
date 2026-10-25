import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminDb, fail, requireAdmin, toIntOrNull } from "@/lib/adminServer";

export const dynamic = "force-dynamic";

// No 0/O/1/I/L so codes are easy to read out loud.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function makeCode(): string {
  const pick = () => Array.from({ length: 4 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join("");
  return `${pick()}-${pick()}`;
}

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const db = adminDb();
    const [{ data: codes, error }, { data: uses }] = await Promise.all([
      db.from("invite_codes").select("*").order("created_at", { ascending: false }),
      db.from("invite_code_uses").select("code_id, user_id, used_at"),
    ]);
    if (error) throw error;
    const ids = Array.from(new Set((uses || []).map((u) => u.user_id)));
    const { data: profiles } = ids.length
      ? await db.from("user_profiles").select("user_id, display_name, email").in("user_id", ids)
      : { data: [] as { user_id: string; display_name: string; email: string | null }[] };
    const pmap = new Map((profiles || []).map((p) => [p.user_id, p]));
    const items = (codes || []).map((c) => ({
      ...c,
      used_by: (uses || [])
        .filter((u) => u.code_id === c.id)
        .map((u) => ({ user_id: u.user_id, name: pmap.get(u.user_id)?.display_name || "—", email: pmap.get(u.user_id)?.email || null, used_at: u.used_at })),
    }));
    return NextResponse.json({ items });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const b = await req.json().catch(() => ({}));
    const count = Math.min(Math.max(toIntOrNull(b.count) ?? 1, 1), 20);
    const maxUses = Math.max(toIntOrNull(b.max_uses) ?? 1, 1);
    const days = toIntOrNull(b.expires_in_days);
    const rows = Array.from({ length: count }, () => ({
      code: makeCode(),
      note: typeof b.note === "string" && b.note.trim() ? b.note.trim() : null,
      max_uses: maxUses,
      max_classes: toIntOrNull(b.max_classes),
      max_meetings: toIntOrNull(b.max_meetings),
      expires_at: days ? new Date(Date.now() + days * 86_400_000).toISOString() : null,
    }));
    const { data, error } = await adminDb().from("invite_codes").insert(rows).select();
    if (error) throw error;
    return NextResponse.json({ items: data });
  } catch (e) {
    return fail(e);
  }
}

/** Enable / disable a code. */
export async function PATCH(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const b = await req.json();
    const { error } = await adminDb().from("invite_codes").update({ disabled: !!b.disabled }).eq("id", b.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id لازمه" }, { status: 400 });
    // Teachers who already used this code keep their account (invite_code_id just becomes null).
    const { error } = await adminDb().from("invite_codes").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
