import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Keeps the OpenRouter API key on the server — the browser never sees it.
// Get a free key at https://openrouter.ai/keys and set OPENROUTER_API_KEY
// in your .env.local / hosting provider. OPENROUTER_MODEL is optional: if set,
// it's tried first; either way we fall back through OpenRouter's current free
// models automatically, so this keeps working even if one model gets
// rate-limited or removed.
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const PINNED_MODEL = process.env.OPENROUTER_MODEL;

// Cheap in-memory cache (per server instance) so we don't refetch the full
// model list on every single hint request.
let freeModelsCache: { ids: string[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getFreeModelIds(): Promise<string[]> {
  if (freeModelsCache && Date.now() - freeModelsCache.fetchedAt < CACHE_TTL_MS) {
    return freeModelsCache.ids;
  }
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models");
    if (!res.ok) return freeModelsCache?.ids || [];
    const data = await res.json();
    const models: Array<{ id: string; pricing?: { prompt?: string; completion?: string }; context_length?: number }> = data?.data || [];
    const free = models
      .filter((m) => m.id.endsWith(":free") || (m.pricing && Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0))
      // Prefer models with a bit more context so longer code/questions still fit.
      .sort((a, b) => (b.context_length || 0) - (a.context_length || 0))
      .map((m) => m.id);
    freeModelsCache = { ids: free, fetchedAt: Date.now() };
    return free;
  } catch {
    return freeModelsCache?.ids || [];
  }
}

const SYSTEM_PROMPT = `تو یه دستیار آموزشی مهربون برای یه کلاس پایتون هستی. دانشجو گیر کرده و کدش رو برات می‌فرسته.
قوانین مهم:
- هرگز کد کامل یا راه‌حل نهایی رو ننویس.
- فقط یه راهنمایی کوتاه (حداکثر ۳ تا ۴ جمله) بده که ذهنش رو به سمت درست هدایت کنه: کدوم خط مشکل داره، چه مفهومی رو باید چک کنه، یا چه سوالی از خودش بپرسه.
- اگه کد بدون خطا و درسته ولی دانشجو گفته گیر کرده، یه تشویق کوتاه بده و بپرس دقیقاً کجا گیر کرده.
- فقط فارسی و خیلی خودمونی و مثبت بنویس.
- هرگز اموجی زیاد استفاده نکن (حداکثر یکی).`;

export async function POST(req: NextRequest) {
  if (!OPENROUTER_API_KEY) {
    return NextResponse.json(
      { error: "سرویس راهنمای هوش مصنوعی هنوز تنظیم نشده (OPENROUTER_API_KEY رو در .env.local بذار)." },
      { status: 503 }
    );
  }

  let body: { code?: string; context?: string; error?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر" }, { status: 400 });
  }

  const code = (body.code || "").slice(0, 4000);
  const context = (body.context || "").slice(0, 2000);
  const errorOutput = (body.error || "").slice(0, 1000);

  if (!code.trim()) {
    return NextResponse.json({ error: "اول یه چیزی بنویس تا بتونم کمکت کنم" }, { status: 400 });
  }

  const userMessage = [
    context ? `صورت تمرین:\n${context}` : null,
    `کد فعلی دانشجو:\n\`\`\`python\n${code}\n\`\`\``,
    errorOutput ? `آخرین خروجی/خطا:\n${errorOutput}` : null,
    "یه راهنمایی کوتاه بده (نه راه‌حل کامل).",
  ]
    .filter(Boolean)
    .join("\n\n");

  const freeModels = await getFreeModelIds();
  // Try the pinned model first (if set), then free models discovered live from
  // OpenRouter, in order — if one is rate-limited/down/unavailable we just
  // move to the next one instead of failing the whole request.
  const candidates = Array.from(new Set([PINNED_MODEL, ...freeModels].filter(Boolean))) as string[];

  if (!candidates.length) {
    return NextResponse.json({ error: "در حال حاضر هیچ مدل رایگانی در دسترس نیست، بعداً دوباره امتحان کن." }, { status: 503 });
  }

  const MAX_ATTEMPTS = 5;
  const statuses: number[] = [];

  for (const model of candidates.slice(0, MAX_ATTEMPTS)) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": req.headers.get("origin") || "https://localhost",
          "X-Title": "Python Classroom Hint",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
          max_tokens: 400,
          temperature: 0.4,
        }),
      });

      if (!res.ok) {
        statuses.push(res.status);
        continue; // rate-limited / model unavailable — try the next one
      }

      const data = await res.json();
      const hint = data?.choices?.[0]?.message?.content?.trim();
      if (!hint) {
        statuses.push(200);
        continue;
      }

      return NextResponse.json({ hint, model });
    } catch {
      statuses.push(0); // network hiccup on this model — try the next one
    }
  }

  // If every single attempt was unauthorized, the key itself is the problem —
  // tell the person that directly instead of the generic "all models failed".
  if (statuses.length && statuses.every((s) => s === 401 || s === 403)) {
    return NextResponse.json(
      { error: "کلید OPENROUTER_API_KEY نامعتبره یا منقضی شده. یه کلید جدید از openrouter.ai/keys بگیر." },
      { status: 401 }
    );
  }

  return NextResponse.json({ error: "همه‌ی مدل‌های رایگان در دسترس جواب ندادن، یکم بعد دوباره امتحان کن." }, { status: 502 });
}
