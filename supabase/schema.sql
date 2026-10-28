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


-- =====================================================================
-- Notifications for new comments on code cells
-- Run once in the Supabase SQL editor (safe to re-run).
-- =====================================================================

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,                 -- who gets notified
  kind text not null default 'comment',
  class_id uuid,
  class_code text,
  class_title text,
  meeting_id uuid,
  meeting_title text,
  cell_id uuid references cells(id) on delete cascade,
  comment_id uuid references comments(id) on delete cascade,
  cell_author_id uuid,
  cell_author_name text,
  actor_id uuid,                         -- who wrote the comment
  actor_name text,
  preview text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_created_idx on notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx on notifications (user_id) where read_at is null;

alter table notifications enable row level security;
drop policy if exists notifications_select_own on notifications;
drop policy if exists notifications_update_own on notifications;
drop policy if exists notifications_delete_own on notifications;
create policy notifications_select_own on notifications for select using (auth.uid() = user_id);
create policy notifications_update_own on notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy notifications_delete_own on notifications for delete using (auth.uid() = user_id);
-- No insert policy: rows are only created by the trigger below.

-- Who is notified when someone comments on a cell:
--   the cell's author, the members of the cell's team (team cells), and everyone who already
--   commented on that cell (so replies reach the teacher / the student they are talking to).
--   The commenter is never notified about their own comment.
create or replace function notify_on_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c record;
  cls record;
  mtitle text;
  r record;
begin
  select id, class_id, meeting_id, team_id, author_id, author_name into c from cells where id = new.cell_id;
  if not found then return new; end if;
  select code, title into cls from class_sessions where id = c.class_id;
  if c.meeting_id is not null then
    select title into mtitle from class_meetings where id = c.meeting_id;
  end if;

  for r in
    select distinct s.uid from (
      select c.author_id as uid
      union select user_id from team_members where c.team_id is not null and team_id = c.team_id
      union select author_id from comments where cell_id = new.cell_id
    ) s
    where s.uid is not null and s.uid <> new.author_id
  loop
    insert into notifications (
      user_id, kind, class_id, class_code, class_title, meeting_id, meeting_title,
      cell_id, comment_id, cell_author_id, cell_author_name, actor_id, actor_name, preview
    ) values (
      r.uid, 'comment', c.class_id, cls.code, cls.title, c.meeting_id, mtitle,
      new.cell_id, new.id, c.author_id, c.author_name, new.author_id, new.author_name, left(new.text, 160)
    );
  end loop;
  return new;
end $$;

drop trigger if exists comments_notify on comments;
create trigger comments_notify
  after insert on comments
  for each row execute function notify_on_comment();

-- Realtime: instant bell updates + live comments inside an open panel.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table notifications;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comments') then
    alter publication supabase_realtime add table comments;
  end if;
end $$;


-- =====================================================================
-- Roles (admin / manager / teacher / student), institutions, and invite codes per role.
-- Run once in the Supabase SQL editor AFTER migration_teacher_invites_and_library_lock.sql
-- (safe to re-run).
--
-- First admin: run this once with your own email, then manage everyone else from /admin/users:
--   update user_profiles set role = 'admin' where email = 'you@example.com';
-- (or set ADMIN_EMAILS in the server environment and just open /admin).
-- =====================================================================

-- ---------- Institutions ----------
create table if not exists institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  max_teachers int,                 -- seat cap for teachers (null = unlimited)
  created_at timestamptz not null default now()
);
alter table institutions enable row level security;   -- no policies: only the server (service role) touches it

alter table user_profiles add column if not exists institution_id uuid references institutions(id) on delete set null;

-- 'role' is now one of: admin | manager | teacher | student (drop any old CHECK that only allowed two)
do $$ declare r record; begin
  for r in select conname from pg_constraint
           where conrelid = 'user_profiles'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%role%'
  loop execute format('alter table user_profiles drop constraint %I', r.conname); end loop;
end $$;

-- ---------- Invite codes now carry a role and a destination ----------
alter table invite_codes add column if not exists role text not null default 'teacher';
alter table invite_codes add column if not exists institution_id uuid references institutions(id) on delete cascade;
alter table invite_codes add column if not exists new_institution_name text;   -- manager code: create this institution on first use
alter table invite_codes add column if not exists created_by uuid;
do $$ begin
  alter table invite_codes add constraint invite_codes_role_chk check (role in ('teacher', 'manager'));
exception when duplicate_object then null; end $$;

