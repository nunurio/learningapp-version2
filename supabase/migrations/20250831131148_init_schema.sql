create extension if not exists "moddatetime" with schema "extensions";

create type "public"."ai_draft_kind" as enum ('outline', 'lesson-cards');

create type "public"."card_type" as enum ('text', 'quiz', 'fill-blank');

create type "public"."course_status" as enum ('draft', 'published');

create type "public"."srs_rating" as enum ('again', 'hard', 'good', 'easy');


  create table "public"."ai_drafts" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "kind" ai_draft_kind not null,
    "payload" jsonb not null,
    "thread_id" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."ai_drafts" enable row level security;


  create table "public"."cards" (
    "id" uuid not null default gen_random_uuid(),
    "lesson_id" uuid not null,
    "card_type" card_type not null,
    "title" text,
    "tags" text[] not null default '{}'::text[],
    "content" jsonb not null,
    "order_index" integer not null default 0,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."cards" enable row level security;


  create table "public"."courses" (
    "id" uuid not null default gen_random_uuid(),
    "owner_id" uuid not null,
    "title" text not null,
    "description" text,
    "category" text,
    "status" course_status not null default 'draft'::course_status,
    "slug" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."courses" enable row level security;


  create table "public"."flags" (
    "user_id" uuid not null,
    "card_id" uuid not null,
    "flagged_at" timestamp with time zone not null default now()
      );


alter table "public"."flags" enable row level security;


  create table "public"."lessons" (
    "id" uuid not null default gen_random_uuid(),
    "course_id" uuid not null,
    "title" text not null,
    "order_index" integer not null default 0,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."lessons" enable row level security;


  create table "public"."notes" (
    "user_id" uuid not null,
    "card_id" uuid not null,
    "text" text not null default ''::text,
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."notes" enable row level security;


  create table "public"."profiles" (
    "id" uuid not null,
    "display_name" text,
    "avatar_url" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."profiles" enable row level security;


  create table "public"."progress" (
    "user_id" uuid not null,
    "card_id" uuid not null,
    "completed" boolean not null default false,
    "completed_at" timestamp with time zone,
    "answer" jsonb
      );


alter table "public"."progress" enable row level security;


  create table "public"."srs" (
    "user_id" uuid not null,
    "card_id" uuid not null,
    "ease" numeric not null,
    "interval" integer not null default 0,
    "due" date not null,
    "last_rating" srs_rating
      );


alter table "public"."srs" enable row level security;

CREATE UNIQUE INDEX ai_drafts_pkey ON public.ai_drafts USING btree (id);

CREATE UNIQUE INDEX cards_pkey ON public.cards USING btree (id);

CREATE UNIQUE INDEX courses_pkey ON public.courses USING btree (id);

CREATE UNIQUE INDEX flags_pkey ON public.flags USING btree (user_id, card_id);

CREATE INDEX idx_ai_drafts_user_kind_created ON public.ai_drafts USING btree (user_id, kind, created_at DESC);

CREATE INDEX idx_cards_lesson ON public.cards USING btree (lesson_id);

CREATE INDEX idx_courses_owner ON public.courses USING btree (owner_id);

CREATE INDEX idx_flags_card ON public.flags USING btree (card_id);

CREATE INDEX idx_lessons_course ON public.lessons USING btree (course_id);

CREATE INDEX idx_notes_card ON public.notes USING btree (card_id);

CREATE INDEX idx_progress_card ON public.progress USING btree (card_id);

CREATE INDEX idx_srs_user_due ON public.srs USING btree (user_id, due);

CREATE UNIQUE INDEX lessons_pkey ON public.lessons USING btree (id);

CREATE UNIQUE INDEX notes_pkey ON public.notes USING btree (user_id, card_id);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);

CREATE UNIQUE INDEX progress_pkey ON public.progress USING btree (user_id, card_id);

CREATE UNIQUE INDEX srs_pkey ON public.srs USING btree (user_id, card_id);

CREATE UNIQUE INDEX uq_cards_lesson_order ON public.cards USING btree (lesson_id, order_index);

CREATE UNIQUE INDEX uq_courses_owner_slug ON public.courses USING btree (owner_id, slug) WHERE (slug IS NOT NULL);

CREATE UNIQUE INDEX uq_lessons_course_order ON public.lessons USING btree (course_id, order_index);

alter table "public"."ai_drafts" add constraint "ai_drafts_pkey" PRIMARY KEY using index "ai_drafts_pkey";

alter table "public"."cards" add constraint "cards_pkey" PRIMARY KEY using index "cards_pkey";

alter table "public"."courses" add constraint "courses_pkey" PRIMARY KEY using index "courses_pkey";

alter table "public"."flags" add constraint "flags_pkey" PRIMARY KEY using index "flags_pkey";

alter table "public"."lessons" add constraint "lessons_pkey" PRIMARY KEY using index "lessons_pkey";

alter table "public"."notes" add constraint "notes_pkey" PRIMARY KEY using index "notes_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."progress" add constraint "progress_pkey" PRIMARY KEY using index "progress_pkey";

alter table "public"."srs" add constraint "srs_pkey" PRIMARY KEY using index "srs_pkey";

alter table "public"."ai_drafts" add constraint "ai_drafts_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."ai_drafts" validate constraint "ai_drafts_user_id_fkey";

alter table "public"."cards" add constraint "cards_lesson_id_fkey" FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE not valid;

alter table "public"."cards" validate constraint "cards_lesson_id_fkey";

alter table "public"."cards" add constraint "cards_order_index_check" CHECK ((order_index >= 0)) not valid;

alter table "public"."cards" validate constraint "cards_order_index_check";

alter table "public"."cards" add constraint "content_shape_fill" CHECK (((card_type <> 'fill-blank'::card_type) OR ((content ? 'text'::text) AND (content ? 'answers'::text)))) not valid;

alter table "public"."cards" validate constraint "content_shape_fill";

alter table "public"."cards" add constraint "content_shape_quiz" CHECK (((card_type <> 'quiz'::card_type) OR ((content ? 'question'::text) AND (content ? 'options'::text) AND (content ? 'answerIndex'::text)))) not valid;

alter table "public"."cards" validate constraint "content_shape_quiz";

alter table "public"."cards" add constraint "content_shape_text" CHECK (((card_type <> 'text'::card_type) OR (content ? 'body'::text))) not valid;

alter table "public"."cards" validate constraint "content_shape_text";

alter table "public"."courses" add constraint "courses_owner_id_fkey" FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."courses" validate constraint "courses_owner_id_fkey";

alter table "public"."courses" add constraint "slug_lowercase" CHECK (((slug IS NULL) OR (slug = lower(slug)))) not valid;

alter table "public"."courses" validate constraint "slug_lowercase";

alter table "public"."flags" add constraint "flags_card_id_fkey" FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE not valid;

alter table "public"."flags" validate constraint "flags_card_id_fkey";

alter table "public"."flags" add constraint "flags_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."flags" validate constraint "flags_user_id_fkey";

alter table "public"."lessons" add constraint "lessons_course_id_fkey" FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE not valid;

alter table "public"."lessons" validate constraint "lessons_course_id_fkey";

alter table "public"."lessons" add constraint "lessons_order_index_check" CHECK ((order_index >= 0)) not valid;

alter table "public"."lessons" validate constraint "lessons_order_index_check";

alter table "public"."notes" add constraint "notes_card_id_fkey" FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE not valid;

alter table "public"."notes" validate constraint "notes_card_id_fkey";

alter table "public"."notes" add constraint "notes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."notes" validate constraint "notes_user_id_fkey";

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

alter table "public"."progress" add constraint "progress_card_id_fkey" FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE not valid;

alter table "public"."progress" validate constraint "progress_card_id_fkey";

alter table "public"."progress" add constraint "progress_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."progress" validate constraint "progress_user_id_fkey";

alter table "public"."srs" add constraint "srs_card_id_fkey" FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE not valid;

alter table "public"."srs" validate constraint "srs_card_id_fkey";

alter table "public"."srs" add constraint "srs_ease_check" CHECK (((ease >= 1.3) AND (ease <= 3.0))) not valid;

alter table "public"."srs" validate constraint "srs_ease_check";

alter table "public"."srs" add constraint "srs_interval_check" CHECK (("interval" >= 0)) not valid;

alter table "public"."srs" validate constraint "srs_interval_check";

alter table "public"."srs" add constraint "srs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."srs" validate constraint "srs_user_id_fkey";

set check_function_bodies = off;

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
    update public.courses set updated_at = now() where id = v_course_id;
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
    update public.courses set updated_at = now() where id = old.course_id;
  else
    update public.courses set updated_at = now() where id = new.course_id;
  end if;
  return null; -- AFTER trigger with no row change
end;
$function$
;

grant delete on table "public"."ai_drafts" to "anon";

grant insert on table "public"."ai_drafts" to "anon";

grant references on table "public"."ai_drafts" to "anon";

grant select on table "public"."ai_drafts" to "anon";

grant trigger on table "public"."ai_drafts" to "anon";

grant truncate on table "public"."ai_drafts" to "anon";

grant update on table "public"."ai_drafts" to "anon";

grant delete on table "public"."ai_drafts" to "authenticated";

grant insert on table "public"."ai_drafts" to "authenticated";

grant references on table "public"."ai_drafts" to "authenticated";

grant select on table "public"."ai_drafts" to "authenticated";

grant trigger on table "public"."ai_drafts" to "authenticated";

grant truncate on table "public"."ai_drafts" to "authenticated";

grant update on table "public"."ai_drafts" to "authenticated";

grant delete on table "public"."ai_drafts" to "service_role";

grant insert on table "public"."ai_drafts" to "service_role";

grant references on table "public"."ai_drafts" to "service_role";

grant select on table "public"."ai_drafts" to "service_role";

grant trigger on table "public"."ai_drafts" to "service_role";

grant truncate on table "public"."ai_drafts" to "service_role";

grant update on table "public"."ai_drafts" to "service_role";

grant delete on table "public"."cards" to "anon";

grant insert on table "public"."cards" to "anon";

grant references on table "public"."cards" to "anon";

grant select on table "public"."cards" to "anon";

grant trigger on table "public"."cards" to "anon";

grant truncate on table "public"."cards" to "anon";

grant update on table "public"."cards" to "anon";

grant delete on table "public"."cards" to "authenticated";

grant insert on table "public"."cards" to "authenticated";

grant references on table "public"."cards" to "authenticated";

grant select on table "public"."cards" to "authenticated";

grant trigger on table "public"."cards" to "authenticated";

grant truncate on table "public"."cards" to "authenticated";

grant update on table "public"."cards" to "authenticated";

grant delete on table "public"."cards" to "service_role";

grant insert on table "public"."cards" to "service_role";

grant references on table "public"."cards" to "service_role";

grant select on table "public"."cards" to "service_role";

grant trigger on table "public"."cards" to "service_role";

grant truncate on table "public"."cards" to "service_role";

grant update on table "public"."cards" to "service_role";

grant delete on table "public"."courses" to "anon";

grant insert on table "public"."courses" to "anon";

grant references on table "public"."courses" to "anon";

grant select on table "public"."courses" to "anon";

grant trigger on table "public"."courses" to "anon";

grant truncate on table "public"."courses" to "anon";

grant update on table "public"."courses" to "anon";

grant delete on table "public"."courses" to "authenticated";

grant insert on table "public"."courses" to "authenticated";

grant references on table "public"."courses" to "authenticated";

grant select on table "public"."courses" to "authenticated";

grant trigger on table "public"."courses" to "authenticated";

grant truncate on table "public"."courses" to "authenticated";

grant update on table "public"."courses" to "authenticated";

grant delete on table "public"."courses" to "service_role";

grant insert on table "public"."courses" to "service_role";

grant references on table "public"."courses" to "service_role";

grant select on table "public"."courses" to "service_role";

grant trigger on table "public"."courses" to "service_role";

grant truncate on table "public"."courses" to "service_role";

grant update on table "public"."courses" to "service_role";

grant delete on table "public"."flags" to "anon";

grant insert on table "public"."flags" to "anon";

grant references on table "public"."flags" to "anon";

grant select on table "public"."flags" to "anon";

grant trigger on table "public"."flags" to "anon";

grant truncate on table "public"."flags" to "anon";

grant update on table "public"."flags" to "anon";

grant delete on table "public"."flags" to "authenticated";

grant insert on table "public"."flags" to "authenticated";

grant references on table "public"."flags" to "authenticated";

grant select on table "public"."flags" to "authenticated";

grant trigger on table "public"."flags" to "authenticated";

grant truncate on table "public"."flags" to "authenticated";

grant update on table "public"."flags" to "authenticated";

grant delete on table "public"."flags" to "service_role";

grant insert on table "public"."flags" to "service_role";

grant references on table "public"."flags" to "service_role";

grant select on table "public"."flags" to "service_role";

grant trigger on table "public"."flags" to "service_role";

grant truncate on table "public"."flags" to "service_role";

grant update on table "public"."flags" to "service_role";

grant delete on table "public"."lessons" to "anon";

grant insert on table "public"."lessons" to "anon";

grant references on table "public"."lessons" to "anon";

grant select on table "public"."lessons" to "anon";

grant trigger on table "public"."lessons" to "anon";

grant truncate on table "public"."lessons" to "anon";

grant update on table "public"."lessons" to "anon";

grant delete on table "public"."lessons" to "authenticated";

grant insert on table "public"."lessons" to "authenticated";

grant references on table "public"."lessons" to "authenticated";

grant select on table "public"."lessons" to "authenticated";

grant trigger on table "public"."lessons" to "authenticated";

grant truncate on table "public"."lessons" to "authenticated";

grant update on table "public"."lessons" to "authenticated";

grant delete on table "public"."lessons" to "service_role";

grant insert on table "public"."lessons" to "service_role";

grant references on table "public"."lessons" to "service_role";

grant select on table "public"."lessons" to "service_role";

grant trigger on table "public"."lessons" to "service_role";

grant truncate on table "public"."lessons" to "service_role";

grant update on table "public"."lessons" to "service_role";

grant delete on table "public"."notes" to "anon";

grant insert on table "public"."notes" to "anon";

grant references on table "public"."notes" to "anon";

grant select on table "public"."notes" to "anon";

grant trigger on table "public"."notes" to "anon";

grant truncate on table "public"."notes" to "anon";

grant update on table "public"."notes" to "anon";

grant delete on table "public"."notes" to "authenticated";

grant insert on table "public"."notes" to "authenticated";

grant references on table "public"."notes" to "authenticated";

grant select on table "public"."notes" to "authenticated";

grant trigger on table "public"."notes" to "authenticated";

grant truncate on table "public"."notes" to "authenticated";

grant update on table "public"."notes" to "authenticated";

grant delete on table "public"."notes" to "service_role";

grant insert on table "public"."notes" to "service_role";

grant references on table "public"."notes" to "service_role";

grant select on table "public"."notes" to "service_role";

grant trigger on table "public"."notes" to "service_role";

grant truncate on table "public"."notes" to "service_role";

grant update on table "public"."notes" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant references on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant trigger on table "public"."profiles" to "anon";

grant truncate on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant references on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant trigger on table "public"."profiles" to "authenticated";

grant truncate on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant references on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant trigger on table "public"."profiles" to "service_role";

grant truncate on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."progress" to "anon";

grant insert on table "public"."progress" to "anon";

grant references on table "public"."progress" to "anon";

grant select on table "public"."progress" to "anon";

grant trigger on table "public"."progress" to "anon";

grant truncate on table "public"."progress" to "anon";

grant update on table "public"."progress" to "anon";

grant delete on table "public"."progress" to "authenticated";

grant insert on table "public"."progress" to "authenticated";

grant references on table "public"."progress" to "authenticated";

grant select on table "public"."progress" to "authenticated";

grant trigger on table "public"."progress" to "authenticated";

grant truncate on table "public"."progress" to "authenticated";

grant update on table "public"."progress" to "authenticated";

grant delete on table "public"."progress" to "service_role";

grant insert on table "public"."progress" to "service_role";

grant references on table "public"."progress" to "service_role";

grant select on table "public"."progress" to "service_role";

grant trigger on table "public"."progress" to "service_role";

grant truncate on table "public"."progress" to "service_role";

grant update on table "public"."progress" to "service_role";

grant delete on table "public"."srs" to "anon";

grant insert on table "public"."srs" to "anon";

grant references on table "public"."srs" to "anon";

grant select on table "public"."srs" to "anon";

grant trigger on table "public"."srs" to "anon";

grant truncate on table "public"."srs" to "anon";

grant update on table "public"."srs" to "anon";

grant delete on table "public"."srs" to "authenticated";

grant insert on table "public"."srs" to "authenticated";

grant references on table "public"."srs" to "authenticated";

grant select on table "public"."srs" to "authenticated";

grant trigger on table "public"."srs" to "authenticated";

grant truncate on table "public"."srs" to "authenticated";

grant update on table "public"."srs" to "authenticated";

grant delete on table "public"."srs" to "service_role";

grant insert on table "public"."srs" to "service_role";

grant references on table "public"."srs" to "service_role";

grant select on table "public"."srs" to "service_role";

grant trigger on table "public"."srs" to "service_role";

grant truncate on table "public"."srs" to "service_role";

grant update on table "public"."srs" to "service_role";


  create policy "AI drafts deletable by self"
  on "public"."ai_drafts"
  as permissive
  for delete
  to public
using ((user_id = auth.uid()));



  create policy "AI drafts insertable by self"
  on "public"."ai_drafts"
  as permissive
  for insert
  to public
with check ((user_id = auth.uid()));



  create policy "AI drafts selectable by self"
  on "public"."ai_drafts"
  as permissive
  for select
  to public
using ((user_id = auth.uid()));



  create policy "AI drafts updatable by self"
  on "public"."ai_drafts"
  as permissive
  for update
  to public
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));



  create policy "Cards deletable by course owner"
  on "public"."cards"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM (lessons l
     JOIN courses c ON ((c.id = l.course_id)))
  WHERE ((l.id = cards.lesson_id) AND (c.owner_id = auth.uid())))));



  create policy "Cards insertable by course owner"
  on "public"."cards"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM (lessons l
     JOIN courses c ON ((c.id = l.course_id)))
  WHERE ((l.id = cards.lesson_id) AND (c.owner_id = auth.uid())))));



  create policy "Cards selectable by course owner"
  on "public"."cards"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM (lessons l
     JOIN courses c ON ((c.id = l.course_id)))
  WHERE ((l.id = cards.lesson_id) AND (c.owner_id = auth.uid())))));



  create policy "Cards updatable by course owner"
  on "public"."cards"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM (lessons l
     JOIN courses c ON ((c.id = l.course_id)))
  WHERE ((l.id = cards.lesson_id) AND (c.owner_id = auth.uid())))))
