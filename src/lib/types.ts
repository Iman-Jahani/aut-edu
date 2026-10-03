// Hand-written types mirroring the existing Supabase schema used by the
// original admin-5.html / class-23.html. Extend these as you add features
// (exercises, quizzes, competitions, ...).

export interface ClassSession {
  id: string;
  code: string;
  title: string;
  admin_pin_hash: string | null; // legacy — no longer used; ownership now controls teacher access
  created_by: string | null;
  created_at: string;
}

/** A "جلسه" (meeting/lecture) within a class — cells belong to one of these now. */
export interface ClassMeeting {
  id: string;
  class_id: string;
  title: string;
  created_by: string | null;
  created_at: string;
}

export interface PlaygroundCell {
  id: string;
  user_id: string;
  code: string;
  output: string | null;
  tags: string[] | null;
  position: number | null;
  created_at: string;
  updated_at: string | null;
}

export type UserRole = "teacher" | "student";

export interface UserProfile {
  user_id: string;
  display_name: string;
  avatar: string;
  email: string | null;
  role: UserRole;
  updated_at: string;
}

/** A teacher explicitly granted co-teacher access to someone else's class. */
export interface ClassTeacher {
  class_id: string;
  user_id: string;
  display_name: string;
  email: string | null;
  added_by: string;
  added_at: string;
}

/** Tracks which authenticated users have visited/joined a class, for the student dashboard. */
export interface ClassMember {
  class_id: string;
  user_id: string;
  display_name: string;
  joined_at: string;
  last_seen_at: string;
}

export interface Team {
  id: string;
  class_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface TeamMember {
  team_id: string;
  user_id: string;
  display_name: string;
  joined_at: string;
}

export interface Cell {
  id: string;
  class_id: string;
  meeting_id?: string | null;
  team_id: string | null;
  team_name: string | null;
  author_id: string;
  author_name: string;
  /** Merged in client-side from user_profiles; not a real DB column on cells. */
  author_avatar?: string | null;
  code: string;
  output: string | null;
  tags: string[] | null;
  position?: number | null;
  created_at: string;
  updated_at: string | null;
  comments_count?: number;
}

export interface Comment {
  id: string;
  cell_id: string;
  author_id: string;
  author_name: string;
  /** Merged in client-side from user_profiles; not a real DB column on comments. */
  author_avatar?: string | null;
  text: string;
  created_at: string;
}

export interface TestCase {
  input: string;
  expected: string;
}

export interface TestResult {
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
  error?: string | null;
}

export interface Exercise {
  id: string;
  class_id: string;
  title: string;
  description: string | null;
  hint: string | null;
  test_cases: TestCase[];
  shared_exercise_id?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export type SubmissionStatus = "pending" | "correct" | "partial" | "wrong" | "error";

export interface ExerciseSubmission {
  id?: string;
  exercise_id: string;
  user_id: string;
  author_name: string;
  code: string;
  output: string;
  status: SubmissionStatus;
  score: number;
  passed_tests: number;
  total_tests: number;
  test_results: TestResult[];
  submitted_at: string;
}

export interface SharedExercise {
  id: string;
  title: string;
  description: string | null;
  hint: string | null;
  test_cases: TestCase[];
  created_by_name: string | null;
  use_count: number;
  created_at: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
}

export type QuizStatus = "draft" | "active" | "ended";

export interface Quiz {
  id: string;
  class_id: string;
  title: string;
  time_limit: number; // minutes
  questions: QuizQuestion[];
  status: QuizStatus;
  started_at?: string | null;
  created_at: string;
}

export interface QuizAnswer {
  id?: string;
  quiz_id: string;
  user_id: string;
  author_name: string;
  answers: number[];
  score: number;
  total_questions: number;
  submitted_at: string;
}

export type CompetitionStatus = "draft" | "active" | "ended";

export interface Competition {
  id: string;
  class_id: string;
  title: string;
  description: string | null;
  time_limit: number; // minutes
  status: CompetitionStatus;
  started_at?: string | null;
  created_at: string;
}

export interface CompetitionSubmission {
  id?: string;
  competition_id: string;
  team_id: string;
  team_name: string;
  user_id: string;
  author_name: string;
  code: string;
  submitted_at: string;
  submitter_key: string;
}

// Minimal Database type so `createClient<Database>()` gets some type-safety.
// Not exhaustive — add exercises/quizzes/competitions tables here as you
// bring those features over.
export interface Database {
  public: {
    Tables: {
      class_sessions: { Row: ClassSession; Insert: Partial<ClassSession>; Update: Partial<ClassSession> };
      teams: { Row: Team; Insert: Partial<Team>; Update: Partial<Team> };
      team_members: { Row: TeamMember; Insert: Partial<TeamMember>; Update: Partial<TeamMember> };
      cells: { Row: Cell; Insert: Partial<Cell>; Update: Partial<Cell> };
      comments: { Row: Comment; Insert: Partial<Comment>; Update: Partial<Comment> };
      user_profiles: { Row: UserProfile; Insert: Partial<UserProfile>; Update: Partial<UserProfile> };
      class_teachers: { Row: ClassTeacher; Insert: Partial<ClassTeacher>; Update: Partial<ClassTeacher> };
      class_members: { Row: ClassMember; Insert: Partial<ClassMember>; Update: Partial<ClassMember> };
    };
  };
}

export interface TeamMessage {
  id: string;
  team_id: string;
  class_id: string;
  user_id: string;
  author_name: string;
  avatar: string | null;
  text: string;
  created_at: string;
}
