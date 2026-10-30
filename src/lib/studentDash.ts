import { DIFF_LABEL, DayPoint, STATUS_LABEL, SubStatus, activitySeries, dayKey, pct } from "@/lib/adminStats";
import type { StudentSource } from "@/lib/classData";

const DAY = 86_400_000;
const ts = (iso?: string | null) => (iso ? new Date(iso).getTime() : 0);

export interface StudentDash {
  classes: { id: string; code: string; title: string; solved: number; total: number; avgScore: number; lastSeenAt: string; attention: boolean }[];
  totals: { solved: number; total: number; attempts: number; avgScore: number; cells: number; commentsReceived: number; commentsWritten: number; quizAvg: number | null; quizCount: number };
  xp: number;
  level: number;
  levelProgress: number; // 0..100 toward next level
  xpToNext: number;
  streak: number;
  activeToday: boolean;
  activity: DayPoint[];
  statusCounts: Record<SubStatus, number>;
  byDifficulty: { label: string; attempts: number; correctRate: number }[];
  byTopic: { topic: string; attempts: number; correctRate: number }[];
  deadlines: { id: string; title: string; classTitle: string; classCode: string; dueAt: string; overdue: boolean; difficulty: number | null }[];
  recent: { title: string; classTitle: string; status: SubStatus; score: number; at: string }[];
  quizzes: { title: string; classTitle: string; pct: number; at: string }[];
  competitions: { title: string; classTitle: string; team: string; at: string }[];
}

const XP_PER_LEVEL = 200;

