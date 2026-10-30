// Loads the rows the teacher / student dashboards need, using the signed-in user's own Supabase session.
// Teachers get an AdminData-shaped object (so the same aggregation code as the admin panel works);
// students only ever load their own rows.
import { supabase } from "@/lib/supabase";
import type { AdminData } from "@/lib/adminStats";
import type { QuizQuestion } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
const PAGE = 1000;

/** Pages through a query (Supabase returns max 1000 rows per request). A failing table yields []. */
async function fetchAll<T = any>(make: () => any, cap = 20000): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < cap; from += PAGE) {
    const { data, error } = await make().range(from, from + PAGE - 1);
    if (error) return rows;
    rows.push(...((data || []) as T[]));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

const chunk = <T,>(arr: T[], n: number): T[][] => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const strip = <T extends Record<string, any>>(rows: T[], key: string): any[] => rows.map((r) => {
  const { [key]: _drop, ...rest } = r;
  void _drop;
  return rest;
});

export interface InsightData {
  data: AdminData;
  /** quiz id -> questions (to compute per-question accuracy) */
  quizQuestions: Map<string, QuizQuestion[]>;
  /** each student's chosen option per question */
  quizSheets: { quiz_id: string; user_id: string; answers: number[] }[];
}

/** Everything about the given classes, shaped like the admin panel's data. */
export async function loadInsightData(classIds: string[], opts: { quizDetail?: boolean } = {}): Promise<InsightData> {
  const empty = (): InsightData => ({ data: shape({}), quizQuestions: new Map(), quizSheets: [] });
  if (!classIds.length) return empty();

  const inClass = (table: string, cols: string) => () => supabase.from(table).select(cols).in("class_id", classIds);
  const viaParent = (table: string, cols: string, parent: string) => () =>
    supabase.from(table).select(`${cols}, ${parent}!inner(class_id)`).in(`${parent}.class_id`, classIds);

  const [sessions, meetings, teams, teamMembers, classMembers, classTeachers, cells, comments, exercises, exSubs, quizzesFull, quizAns, competitions, compSubs] = await Promise.all([
    fetchAll(() => supabase.from("class_sessions").select("id,code,title,created_by,created_at").in("id", classIds)),
    fetchAll(inClass("class_meetings", "id,class_id,title,created_by,created_at")),
    fetchAll(inClass("teams", "id,class_id,name,color,created_at")),
    fetchAll(viaParent("team_members", "team_id,user_id,display_name,joined_at", "teams")),
    fetchAll(inClass("class_members", "class_id,user_id,display_name,joined_at,last_seen_at")),
    fetchAll(inClass("class_teachers", "class_id,user_id,display_name,email,added_at")),
    fetchAll(inClass("cells", "id,class_id,meeting_id,team_id,author_id,author_name,created_at,updated_at"), 15000),
    fetchAll(viaParent("comments", "id,cell_id,author_id,author_name,created_at", "cells"), 15000),
    fetchAll(inClass("exercises", "id,class_id,title,difficulty,topic,opens_at,due_at,created_at")),
    fetchAll(viaParent("exercise_submissions", "exercise_id,user_id,author_name,status,score,passed_tests,total_tests,submitted_at", "exercises")),
    fetchAll(inClass("quizzes", opts.quizDetail ? "id,class_id,title,status,time_limit,created_at,started_at,questions" : "id,class_id,title,status,time_limit,created_at,started_at")),
    fetchAll(viaParent("quiz_answers", opts.quizDetail ? "quiz_id,user_id,author_name,score,total_questions,submitted_at,answers" : "quiz_id,user_id,author_name,score,total_questions,submitted_at", "quizzes")),
    fetchAll(inClass("competitions", "id,class_id,title,status,time_limit,created_at,started_at")),
    fetchAll(viaParent("competition_submissions", "competition_id,team_id,team_name,user_id,author_name,submitted_at", "competitions")),
  ]);

  // names / avatars for everyone who shows up
  const ids = new Set<string>();
  [...classMembers, ...teamMembers, ...classTeachers].forEach((r: any) => r.user_id && ids.add(r.user_id));
  [...cells].forEach((r: any) => ids.add(r.author_id));
  exSubs.forEach((r: any) => ids.add(r.user_id));
  sessions.forEach((r: any) => r.created_by && ids.add(r.created_by));
  const profileChunks = await Promise.all(
    chunk(Array.from(ids), 120).map(async (c) => {
      const { data } = await supabase.from("user_profiles").select("user_id,display_name,avatar,email,role,updated_at").in("user_id", c);
      return data || [];
    })
  );
  const profiles = profileChunks.flat().map((p: any) => ({ ...p, institution_id: null }));

  const quizQuestions = new Map<string, QuizQuestion[]>();
  const quizzes = (quizzesFull as any[]).map((q) => {
    if (opts.quizDetail && Array.isArray(q.questions)) quizQuestions.set(q.id, q.questions);
    const { questions: _q, ...rest } = q;
    void _q;
    return rest;
  });
  const quizSheets = opts.quizDetail ? (quizAns as any[]).map((a) => ({ quiz_id: a.quiz_id, user_id: a.user_id, answers: Array.isArray(a.answers) ? a.answers : [] })) : [];

  return {
    data: shape({
      sessions,
      meetings,
      teams,
      teamMembers: strip(teamMembers, "teams"),
      classMembers,
      classTeachers,
      profiles,
      cells,
      comments: strip(comments, "cells"),
      exercises,
      exSubs: strip(exSubs, "exercises"),
      quizzes,
      quizAnswers: strip(quizAns, "quizzes").map(({ answers: _a, ...rest }: any) => (void _a, rest)),
      competitions,
      compSubs: strip(compSubs, "competitions"),
    }),
    quizQuestions,
    quizSheets,
  };
}

function shape(p: Partial<AdminData>): AdminData {
  return {
    sessions: [], meetings: [], teams: [], teamMembers: [], classMembers: [], classTeachers: [], profiles: [], cells: [], comments: [],
    exercises: [], exSubs: [], quizzes: [], quizAnswers: [], competitions: [], compSubs: [], institutions: [], grants: [],
    scope: { role: "admin", institutionId: null, institutionName: null },
    warnings: [],
    generatedAt: new Date().toISOString(),
    ...p,
  } as AdminData;
}

// ---------------------------------------------------------------------------
// A student's own data
// ---------------------------------------------------------------------------

export interface StudentSource {
  classes: { id: string; code: string; title: string; created_at: string; lastSeenAt: string }[];
  exercises: { id: string; class_id: string; title: string; difficulty: number | null; topic: string | null; due_at: string | null; opens_at: string | null }[];
  subs: { exercise_id: string; status: string; score: number; submitted_at: string }[];
  cells: { class_id: string; created_at: string; updated_at: string | null }[];
  commentsWritten: { created_at: string }[];
  commentsReceived: { created_at: string }[];
  quizzes: { id: string; class_id: string; title: string; status: string; created_at: string }[];
  quizAnswers: { quiz_id: string; score: number; total_questions: number; submitted_at: string }[];
  competitions: { id: string; class_id: string; title: string; status: string; created_at: string }[];
  compSubs: { competition_id: string; team_name: string; submitted_at: string }[];
}

export async function loadStudentData(userId: string): Promise<StudentSource> {
  const { data: memberRows } = await supabase.from("class_members").select("class_id,last_seen_at").eq("user_id", userId);
  const ids = (memberRows || []).map((r: any) => r.class_id as string);
  const empty: StudentSource = { classes: [], exercises: [], subs: [], cells: [], commentsWritten: [], commentsReceived: [], quizzes: [], quizAnswers: [], competitions: [], compSubs: [] };
  if (!ids.length) return empty;
  const seen = new Map((memberRows || []).map((r: any) => [r.class_id as string, r.last_seen_at as string]));

  const [{ data: sessions }, exercises, cells, written, received, quizzes, competitions, myTeams] = await Promise.all([
    supabase.from("class_sessions").select("id,code,title,created_at").in("id", ids),
    fetchAll(() => supabase.from("exercises").select("id,class_id,title,difficulty,topic,due_at,opens_at").in("class_id", ids)),
    fetchAll(() => supabase.from("cells").select("class_id,created_at,updated_at").eq("author_id", userId), 10000),
    fetchAll(() => supabase.from("comments").select("created_at").eq("author_id", userId), 10000),
    fetchAll(() => supabase.from("comments").select("created_at, cells!inner(author_id)").eq("cells.author_id", userId).neq("author_id", userId), 10000),
    fetchAll(() => supabase.from("quizzes").select("id,class_id,title,status,created_at").in("class_id", ids)),
    fetchAll(() => supabase.from("competitions").select("id,class_id,title,status,created_at").in("class_id", ids)),
    fetchAll(() => supabase.from("team_members").select("team_id").eq("user_id", userId)),
  ]);

  const exIds = (exercises as any[]).map((e) => e.id);
  const quizIds = (quizzes as any[]).map((q) => q.id);
  const teamIds = (myTeams as any[]).map((t) => t.team_id);
  const [subs, quizAnswers, compSubs] = await Promise.all([
    exIds.length ? fetchAll(() => supabase.from("exercise_submissions").select("exercise_id,status,score,submitted_at").eq("user_id", userId)) : Promise.resolve([]),
    quizIds.length ? fetchAll(() => supabase.from("quiz_answers").select("quiz_id,score,total_questions,submitted_at").eq("user_id", userId)) : Promise.resolve([]),
    teamIds.length ? fetchAll(() => supabase.from("competition_submissions").select("competition_id,team_name,submitted_at").in("team_id", teamIds)) : Promise.resolve([]),
  ]);

  const exSet = new Set(exIds);
  const quizSet = new Set(quizIds);
  const compSet = new Set((competitions as any[]).map((c) => c.id));
  return {
    classes: (sessions || []).map((c: any) => ({ ...c, lastSeenAt: seen.get(c.id) || c.created_at })),
    exercises: exercises as StudentSource["exercises"],
    subs: (subs as any[]).filter((s) => exSet.has(s.exercise_id)),
    cells: cells as StudentSource["cells"],
    commentsWritten: written as StudentSource["commentsWritten"],
    commentsReceived: strip(received as any[], "cells"),
    quizzes: quizzes as StudentSource["quizzes"],
    quizAnswers: (quizAnswers as any[]).filter((a) => quizSet.has(a.quiz_id)),
    competitions: competitions as StudentSource["competitions"],
    compSubs: (compSubs as any[]).filter((s) => compSet.has(s.competition_id)),
  };
}
