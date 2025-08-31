-- Enumerated types (idempotent via DO blocks)

do $$ begin
  if not exists (select 1 from pg_type t where t.typname = 'course_status') then
    create type public.course_status as enum ('draft','published');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type t where t.typname = 'card_type') then
    create type public.card_type as enum ('text','quiz','fill-blank');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type t where t.typname = 'srs_rating') then
    create type public.srs_rating as enum ('again','hard','good','easy');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type t where t.typname = 'ai_draft_kind') then
    create type public.ai_draft_kind as enum ('outline','lesson-cards');
  end if;
end $$;

