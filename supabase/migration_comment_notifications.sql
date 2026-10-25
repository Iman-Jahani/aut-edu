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