with check ((EXISTS ( SELECT 1
   FROM (lessons l
     JOIN courses c ON ((c.id = l.course_id)))
  WHERE ((l.id = cards.lesson_id) AND (c.owner_id = auth.uid())))));



  create policy "Courses are owner-deletable"
  on "public"."courses"
  as permissive
  for delete
  to public
using ((owner_id = auth.uid()));



  create policy "Courses are owner-insertable"
  on "public"."courses"
  as permissive
  for insert
  to public
with check ((owner_id = auth.uid()));



  create policy "Courses are owner-selectable"
  on "public"."courses"
  as permissive
  for select
  to public
using ((owner_id = auth.uid()));



  create policy "Courses are owner-updatable"
  on "public"."courses"
  as permissive
  for update
  to public
using ((owner_id = auth.uid()))
with check ((owner_id = auth.uid()));



  create policy "Flags deletable by self"
  on "public"."flags"
  as permissive
  for delete
  to public
using ((user_id = auth.uid()));



  create policy "Flags insertable by self"
  on "public"."flags"
  as permissive
  for insert
  to public
with check ((user_id = auth.uid()));



  create policy "Flags selectable by self"
  on "public"."flags"
  as permissive
  for select
  to public
using ((user_id = auth.uid()));



  create policy "Flags updatable by self"
  on "public"."flags"
  as permissive
  for update
  to public
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));



  create policy "Lessons deletable by course owner"
  on "public"."lessons"
  as permissive
  for delete
  to public
