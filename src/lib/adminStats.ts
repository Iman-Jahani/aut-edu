// Pure aggregation helpers for the admin statistics pages. No React, no network.

export interface AdminData {
  sessions: { id: string; code: string; title: string; created_by: string | null; created_at: string }[];
  meetings: { id: string; class_id: string; title: string; created_by: string | null; created_at: string }[];
  teams: { id: string; class_id: string; name: string; color: string; created_at: string }[];
  teamMembers: { team_id: string; user_id: string; display_name: string; joined_at: string }[];
  classMembers: { class_id: string; user_id: string; display_name: string; joined_at: string; last_seen_at: string }[];
  classTeachers: { class_id: string; user_id: string; display_name: string; email: string | null; added_at: string }[];
  profiles: { user_id: string; display_name: string; avatar: string | null; email: string | null; role: "teacher" | "student"; updated_at: string }[];
  cells: { id: string; class_id: string; meeting_id: string | null; team_id: string | null; author_id: string; author_name: string; created_at: string; updated_at: string | null }[];
  comments: { id: string; cell_id: string; author_id: string; author_name: string; created_at: string }[];
  exercises: { id: string; class_id: string; title: string; difficulty: number | null; topic: string | null; opens_at: string | null; due_at: string | null; created_at: string }[];
  exSubs: { exercise_id: string; user_id: string; author_name: string; status: SubStatus; score: number; passed_tests: number; total_tests: number; submitted_at: string }[];
  quizzes: { id: string; class_id: string; title: string; status: string; time_limit: number; created_at: string; started_at: string | null }[];
  quizAnswers: { quiz_id: string; user_id: string; author_name: string; score: number; total_questions: number; submitted_at: string }[];
  competitions: { id: string; class_id: string; title: string; status: string; time_limit: number; created_at: string; started_at: string | null }[];
  compSubs: { competition_id: string; team_id: string; team_name: string; user_id: string; author_name: string; submitted_at: string }[];
  warnings: string[];
  generatedAt: string;
}

export type SubStatus = "pending" | "correct" | "partial" | "wrong" | "error";

export const STATUS_LABEL: Record<SubStatus, string> = {
  correct: "درست",
  partial: "نیمه‌درست",
  wrong: "غلط",
  error: "خطا",
  pending: "در انتظار",
};
export const STATUS_COLOR: Record<SubStatus, string> = {
  correct: "#10b981",
  partial: "#f59e0b",
  wrong: "#ef4444",
  error: "#a1a1aa",
  pending: "#d4d4d8",
};
export const DIFF_LABEL: Record<number, string> = { 1: "پایه", 2: "آسان", 3: "متوسط", 4: "سخت" };

// ---------- small helpers ----------
const DAY = 86_400_000;
export const fa = (n: number | string) => Number(n).toLocaleString("fa-IR");
export const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
export const t = (iso?: string | null) => (iso ? new Date(iso).getTime() : 0);
export function dayKey(d: Date | string | number) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
export function dayLabel(key: string) {
  return new Date(key + "T00:00:00").toLocaleDateString("fa-IR", { month: "short", day: "numeric" });
}
export function ago(iso?: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - t(iso);
  if (diff < 60_000) return "همین الان";
  if (diff < 3_600_000) return `${fa(Math.floor(diff / 60_000))} دقیقه پیش`;
  if (diff < DAY) return `${fa(Math.floor(diff / 3_600_000))} ساعت پیش`;
  if (diff < 30 * DAY) return `${fa(Math.floor(diff / DAY))} روز پیش`;
  return new Date(iso).toLocaleDateString("fa-IR");
}
const latest = (...vals: (string | null | undefined)[]) => vals.reduce<string | null>((m, v) => (v && t(v) > t(m) ? v : m), null);

export interface DayPoint {
  key: string;
  label: string;
  cells: number;
  submissions: number;
  comments: number;
}

