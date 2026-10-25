export async function getHint(args: { code: string; context?: string; error?: string }): Promise<{ hint?: string; error?: string }> {
  try {
    const res = await fetch("/api/hint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "خطای ناشناخته" };
    return { hint: data.hint };
  } catch (e) {
    return { error: "ارتباط با سرویس راهنما برقرار نشد: " + (e as Error).message };
  }
}
