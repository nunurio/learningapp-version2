-- Verify required extensions and enums exist with expected labels
create extension if not exists pgtap with schema extensions;

begin;
select no_plan();

-- Extensions (existence)
select ok(exists(select 1 from pg_extension where extname = 'uuid-ossp'), 'uuid-ossp extension exists');
select ok(exists(select 1 from pg_extension where extname = 'pgcrypto'), 'pgcrypto extension exists');
select ok(exists(select 1 from pg_extension where extname = 'moddatetime'), 'moddatetime extension exists');

-- Enums (existence + labels)
select ok(exists(
  select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' and t.typname = 'course_status'
), 'enum public.course_status exists');
select enum_has_labels('public', 'course_status', array['draft','published']);

select ok(exists(
  select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' and t.typname = 'card_type'
), 'enum public.card_type exists');
select enum_has_labels('public', 'card_type', array['text','quiz','fill-blank']);

select ok(exists(
  select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' and t.typname = 'srs_rating'
), 'enum public.srs_rating exists');
select enum_has_labels('public', 'srs_rating', array['again','hard','good','easy']);

select ok(exists(
  select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' and t.typname = 'ai_draft_kind'
), 'enum public.ai_draft_kind exists');
select enum_has_labels('public', 'ai_draft_kind', array['outline','lesson-cards']);

select * from finish();
rollback;