/** One point per day for the last `days` days with counts of each activity type (optionally filtered). */
export function activitySeries(
  days: number,
  src: { cells: string[]; submissions: string[]; comments: string[] }
): DayPoint[] {
  const keys: string[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) keys.push(dayKey(today.getTime() - i * DAY));
  const idx = new Map(keys.map((k, i) => [k, i]));
  const pts: DayPoint[] = keys.map((k) => ({ key: k, label: dayLabel(k), cells: 0, submissions: 0, comments: 0 }));
  (["cells", "submissions", "comments"] as const).forEach((f) =>
    src[f].forEach((iso) => {
      const i = idx.get(dayKey(iso));
      if (i !== undefined) pts[i][f]++;
    })
  );
  return pts;
}

// ---------- index ----------
export interface Index {
  data: AdminData;
  sessionById: Map<string, AdminData["sessions"][number]>;
  exerciseById: Map<string, AdminData["exercises"][number]>;
  profileById: Map<string, AdminData["profiles"][number]>;
  teacherIds: Set<string>;
  nameOf: (uid: string, fallback?: string) => string;
}

export function buildIndex(data: AdminData): Index {
  const profileById = new Map(data.profiles.map((p) => [p.user_id, p]));
  const teacherIds = new Set<string>();
  data.profiles.forEach((p) => p.role === "teacher" && teacherIds.add(p.user_id));
  data.sessions.forEach((s) => s.created_by && teacherIds.add(s.created_by));
  data.classTeachers.forEach((c) => teacherIds.add(c.user_id));
  const fallbackNames = new Map<string, string>();
  const remember = (uid: string, name: string | null | undefined) => {
    if (name && !fallbackNames.has(uid)) fallbackNames.set(uid, name);
  };
  data.classMembers.forEach((r) => remember(r.user_id, r.display_name));
  data.teamMembers.forEach((r) => remember(r.user_id, r.display_name));
  data.cells.forEach((r) => remember(r.author_id, r.author_name));
  data.exSubs.forEach((r) => remember(r.user_id, r.author_name));
  return {
    data,
    sessionById: new Map(data.sessions.map((s) => [s.id, s])),
    exerciseById: new Map(data.exercises.map((e) => [e.id, e])),
    profileById,
    teacherIds,
    nameOf: (uid, fb) => profileById.get(uid)?.display_name || fallbackNames.get(uid) || fb || "ناشناس",
  };
}

// ---------- per-student-in-class rows ----------
export interface StudentInClass {
  userId: string;
  name: string;
  avatar: string | null;
  teamName: string | null;
  teamColor: string | null;
  cells: number;
  comments: number;
  attempts: number;
  solved: number;
  avgScore: number; // best score per exercise, averaged over attempted exercises (0-100)
  lastActive: string | null;
  joinedAt: string | null;
}

/** Best submission per (user, exercise). */
function bestPerExercise(subs: AdminData["exSubs"]) {
  const best = new Map<string, AdminData["exSubs"][number]>();
  subs.forEach((s) => {
    const k = s.user_id + "|" + s.exercise_id;
    const cur = best.get(k);
    if (!cur || (s.status === "correct" && cur.status !== "correct") || (cur.status !== "correct" && s.score > cur.score)) best.set(k, s);
  });
  return best;
}

export interface ClassStats {
  id: string;
  code: string;
  title: string;
  teacherId: string | null;
  teacherName: string;
  createdAt: string;
  students: StudentInClass[];
  studentCount: number;
  activeStudents7d: number;
  teams: { id: string; name: string; color: string; members: number; cells: number; solved: number }[];
  meetings: { id: string; title: string; cells: number; comments: number; createdAt: string }[];
  exercises: { id: string; title: string; difficulty: number | null; topic: string | null; attempts: number; solvers: number; avgScore: number; dueAt: string | null }[];
  cellCount: number;
  commentCount: number;
  submissionCount: number;
  correctCount: number;
  solveRate: number; // % of (student × exercise) pairs solved
  avgScore: number;
  quizzes: { id: string; title: string; status: string; participants: number; avgPct: number }[];
  competitions: { id: string; title: string; status: string; submissions: number }[];
  statusCounts: Record<SubStatus, number>;
  lastActive: string | null;
  activity: DayPoint[];
}

