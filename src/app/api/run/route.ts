import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildFiles, type RunnerFile, type ServerMode } from "@/lib/serverRunCore";

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
const RUNNER_URL = process.env.CODE_RUNNER_URL?.replace(/\/+$/, "");
const RUNNER_KEY = process.env.CODE_RUNNER_KEY;
const RUNNER_TIMEOUT = Number(process.env.CODE_RUNNER_TIMEOUT_MS || 0) || undefined;
const BACKEND: "piston" | "sandbox" | null = RUNNER_URL ? "piston" : process.env.CODE_RUNNER === "vercel-sandbox" ? "sandbox" : null;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

const MAX_CODE = 20_000;
const MAX_STDIN = 20_000;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;
const hits = new Map<string, number[]>(); // per-user, per server instance

type Raw = { stdout: string; stderr: string; code: number | null; signal: string | null };

async function runOnPiston(files: RunnerFile[], stdin: string): Promise<Raw> {
  const res = await fetch(`${RUNNER_URL}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(RUNNER_KEY ? { Authorization: RUNNER_KEY } : {}) },
    body: JSON.stringify({ language: "python", version: "*", files, stdin, ...(RUNNER_TIMEOUT ? { run_timeout: RUNNER_TIMEOUT } : {}) }),
    signal: AbortSignal.timeout(20_000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.run) throw new Error(data?.message ? String(data.message).slice(0, 150) : "bad response");
  return {
    stdout: String(data.run.stdout ?? ""),
    stderr: String(data.run.stderr ?? ""),
    code: typeof data.run.code === "number" ? data.run.code : null,
    signal: data.run.signal ?? null,
  };
}

/** One fresh microVM per run, always stopped afterwards. The SDK has no stdin channel, so stdin is a file. */
async function runOnVercelSandbox(files: RunnerFile[], stdin: string): Promise<Raw> {
  const { Sandbox } = await import("@vercel/sandbox");
  const creds =
    process.env.VERCEL_TOKEN && process.env.VERCEL_TEAM_ID && process.env.VERCEL_PROJECT_ID
      ? { token: process.env.VERCEL_TOKEN, teamId: process.env.VERCEL_TEAM_ID, projectId: process.env.VERCEL_PROJECT_ID }
      : {};
  const base = { timeout: 60_000, resources: { vcpus: 1 }, ...creds };
  let sandbox;
  try {
    sandbox = await Sandbox.create({ image: "vercel/sandbox/python:3.14", ...base });
  } catch (firstError) {
    // Older/other setups may not know the image name: retry with the runtime name.
    try {
      sandbox = await Sandbox.create({ runtime: "python3.13", ...base });
    } catch {
      throw firstError;
    }
  }
  try {
    await sandbox.writeFiles([
      ...files.map((f) => ({ path: `/vercel/sandbox/${f.name}`, content: Buffer.from(f.content, "utf8") })),
      { path: "/vercel/sandbox/stdin.txt", content: Buffer.from(stdin, "utf8") },
    ]);
    const r = await sandbox.runCommand("sh", ["-c", "cd /vercel/sandbox && timeout 10 python3 main.py < stdin.txt"], { timeoutMs: 20_000 });
    const [stdout, stderr] = await Promise.all([r.stdout(), r.stderr()]);
    // `timeout` exits 124 when it had to stop the program; 137 = killed (usually out of memory).
    const killed = r.exitCode === 124 || r.exitCode === 137;
    return { stdout, stderr, code: r.exitCode, signal: killed ? "SIGKILL" : null };
  } finally {
    await sandbox.stop().catch(() => undefined);
  }
}

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
    const raw = BACKEND === "sandbox" ? await runOnVercelSandbox(files, stdin) : await runOnPiston(files, stdin);
    return NextResponse.json(raw);
  } catch (e) {
    console.error("[api/run] executor failed:", BACKEND, e);
    const detail = e instanceof Error && e.message ? `: ${e.message.slice(0, 150)}` : "";
    return NextResponse.json({ error: "سرویس اجرا جواب نداد" + detail }, { status: 502 });
  }
}
