import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { adminDb } from "@/lib/adminServer";
import { BACKEND, runOnExecutor } from "@/lib/executor";
import { buildGradeFiles, type GradeResultRaw, type GradeTest } from "@/lib/graderHarness";
import { friendlyWindowError } from "@/lib/schedule";
import type { TestCase } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Server-side grading. The browser sends ONLY {exercise_id, code}; the server loads the tests (including hidden
 * tests and checkers, which students can't read), runs the student's program on the isolated executor, judges
 * it and records the submission with the service-role key. Students can't forge a result and don't need
 * Python to run in their browser, so it works on any phone.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const MAX_CODE = 20_000;
const MAX_TESTS = 30;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 12;
const hits = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) || []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(userId, recent);
  return recent.length > RATE_MAX;
}

const err = (error: string, status: number) => NextResponse.json({ error }, { status });

function toGradeTest(t: TestCase, hidden: boolean): GradeTest {
  return {
    kind: t.kind === "checker" ? "checker" : "exact",
    input: String(t.input ?? ""),
    expected: String(t.expected ?? ""),
    hidden: hidden || !!t.hidden,
    random: t.random ? String(t.random) : undefined,
    checker: t.checker ? String(t.checker) : undefined,
    runs: t.runs ? Math.max(1, Math.min(20, Number(t.runs) || 5)) : undefined,
  };
}

export async function POST(req: NextRequest) {
  if (!BACKEND) return err("تصحیح سمت سرور فعال نیست؛ از مدیر سایت بخواه اجراکننده‌ی کد (CODE_RUNNER) رو تنظیم کنه.", 503);

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return err("اول وارد حساب کاربریت شو.", 401);
  const { data: auth, error: authError } = await createClient(SUPABASE_URL, SUPABASE_ANON).auth.getUser(token);
  if (authError || !auth.user) return err("نشست شما معتبر نیست؛ دوباره وارد شو.", 401);
  const userId = auth.user.id;
  if (rateLimited(userId)) return err("خیلی سریع ثبت می‌کنی؛ چند ثانیه صبر کن.", 429);

  let body: { exercise_id?: unknown; code?: unknown };
  try {
    body = await req.json();
  } catch {
    return err("درخواست نامعتبر", 400);
  }
  const exerciseId = typeof body.exercise_id === "string" ? body.exercise_id : "";
  const code = typeof body.code === "string" ? body.code : "";
  if (!exerciseId) return err("تمرین مشخص نیست", 400);
  if (!code.trim()) return err("اول کدت رو بنویس", 400);
  if (code.length > MAX_CODE) return err("کد خیلی بزرگه", 413);

  let db;
  try {
    db = adminDb();
  } catch (e) {
    return err(e instanceof Error ? e.message : "تنظیمات سرور ناقصه", 503);
  }

  const { data: ex } = await db.from("exercises").select("*").eq("id", exerciseId).maybeSingle();
  if (!ex) return err("این تمرین پیدا نشد", 404);

  // Who is asking? Teachers (owner / co-teacher) may try the exercise, but nothing is recorded for them.
  const [{ data: cls }, { data: co }, { data: member }] = await Promise.all([
    db.from("class_sessions").select("created_by").eq("id", ex.class_id).maybeSingle(),
    db.from("class_teachers").select("user_id").eq("class_id", ex.class_id).eq("user_id", userId).maybeSingle(),
    db.from("class_members").select("display_name").eq("class_id", ex.class_id).eq("user_id", userId).maybeSingle(),
  ]);
  const isTeacher = cls?.created_by === userId || !!co;
  if (!isTeacher && !member) return err("برای ثبت پاسخ باید عضو کلاس باشی", 403);

  const now = Date.now();
  if (!isTeacher) {
    if (ex.opens_at && new Date(ex.opens_at).getTime() > now) return err("این تمرین هنوز باز نشده.", 403);
    if (ex.due_at && new Date(ex.due_at).getTime() < now) return err("مهلت این تمرین تموم شده و دیگه پاسخ ثبت نمی‌شه.", 403);
  }

  // Public tests (exercises.test_cases) + private ones (hidden tests / checkers, teacher-only table).
  const publicTests: GradeTest[] = ((ex.test_cases as TestCase[] | null) || []).map((t) => toGradeTest(t, false));
  const { data: priv } = await db.from("exercise_graders").select("tests").eq("exercise_id", exerciseId).maybeSingle();
  const privateTests: GradeTest[] = ((priv?.tests as TestCase[] | null) || []).map((t) => toGradeTest(t, true));
  let tests = [...publicTests, ...privateTests];
  if (!tests.length) tests = [{ kind: "exact", input: "", expected: "" }];
  if (tests.length > MAX_TESTS) return err("تعداد تست‌های این تمرین بیش از حده؛ به معلم اطلاع بده.", 422);

  let results: GradeResultRaw[];
  try {
    const raw = await runOnExecutor(buildGradeFiles(code, tests), "", { grading: true });
    if (raw.signal) return err("تصحیح بیش از حد طول کشید؛ کدت یا تست‌ها سنگینه.", 504);
    try {
      results = JSON.parse(raw.stdout).results as GradeResultRaw[];
      if (!Array.isArray(results) || results.length !== tests.length) throw new Error("bad result");
    } catch {
      console.error("[api/grade] bad grader output:", raw.stdout.slice(0, 300), raw.stderr.slice(0, 300));
      return err("پاسخ سرور تصحیح قابل‌خواندن نبود؛ دوباره امتحان کن.", 502);
    }
  } catch (e) {
    console.error("[api/grade] executor failed:", BACKEND, e);
    const detail = e instanceof Error && e.message ? `: ${e.message.slice(0, 150)}` : "";
    return err("سرویس اجرا جواب نداد" + detail, 502);
  }

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const status = passed === total ? "correct" : passed > 0 ? "partial" : "wrong";
  const test_results = results.map((r) => ({
    input: r.input,
    expected: r.expected,
    actual: r.actual,
    passed: r.passed,
    error: r.error,
    hidden: r.hidden || undefined,
    kind: r.kind,
    message: r.message || undefined,
    runs: r.kind === "checker" ? r.runs : undefined,
    runs_passed: r.kind === "checker" ? r.runs_passed : undefined,
  }));
  const payload = {
    exercise_id: exerciseId,
    user_id: userId,
    author_name: member?.display_name || auth.user.user_metadata?.display_name || "دانشجو",
    code,
    output: results.filter((r) => !r.hidden).map((r) => r.actual).join("\n---\n"),
    status,
    score: total > 0 ? Math.round((passed / total) * 100) : 0,
    passed_tests: passed,
    total_tests: total,
    test_results,
    submitted_at: new Date().toISOString(),
  };

  if (isTeacher) return NextResponse.json({ saved: false, submission: payload, results: test_results });

  const { error: saveError } = await db.from("exercise_submissions").upsert(payload, { onConflict: "exercise_id,user_id" });
  if (saveError) return err(friendlyWindowError(saveError.message) || "ثبت نتیجه ناموفق بود: " + saveError.message, 500);
  return NextResponse.json({ saved: true, submission: payload, results: test_results });
}
