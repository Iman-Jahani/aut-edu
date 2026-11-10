-- ===== جزوه (برای هر کلاس، چندتا) و تخته کلاس (برای هر جلسه) =====
-- • «جزوه‌ها»: به کلاس وصلن، هر کلاس چندتا جزوه با عنوان‌های مختلف داره (جدول class_notes).
-- • «تخته کلاس»: به جلسه وصله و می‌شه بعد از کلاس هم آپلودش کرد.
-- فقط معلم‌های همون کلاس (مالک یا همکار) می‌تونن بنویسن/ویرایش/آپلود کنن؛ بقیه فقط می‌خونن و
-- می‌تونن کد رو اجرا کنن (خروجیِ اجرای دانشجو هیچ‌جا ذخیره نمی‌شه، چون اجازه‌ی نوشتن ندارن).
-- این فایل امنه چندبار اجرا بشه، و اگه نسخه‌ی قبلی (جزوه به‌ازای جلسه) رو اجرا کرده بودی ارتقاش می‌ده.

create or replace function is_class_teacher(p_class uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from class_sessions where id = p_class and created_by = auth.uid())
      or exists (select 1 from class_teachers where class_id = p_class and user_id = auth.uid());
$$;

create table if not exists class_notes (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references class_sessions(id) on delete cascade,
  title text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists class_notes_class_idx on class_notes (class_id, created_at);

create table if not exists material_cells (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references class_sessions(id) on delete cascade,
  meeting_id uuid references class_meetings(id) on delete cascade,
  note_id uuid references class_notes(id) on delete cascade,
  kind text not null check (kind in ('notes', 'board')),
  cell_type text not null default 'code' check (cell_type in ('code', 'markdown')),
  source text not null default '',
  output text not null default '',
  position double precision not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists material_files (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references class_sessions(id) on delete cascade,
  meeting_id uuid references class_meetings(id) on delete cascade,
  note_id uuid references class_notes(id) on delete cascade,
  kind text not null check (kind in ('notes', 'board')),
  title text not null,
  storage_path text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- ارتقا از نسخه‌ی قبلی (جزوه به‌ازای جلسه)
alter table material_cells add column if not exists note_id uuid references class_notes(id) on delete cascade;
alter table material_files add column if not exists note_id uuid references class_notes(id) on delete cascade;
alter table material_cells alter column meeting_id drop not null;
alter table material_files alter column meeting_id drop not null;

-- جزوه‌های قدیمیِ وصل‌به‌جلسه → هر جلسه یه جزوه‌ی کلاسی با عنوان همون جلسه
do $$
declare m record; nid uuid;
begin
  for m in
    select distinct meeting_id from (
      select meeting_id from material_cells where kind = 'notes' and note_id is null and meeting_id is not null
      union
      select meeting_id from material_files where kind = 'notes' and note_id is null and meeting_id is not null
    ) x
  loop
    insert into class_notes (class_id, title, created_by)
      select class_id, 'جزوه ' || title, created_by from class_meetings where id = m.meeting_id
      returning id into nid;
    update material_cells set note_id = nid, meeting_id = null where kind = 'notes' and note_id is null and meeting_id = m.meeting_id;
    update material_files set note_id = nid, meeting_id = null where kind = 'notes' and note_id is null and meeting_id = m.meeting_id;
  end loop;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'material_cells_scope_chk') then
    alter table material_cells add constraint material_cells_scope_chk
      check ((kind = 'board' and meeting_id is not null and note_id is null) or (kind = 'notes' and note_id is not null and meeting_id is null));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'material_files_scope_chk') then
    alter table material_files add constraint material_files_scope_chk
      check ((kind = 'board' and meeting_id is not null and note_id is null) or (kind = 'notes' and note_id is not null and meeting_id is null));
  end if;
end $$;

create index if not exists material_cells_meeting_idx on material_cells (meeting_id, kind, position);
create index if not exists material_cells_note_idx on material_cells (note_id, position);
create index if not exists material_files_meeting_idx on material_files (meeting_id, kind);
create index if not exists material_files_note_idx on material_files (note_id);

alter table class_notes enable row level security;
alter table material_cells enable row level security;
alter table material_files enable row level security;

drop policy if exists class_notes_select on class_notes;
drop policy if exists class_notes_insert on class_notes;
drop policy if exists class_notes_update on class_notes;
drop policy if exists class_notes_delete on class_notes;
create policy class_notes_select on class_notes for select to authenticated using (true);
create policy class_notes_insert on class_notes for insert to authenticated with check (is_class_teacher(class_id));
create policy class_notes_update on class_notes for update to authenticated using (is_class_teacher(class_id)) with check (is_class_teacher(class_id));
create policy class_notes_delete on class_notes for delete to authenticated using (is_class_teacher(class_id));

drop policy if exists material_cells_select on material_cells;
drop policy if exists material_cells_insert on material_cells;
drop policy if exists material_cells_update on material_cells;
drop policy if exists material_cells_delete on material_cells;
create policy material_cells_select on material_cells for select to authenticated using (true);
create policy material_cells_insert on material_cells for insert to authenticated with check (is_class_teacher(class_id));
create policy material_cells_update on material_cells for update to authenticated using (is_class_teacher(class_id)) with check (is_class_teacher(class_id));
create policy material_cells_delete on material_cells for delete to authenticated using (is_class_teacher(class_id));

drop policy if exists material_files_select on material_files;
drop policy if exists material_files_insert on material_files;
drop policy if exists material_files_delete on material_files;
create policy material_files_select on material_files for select to authenticated using (true);
create policy material_files_insert on material_files for insert to authenticated with check (is_class_teacher(class_id));
create policy material_files_delete on material_files for delete to authenticated using (is_class_teacher(class_id));

-- فایل‌های PDF: باکت خصوصی؛ مسیر فایل‌ها «<class_id>/<note_id یا meeting_id>/<uuid>.pdf» هست.
insert into storage.buckets (id, name, public) values ('materials', 'materials', false)
on conflict (id) do nothing;

drop policy if exists materials_storage_select on storage.objects;
drop policy if exists materials_storage_insert on storage.objects;
drop policy if exists materials_storage_delete on storage.objects;
create policy materials_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'materials');
create policy materials_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'materials' and is_class_teacher(((storage.foldername(name))[1])::uuid));
create policy materials_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'materials' and is_class_teacher(((storage.foldername(name))[1])::uuid));

-- (اختیاری) آپدیت زنده وقتی معلم سر کلاس تخته رو می‌نویسه:
-- alter publication supabase_realtime add table material_cells;
-- alter publication supabase_realtime add table material_files;
