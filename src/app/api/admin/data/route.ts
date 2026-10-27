import { NextRequest, NextResponse } from "next/server";
import { adminDb, fail, requireAdmin } from "@/lib/adminServer";

export const dynamic = "force-dynamic";

/**
 * Everything the admin statistics pages need, in one request.
 * Heavy tables are fetched with narrow column lists (no code / output bodies), and paged
 * because Supabase returns at most 1000 rows per request.
 */
const TABLES: Record<string, string> = {
  sessions: "class_sessions|id,code,title,created_by,created_at",
  meetings: "class_meetings|id,class_id,title,created_by,created_at",
  teams: "teams|id,class_id,name,color,created_at",
  teamMembers: "team_members|team_id,user_id,display_name,joined_at",
  classMembers: "class_members|class_id,user_id,display_name,joined_at,last_seen_at",
  classTeachers: "class_teachers|class_id,user_id,display_name,email,added_at",
  profiles: "user_profiles|user_id,display_name,avatar,email,role,updated_at",
  cells: "cells|id,class_id,meeting_id,team_id,author_id,author_name,created_at,updated_at",
  comments: "comments|id,cell_id,author_id,author_name,created_at",
  exercises: "exercises|id,class_id,title,difficulty,topic,opens_at,due_at,created_at",
  exSubs: "exercise_submissions|exercise_id,user_id,author_name,status,score,passed_tests,total_tests,submitted_at",
  quizzes: "quizzes|id,class_id,title,status,time_limit,created_at,started_at",
  quizAnswers: "quiz_answers|quiz_id,user_id,author_name,score,total_questions,submitted_at",
  competitions: "competitions|id,class_id,title,status,time_limit,created_at,started_at",
  compSubs: "competition_submissions|competition_id,team_id,team_name,user_id,author_name,submitted_at",
};

const PAGE = 1000;
const MAX_ROWS = 200_000; // safety net

async function fetchAll(table: string, columns: string): Promise<unknown[]> {
  const db = adminDb();
  const rows: unknown[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await db.from(table).select(columns).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const out: Record<string, unknown[]> = {};
    const warnings: string[] = [];
    await Promise.all(
      Object.entries(TABLES).map(async ([key, spec]) => {
        const [table, cols] = spec.split("|");
        try {
          out[key] = await fetchAll(table, cols);
        } catch (e) {
          // A table that doesn't exist yet (older database) shouldn't take the whole panel down.
          out[key] = [];
          warnings.push(e instanceof Error ? e.message : String(e));
        }
      })
    );
    return NextResponse.json({ ...out, warnings, generatedAt: new Date().toISOString() });
  } catch (e) {
    return fail(e);
  }
}