export function buildStudentDash(src: StudentSource): StudentDash {
  const classBy = new Map(src.classes.map((c) => [c.id, c]));
  const exBy = new Map(src.exercises.map((e) => [e.id, e]));

  // best submission per exercise
  const best = new Map<string, StudentSource["subs"][number]>();
  src.subs.forEach((s) => {
    const cur = best.get(s.exercise_id);
    if (!cur || (s.status === "correct" && cur.status !== "correct") || (cur.status !== "correct" && s.score > cur.score)) best.set(s.exercise_id, s);
  });
  const bests = Array.from(best.values());
  const solvedIds = new Set(bests.filter((b) => b.status === "correct").map((b) => b.exercise_id));

  const statusCounts: Record<SubStatus, number> = { correct: 0, partial: 0, wrong: 0, error: 0, pending: 0 };
  src.subs.forEach((s) => (statusCounts[s.status as SubStatus] = (statusCounts[s.status as SubStatus] || 0) + 1));

  const activeQuizIds = new Set(src.quizzes.filter((q) => q.status === "active").map((q) => q.id));
  const answeredQuiz = new Set(src.quizAnswers.map((a) => a.quiz_id));

  const classes = src.classes
    .map((c) => {
      const exs = src.exercises.filter((e) => e.class_id === c.id);
      const mine = exs.map((e) => best.get(e.id)).filter(Boolean) as StudentSource["subs"];
      const attention =
        src.quizzes.some((q) => q.class_id === c.id && activeQuizIds.has(q.id) && !answeredQuiz.has(q.id)) || src.competitions.some((x) => x.class_id === c.id && x.status === "active");
      return {
        id: c.id,
        code: c.code,
        title: c.title,
        solved: exs.filter((e) => solvedIds.has(e.id)).length,
        total: exs.length,
        avgScore: mine.length ? Math.round(mine.reduce((a, b) => a + (b.score || 0), 0) / mine.length) : 0,
        lastSeenAt: c.lastSeenAt,
        attention,
      };
    })
    .sort((a, b) => ts(b.lastSeenAt) - ts(a.lastSeenAt));

  // XP: best score of every exercise + up to 50 per quiz
  const quizPcts = src.quizAnswers.map((a) => pct(a.score, a.total_questions));
  const xp = Math.round(bests.reduce((a, b) => a + (b.score || 0), 0) + quizPcts.reduce((a, p) => a + p / 2, 0));
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;

  // streak: consecutive days (ending today, or yesterday if nothing yet today) with any activity
  const days = new Set<string>();
  src.subs.forEach((s) => days.add(dayKey(s.submitted_at)));
  src.cells.forEach((c) => {
    days.add(dayKey(c.created_at));
    if (c.updated_at) days.add(dayKey(c.updated_at));
  });
  src.commentsWritten.forEach((c) => days.add(dayKey(c.created_at)));
  src.quizAnswers.forEach((a) => days.add(dayKey(a.submitted_at)));
  const activeToday = days.has(dayKey(Date.now()));
  let streak = 0;
  for (let i = activeToday ? 0 : 1; i < 400; i++) {
    if (days.has(dayKey(Date.now() - i * DAY))) streak++;
    else break;
  }

  const diffs = [1, 2, 3, 4].map((d) => {
    const ss = src.subs.filter((s) => exBy.get(s.exercise_id)?.difficulty === d);
    return { label: DIFF_LABEL[d], attempts: ss.length, correctRate: pct(ss.filter((s) => s.status === "correct").length, ss.length) };
  });
  const topics = new Map<string, StudentSource["subs"]>();
  src.subs.forEach((s) => {
    const t = (exBy.get(s.exercise_id)?.topic || "").trim();
    if (t) topics.set(t, [...(topics.get(t) || []), s]);
  });

  const now = Date.now();
  const deadlines = src.exercises
    .filter((e) => e.due_at && !solvedIds.has(e.id) && (!e.opens_at || ts(e.opens_at) <= now))
    .map((e) => ({
      id: e.id,
      title: e.title,
      classTitle: classBy.get(e.class_id)?.title || "",
      classCode: classBy.get(e.class_id)?.code || "",
      dueAt: e.due_at!,
      overdue: ts(e.due_at) < now,
      difficulty: e.difficulty,
    }))
    // upcoming first (soonest), then the overdue ones (most recent first)
    .sort((a, b) => (a.overdue === b.overdue ? (a.overdue ? ts(b.dueAt) - ts(a.dueAt) : ts(a.dueAt) - ts(b.dueAt)) : a.overdue ? 1 : -1))
    .slice(0, 6);

  return {
    classes,
    totals: {
      solved: solvedIds.size,
      total: src.exercises.length,
      attempts: src.subs.length,
      avgScore: bests.length ? Math.round(bests.reduce((a, b) => a + (b.score || 0), 0) / bests.length) : 0,
      cells: src.cells.length,
      commentsReceived: src.commentsReceived.length,
      commentsWritten: src.commentsWritten.length,
      quizAvg: quizPcts.length ? Math.round(quizPcts.reduce((a, b) => a + b, 0) / quizPcts.length) : null,
      quizCount: quizPcts.length,
    },
    xp,
    level,
    levelProgress: Math.round(((xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100),
    xpToNext: XP_PER_LEVEL - (xp % XP_PER_LEVEL),
    streak,
    activeToday,
    activity: activitySeries(30, {
      cells: src.cells.map((c) => c.updated_at || c.created_at),
      submissions: src.subs.map((s) => s.submitted_at),
      comments: src.commentsWritten.map((c) => c.created_at),
    }),
    statusCounts,
    byDifficulty: diffs,
    byTopic: Array.from(topics.entries()).map(([topic, ss]) => ({ topic, attempts: ss.length, correctRate: pct(ss.filter((s) => s.status === "correct").length, ss.length) })),
    deadlines,
    recent: [...src.subs]
      .sort((a, b) => ts(b.submitted_at) - ts(a.submitted_at))
      .slice(0, 8)
      .map((s) => ({
        title: exBy.get(s.exercise_id)?.title || "تمرین",
        classTitle: classBy.get(exBy.get(s.exercise_id)?.class_id || "")?.title || "",
        status: s.status as SubStatus,
        score: s.score,
        at: s.submitted_at,
      })),
    quizzes: src.quizAnswers
      .map((a) => {
        const q = src.quizzes.find((x) => x.id === a.quiz_id);
        return { title: q?.title || "کوییز", classTitle: classBy.get(q?.class_id || "")?.title || "", pct: pct(a.score, a.total_questions), at: a.submitted_at };
      })
      .sort((a, b) => ts(b.at) - ts(a.at))
      .slice(0, 6),
    competitions: src.compSubs
      .map((s) => {
        const c = src.competitions.find((x) => x.id === s.competition_id);
        return { title: c?.title || "مسابقه", classTitle: classBy.get(c?.class_id || "")?.title || "", team: s.team_name, at: s.submitted_at };
      })
      .sort((a, b) => ts(b.at) - ts(a.at))
      .slice(0, 6),
  };
}

export { STATUS_LABEL };