export function classStats(ix: Index, classId: string): ClassStats | null {
  const { data } = ix;
  const s = ix.sessionById.get(classId);
  if (!s) return null;

  const meetings = data.meetings.filter((m) => m.class_id === classId);
  const cells = data.cells.filter((c) => c.class_id === classId);
  const cellIds = new Set(cells.map((c) => c.id));
  const comments = data.comments.filter((c) => cellIds.has(c.cell_id));
  const exercises = data.exercises.filter((e) => e.class_id === classId);
  const exIds = new Set(exercises.map((e) => e.id));
  const subs = data.exSubs.filter((x) => exIds.has(x.exercise_id));
  const teams = data.teams.filter((x) => x.class_id === classId);
  const teamIds = new Set(teams.map((x) => x.id));
  const teamMembers = data.teamMembers.filter((m) => teamIds.has(m.team_id));
  const best = bestPerExercise(subs);

  const teacherIdsHere = new Set<string>([...(s.created_by ? [s.created_by] : []), ...data.classTeachers.filter((c) => c.class_id === classId).map((c) => c.user_id)]);
  const memberRows = data.classMembers.filter((m) => m.class_id === classId && !teacherIdsHere.has(m.user_id));
  const studentIds = new Set<string>(memberRows.map((m) => m.user_id));
  teamMembers.forEach((m) => !teacherIdsHere.has(m.user_id) && studentIds.add(m.user_id));
  subs.forEach((x) => !teacherIdsHere.has(x.user_id) && studentIds.add(x.user_id));
  cells.forEach((c) => !teacherIdsHere.has(c.author_id) && studentIds.add(c.author_id));

  const memberById = new Map(memberRows.map((m) => [m.user_id, m]));
  const teamOfUser = new Map<string, (typeof teams)[number]>();
  teamMembers.forEach((m) => {
    const tm = teams.find((x) => x.id === m.team_id);
    if (tm) teamOfUser.set(m.user_id, tm);
  });

  const students: StudentInClass[] = Array.from(studentIds).map((uid) => {
    const mySubs = subs.filter((x) => x.user_id === uid);
    const myBest = Array.from(best.entries()).filter(([k]) => k.startsWith(uid + "|")).map(([, v]) => v);
    const myCells = cells.filter((c) => c.author_id === uid);
    const myComments = comments.filter((c) => c.author_id === uid);
    const tm = teamOfUser.get(uid);
    return {
      userId: uid,
      name: ix.nameOf(uid),
      avatar: ix.profileById.get(uid)?.avatar || null,
      teamName: tm?.name || null,
      teamColor: tm?.color || null,
      cells: myCells.length,
      comments: myComments.length,
      attempts: mySubs.length,
      solved: myBest.filter((b) => b.status === "correct").length,
      avgScore: myBest.length ? Math.round(myBest.reduce((a, b) => a + (b.score || 0), 0) / myBest.length) : 0,
      lastActive: latest(
        memberById.get(uid)?.last_seen_at,
        ...myCells.map((c) => c.updated_at || c.created_at),
        ...mySubs.map((x) => x.submitted_at)
      ),
      joinedAt: memberById.get(uid)?.joined_at || null,
    };
  });
  students.sort((a, b) => b.solved - a.solved || b.avgScore - a.avgScore || b.cells - a.cells);

  const exRows = exercises
    .map((e) => {
      const es = subs.filter((x) => x.exercise_id === e.id);
      const solvers = new Set(es.filter((x) => x.status === "correct").map((x) => x.user_id));
      const bests = Array.from(best.values()).filter((b) => b.exercise_id === e.id);
      return {
        id: e.id,
        title: e.title,
        difficulty: e.difficulty ?? null,
        topic: e.topic ?? null,
        attempts: es.length,
        solvers: solvers.size,
        avgScore: bests.length ? Math.round(bests.reduce((a, b) => a + (b.score || 0), 0) / bests.length) : 0,
        dueAt: e.due_at,
      };
    })
    .sort((a, b) => t(data.exercises.find((e) => e.id === b.id)?.created_at) - t(data.exercises.find((e) => e.id === a.id)?.created_at));

  const statusCounts: Record<SubStatus, number> = { correct: 0, partial: 0, wrong: 0, error: 0, pending: 0 };
  subs.forEach((x) => (statusCounts[x.status] = (statusCounts[x.status] || 0) + 1));

  const solvedPairs = students.reduce((a, b) => a + b.solved, 0);
  const allBest = Array.from(best.values());
  const now = Date.now();

  const quizRows = data.quizzes
    .filter((q) => q.class_id === classId)
    .map((q) => {
      const ans = data.quizAnswers.filter((a) => a.quiz_id === q.id);
      return { id: q.id, title: q.title, status: q.status, participants: ans.length, avgPct: ans.length ? Math.round(ans.reduce((a, b) => a + pct(b.score, b.total_questions), 0) / ans.length) : 0 };
    });
  const compRows = data.competitions
    .filter((c) => c.class_id === classId)
    .map((c) => ({ id: c.id, title: c.title, status: c.status, submissions: data.compSubs.filter((x) => x.competition_id === c.id).length }));

  return {
    id: s.id,
    code: s.code,
    title: s.title,
    teacherId: s.created_by,
    teacherName: s.created_by ? ix.nameOf(s.created_by) : "—",
    createdAt: s.created_at,
    students,
    studentCount: students.length,
    activeStudents7d: students.filter((x) => x.lastActive && now - t(x.lastActive) < 7 * DAY).length,
    teams: teams.map((tm) => ({
      id: tm.id,
      name: tm.name,
      color: tm.color,
      members: teamMembers.filter((m) => m.team_id === tm.id).length,
      cells: cells.filter((c) => c.team_id === tm.id).length,
      solved: students.filter((x) => x.teamName === tm.name).reduce((a, b) => a + b.solved, 0),
    })),
    meetings: meetings
      .map((m) => {
        const mc = cells.filter((c) => c.meeting_id === m.id);
        const ids = new Set(mc.map((c) => c.id));
        return { id: m.id, title: m.title, cells: mc.length, comments: comments.filter((c) => ids.has(c.cell_id)).length, createdAt: m.created_at };
      })
      .sort((a, b) => t(a.createdAt) - t(b.createdAt)),
    exercises: exRows,
    cellCount: cells.length,
    commentCount: comments.length,
    submissionCount: subs.length,
    correctCount: statusCounts.correct,
    solveRate: pct(solvedPairs, students.length * exercises.length),
    avgScore: allBest.length ? Math.round(allBest.reduce((a, b) => a + (b.score || 0), 0) / allBest.length) : 0,
    quizzes: quizRows,
    competitions: compRows,
    statusCounts,
    lastActive: latest(...students.map((x) => x.lastActive), ...cells.map((c) => c.updated_at || c.created_at), ...subs.map((x) => x.submitted_at)),
    activity: activitySeries(30, {
      cells: cells.map((c) => c.created_at),
      submissions: subs.map((x) => x.submitted_at),
      comments: comments.map((c) => c.created_at),
    }),
  };
}

