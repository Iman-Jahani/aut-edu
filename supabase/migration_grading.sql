-- ===== تصحیح سمت سرور + تست‌های مخفی/چک‌کننده =====
-- • تصحیح تمرین‌ها حالا توی سرور (/api/grade) انجام می‌شه، نه توی مرورگر دانشجو؛ پس روی هر گوشی کار می‌کنه
--   و دانشجو نمی‌تونه نتیجه رو دستکاری کنه.
-- • تست‌های «مخفی» و «چک‌کننده» (برای سؤال‌های random/شبیه‌سازی) توی exercise_graders ذخیره می‌شن که فقط
--   معلم‌های همون کلاس می‌تونن بخونن؛ سرور با service role می‌خونه. دانشجو هیچ‌وقت به اون‌ها دسترسی نداره.
-- • ثبت پاسخ (exercise_submissions) فقط از سمت سرور انجام می‌شه؛ کلاینت اجازه‌ی نوشتن نداره.
-- امنه چندبار اجرا بشه. اول SUPABASE_SERVICE_ROLE_KEY و اجراکننده‌ی کد (CODE_RUNNER*) رو تنظیم و کد جدید رو
-- دیپلوی کن، بعد این فایل رو اجرا کن (چون بعد از اجراش کلاینتِ قدیمی دیگه نمی‌تونه پاسخ ثبت کنه).

create or replace function is_class_teacher(p_class uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from class_sessions where id = p_class and created_by = auth.uid())
      or exists (select 1 from class_teachers where class_id = p_class and user_id = auth.uid());
$$;

create table if not exists exercise_graders (
  exercise_id uuid primary key references exercises(id) on delete cascade,
  class_id uuid not null references class_sessions(id) on delete cascade,
  tests jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table exercise_graders enable row level security;
drop policy if exists exercise_graders_select on exercise_graders;
drop policy if exists exercise_graders_insert on exercise_graders;
drop policy if exists exercise_graders_update on exercise_graders;
drop policy if exists exercise_graders_delete on exercise_graders;
create policy exercise_graders_select on exercise_graders for select to authenticated using (is_class_teacher(class_id));
create policy exercise_graders_insert on exercise_graders for insert to authenticated with check (is_class_teacher(class_id));
create policy exercise_graders_update on exercise_graders for update to authenticated using (is_class_teacher(class_id)) with check (is_class_teacher(class_id));
create policy exercise_graders_delete on exercise_graders for delete to authenticated using (is_class_teacher(class_id));

-- تعداد تست‌های مخفی (فقط برای نمایش «N تست» به دانشجو؛ خودِ تست‌ها توی exercise_graders هستن)
alter table exercises add column if not exists private_tests int not null default 0;

-- ثبت پاسخ: همه می‌تونن بخونن (آمار/پیشرفت)، ولی نوشتن فقط با service role (سرور تصحیح).
alter table exercise_submissions enable row level security;
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'exercise_submissions' loop
    execute format('drop policy %I on exercise_submissions', p.policyname);
  end loop;
end $$;
create policy exercise_submissions_select on exercise_submissions for select to authenticated using (true);
