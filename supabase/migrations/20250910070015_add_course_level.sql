drop trigger if exists "trg_courses_updated_at" on "public"."courses";

drop trigger if exists "trg_notes_updated_at" on "public"."notes";

drop trigger if exists "trg_profiles_updated_at" on "public"."profiles";

alter table "public"."courses" add column "level" text;

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.set_updated_at_clock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.touch_course_updated_at_from_card()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.touch_course_updated_at_from_lesson()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if (tg_op = 'DELETE') then
    update public.courses set updated_at = clock_timestamp() where id = old.course_id;
  else
    update public.courses set updated_at = clock_timestamp() where id = new.course_id;
  end if;
  return null; -- AFTER trigger with no row change
end;
$function$
;

CREATE TRIGGER trg_courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION set_updated_at_clock();

CREATE TRIGGER trg_notes_updated_at BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION set_updated_at_clock();

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at_clock();


