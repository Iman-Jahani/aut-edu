-- Distinct topics of the shared library, without pulling every row to the browser
-- (Supabase returns at most 1000 rows per request). Safe to re-run.
create or replace function library_topics() returns setof text
language sql stable security definer set search_path = public as $$
  select distinct trim(topic) from shared_exercises
  where topic is not null and trim(topic) <> ''
  order by 1;
$$;
grant execute on function library_topics() to anon, authenticated;