// ---------- overview ----------
export interface ClassRow {
  id: string;
  code: string;
  title: string;
  teacherName: string;
  teacherId: string | null;
  students: number;
  meetings: number;
  exercises: number;
  cells: number;
  submissions: number;
  solveRate: number;
  lastActive: string | null;
  createdAt: string;
  activity30: number;
}

/** Cheap per-class table (does not run the full classStats for every class). */
export function classRows(ix: Index): ClassRow[] {
  const { data } = ix;
  return data.sessions.map((s) => {
    const full = classStats(ix, s.id)!;
    return {
      id: s.id,
      code: s.code,
      title: s.title,
      teacherName: full.teacherName,
      teacherId: s.created_by,
      students: full.studentCount,
      meetings: full.meetings.length,
      exercises: full.exercises.length,
      cells: full.cellCount,
      submissions: full.submissionCount,
      solveRate: full.solveRate,
      lastActive: full.lastActive,
      createdAt: s.created_at,
      activity30: full.activity.reduce((a, p) => a + p.cells + p.submissions + p.comments, 0),
    };
  });
}

export interface Overview {
  totals: { classes: number; teachers: number; students: number; meetings: number; cells: number; comments: number; exercises: number; submissions: number; quizzes: number; competitions: number };
  active7d: number;
  prevActive7d: number;
  activity: DayPoint[];
  joins: { key: string; label: string; joins: number }[];
  statusCounts: Record<SubStatus, number>;
  correctRate: number;
  topClasses: { id: string; title: string; value: number }[];
  byDifficulty: { label: string; attempts: number; correctRate: number }[];
  recent: { kind: "cell" | "submission" | "comment"; who: string; text: string; at: string; classId?: string }[];
}

