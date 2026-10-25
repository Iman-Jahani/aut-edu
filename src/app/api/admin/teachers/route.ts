import { NextRequest, NextResponse } from "next/server";
import { adminDb, fail, requireAdmin, toIntOrNull } from "@/lib/adminServer";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const db = adminDb();
    const [profiles, limits, classes, meetings] = await Promise.all([
      db.from("user_profiles").select("user_id, display_name, email, avatar").eq("role", "teacher"),
      db.from("teacher_limits").select("*"),
      db.from("class_sessions").select("id, created_by"),
      db.from("class_meetings").select("class_id"),
    ]);
    for (const r of [profiles, limits, classes, meetings]) if (r.error) throw r.error;

    const lim = new Map((limits.data || []).map((l) => [l.user_id, l]));
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

/** Set a teacher's limits. Empty / null means unlimited. */
export async function PATCH(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const b = await req.json();
    if (!b.user_id) return NextResponse.json({ error: "user_id لازمه" }, { status: 400 });
    const { error } = await adminDb()
      .from("teacher_limits")
      .upsert(
        { user_id: b.user_id, max_classes: toIntOrNull(b.max_classes), max_meetings: toIntOrNull(b.max_meetings), updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
