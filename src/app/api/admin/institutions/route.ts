import { NextRequest, NextResponse } from "next/server";
import { adminDb, fail, requireActor, toIntOrNull } from "@/lib/adminServer";

export const dynamic = "force-dynamic";

const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function POST(req: NextRequest) {
  const a = await requireActor(req, { adminOnly: true });
  if ("error" in a) return a.error;
  try {
    const b = await req.json();
    const name = typeof b.name === "string" ? b.name.trim() : "";
    if (!name) return bad("اسم موسسه رو بنویس");
    const { data, error } = await adminDb().from("institutions").insert({ name, max_teachers: toIntOrNull(b.max_teachers) }).select().single();
    if (error) throw error;
    return NextResponse.json({ item: data });
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: NextRequest) {
  const a = await requireActor(req, { adminOnly: true });
  if ("error" in a) return a.error;
  try {
    const b = await req.json();
    if (!b.id) return bad("id لازمه");
    const patch: Record<string, unknown> = {};
    if (typeof b.name === "string") {
      if (!b.name.trim()) return bad("اسم موسسه خالیه");
      patch.name = b.name.trim();
    }
    if ("max_teachers" in b) patch.max_teachers = toIntOrNull(b.max_teachers);
    const { error } = await adminDb().from("institutions").update(patch).eq("id", b.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: NextRequest) {
  const a = await requireActor(req, { adminOnly: true });
  if ("error" in a) return a.error;
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return bad("id لازمه");
    const db = adminDb();
    const { count } = await db.from("role_grants").select("user_id", { count: "exact", head: true }).eq("institution_id", id);
    if ((count || 0) > 0) return bad("این موسسه هنوز مدیر یا معلم داره. اول اون‌ها رو به جای دیگه منتقل کن یا نقششون رو عوض کن.");
    const { error } = await db.from("institutions").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
