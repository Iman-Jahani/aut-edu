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
