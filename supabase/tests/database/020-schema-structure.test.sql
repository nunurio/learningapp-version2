-- Structural checks: tables, primary keys, essential columns
create extension if not exists pgtap with schema extensions;

begin;
select no_plan();

-- Tables exist (to_regclass)
select ok(to_regclass('public.profiles') is not null, 'table public.profiles exists');
select ok(to_regclass('public.courses')  is not null, 'table public.courses exists');
select ok(to_regclass('public.lessons')  is not null, 'table public.lessons exists');
select ok(to_regclass('public.cards')    is not null, 'table public.cards exists');
select ok(to_regclass('public.progress') is not null, 'table public.progress exists');
select ok(to_regclass('public.srs')      is not null, 'table public.srs exists');
select ok(to_regclass('public.flags')    is not null, 'table public.flags exists');
select ok(to_regclass('public.notes')    is not null, 'table public.notes exists');
select ok(to_regclass('public.ai_drafts') is not null, 'table public.ai_drafts exists');

-- Primary keys (columns)
select ok((
  with pk_cols as (
    select c.relname as tbl, array_agg(a.attname order by a.attnum) as cols
    from pg_index i
    join pg_class c on c.oid = i.indrelid
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
    where i.indisprimary
    group by c.relname
  ) select (cols = ARRAY['id']::name[]) from pk_cols where tbl = 'profiles'
), 'profiles pk is (id)');
select ok((
  with pk_cols as (
    select c.relname as tbl, array_agg(a.attname order by a.attnum) as cols
    from pg_index i
    join pg_class c on c.oid = i.indrelid
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
    where i.indisprimary
    group by c.relname
  ) select (cols = ARRAY['id']::name[]) from pk_cols where tbl = 'courses'
), 'courses pk is (id)');
select ok((
  with pk_cols as (
    select c.relname as tbl, array_agg(a.attname order by a.attnum) as cols
    from pg_index i
    join pg_class c on c.oid = i.indrelid
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
    where i.indisprimary
    group by c.relname
  ) select (cols = ARRAY['id']::name[]) from pk_cols where tbl = 'lessons'
), 'lessons pk is (id)');
select ok((
  with pk_cols as (
    select c.relname as tbl, array_agg(a.attname order by a.attnum) as cols
    from pg_index i
    join pg_class c on c.oid = i.indrelid
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
    where i.indisprimary
    group by c.relname
  ) select (cols = ARRAY['id']::name[]) from pk_cols where tbl = 'cards'
), 'cards pk is (id)');
select ok((
  with pk_cols as (
    select c.relname as tbl, array_agg(a.attname order by a.attnum) as cols
    from pg_index i
    join pg_class c on c.oid = i.indrelid
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
    where i.indisprimary
    group by c.relname
  ) select (cols = ARRAY['user_id','card_id']::name[]) from pk_cols where tbl = 'progress'
), 'progress pk');
select ok((
  with pk_cols as (
    select c.relname as tbl, array_agg(a.attname order by a.attnum) as cols
    from pg_index i
    join pg_class c on c.oid = i.indrelid
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
    where i.indisprimary
    group by c.relname
  ) select (cols = ARRAY['user_id','card_id']::name[]) from pk_cols where tbl = 'srs'
), 'srs pk');
select ok((
  with pk_cols as (
    select c.relname as tbl, array_agg(a.attname order by a.attnum) as cols
    from pg_index i
    join pg_class c on c.oid = i.indrelid
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
    where i.indisprimary
    group by c.relname
  ) select (cols = ARRAY['user_id','card_id']::name[]) from pk_cols where tbl = 'flags'
), 'flags pk');
select ok((
  with pk_cols as (
    select c.relname as tbl, array_agg(a.attname order by a.attnum) as cols
    from pg_index i
    join pg_class c on c.oid = i.indrelid
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
    where i.indisprimary
    group by c.relname
  ) select (cols::text[] = ARRAY['user_id','card_id']::text[]) from pk_cols where tbl = 'notes'
), 'notes pk');
select ok((
  with pk_cols as (
    select c.relname as tbl, array_agg(a.attname order by a.attnum) as cols
    from pg_index i
    join pg_class c on c.oid = i.indrelid
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
    where i.indisprimary
    group by c.relname
  ) select (cols::text[] = ARRAY['id']::text[]) from pk_cols where tbl = 'ai_drafts'
), 'ai_drafts pk (id)');

