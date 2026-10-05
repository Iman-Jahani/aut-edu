import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Keeps the OpenRouter API key on the server — the browser never sees it.
// Get a free key at https://openrouter.ai/keys and set OPENROUTER_API_KEY
// (and optionally OPENROUTER_MODEL) in your .env.local / hosting provider.
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free";

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
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        max_tokens: 220,
        temperature: 0.4,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: "سرویس راهنما جواب نداد: " + text.slice(0, 200) }, { status: 502 });
    }

    const data = await res.json();
    const hint = data?.choices?.[0]?.message?.content?.trim();
    if (!hint) return NextResponse.json({ error: "راهنمایی‌ای برنگشت، دوباره امتحان کن" }, { status: 502 });

    return NextResponse.json({ hint });
  } catch (e) {
    return NextResponse.json({ error: "خطا در ارتباط با سرویس راهنما: " + (e as Error).message }, { status: 500 });
  }
}
