-- ===== جزوه و تخته کلاس (Notes & Board) =====
-- هر جلسه می‌تونه «جزوه» و «تخته کلاس» داشته باشه. فقط معلم‌های همون کلاس (مالک یا همکار)
-- می‌تونن بنویسن/ویرایش/آپلود کنن؛ بقیه فقط می‌خونن و می‌تونن کد رو اجرا کنن (خروجیِ اجرای
-- دانشجو هیچ‌جا ذخیره نمی‌شه، چون دانشجو اصلاً اجازه‌ی نوشتن توی این جدول‌ها رو نداره).

create or replace function is_class_teacher(p_class uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from class_sessions where id = p_class and created_by = auth.uid())
      or exists (select 1 from class_teachers where class_id = p_class and user_id = auth.uid());
$$;

create table if not exists material_cells (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references class_sessions(id) on delete cascade,
  meeting_id uuid not null references class_meetings(id) on delete cascade,
  kind text not null check (kind in ('notes', 'board')),
  cell_type text not null default 'code' check (cell_type in ('code', 'markdown')),
  source text not null default '',
  output text not null default '',
  position double precision not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists material_cells_meeting_idx on material_cells (meeting_id, kind, position);

create table if not exists material_files (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references class_sessions(id) on delete cascade,
  meeting_id uuid not null references class_meetings(id) on delete cascade,
  kind text not null check (kind in ('notes', 'board')),
  title text not null,
  storage_path text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists material_files_meeting_idx on material_files (meeting_id, kind);

alter table material_cells enable row level security;
alter table material_files enable row level security;

create policy material_cells_select on material_cells for select to authenticated using (true);
create policy material_cells_insert on material_cells for insert to authenticated with check (is_class_teacher(class_id));
create policy material_cells_update on material_cells for update to authenticated using (is_class_teacher(class_id)) with check (is_class_teacher(class_id));
create policy material_cells_delete on material_cells for delete to authenticated using (is_class_teacher(class_id));

create policy material_files_select on material_files for select to authenticated using (true);
create policy material_files_insert on material_files for insert to authenticated with check (is_class_teacher(class_id));
create policy material_files_delete on material_files for delete to authenticated using (is_class_teacher(class_id));

-- فایل‌های PDF: باکت خصوصی؛ مسیر فایل‌ها «<class_id>/<meeting_id>/<uuid>.pdf» هست.
insert into storage.buckets (id, name, public) values ('materials', 'materials', false)
on conflict (id) do nothing;

create policy materials_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'materials');
create policy materials_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'materials' and is_class_teacher(((storage.foldername(name))[1])::uuid));
create policy materials_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'materials' and is_class_teacher(((storage.foldername(name))[1])::uuid));

-- (اختیاری) آپدیت زنده برای دانشجوها وقتی معلم سر کلاس تخته رو می‌نویسه:
-- alter publication supabase_realtime add table material_cells;
-- alter publication supabase_realtime add table material_files;