-- Column types (subset)
create temporary table __coltypes as
select n.nspname as sch, c.relname as tbl, a.attname as col, format_type(a.atttypid, a.atttypmod) as typ
from pg_attribute a
join pg_class c on c.oid = a.attrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname='public' and a.attnum>0 and not a.attisdropped;

select ok((select typ='uuid' from __coltypes where tbl='courses' and col='owner_id'), 'courses.owner_id uuid');
select ok((select typ='course_status' from __coltypes where tbl='courses' and col='status'), 'courses.status enum');
select ok((select typ='text' from __coltypes where tbl='courses' and col='slug'), 'courses.slug text');
select ok((select typ='uuid' from __coltypes where tbl='lessons' and col='course_id'), 'lessons.course_id uuid');
select ok((select typ='integer' from __coltypes where tbl='lessons' and col='order_index'), 'lessons.order_index int');
select ok((select typ='uuid' from __coltypes where tbl='cards' and col='lesson_id'), 'cards.lesson_id uuid');
select ok((select typ='card_type' from __coltypes where tbl='cards' and col='card_type'), 'cards.card_type enum');
select ok((select typ='text[]' from __coltypes where tbl='cards' and col='tags'), 'cards.tags text[]');
select ok((select typ='jsonb' from __coltypes where tbl='cards' and col='content'), 'cards.content jsonb');
select ok((select typ='numeric' from __coltypes where tbl='srs' and col='ease'), 'srs.ease numeric');
select ok((select typ='date' from __coltypes where tbl='srs' and col='due'), 'srs.due date');

-- Not null expectations (subset)
select ok((
  with nn as (
    select table_name, column_name, is_nullable
    from information_schema.columns
    where table_schema='public'
  ) select (is_nullable='NO') from nn where table_name='courses' and column_name='owner_id'
), 'courses.owner_id not null');
select ok((
  with nn as (
    select table_name, column_name, is_nullable
    from information_schema.columns
    where table_schema='public'
  ) select (is_nullable='NO') from nn where table_name='courses' and column_name='title'
), 'courses.title not null');
select ok((
  with nn as (
    select table_name, column_name, is_nullable
    from information_schema.columns
    where table_schema='public'
  ) select (is_nullable='NO') from nn where table_name='lessons' and column_name='course_id'
), 'lessons.course_id not null');
select ok((
  with nn as (
    select table_name, column_name, is_nullable
    from information_schema.columns
    where table_schema='public'
  ) select (is_nullable='NO') from nn where table_name='lessons' and column_name='title'
), 'lessons.title not null');
select ok((
  with nn as (
    select table_name, column_name, is_nullable
    from information_schema.columns
    where table_schema='public'
  ) select (is_nullable='NO') from nn where table_name='cards' and column_name='lesson_id'
), 'cards.lesson_id not null');
select ok((
  with nn as (
    select table_name, column_name, is_nullable
    from information_schema.columns
    where table_schema='public'
  ) select (is_nullable='NO') from nn where table_name='cards' and column_name='card_type'
), 'cards.card_type not null');
select ok((
  with nn as (
    select table_name, column_name, is_nullable
    from information_schema.columns
    where table_schema='public'
  ) select (is_nullable='NO') from nn where table_name='cards' and column_name='content'
), 'cards.content not null');
select ok((
  with nn as (
    select table_name, column_name, is_nullable
    from information_schema.columns
    where table_schema='public'
  ) select (is_nullable='NO') from nn where table_name='progress' and column_name='user_id'
), 'progress.user_id not null');
select ok((
  with nn as (
    select table_name, column_name, is_nullable
    from information_schema.columns
    where table_schema='public'
  ) select (is_nullable='NO') from nn where table_name='progress' and column_name='card_id'
), 'progress.card_id not null');

-- Check constraints
select ok(exists (
  select 1 from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname='public' and rel.relname='courses' and con.conname='slug_lowercase'
), 'courses has slug_lowercase check');

select * from finish();
rollback;
