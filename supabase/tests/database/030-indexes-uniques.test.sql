-- Indexes & unique constraints
create extension if not exists pgtap with schema extensions;

begin;
select no_plan();

-- Existence by name
select ok(exists(select 1 from pg_indexes where schemaname='public' and tablename='courses' and indexname='idx_courses_owner'), 'idx_courses_owner exists');
select ok(exists(select 1 from pg_indexes where schemaname='public' and tablename='courses' and indexname='uq_courses_owner_slug'), 'uq_courses_owner_slug exists');
select ok(exists(select 1 from pg_indexes where schemaname='public' and tablename='lessons' and indexname='idx_lessons_course'), 'idx_lessons_course exists');
select ok(exists(select 1 from pg_indexes where schemaname='public' and tablename='lessons' and indexname='uq_lessons_course_order'), 'uq_lessons_course_order exists');
select ok(exists(select 1 from pg_indexes where schemaname='public' and tablename='cards' and indexname='idx_cards_lesson'), 'idx_cards_lesson exists');
select ok(exists(select 1 from pg_indexes where schemaname='public' and tablename='cards' and indexname='uq_cards_lesson_order'), 'uq_cards_lesson_order exists');
select ok(exists(select 1 from pg_indexes where schemaname='public' and tablename='srs' and indexname='idx_srs_user_due'), 'idx_srs_user_due exists');
select ok(exists(select 1 from pg_indexes where schemaname='public' and tablename='flags' and indexname='idx_flags_card'), 'idx_flags_card exists');
select ok(exists(select 1 from pg_indexes where schemaname='public' and tablename='notes' and indexname='idx_notes_card'), 'idx_notes_card exists');
select ok(exists(select 1 from pg_indexes where schemaname='public' and tablename='ai_drafts' and indexname='idx_ai_drafts_user_kind_created'), 'idx_ai_drafts_user_kind_created exists');

-- Uniqueness
select results_eq(
  $$with x as (
      select i.indisunique as u
      from pg_class t
      join pg_namespace n on n.oid = t.relnamespace
      join pg_index i on i.indrelid = t.oid
      join pg_class ix on ix.oid = i.indexrelid
      where n.nspname='public' and t.relname='courses' and ix.relname='uq_courses_owner_slug'
    ) select u from x$$,
  $$values (true)$$,
  'uq_courses_owner_slug unique'
);

select results_eq(
  $$with y as (
      select i.indisunique as u
      from pg_class t
      join pg_namespace n on n.oid = t.relnamespace
      join pg_index i on i.indrelid = t.oid
      join pg_class ix on ix.oid = i.indexrelid
      where n.nspname='public' and t.relname='lessons' and ix.relname='uq_lessons_course_order'
    ) select u from y$$,
  $$values (true)$$,
  'uq_lessons_course_order unique'
);

select results_eq(
  $$with z as (
      select i.indisunique as u
      from pg_class t
      join pg_namespace n on n.oid = t.relnamespace
      join pg_index i on i.indrelid = t.oid
      join pg_class ix on ix.oid = i.indexrelid
      where n.nspname='public' and t.relname='cards' and ix.relname='uq_cards_lesson_order'
    ) select u from z$$,
  $$values (true)$$,
  'uq_cards_lesson_order unique'
);

select * from finish();
rollback;
