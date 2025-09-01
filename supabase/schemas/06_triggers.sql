-- Triggers & functions

begin;

-- Ensure a consistent updated_at based on wall-clock time (not tx start)
create or replace function public.set_updated_at_clock() returns trigger as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$ language plpgsql security definer set search_path=public;

-- Use moddatetime to auto-update updated_at
drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at_clock();

drop trigger if exists trg_courses_updated_at on public.courses;
create trigger trg_courses_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at_clock();

drop trigger if exists trg_notes_updated_at on public.notes;
create trigger trg_notes_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at_clock();

-- Touch parent course.updated_at when lessons/cards change
create or replace function public.touch_course_updated_at_from_lesson() returns trigger as $$
begin
  if (tg_op = 'DELETE') then
    update public.courses set updated_at = clock_timestamp() where id = old.course_id;
  else
    update public.courses set updated_at = clock_timestamp() where id = new.course_id;
  end if;
  return null; -- AFTER trigger with no row change
end;
$$ language plpgsql security definer set search_path=public;

drop trigger if exists trg_lessons_touch_course on public.lessons;
create trigger trg_lessons_touch_course
  after insert or update or delete on public.lessons
  for each row execute function public.touch_course_updated_at_from_lesson();

create or replace function public.touch_course_updated_at_from_card() returns trigger as $$
declare
  v_course_id uuid;
begin
  if (tg_op = 'DELETE') then
    select l.course_id into v_course_id from public.lessons l where l.id = old.lesson_id;
  else
    select l.course_id into v_course_id from public.lessons l where l.id = new.lesson_id;
  end if;
  if v_course_id is not null then
    update public.courses set updated_at = clock_timestamp() where id = v_course_id;
  end if;
  return null; -- AFTER trigger
end;
$$ language plpgsql security definer set search_path=public;

drop trigger if exists trg_cards_touch_course on public.cards;
create trigger trg_cards_touch_course
  after insert or update or delete on public.cards
  for each row execute function public.touch_course_updated_at_from_card();

commit;
