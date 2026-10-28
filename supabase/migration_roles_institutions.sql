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
