import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, adminPassword, makeSessionToken, safeEqual } from "@/lib/adminServer";

export const dynamic = "force-dynamic";

// Tiny in-memory brute-force guard (per server instance): 8 wrong tries / 10 min / IP.
const attempts = new Map<string, { n: number; reset: number }>();

export async function POST(req: NextRequest) {
  const expected = adminPassword();
  if (!expected) {
    return NextResponse.json({ error: "رمز ادمین تنظیم نشده. ADMIN_PASSWORD رو توی .env.local بذار." }, { status: 500 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const rec = attempts.get(ip);
  if (rec && rec.reset > now && rec.n >= 8) {
    return NextResponse.json({ error: "تعداد تلاش‌ها زیاد بود، چند دقیقه بعد دوباره امتحان کن" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";
  if (!password || !safeEqual(password, expected)) {
    attempts.set(ip, rec && rec.reset > now ? { n: rec.n + 1, reset: rec.reset } : { n: 1, reset: now + 10 * 60_000 });
    return NextResponse.json({ error: "رمز اشتباهه" }, { status: 401 });
  }
  attempts.delete(ip);

  const { token, maxAgeSec } = makeSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSec,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
