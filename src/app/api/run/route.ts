import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildFiles, type ServerMode } from "@/lib/serverRunCore";

export const runtime = "nodejs";

/**
 * Optional server-side execution, used ONLY when a student's browser can't load the
 * in-browser Python engine. Student code is never run inside this Next.js process —
 * it is forwarded to a separate sandboxed executor you host (Piston-compatible API).
 * Not configured → 503, and the app simply shows the "engine failed to load" message.
 *
 *   CODE_RUNNER_URL=https://your-piston-host/api/v2   (required to enable)
 *   CODE_RUNNER_KEY=...                               (optional, sent as the Authorization header)
 *   CODE_RUNNER_TIMEOUT_MS=3000                       (optional run timeout, must not exceed the executor's own limit)
 */
const RUNNER_URL = process.env.CODE_RUNNER_URL?.replace(/\/+$/, "");
const RUNNER_KEY = process.env.CODE_RUNNER_KEY;
const RUNNER_TIMEOUT = Number(process.env.CODE_RUNNER_TIMEOUT_MS || 0) || undefined;

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
  if (!RUNNER_URL) {
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
    const res = await fetch(`${RUNNER_URL}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(RUNNER_KEY ? { Authorization: RUNNER_KEY } : {}) },
      body: JSON.stringify({
        language: "python",
        version: "*",
        files: buildFiles(code, mode, seed),
        stdin,
        ...(RUNNER_TIMEOUT ? { run_timeout: RUNNER_TIMEOUT } : {}),
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.run) {
      return NextResponse.json({ error: "سرویس اجرا جواب نداد" + (data?.message ? `: ${String(data.message).slice(0, 150)}` : "") }, { status: 502 });
    }
    return NextResponse.json({
      stdout: String(data.run.stdout ?? ""),
      stderr: String(data.run.stderr ?? ""),
      code: typeof data.run.code === "number" ? data.run.code : null,
      signal: data.run.signal ?? null,
    });
  } catch {
    return NextResponse.json({ error: "ارتباط با سرویس اجرا برقرار نشد" }, { status: 502 });
  }
}
