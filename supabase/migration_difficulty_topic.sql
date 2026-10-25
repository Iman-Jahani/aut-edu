-- Run once in the Supabase SQL editor (safe to re-run)
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
