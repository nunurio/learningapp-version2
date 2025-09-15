create type "public"."chat_role" as enum ('user', 'assistant');

create table "public"."chat_messages" (
    "id" uuid not null default gen_random_uuid(),
    "thread_id" uuid not null,
    "user_id" uuid not null,
    "role" chat_role not null,
    "content" text not null,
    "created_at" timestamp with time zone not null default now()
);


alter table "public"."chat_messages" enable row level security;

create table "public"."chat_threads" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "title" text not null default '新しいチャット'::text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
);


alter table "public"."chat_threads" enable row level security;

CREATE UNIQUE INDEX chat_messages_pkey ON public.chat_messages USING btree (id);

CREATE UNIQUE INDEX chat_threads_pkey ON public.chat_threads USING btree (id);

CREATE INDEX idx_chat_messages_thread ON public.chat_messages USING btree (thread_id, created_at);

CREATE INDEX idx_chat_messages_user ON public.chat_messages USING btree (user_id);

CREATE INDEX idx_chat_threads_updated ON public.chat_threads USING btree (updated_at DESC);

CREATE INDEX idx_chat_threads_user ON public.chat_threads USING btree (user_id);

alter table "public"."chat_messages" add constraint "chat_messages_pkey" PRIMARY KEY using index "chat_messages_pkey";

alter table "public"."chat_threads" add constraint "chat_threads_pkey" PRIMARY KEY using index "chat_threads_pkey";

alter table "public"."chat_messages" add constraint "chat_messages_thread_id_fkey" FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE not valid;

alter table "public"."chat_messages" validate constraint "chat_messages_thread_id_fkey";

alter table "public"."chat_messages" add constraint "chat_messages_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."chat_messages" validate constraint "chat_messages_user_id_fkey";

alter table "public"."chat_threads" add constraint "chat_threads_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."chat_threads" validate constraint "chat_threads_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.touch_thread_updated_at_from_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.chat_threads set updated_at = clock_timestamp() where id = new.thread_id;
  return null;
end;
$function$
;

grant delete on table "public"."chat_messages" to "anon";

grant insert on table "public"."chat_messages" to "anon";

grant references on table "public"."chat_messages" to "anon";

grant select on table "public"."chat_messages" to "anon";

grant trigger on table "public"."chat_messages" to "anon";

grant truncate on table "public"."chat_messages" to "anon";

grant update on table "public"."chat_messages" to "anon";

grant delete on table "public"."chat_messages" to "authenticated";

grant insert on table "public"."chat_messages" to "authenticated";

grant references on table "public"."chat_messages" to "authenticated";

grant select on table "public"."chat_messages" to "authenticated";

grant trigger on table "public"."chat_messages" to "authenticated";

grant truncate on table "public"."chat_messages" to "authenticated";

grant update on table "public"."chat_messages" to "authenticated";

grant delete on table "public"."chat_messages" to "service_role";

grant insert on table "public"."chat_messages" to "service_role";

grant references on table "public"."chat_messages" to "service_role";

grant select on table "public"."chat_messages" to "service_role";

grant trigger on table "public"."chat_messages" to "service_role";

grant truncate on table "public"."chat_messages" to "service_role";

grant update on table "public"."chat_messages" to "service_role";

grant delete on table "public"."chat_threads" to "anon";

grant insert on table "public"."chat_threads" to "anon";

grant references on table "public"."chat_threads" to "anon";

grant select on table "public"."chat_threads" to "anon";

grant trigger on table "public"."chat_threads" to "anon";

grant truncate on table "public"."chat_threads" to "anon";

grant update on table "public"."chat_threads" to "anon";

grant delete on table "public"."chat_threads" to "authenticated";

grant insert on table "public"."chat_threads" to "authenticated";

grant references on table "public"."chat_threads" to "authenticated";

grant select on table "public"."chat_threads" to "authenticated";

grant trigger on table "public"."chat_threads" to "authenticated";

grant truncate on table "public"."chat_threads" to "authenticated";

grant update on table "public"."chat_threads" to "authenticated";

grant delete on table "public"."chat_threads" to "service_role";

grant insert on table "public"."chat_threads" to "service_role";

grant references on table "public"."chat_threads" to "service_role";

grant select on table "public"."chat_threads" to "service_role";

grant trigger on table "public"."chat_threads" to "service_role";

grant truncate on table "public"."chat_threads" to "service_role";

grant update on table "public"."chat_threads" to "service_role";

create policy "Chat messages deletable by self"
on "public"."chat_messages"
as permissive
for delete
to public
using ((user_id = auth.uid()));


create policy "Chat messages insertable by self"
on "public"."chat_messages"
as permissive
for insert
to public
with check ((user_id = auth.uid()));


create policy "Chat messages selectable by self"
on "public"."chat_messages"
as permissive
for select
to public
using ((user_id = auth.uid()));


create policy "Chat messages updatable by self"
on "public"."chat_messages"
as permissive
for update
to public
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));


create policy "Chat threads deletable by self"
on "public"."chat_threads"
as permissive
for delete
to public
using ((user_id = auth.uid()));


create policy "Chat threads insertable by self"
on "public"."chat_threads"
as permissive
for insert
to public
with check ((user_id = auth.uid()));


create policy "Chat threads selectable by self"
on "public"."chat_threads"
as permissive
for select
to public
using ((user_id = auth.uid()));


create policy "Chat threads updatable by self"
on "public"."chat_threads"
as permissive
for update
to public
using ((user_id = auth.uid()))
with check ((user_id = auth.uid()));


CREATE TRIGGER trg_chat_messages_touch_thread AFTER INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION touch_thread_updated_at_from_message();

CREATE TRIGGER trg_chat_threads_updated_at BEFORE UPDATE ON public.chat_threads FOR EACH ROW EXECUTE FUNCTION set_updated_at_clock();


