import { supabase } from "@/lib/supabase";
import { interpretRun, toStdin, cleanTraceback, type InterpretedRun, type RawServerResult, type ServerMode } from "@/lib/serverRunCore";

export type ServerAttempt =
  | { ok: true; raw: RawServerResult }
  | { ok: false; reason: "unavailable" | "unauthorized" | "limited" | "error"; message?: string };

/** Sends the program to /api/run (which forwards to the configured remote executor). */
export async function executeOnServer(args: { code: string; stdin: string; mode: ServerMode; seed: number }): Promise<ServerAttempt> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { ok: false, reason: "unauthorized" };
    const res = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(args),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, raw: body as RawServerResult };
    if (res.status === 503) return { ok: false, reason: "unavailable", message: body.error };
    if (res.status === 401) return { ok: false, reason: "unauthorized", message: body.error };
    if (res.status === 429) return { ok: false, reason: "limited", message: body.error };
    return { ok: false, reason: "error", message: body.error };
  } catch (e) {
    return { ok: false, reason: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

export { interpretRun, toStdin, cleanTraceback };
export type { InterpretedRun };
