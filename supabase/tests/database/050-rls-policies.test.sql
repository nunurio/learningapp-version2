-- RLS behavior tests (owner/self only) without external helpers
create extension if not exists pgtap with schema extensions;

begin;
select plan(7);

-- Prepare variables
create temporary table __vars (
  u1 uuid,
  u2 uuid,
  course_id uuid,
  lesson_id uuid,
  card_id uuid
);
insert into __vars(u1,u2) values (gen_random_uuid(), gen_random_uuid());

-- Create auth users
insert into auth.users (id) select u1 from __vars;
insert into auth.users (id) select u2 from __vars;

-- Seed data (bypass RLS as superuser)
with v as (select u1 from __vars), ins as (
  insert into public.courses (owner_id, title, status)
  select u1, 'C1', 'draft' from v returning id
)
update __vars set course_id = (select id from ins);

with v as (select course_id from __vars), ins as (
  insert into public.lessons (course_id, title, order_index)
  select course_id, 'L1', 0 from v returning id
)
update __vars set lesson_id = (select id from ins);

with v as (select lesson_id from __vars), ins as (
  insert into public.cards (lesson_id, card_type, title, content, order_index)
  select lesson_id, 'text', 'Card1', jsonb_build_object('body','hi'), 0 from v returning id
)
update __vars set card_id = (select id from ins);

-- Stash ids in GUCs for access after role change
select set_config('test.u1', (select u1::text from __vars), true);
select set_config('test.u2', (select u2::text from __vars), true);
select set_config('test.course', (select course_id::text from __vars), true);
select set_config('test.lesson', (select lesson_id::text from __vars), true);
select set_config('test.card', (select card_id::text from __vars), true);

-- Authenticate as u1
do $$ begin
  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claim.role','authenticated', true);
  perform set_config('request.jwt.claim.sub', current_setting('test.u1'), true);
end $$;
select ok((select count(*) = 1 from public.courses where id = current_setting('test.course')::uuid), 'owner can select own course');
select ok((select count(*) = 1 from public.lessons where id = current_setting('test.lesson')::uuid), 'owner can select lesson');
select ok((select count(*) = 1 from public.cards where id = current_setting('test.card')::uuid), 'owner can select card');

-- Authenticate as u2 and verify cannot see others
do $$ begin
  perform set_config('request.jwt.claim.sub', current_setting('test.u2'), true);
end $$;
select ok((select count(*) = 0 from public.courses where id = current_setting('test.course')::uuid), 'non-owner cannot see course');
select ok((select count(*) = 0 from public.cards where id = current_setting('test.card')::uuid), 'non-owner cannot see card');

-- Insert a progress row for u1
do $$ begin
  perform set_config('request.jwt.claim.role','authenticated', true);
  perform set_config('request.jwt.claim.sub', current_setting('test.u1'), true);
end $$;
insert into public.progress (user_id, card_id, completed)
values (current_setting('test.u1')::uuid, current_setting('test.card')::uuid, true);

-- u1 can see own progress; u2 cannot
do $$ begin
  perform set_config('request.jwt.claim.role','authenticated', true);
  perform set_config('request.jwt.claim.sub', current_setting('test.u1'), true);
end $$;
select ok((select count(*) = 1 from public.progress where user_id = current_setting('test.u1')::uuid and card_id = current_setting('test.card')::uuid), 'owner can see own progress');
do $$ begin
  perform set_config('request.jwt.claim.sub', current_setting('test.u2'), true);
end $$;
select ok((select count(*) = 0 from public.progress where user_id = current_setting('test.u1')::uuid and card_id = current_setting('test.card')::uuid), 'other cannot see progress');

select * from finish();
rollback;
