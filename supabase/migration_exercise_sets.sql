-- ===== سری تمرین (چند سؤال تحت یک نام مشترک) =====
-- یک «سری» فقط یه گروه‌بندیه: هر سؤال همچنان یک ردیف توی جدول exercises هست (با تست‌ها، ثبت جواب،
-- تصحیح خودکار، آمار و افزودن به کتابخانه مثل قبل). سری‌ها بازه‌ی زمانیِ مشترک دارن که روی همه‌ی سؤال‌هاشون اعمال می‌شه.
-- امنه چندبار اجرا بشه.

create or replace function is_class_teacher(p_class uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from class_sessions where id = p_class and created_by = auth.uid())
      or exists (select 1 from class_teachers where class_id = p_class and user_id = auth.uid());
$$;

create table if not exists exercise_sets (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references class_sessions(id) on delete cascade,
  title text not null,
  description text,
  opens_at timestamptz,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists exercise_sets_class_idx on exercise_sets (class_id, created_at);

-- حذف یک سری، سؤال‌های داخلش (و جواب‌های دانشجوها) رو هم حذف می‌کنه؛ توی UI قبلش تأیید گرفته می‌شه.
alter table exercises add column if not exists set_id uuid references exercise_sets(id) on delete cascade;
create index if not exists exercises_set_idx on exercises (set_id);

alter table exercise_sets enable row level security;
drop policy if exists exercise_sets_select on exercise_sets;
drop policy if exists exercise_sets_insert on exercise_sets;
drop policy if exists exercise_sets_update on exercise_sets;
drop policy if exists exercise_sets_delete on exercise_sets;
create policy exercise_sets_select on exercise_sets for select to authenticated using (true);
create policy exercise_sets_insert on exercise_sets for insert to authenticated with check (is_class_teacher(class_id));
create policy exercise_sets_update on exercise_sets for update to authenticated using (is_class_teacher(class_id)) with check (is_class_teacher(class_id));
create policy exercise_sets_delete on exercise_sets for delete to authenticated using (is_class_teacher(class_id));
