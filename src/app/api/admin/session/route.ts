import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminServer";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return NextResponse.json({ ok: isAdminRequest(req) });
}
