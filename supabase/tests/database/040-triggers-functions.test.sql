-- Trigger & function existence
create extension if not exists pgtap with schema extensions;

begin;
select no_plan();

-- Functions
select has_function('public', 'touch_course_updated_at_from_lesson', ARRAY[]::text[]);
select has_function('public', 'touch_course_updated_at_from_card', ARRAY[]::text[]);

-- Triggers (by name) via pg_trigger
select ok(exists(select 1 from pg_trigger where tgrelid='public.profiles'::regclass and tgname='trg_profiles_updated_at'), 'profiles trigger exists');
select ok(exists(select 1 from pg_trigger where tgrelid='public.courses'::regclass and tgname='trg_courses_updated_at'), 'courses updated_at trigger exists');
select ok(exists(select 1 from pg_trigger where tgrelid='public.notes'::regclass and tgname='trg_notes_updated_at'), 'notes updated_at trigger exists');
select ok(exists(select 1 from pg_trigger where tgrelid='public.lessons'::regclass and tgname='trg_lessons_touch_course'), 'lessons touch course trigger exists');
select ok(exists(select 1 from pg_trigger where tgrelid='public.cards'::regclass and tgname='trg_cards_touch_course'), 'cards touch course trigger exists');

select * from finish();
rollback;