export function overview(ix: Index): Overview {
  const { data } = ix;
  const studentIds = new Set<string>();
  data.profiles.forEach((p) => p.role === "student" && studentIds.add(p.user_id));
  data.classMembers.forEach((m) => !ix.teacherIds.has(m.user_id) && studentIds.add(m.user_id));
  const now = Date.now();
  const activeSets = (from: number, to: number) => {
    const s = new Set<string>();
    data.cells.forEach((c) => { const x = t(c.updated_at || c.created_at); if (x >= from && x < to) s.add(c.author_id); });
    data.exSubs.forEach((c) => { const x = t(c.submitted_at); if (x >= from && x < to) s.add(c.user_id); });
    data.comments.forEach((c) => { const x = t(c.created_at); if (x >= from && x < to) s.add(c.author_id); });
    data.classMembers.forEach((c) => { const x = t(c.last_seen_at); if (x >= from && x < to) s.add(c.user_id); });
    return Array.from(s).filter((id) => !ix.teacherIds.has(id)).length;
  };

  const statusCounts: Record<SubStatus, number> = { correct: 0, partial: 0, wrong: 0, error: 0, pending: 0 };
  data.exSubs.forEach((x) => (statusCounts[x.status] = (statusCounts[x.status] || 0) + 1));

  // first time each student appears in any class, per day
  const firstJoin = new Map<string, string>();
  data.classMembers.forEach((m) => {
    const cur = firstJoin.get(m.user_id);
    if (!cur || t(m.joined_at) < t(cur)) firstJoin.set(m.user_id, m.joined_at);
  });
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) days.push(dayKey(now - i * DAY));
  const joinMap = new Map(days.map((d) => [d, 0]));
  firstJoin.forEach((iso, uid) => {
    if (ix.teacherIds.has(uid)) return;
    const k = dayKey(iso);
    if (joinMap.has(k)) joinMap.set(k, (joinMap.get(k) || 0) + 1);
  });

  const rows = classRows(ix);
  const byDiff = [1, 2, 3, 4].map((d) => {
    const ids = new Set(data.exercises.filter((e) => e.difficulty === d).map((e) => e.id));
    const ss = data.exSubs.filter((x) => ids.has(x.exercise_id));
    return { label: DIFF_LABEL[d], attempts: ss.length, correctRate: pct(ss.filter((x) => x.status === "correct").length, ss.length) };
  });

  const recent: Overview["recent"] = [
    ...data.cells.slice(-400).map((c) => ({ kind: "cell" as const, who: c.author_name, text: "سلول کد جدید", at: c.created_at, classId: c.class_id })),
    ...data.exSubs.slice(-400).map((x) => ({
      kind: "submission" as const,
      who: x.author_name,
      text: `پاسخ ${STATUS_LABEL[x.status]} برای «${ix.exerciseById.get(x.exercise_id)?.title || "تمرین"}»`,
      at: x.submitted_at,
      classId: ix.exerciseById.get(x.exercise_id)?.class_id,
    })),
    ...data.comments.slice(-400).map((c) => ({ kind: "comment" as const, who: c.author_name, text: "نظر جدید زیر یک سلول", at: c.created_at })),
  ]
    .sort((a, b) => t(b.at) - t(a.at))
    .slice(0, 12);

  return {
    totals: {
      classes: data.sessions.length,
      teachers: ix.teacherIds.size,
      students: studentIds.size,
      meetings: data.meetings.length,
      cells: data.cells.length,
      comments: data.comments.length,
      exercises: data.exercises.length,
      submissions: data.exSubs.length,
      quizzes: data.quizzes.length,
      competitions: data.competitions.length,
    },
    active7d: activeSets(now - 7 * DAY, now + DAY),
    prevActive7d: activeSets(now - 14 * DAY, now - 7 * DAY),
    activity: activitySeries(30, {
      cells: data.cells.map((c) => c.created_at),
      submissions: data.exSubs.map((x) => x.submitted_at),
      comments: data.comments.map((c) => c.created_at),
    }),
    joins: days.map((k) => ({ key: k, label: dayLabel(k), joins: joinMap.get(k) || 0 })),
    statusCounts,
    correctRate: pct(statusCounts.correct, data.exSubs.length),
    topClasses: rows.sort((a, b) => b.activity30 - a.activity30).slice(0, 6).map((r) => ({ id: r.id, title: r.title, value: r.activity30 })),
    byDifficulty: byDiff,
    recent,
  };
}

