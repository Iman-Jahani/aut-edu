import { NextRequest, NextResponse } from "next/server";
import { adminDb, fail, requireActor } from "@/lib/adminServer";

export const dynamic = "force-dynamic";

/** Edit a record of the shared library in place (admin only). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireActor(req, { adminOnly: true });
  if ("error" in a) return a.error;
  try {
    const b = await req.json();
    const patch: Record<string, unknown> = {};
    if (typeof b.title === "string") {
      if (!b.title.trim()) return NextResponse.json({ error: "عنوان خالیه" }, { status: 400 });
      patch.title = b.title.trim();
    }
    if (typeof b.description === "string" || b.description === null) patch.description = b.description;
    if (typeof b.hint === "string" || b.hint === null) patch.hint = b.hint;
    if (Array.isArray(b.test_cases)) {
      patch.test_cases = b.test_cases.map((t: { input?: unknown; expected?: unknown }) => ({
        input: typeof t.input === "string" ? t.input : "",
        expected: typeof t.expected === "string" ? t.expected : "",
      }));
    }
    if ("difficulty" in b) {
      const d = b.difficulty === null ? null : Number(b.difficulty);
      if (d !== null && ![1, 2, 3, 4].includes(d)) return NextResponse.json({ error: "درجه‌ی سختی نامعتبره" }, { status: 400 });
      patch.difficulty = d;
    }
    if ("topic" in b) patch.topic = typeof b.topic === "string" && b.topic.trim() ? b.topic.trim() : null;
    if (!Object.keys(patch).length) return NextResponse.json({ error: "چیزی برای ذخیره نیست" }, { status: 400 });

    const { data, error } = await adminDb().from("shared_exercises").update(patch).eq("id", params.id).select().single();
    if (error) throw error;
    return NextResponse.json({ item: data });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const a = await requireActor(req, { adminOnly: true });
  if ("error" in a) return a.error;
  try {
    const { error } = await adminDb().from("shared_exercises").delete().eq("id", params.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