-- ---------- Who has been granted a staff role (teacher / manager) and where ----------
create table if not exists role_grants (
  user_id uuid primary key,
  role text not null check (role in ('teacher', 'manager')),
  institution_id uuid references institutions(id) on delete set null,
  invite_code_id uuid references invite_codes(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table role_grants enable row level security;    -- no policies: only the server / SECURITY DEFINER functions

-- teachers that already exist keep working (independent, no institution)
insert into role_grants (user_id, role)
  select user_id, 'teacher' from user_profiles where role = 'teacher'
  on conflict (user_id) do nothing;

-- ---------- Code checking / redeeming ----------
drop function if exists check_invite_code(text);
create or replace function check_invite_code(p_code text) returns json
language sql security definer set search_path = public as $$
  select json_build_object('role', c.role, 'institution_name', coalesce(i.name, c.new_institution_name))
  from invite_codes c
  left join institutions i on i.id = c.institution_id
  where c.code = upper(trim(p_code)) and not c.disabled and c.uses < c.max_uses
    and (c.expires_at is null or c.expires_at > now())
    and (
      c.role <> 'teacher' or c.institution_id is null or i.max_teachers is null
      or (select count(*) from role_grants g where g.institution_id = c.institution_id and g.role = 'teacher') < i.max_teachers
    );
$$;
grant execute on function check_invite_code(text) to anon, authenticated;

drop function if exists redeem_invite_code(text);
create or replace function redeem_invite_code(p_code text, p_role text default null) returns text
language plpgsql security definer set search_path = public as $$
declare
  c invite_codes;
  g role_grants;
  uid uuid := auth.uid();
  inst uuid;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into g from role_grants where user_id = uid;
  if found then return g.role; end if;                       -- already approved (idempotent)

  select * into c from invite_codes where code = upper(trim(p_code)) for update;
  if not found or c.disabled or c.uses >= c.max_uses or (c.expires_at is not null and c.expires_at <= now()) then
    raise exception 'INVALID_INVITE_CODE';
  end if;
  if p_role is not null and p_role <> c.role then raise exception 'INVITE_ROLE_MISMATCH'; end if;

  inst := c.institution_id;
  if c.role = 'manager' and inst is null then
    if coalesce(trim(c.new_institution_name), '') = '' then raise exception 'INVALID_INVITE_CODE'; end if;
    insert into institutions (name) values (trim(c.new_institution_name)) returning id into inst;
    update invite_codes set institution_id = inst where id = c.id;   -- later redeemers join the same institution
  end if;
  if c.role = 'teacher' and inst is not null then
    if exists (
      select 1 from institutions i
      where i.id = inst and i.max_teachers is not null
        and (select count(*) from role_grants g2 where g2.institution_id = inst and g2.role = 'teacher') >= i.max_teachers
    ) then raise exception 'INSTITUTION_FULL'; end if;
  end if;

  update invite_codes set uses = uses + 1 where id = c.id;
  insert into role_grants (user_id, role, institution_id, invite_code_id) values (uid, c.role, inst, c.id);
  if c.role = 'teacher' then
    insert into teacher_limits (user_id, max_classes, max_meetings, invite_code_id)
      values (uid, c.max_classes, c.max_meetings, c.id)
      on conflict (user_id) do nothing;
  end if;
  insert into invite_code_uses (code_id, user_id) values (c.id, uid) on conflict (user_id) do nothing;
  return c.role;
end $$;
grant execute on function redeem_invite_code(text, text) to authenticated;

-- ---------- Guard: nobody can promote themselves ----------
-- The JWT role of the caller: 'anon' / 'authenticated' for the website, 'service_role' for our
-- server API, and NULL in the SQL editor. Only the latter two count as privileged.
create or replace function _jwt_role() returns text language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'), '')
  );
$$;

create or replace function guard_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  g role_grants;
  privileged boolean := coalesce(_jwt_role(), '') not in ('anon', 'authenticated');
begin
  if not privileged then
    if new.role = 'admin' and (tg_op = 'INSERT' or old.role is distinct from 'admin') then
      raise exception 'ADMIN_ROLE_RESTRICTED';
    end if;
    if new.role in ('teacher', 'manager') and (tg_op = 'INSERT' or old.role is distinct from new.role) then
      select * into g from role_grants where user_id = new.user_id;
      if not found or g.role <> new.role then raise exception 'ROLE_INVITE_REQUIRED'; end if;
    end if;
  end if;
  -- the institution always follows the grant; clients can't set it themselves
  new.institution_id := (select institution_id from role_grants where user_id = new.user_id and role = new.role);
  return new;
end $$;

drop trigger if exists user_profiles_teacher_check on user_profiles;
drop trigger if exists user_profiles_role_guard on user_profiles;
create trigger user_profiles_role_guard
  before insert or update on user_profiles
  for each row execute function guard_profile_role();
