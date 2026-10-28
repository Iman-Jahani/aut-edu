import { NextRequest, NextResponse } from "next/server";
import { adminDb, fail, institutionTeacherIds, requireActor, toIntOrNull } from "@/lib/adminServer";

export const dynamic = "force-dynamic";

const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

/** admin: every teacher. manager: only the teachers of their institution. */
export async function GET(req: NextRequest) {
  const a = await requireActor(req);
  if ("error" in a) return a.error;
  const { actor } = a;
  try {
    const db = adminDb();
    const scopeIds = actor.role === "manager" ? await institutionTeacherIds(db, actor.institutionId!) : null;
    const profilesQ = db.from("user_profiles").select("user_id, display_name, email, avatar, institution_id").eq("role", "teacher");
    const [profiles, limits, classes, meetings, insts] = await Promise.all([
      scopeIds ? profilesQ.in("user_id", scopeIds.length ? scopeIds : ["00000000-0000-0000-0000-000000000000"]) : profilesQ,
      db.from("teacher_limits").select("*"),
      db.from("class_sessions").select("id, created_by"),
      db.from("class_meetings").select("class_id"),
      db.from("institutions").select("id, name"),
    ]);
    for (const r of [profiles, limits, classes, meetings, insts]) if (r.error) throw r.error;

    const lim = new Map((limits.data || []).map((l) => [l.user_id, l]));
    const imap = new Map((insts.data || []).map((i) => [i.id, i.name as string]));
    const classOwner = new Map((classes.data || []).map((c) => [c.id, c.created_by]));
    const classCount = new Map<string, number>();
    (classes.data || []).forEach((c) => c.created_by && classCount.set(c.created_by, (classCount.get(c.created_by) || 0) + 1));
    const meetingCount = new Map<string, number>();
    (meetings.data || []).forEach((m) => {
      const owner = classOwner.get(m.class_id);
      if (owner) meetingCount.set(owner, (meetingCount.get(owner) || 0) + 1);
    });

    const items = (profiles.data || []).map((p) => ({
      user_id: p.user_id,
      display_name: p.display_name,
      email: p.email,
      avatar: p.avatar,
      institution_id: p.institution_id,
      institution_name: p.institution_id ? imap.get(p.institution_id) || null : null,
      max_classes: lim.get(p.user_id)?.max_classes ?? null,
      max_meetings: lim.get(p.user_id)?.max_meetings ?? null,
      classes: classCount.get(p.user_id) || 0,
      meetings: meetingCount.get(p.user_id) || 0,
    }));
    return NextResponse.json({ items });
  } catch (e) {
    return fail(e);
  }
}

/**
 * Set a teacher's limits (empty / null = unlimited). admin: any teacher. manager: only their own.
 * Only an admin can also move a teacher to another institution (institution_id, null = independent).
 */
export async function PATCH(req: NextRequest) {
  const a = await requireActor(req);
  if ("error" in a) return a.error;
  const { actor } = a;
  try {
    const b = await req.json();
    if (!b.user_id) return bad("user_id لازمه");
    const db = adminDb();

    if (actor.role === "manager") {
      const mine = await institutionTeacherIds(db, actor.institutionId!);
      if (!mine.includes(b.user_id)) return bad("این معلم عضو موسسه‌ی تو نیست", 403);
    }

    const { error } = await db
      .from("teacher_limits")
      .upsert({ user_id: b.user_id, max_classes: toIntOrNull(b.max_classes), max_meetings: toIntOrNull(b.max_meetings), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw error;

    if (actor.role === "admin" && "institution_id" in b) {
      const instId = typeof b.institution_id === "string" && b.institution_id ? b.institution_id : null;
      const { error: gErr } = await db.from("role_grants").update({ institution_id: instId }).eq("user_id", b.user_id).eq("role", "teacher");
      if (gErr) throw gErr;
      // touch the profile so the database copies the new institution onto it
      await db.from("user_profiles").update({ updated_at: new Date().toISOString() }).eq("user_id", b.user_id);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