using ((EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = lessons.course_id) AND (c.owner_id = auth.uid())))));



  create policy "Lessons insertable by course owner"
  on "public"."lessons"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = lessons.course_id) AND (c.owner_id = auth.uid())))));



  create policy "Lessons selectable by course owner"
  on "public"."lessons"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = lessons.course_id) AND (c.owner_id = auth.uid())))));



  create policy "Lessons updatable by course owner"
  on "public"."lessons"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = lessons.course_id) AND (c.owner_id = auth.uid())))))
with check ((EXISTS ( SELECT 1
   FROM courses c
  WHERE ((c.id = lessons.course_id) AND (c.owner_id = auth.uid())))));



  create policy "Notes deletable by self"
  on "public"."notes"
  as permissive
  for delete
  to public
using ((user_id = auth.uid()));



  create policy "Notes insertable by self"
  on "public"."notes"
  as permissive
  for insert
  to public
with check ((user_id = auth.uid()));



  create policy "Notes selectable by self"
  on "public"."notes"
  as permissive
  for select
  to public
using ((user_id = auth.uid()));



  create policy "Notes updatable by self"
  on "public"."notes"
  as permissive
  for update
  to public
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));



  create policy "Profiles are self-deletable"
  on "public"."profiles"
  as permissive
  for delete
  to public
