import { supabase } from "@/lib/supabase";
import type { ExerciseSubmission, TestResult } from "@/lib/types";

export interface GradeResponse {
  /** false for teachers trying their own exercise: graded, but nothing recorded. */
  saved: boolean;
  submission: ExerciseSubmission;
  results: TestResult[];
}

export class GradeError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Sends the code to /api/grade: the server runs the tests, judges them and records the submission. */
export async function gradeOnServer(exerciseId: string, code: string): Promise<GradeResponse> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new GradeError("اول وارد حساب کاربریت شو.", 401);
  let res: Response;
  try {
    res = await fetch("/api/grade", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ exercise_id: exerciseId, code }),
    });
  } catch {
    throw new GradeError("به سرور وصل نشدم؛ اینترنتت رو چک کن و دوباره امتحان کن.", 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new GradeError(body.error || "تصحیح ناموفق بود", res.status);
  return body as GradeResponse;
}
