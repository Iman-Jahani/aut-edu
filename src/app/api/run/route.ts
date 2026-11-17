import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildFiles, type ServerMode } from "@/lib/serverRunCore";
import { BACKEND, runOnExecutor } from "@/lib/executor";

export const runtime = "nodejs";
// Creating a sandbox takes a few seconds; the default function limit can be shorter than that.
export const maxDuration = 60;

/**
 * Optional server-side execution, used ONLY when a student's browser can't load the
 * in-browser Python engine. Student code is never run inside this Next.js process.
 * Pick ONE executor (nothing configured → 503 and the app shows the normal message):
 *
 *  A) Vercel Sandbox — no extra server; isolated Firecracker microVMs made for untrusted code.
 *       CODE_RUNNER=vercel-sandbox
 *     On Vercel, authentication is automatic. Elsewhere (or locally) also set
 *     VERCEL_TOKEN, VERCEL_TEAM_ID, VERCEL_PROJECT_ID.
 *
 *  B) A Piston server you host yourself:
 *       CODE_RUNNER_URL=https://your-piston-host/api/v2
 *       CODE_RUNNER_KEY=...              (optional, sent as the Authorization header)
 *       CODE_RUNNER_TIMEOUT_MS=3000      (optional, must not exceed the executor's own limit)
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

const MAX_CODE = 20_000;
const MAX_STDIN = 20_000;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;
const hits = new Map<string, number[]>(); // per-user, per server instance

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) || []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(userId, recent);
  return recent.length > RATE_MAX;
}

export async function POST(req: NextRequest) {
  if (!BACKEND) {
    return NextResponse.json({ error: "اجرای سمت سرور فعال نیست." }, { status: 503 });
  }

  // Only signed-in users may use the executor (it costs CPU and is an abuse target).
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "اول وارد حساب کاربریت شو." }, { status: 401 });
  const { data: auth, error: authError } = await createClient(SUPABASE_URL, SUPABASE_ANON).auth.getUser(token);
  if (authError || !auth.user) return NextResponse.json({ error: "نشست شما معتبر نیست؛ دوباره وارد شو." }, { status: 401 });
  if (rateLimited(auth.user.id)) return NextResponse.json({ error: "درخواست‌های اجرا زیاده؛ چند ثانیه صبر کن." }, { status: 429 });

  let body: { code?: unknown; stdin?: unknown; mode?: unknown; seed?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر" }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code : "";
  const stdin = typeof body.stdin === "string" ? body.stdin : "";
  const mode: ServerMode = body.mode === "test" ? "test" : "run";
  const seed = typeof body.seed === "number" ? body.seed : 1;
  if (!code.trim()) return NextResponse.json({ error: "کدی برای اجرا نیست" }, { status: 400 });
  if (code.length > MAX_CODE || stdin.length > MAX_STDIN) return NextResponse.json({ error: "کد یا ورودی خیلی بزرگه" }, { status: 413 });

  try {
    const files = buildFiles(code, mode, seed);
    const raw = await runOnExecutor(files, stdin);
    return NextResponse.json(raw);
  } catch (e) {
    console.error("[api/run] executor failed:", BACKEND, e);
    const detail = e instanceof Error && e.message ? `: ${e.message.slice(0, 150)}` : "";
    return NextResponse.json({ error: "سرویس اجرا جواب نداد" + detail }, { status: 502 });
  }
}