using ((id = auth.uid()));



  create policy "Profiles are self-insertable"
  on "public"."profiles"
  as permissive
  for insert
  to public
with check ((id = auth.uid()));



  create policy "Profiles are self-selectable"
  on "public"."profiles"
  as permissive
  for select
  to public
using ((id = auth.uid()));



  create policy "Profiles are self-updatable"
  on "public"."profiles"
  as permissive
  for update
  to public
using ((id = auth.uid()))
with check ((id = auth.uid()));



  create policy "Progress deletable by self"
  on "public"."progress"
  as permissive
  for delete
  to public
using ((user_id = auth.uid()));



  create policy "Progress insertable by self"
  on "public"."progress"
  as permissive
  for insert
  to public
with check ((user_id = auth.uid()));



  create policy "Progress selectable by self"
  on "public"."progress"
  as permissive
  for select
  to public
using ((user_id = auth.uid()));



  create policy "Progress updatable by self"
  on "public"."progress"
  as permissive
  for update
  to public
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));



  create policy "SRS deletable by self"
  on "public"."srs"
  as permissive
  for delete
  to public
using ((user_id = auth.uid()));



  create policy "SRS insertable by self"
  on "public"."srs"
  as permissive
  for insert
  to public
with check ((user_id = auth.uid()));



  create policy "SRS selectable by self"
  on "public"."srs"
  as permissive
  for select
  to public
using ((user_id = auth.uid()));



  create policy "SRS updatable by self"
  on "public"."srs"
  as permissive
  for update
  to public
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));


CREATE TRIGGER trg_cards_touch_course AFTER INSERT OR DELETE OR UPDATE ON public.cards FOR EACH ROW EXECUTE FUNCTION touch_course_updated_at_from_card();

CREATE TRIGGER trg_courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');

CREATE TRIGGER trg_lessons_touch_course AFTER INSERT OR DELETE OR UPDATE ON public.lessons FOR EACH ROW EXECUTE FUNCTION touch_course_updated_at_from_lesson();

CREATE TRIGGER trg_notes_updated_at BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');


