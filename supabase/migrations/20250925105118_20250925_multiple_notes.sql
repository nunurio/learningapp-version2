alter table "public"."notes" drop constraint "notes_pkey";

drop index if exists "public"."notes_pkey";

alter table "public"."notes" add column "created_at" timestamp with time zone not null default now();

alter table "public"."notes" add column "id" uuid not null default gen_random_uuid();

CREATE INDEX idx_notes_user_card_created_at ON public.notes USING btree (user_id, card_id, created_at DESC);

CREATE UNIQUE INDEX notes_pkey ON public.notes USING btree (id);

alter table "public"."notes" add constraint "notes_pkey" PRIMARY KEY using index "notes_pkey";


