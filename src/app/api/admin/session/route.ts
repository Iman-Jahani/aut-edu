import { NextRequest, NextResponse } from "next/server";
import { getActor } from "@/lib/adminServer";

export const dynamic = "force-dynamic";

/** Who am I, as far as the admin panel is concerned? 401 = not signed in, 403 = signed in but not staff. */
export async function GET(req: NextRequest) {
  try {
    const hasToken = !!req.headers.get("authorization");
    const actor = await getActor(req);
    if (!actor) return NextResponse.json({ ok: false }, { status: hasToken ? 403 : 401 });
    return NextResponse.json({ ok: true, ...actor });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "خطا" }, { status: 500 });
  }
}
