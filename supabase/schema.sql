-- Reference schema, reverse-engineered from the original app's Supabase calls.
-- Your Supabase project already has these tables — this file is just
-- documentation / a starting point if you ever need to recreate them
-- (e.g. in a fresh project) or add the tables for exercises/quizzes/
-- competitions that the old app also used (not yet ported to Next.js).

create table if not exists class_sessions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  title text not null,
  admin_pin_hash text, -- legacy, no longer required; ownership/class_teachers controls access now
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references class_sessions(id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz not null default now(),
  unique (class_id, name)
);

create table if not exists team_members (
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null,
  display_name text not null,
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table if not exists cells (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references class_sessions(id) on delete cascade,
  team_id uuid references teams(id) on delete set null,
  team_name text,
  author_id uuid not null,
  author_name text not null,
  code text default '',
  output text default '',
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references cells(id) on delete cascade,
  author_id uuid not null,
  author_name text not null,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists user_profiles (
  user_id uuid primary key,
  display_name text not null,
  avatar text not null,
  email text,
  role text not null default 'student', -- 'teacher' | 'student', chosen at signup
  updated_at timestamptz not null default now()
);

-- A teacher explicitly granted co-teacher access to someone else's class.
create table if not exists class_teachers (
  class_id uuid not null references class_sessions(id) on delete cascade,
  user_id uuid not null,
  display_name text not null,
  email text,
  added_by uuid,
  added_at timestamptz not null default now(),
  primary key (class_id, user_id)
);

-- Tracks which authenticated (non-owner, non-co-teacher) users have visited a
-- class, so it shows up on their "my classes as a student" dashboard.
create table if not exists class_members (
  class_id uuid not null references class_sessions(id) on delete cascade,
  user_id uuid not null,
  display_name text not null,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (class_id, user_id)
);

create table if not exists shared_exercises (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  hint text,
  test_cases jsonb not null default '[]',
  created_by_name text,
  use_count int default 0,
  created_at timestamptz not null default now()
);

create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references class_sessions(id) on delete cascade,
  title text not null,
  description text,
  hint text,
  test_cases jsonb not null default '[]',
  shared_exercise_id uuid references shared_exercises(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists exercise_submissions (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references exercises(id) on delete cascade,
  user_id uuid not null,
  author_name text not null,
  code text,
  output text,
  status text not null default 'pending',
  score int default 0,
  passed_tests int default 0,
  total_tests int default 0,
  test_results jsonb default '[]',
  submitted_at timestamptz not null default now(),
  unique (exercise_id, user_id)
);



create table if not exists quizzes (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references class_sessions(id) on delete cascade,
  title text not null,
  time_limit int not null default 5, -- minutes
  questions jsonb not null default '[]', -- [{question, options:[...], correct}]
  status text not null default 'draft', -- draft | active | ended
  started_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists quiz_answers (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  user_id uuid not null,
  author_name text not null,
  answers jsonb not null default '[]', -- [selectedOptionIndex, ...]
  score int not null default 0,
  total_questions int not null default 0,
  submitted_at timestamptz not null default now(),
  unique (quiz_id, user_id)
);

-- Enable realtime on quizzes so the active-quiz banner appears instantly:
-- alter publication supabase_realtime add table quizzes;

-- Enable realtime on cells so the workspace updates live:
-- alter publication supabase_realtime add table cells;

-- ===== Competitions =====
create table if not exists competitions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references class_sessions(id) on delete cascade,
  title text not null,
  description text,
  time_limit int not null default 10, -- minutes
  status text not null default 'draft', -- draft | active | ended
  started_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists competition_submissions (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  team_name text not null,
  user_id uuid not null,
  author_name text not null,
  code text,
  submitted_at timestamptz not null default now(),
  submitter_key text not null,
  unique (competition_id, submitter_key)
);

-- ===== Team chat (NEW in the Next.js version) =====
create table if not exists team_messages (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  class_id uuid not null references class_sessions(id) on delete cascade,
  user_id uuid not null,
  author_name text not null,
  avatar text,
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists team_messages_team_created_idx on team_messages (team_id, created_at);

-- RLS: keep the same open policy style as your other tables (adjust to taste), e.g.
-- alter table team_messages enable row level security;
-- create policy "team_messages_all" on team_messages for all using (true) with check (true);

-- Realtime for instant chat + competition banner:
-- alter publication supabase_realtime add table team_messages;
-- alter publication supabase_realtime add table competitions;

-- ===== Cell ordering (insert a cell between others) =====
alter table cells add column if not exists position double precision;

-- ===== Meetings (جلسات) within a class — cells now belong to a meeting =====
create table if not exists class_meetings (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references class_sessions(id) on delete cascade,
  title text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table cells add column if not exists meeting_id uuid references class_meetings(id) on delete cascade;
create index if not exists cells_meeting_idx on cells (meeting_id);

-- One-time backfill: give every class that already has cells a single
-- "جلسه ۱" meeting and attach its existing (meeting_id is null) cells to it.
-- Safe to run multiple times — only touches classes that still have orphan cells.
do $$
declare c record;
declare new_meeting_id uuid;
begin
  for c in (
    select distinct class_id from cells where meeting_id is null
  ) loop
    insert into class_meetings (class_id, title, created_by)
    values (c.class_id, 'جلسه ۱', (select created_by from class_sessions where id = c.class_id))
    returning id into new_meeting_id;

    update cells set meeting_id = new_meeting_id
    where class_id = c.class_id and meeting_id is null;
  end loop;
end $$;

-- ===== Playground — personal sandbox, independent of any class =====
create table if not exists playground_cells (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  code text default '',
  output text default '',
  tags text[] default '{}',
  position double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists playground_cells_user_idx on playground_cells (user_id);

alter table class_meetings enable row level security;
alter table playground_cells enable row level security;

create policy "class_meetings_select" on class_meetings for select using (true);
create policy "class_meetings_insert" on class_meetings for insert
  with check (
    auth.uid() in (select created_by from class_sessions where id = class_meetings.class_id)
    or auth.uid() in (select user_id from class_teachers where class_id = class_meetings.class_id)
  );

create policy "playground_select_own" on playground_cells for select using (auth.uid() = user_id);
create policy "playground_insert_own" on playground_cells for insert with check (auth.uid() = user_id);
create policy "playground_update_own" on playground_cells for update using (auth.uid() = user_id);
create policy "playground_delete_own" on playground_cells for delete using (auth.uid() = user_id);

-- Realtime for live notebook updates within a meeting:
-- alter publication supabase_realtime add table class_meetings;

-- ===== Quiz library (mirrors shared_exercises) =====
create table if not exists shared_quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  time_limit int not null default 5,
  questions jsonb not null default '[]',
  created_by_name text,
  use_count int default 0,
  created_at timestamptz not null default now()
);
alter table quizzes add column if not exists shared_quiz_id uuid references shared_quizzes(id) on delete set null;

-- ===== Exercise schedule (start / deadline) =====
alter table exercises add column if not exists opens_at timestamptz;
alter table exercises add column if not exists due_at timestamptz;

-- The database itself refuses submissions outside the window, so it can't be
-- bypassed from the browser. Empty opens_at / due_at means "no limit".
create or replace function enforce_exercise_window() returns trigger
language plpgsql security definer set search_path = public as $$
declare ex record;
begin
  select opens_at, due_at into ex from exercises where id = new.exercise_id;
  if ex.opens_at is not null and now() < ex.opens_at then
    raise exception 'EXERCISE_NOT_OPEN';
  end if;
  if ex.due_at is not null and now() > ex.due_at then
    raise exception 'EXERCISE_CLOSED';
  end if;
  return new;
end $$;

drop trigger if exists exercise_window_check on exercise_submissions;
create trigger exercise_window_check
  before insert or update on exercise_submissions
  for each row execute function enforce_exercise_window();

-- ===== Exercise difficulty + topic =====
-- difficulty: 1 = Basic, 2 = Easy, 3 = Medium, 4 = Hard (null = not set)
-- topic: free text, e.g. 'Python', 'Mathematics'
alter table shared_exercises add column if not exists difficulty smallint;
alter table shared_exercises add column if not exists topic text;
alter table exercises add column if not exists difficulty smallint;
alter table exercises add column if not exists topic text;

do $$ begin
  alter table shared_exercises add constraint shared_exercises_difficulty_chk check (difficulty is null or difficulty between 1 and 4);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table exercises add constraint exercises_difficulty_chk check (difficulty is null or difficulty between 1 and 4);
exception when duplicate_object then null; end $$;

create index if not exists shared_exercises_difficulty_idx on shared_exercises (difficulty);
create index if not exists shared_exercises_topic_idx on shared_exercises (topic);


-- =====================================================================
-- Teacher invite codes, per-teacher limits, and admin-only library edits
-- Run once in the Supabase SQL editor (safe to re-run).
-- =====================================================================

-- ---------- Invite codes ----------
create table if not exists invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  note text,
  max_uses int not null default 1,
  uses int not null default 0,
  max_classes int,            -- limits copied to the teacher who redeems it (null = unlimited)
  max_meetings int,
  expires_at timestamptz,
  disabled boolean not null default false,
  created_at timestamptz not null default now()
);

-- One row per approved teacher. A teacher account can only exist if it has a row here.
create table if not exists teacher_limits (
  user_id uuid primary key,
  max_classes int,            -- null = unlimited
  max_meetings int,           -- total meetings across all of the teacher's classes; null = unlimited
  invite_code_id uuid references invite_codes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists invite_code_uses (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references invite_codes(id) on delete cascade,
  user_id uuid not null unique,
  used_at timestamptz not null default now()
);

-- No policies for invite_codes / invite_code_uses: only the server (service role) can touch them.
alter table invite_codes enable row level security;
alter table invite_code_uses enable row level security;
alter table teacher_limits enable row level security;
drop policy if exists teacher_limits_select_own on teacher_limits;
create policy teacher_limits_select_own on teacher_limits for select using (auth.uid() = user_id);

-- Teachers that already exist keep working (unlimited until the admin sets limits).
insert into teacher_limits (user_id)
  select user_id from user_profiles where role = 'teacher'
  on conflict (user_id) do nothing;

create or replace function check_invite_code(p_code text) returns boolean
language sql security definer set search_path = public as $$
  select exists (
    select 1 from invite_codes
    where code = upper(trim(p_code)) and not disabled and uses < max_uses
      and (expires_at is null or expires_at > now())
  );
$$;
grant execute on function check_invite_code(text) to anon, authenticated;

create or replace function redeem_invite_code(p_code text) returns void
language plpgsql security definer set search_path = public as $$
declare
  c invite_codes;
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if exists (select 1 from teacher_limits where user_id = uid) then return; end if; -- already a teacher
  select * into c from invite_codes where code = upper(trim(p_code)) for update;
  if not found or c.disabled or c.uses >= c.max_uses or (c.expires_at is not null and c.expires_at <= now()) then
    raise exception 'INVALID_INVITE_CODE';
  end if;
  update invite_codes set uses = uses + 1 where id = c.id;
  insert into teacher_limits (user_id, max_classes, max_meetings, invite_code_id)
    values (uid, c.max_classes, c.max_meetings, c.id);
  insert into invite_code_uses (code_id, user_id) values (c.id, uid);
end $$;
grant execute on function redeem_invite_code(text) to authenticated;

-- ---------- Only approved teachers can hold the 'teacher' role ----------
create or replace function enforce_teacher_invite() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'teacher' and (tg_op = 'INSERT' or old.role is distinct from 'teacher') then
    if not exists (select 1 from teacher_limits where user_id = new.user_id) then
      raise exception 'TEACHER_INVITE_REQUIRED';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists user_profiles_teacher_check on user_profiles;
create trigger user_profiles_teacher_check
  before insert or update on user_profiles
  for each row execute function enforce_teacher_invite();

-- ---------- Per-teacher limits on classes and meetings ----------
create or replace function enforce_class_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare lim int; cnt int;
begin
  if new.created_by is null
     or not exists (select 1 from user_profiles where user_id = new.created_by and role = 'teacher') then
    raise exception 'NOT_TEACHER';
  end if;
  select max_classes into lim from teacher_limits where user_id = new.created_by;
  if lim is not null then
    select count(*) into cnt from class_sessions where created_by = new.created_by;
    if cnt >= lim then raise exception 'CLASS_LIMIT_REACHED'; end if;
  end if;
  return new;
end $$;
drop trigger if exists class_sessions_limit_check on class_sessions;
create trigger class_sessions_limit_check
  before insert on class_sessions
  for each row execute function enforce_class_limit();

-- Meetings count against the CLASS OWNER's limit (co-teachers can create them too).
create or replace function enforce_meeting_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid; lim int; cnt int;
begin
  select created_by into owner from class_sessions where id = new.class_id;
  if owner is null then return new; end if;
  select max_meetings into lim from teacher_limits where user_id = owner;
  if lim is not null then
    select count(*) into cnt from class_meetings m
      join class_sessions s on s.id = m.class_id where s.created_by = owner;
    if cnt >= lim then raise exception 'MEETING_LIMIT_REACHED'; end if;
  end if;
  return new;
end $$;
drop trigger if exists class_meetings_limit_check on class_meetings;
create trigger class_meetings_limit_check
  before insert on class_meetings
  for each row execute function enforce_meeting_limit();

-- ---------- Shared library: everyone reads, teachers add, ONLY the admin API edits/deletes ----------
do $$ declare r record; begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'shared_exercises' loop
    execute format('drop policy %I on shared_exercises', r.policyname);
  end loop;
end $$;
alter table shared_exercises enable row level security;
create policy shared_exercises_select on shared_exercises for select using (true);
create policy shared_exercises_insert on shared_exercises for insert
  with check (exists (select 1 from user_profiles where user_id = auth.uid() and role = 'teacher'));
-- (no update/delete policy on purpose: the service-role key used by /api/admin bypasses RLS)

create or replace function bump_shared_exercise_use(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update shared_exercises set use_count = coalesce(use_count, 0) + 1 where id = p_id;
$$;
grant execute on function bump_shared_exercise_use(uuid) to authenticated;
