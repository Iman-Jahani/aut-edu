// Server-only: the remote code executor shared by /api/run (running cells) and /api/grade (checking exercises).
// Student code is never run inside this Next.js process. Pick ONE executor (see /api/run for details).
import type { RunnerFile } from "@/lib/serverRunCore";

const RUNNER_URL = process.env.CODE_RUNNER_URL?.replace(/\/+$/, "");
const RUNNER_KEY = process.env.CODE_RUNNER_KEY;
const RUNNER_TIMEOUT = Number(process.env.CODE_RUNNER_TIMEOUT_MS || 0) || undefined;
// Grading runs a whole test-suite in one execution, so it may need a longer limit than a single cell run.
// Must not exceed the executor's own limit (for Piston: run_timeout in its config).
const GRADE_TIMEOUT = Number(process.env.CODE_RUNNER_GRADE_TIMEOUT_MS || 0) || RUNNER_TIMEOUT;

export const BACKEND: "piston" | "sandbox" | null = RUNNER_URL ? "piston" : process.env.CODE_RUNNER === "vercel-sandbox" ? "sandbox" : null;

export type Raw = { stdout: string; stderr: string; code: number | null; signal: string | null };

async function runOnPiston(files: RunnerFile[], stdin: string, grading: boolean): Promise<Raw> {
  const timeout = grading ? GRADE_TIMEOUT : RUNNER_TIMEOUT;
  const res = await fetch(`${RUNNER_URL}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(RUNNER_KEY ? { Authorization: RUNNER_KEY } : {}) },
    body: JSON.stringify({ language: "python", version: "*", files, stdin, ...(timeout ? { run_timeout: timeout } : {}) }),
    signal: AbortSignal.timeout(grading ? 55_000 : 20_000),
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
async function runOnVercelSandbox(files: RunnerFile[], stdin: string, grading: boolean): Promise<Raw> {
  const limitSec = grading ? 40 : 10;
  const { Sandbox } = await import("@vercel/sandbox");
  const creds =
    process.env.VERCEL_TOKEN && process.env.VERCEL_TEAM_ID && process.env.VERCEL_PROJECT_ID
      ? { token: process.env.VERCEL_TOKEN, teamId: process.env.VERCEL_TEAM_ID, projectId: process.env.VERCEL_PROJECT_ID }
      : {};
  const base = { timeout: (limitSec + 50) * 1000, resources: { vcpus: 1 }, ...creds };
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
    const r = await sandbox.runCommand("sh", ["-c", `cd /vercel/sandbox && timeout ${limitSec} python3 main.py < stdin.txt`], { timeoutMs: (limitSec + 10) * 1000 });
    const [stdout, stderr] = await Promise.all([r.stdout(), r.stderr()]);
    // `timeout` exits 124 when it had to stop the program; 137 = killed (usually out of memory).
    const killed = r.exitCode === 124 || r.exitCode === 137;
    return { stdout, stderr, code: r.exitCode, signal: killed ? "SIGKILL" : null };
  } finally {
    await sandbox.stop().catch(() => undefined);
  }
}

export function runOnExecutor(files: RunnerFile[], stdin: string, opts: { grading?: boolean } = {}): Promise<Raw> {
  const grading = !!opts.grading;
  return BACKEND === "sandbox" ? runOnVercelSandbox(files, stdin, grading) : runOnPiston(files, stdin, grading);
}