// ---------- students ----------
export interface StudentRow {
  userId: string;
  name: string;
  avatar: string | null;
  email: string | null;
  classes: number;
  cells: number;
  attempts: number;
  solved: number;
  avgScore: number;
  lastActive: string | null;
}

export function studentRows(ix: Index): StudentRow[] {
  const { data } = ix;
  const ids = new Set<string>();
  data.profiles.forEach((p) => p.role === "student" && ids.add(p.user_id));
  data.classMembers.forEach((m) => !ix.teacherIds.has(m.user_id) && ids.add(m.user_id));
  const best = bestPerExercise(data.exSubs);
  const bestBy = new Map<string, AdminData["exSubs"]>();
  best.forEach((v) => bestBy.set(v.user_id, [...(bestBy.get(v.user_id) || []), v]));
  const classCount = new Map<string, Set<string>>();
  data.classMembers.forEach((m) => classCount.set(m.user_id, (classCount.get(m.user_id) || new Set()).add(m.class_id)));
  const cellBy = new Map<string, AdminData["cells"]>();
  data.cells.forEach((c) => cellBy.set(c.author_id, [...(cellBy.get(c.author_id) || []), c]));
  const subBy = new Map<string, AdminData["exSubs"]>();
  data.exSubs.forEach((c) => subBy.set(c.user_id, [...(subBy.get(c.user_id) || []), c]));
  const seen = new Map<string, string>();
  data.classMembers.forEach((m) => t(m.last_seen_at) > t(seen.get(m.user_id)) && seen.set(m.user_id, m.last_seen_at));

  return Array.from(ids).map((uid) => {
    const myBest = bestBy.get(uid) || [];
    const myCells = cellBy.get(uid) || [];
    const mySubs = subBy.get(uid) || [];
    return {
      userId: uid,
      name: ix.nameOf(uid),
      avatar: ix.profileById.get(uid)?.avatar || null,
      email: ix.profileById.get(uid)?.email || null,
      classes: classCount.get(uid)?.size || 0,
      cells: myCells.length,
      attempts: mySubs.length,
      solved: myBest.filter((b) => b.status === "correct").length,
      avgScore: myBest.length ? Math.round(myBest.reduce((a, b) => a + (b.score || 0), 0) / myBest.length) : 0,
      lastActive: latest(seen.get(uid), ...myCells.map((c) => c.updated_at || c.created_at), ...mySubs.map((s) => s.submitted_at)),
    };
  });
}

export interface StudentStats {
  row: StudentRow;
  profileRole: string | null;
  joinedAt: string | null;
  classes: { id: string; title: string; code: string; solved: number; totalExercises: number; avgScore: number; cells: number; rank: number; of: number; lastActive: string | null }[];
  statusCounts: Record<SubStatus, number>;
  byDifficulty: { label: string; attempts: number; correctRate: number }[];
  byTopic: { topic: string; attempts: number; correctRate: number }[];
  recentSubs: { title: string; status: SubStatus; score: number; at: string; classTitle: string }[];
  quizzes: { title: string; pct: number; at: string }[];
  commentsWritten: number;
  commentsReceived: number;
  activity: DayPoint[];
}

