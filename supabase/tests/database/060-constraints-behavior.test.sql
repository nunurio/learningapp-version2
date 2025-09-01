-- Constraint behavior: CHECKs, content shape, srs ranges
create extension if not exists pgtap with schema extensions;

begin;
select plan(6);

-- IDs via session GUCs (no temp tables)
do $$ begin
  perform set_config('c.u', gen_random_uuid()::text, true);
  perform set_config('c.course', gen_random_uuid()::text, true);
  perform set_config('c.lesson', gen_random_uuid()::text, true);
  perform set_config('c.card', gen_random_uuid()::text, true);
end $$;

-- Create user and authenticate to satisfy RLS
insert into auth.users (id) values (current_setting('c.u')::uuid);
do $$ begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', current_setting('c.u'), true);
end $$;

-- 1) courses.slug_lowercase CHECK (23514)
select throws_ok($$
  insert into public.courses (owner_id, title, slug)
  values (current_setting('c.u')::uuid, 'T', 'ABC')
$$);

-- Seed course/lesson for card tests
insert into public.courses (id, owner_id, title)
values (current_setting('c.course')::uuid, current_setting('c.u')::uuid, 'C');
insert into public.lessons (id, course_id, title, order_index)
values (current_setting('c.lesson')::uuid, current_setting('c.course')::uuid, 'L', 0);

-- 2) cards.content shape checks (23514)
select throws_ok($$
  insert into public.cards (lesson_id, card_type, title, content, order_index)
  values (current_setting('c.lesson')::uuid, 'text', 'bad', '{}'::jsonb, 0)
$$);

select throws_ok($$
  insert into public.cards (lesson_id, card_type, title, content, order_index)
  values (current_setting('c.lesson')::uuid, 'quiz', 'bad', '{"question":"q"}'::jsonb, 1)
$$);

select throws_ok($$
  insert into public.cards (lesson_id, card_type, title, content, order_index)
  values (current_setting('c.lesson')::uuid, 'fill-blank', 'bad', '{"text":"x"}'::jsonb, 2)
$$);

-- Seed valid card
insert into public.cards (id, lesson_id, card_type, title, content, order_index)
values (current_setting('c.card')::uuid, current_setting('c.lesson')::uuid, 'text', 'ok', '{"body":"x"}'::jsonb, 0);

-- 3) srs range checks (23514)
select throws_ok($$
  insert into public.srs (user_id, card_id, ease, interval, due)
  values (current_setting('c.u')::uuid, current_setting('c.card')::uuid, 1.0, 0, current_date)
$$);

select throws_ok($$
  insert into public.srs (user_id, card_id, ease, interval, due)
  values (current_setting('c.u')::uuid, current_setting('c.card')::uuid, 2.5, -1, current_date)
$$);

select * from finish();
rollback;
