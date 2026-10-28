import { supabase } from "@/lib/supabase";

/** fetch() for the /api/admin/* routes: sends the signed-in user's access token so the server can check their role. */
export async function adminFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (data.session?.access_token) headers.set("Authorization", `Bearer ${data.session.access_token}`);
  return fetch(input, { ...init, headers, cache: "no-store" });
}

/** adminFetch + JSON parsing + throw on non-2xx (message comes from the server's { error }). */
export async function adminJson<T = unknown>(input: string, init: RequestInit = {}): Promise<T> {
  const res = await adminFetch(input, init);
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((d as { error?: string }).error || "خطا");
  return d as T;
}

export function jsonBody(body: unknown): RequestInit {
  return { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}