export function studentStats(ix: Index, userId: string): StudentStats | null {
  const { data } = ix;
  const row = studentRows(ix).find((r) => r.userId === userId);
  if (!row) {
    // e.g. a teacher id or an unknown id
    if (!ix.profileById.has(userId) && !data.classMembers.some((m) => m.user_id === userId)) return null;
  }
  const base: StudentRow = row || { userId, name: ix.nameOf(userId), avatar: ix.profileById.get(userId)?.avatar || null, email: ix.profileById.get(userId)?.email || null, classes: 0, cells: 0, attempts: 0, solved: 0, avgScore: 0, lastActive: null };

  const mySubs = data.exSubs.filter((x) => x.user_id === userId);
  const myCells = data.cells.filter((c) => c.author_id === userId);
  const myCellIds = new Set(myCells.map((c) => c.id));
  const classIds = Array.from(new Set([...data.classMembers.filter((m) => m.user_id === userId).map((m) => m.class_id), ...myCells.map((c) => c.class_id)]));

  const classes = classIds
    .map((cid) => {
      const cs = classStats(ix, cid);
      if (!cs) return null;
      const me = cs.students.find((s) => s.userId === userId);
      const rank = cs.students.findIndex((s) => s.userId === userId) + 1;
      return { id: cid, title: cs.title, code: cs.code, solved: me?.solved || 0, totalExercises: cs.exercises.length, avgScore: me?.avgScore || 0, cells: me?.cells || 0, rank: rank || cs.students.length, of: cs.students.length, lastActive: me?.lastActive || null };
    })
    .filter(Boolean) as StudentStats["classes"];

  const statusCounts: Record<SubStatus, number> = { correct: 0, partial: 0, wrong: 0, error: 0, pending: 0 };
  mySubs.forEach((x) => (statusCounts[x.status] = (statusCounts[x.status] || 0) + 1));

  const exOf = (id: string) => ix.exerciseById.get(id);
  const byDifficulty = [1, 2, 3, 4].map((d) => {
    const ss = mySubs.filter((x) => exOf(x.exercise_id)?.difficulty === d);
    return { label: DIFF_LABEL[d], attempts: ss.length, correctRate: pct(ss.filter((x) => x.status === "correct").length, ss.length) };
  });
  const topics = new Map<string, AdminData["exSubs"]>();
  mySubs.forEach((x) => {
    const tp = (exOf(x.exercise_id)?.topic || "").trim();
    if (tp) topics.set(tp, [...(topics.get(tp) || []), x]);
  });
  const byTopic = Array.from(topics.entries()).map(([topic, ss]) => ({ topic, attempts: ss.length, correctRate: pct(ss.filter((x) => x.status === "correct").length, ss.length) }));

  const myComments = data.comments.filter((c) => c.author_id === userId);
  return {
    row: base,
    profileRole: ix.profileById.get(userId)?.role || null,
    joinedAt: data.classMembers.filter((m) => m.user_id === userId).map((m) => m.joined_at).sort()[0] || null,
    classes,
    statusCounts,
    byDifficulty,
    byTopic,
    recentSubs: [...mySubs]
      .sort((a, b) => t(b.submitted_at) - t(a.submitted_at))
      .slice(0, 12)
      .map((x) => ({ title: exOf(x.exercise_id)?.title || "تمرین حذف‌شده", status: x.status, score: x.score, at: x.submitted_at, classTitle: ix.sessionById.get(exOf(x.exercise_id)?.class_id || "")?.title || "" })),
    quizzes: data.quizAnswers
      .filter((a) => a.user_id === userId)
      .map((a) => ({ title: data.quizzes.find((q) => q.id === a.quiz_id)?.title || "کوییز", pct: pct(a.score, a.total_questions), at: a.submitted_at }))
      .sort((a, b) => t(b.at) - t(a.at)),
    commentsWritten: myComments.length,
    commentsReceived: data.comments.filter((c) => myCellIds.has(c.cell_id) && c.author_id !== userId).length,
    activity: activitySeries(30, { cells: myCells.map((c) => c.created_at), submissions: mySubs.map((x) => x.submitted_at), comments: myComments.map((c) => c.created_at) }),
  };
}
