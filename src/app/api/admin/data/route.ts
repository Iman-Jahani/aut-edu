import { NextRequest, NextResponse } from "next/server";
import { adminDb, fail, requireActor } from "@/lib/adminServer";

export const dynamic = "force-dynamic";

/**
 * Everything the statistics pages need, in one request.
 *  - admin:   the whole site
 *  - manager: only their institution (its teachers, those teachers' classes, and the people in them)
 * Heavy tables use narrow column lists (no code / output bodies) and are paged, because Supabase
 * returns at most 1000 rows per request.
 */
const TABLES: Record<string, string> = {
  sessions: "class_sessions|id,code,title,created_by,created_at",
  meetings: "class_meetings|id,class_id,title,created_by,created_at",
  teams: "teams|id,class_id,name,color,created_at",
  teamMembers: "team_members|team_id,user_id,display_name,joined_at",
  classMembers: "class_members|class_id,user_id,display_name,joined_at,last_seen_at",
  classTeachers: "class_teachers|class_id,user_id,display_name,email,added_at",
  profiles: "user_profiles|user_id,display_name,avatar,email,role,institution_id,updated_at",
  cells: "cells|id,class_id,meeting_id,team_id,author_id,author_name,created_at,updated_at",
  comments: "comments|id,cell_id,author_id,author_name,created_at",
  exercises: "exercises|id,class_id,title,difficulty,topic,opens_at,due_at,created_at",
  exSubs: "exercise_submissions|exercise_id,user_id,author_name,status,score,passed_tests,total_tests,submitted_at",
  quizzes: "quizzes|id,class_id,title,status,time_limit,created_at,started_at",
  quizAnswers: "quiz_answers|quiz_id,user_id,author_name,score,total_questions,submitted_at",
  competitions: "competitions|id,class_id,title,status,time_limit,created_at,started_at",
  compSubs: "competition_submissions|competition_id,team_id,team_name,user_id,author_name,submitted_at",
  institutions: "institutions|id,name,max_teachers,created_at",
  grants: "role_grants|user_id,role,institution_id",
};

const PAGE = 1000;
const MAX_ROWS = 200_000;

async function fetchAll(table: string, columns: string): Promise<Record<string, unknown>[]> {
  const db = adminDb();
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await db.from(table).select(columns).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data || []) as unknown as Record<string, unknown>[]));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

type Rows = Record<string, Record<string, unknown>[]>;
const by = (rows: Record<string, unknown>[], key: string, ok: Set<unknown>) => rows.filter((r) => ok.has(r[key]));
const ids = (rows: Record<string, unknown>[], key: string) => new Set(rows.map((r) => r[key]));

/** Keep only what belongs to one institution. */
function scopeToInstitution(d: Rows, institutionId: string): Rows {
  const grants = d.grants.filter((g) => g.institution_id === institutionId);
  const teacherIds = new Set(grants.filter((g) => g.role === "teacher").map((g) => g.user_id));
  const sessions = d.sessions.filter((s) => teacherIds.has(s.created_by));
  const classIds = ids(sessions, "id");
  const teams = by(d.teams, "class_id", classIds);
  const teamMembers = by(d.teamMembers, "team_id", ids(teams, "id"));
  const classMembers = by(d.classMembers, "class_id", classIds);
  const cells = by(d.cells, "class_id", classIds);
  const exercises = by(d.exercises, "class_id", classIds);
  const quizzes = by(d.quizzes, "class_id", classIds);
  const competitions = by(d.competitions, "class_id", classIds);
  const people = new Set<unknown>([...grants.map((g) => g.user_id), ...ids(classMembers, "user_id"), ...ids(teamMembers, "user_id"), ...ids(cells, "author_id")]);
  const exSubs = by(d.exSubs, "exercise_id", ids(exercises, "id"));
  exSubs.forEach((s) => people.add(s.user_id));
  return {
    sessions,
    meetings: by(d.meetings, "class_id", classIds),
    teams,
    teamMembers,
    classMembers,
    classTeachers: by(d.classTeachers, "class_id", classIds),
    profiles: by(d.profiles, "user_id", people),
    cells,
    comments: by(d.comments, "cell_id", ids(cells, "id")),
    exercises,
    exSubs,
    quizzes,
    quizAnswers: by(d.quizAnswers, "quiz_id", ids(quizzes, "id")),
    competitions,
    compSubs: by(d.compSubs, "competition_id", ids(competitions, "id")),
    institutions: d.institutions.filter((i) => i.id === institutionId),
    grants,
  };
}

export async function GET(req: NextRequest) {
  const a = await requireActor(req);
  if ("error" in a) return a.error;
  const { actor } = a;
  try {
    let out: Rows = {};
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
    if (actor.role === "manager" && actor.institutionId) out = scopeToInstitution(out, actor.institutionId);
    return NextResponse.json({
      ...out,
      warnings,
      scope: { role: actor.role, institutionId: actor.institutionId, institutionName: actor.institutionName },
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return fail(e);
  }
}
