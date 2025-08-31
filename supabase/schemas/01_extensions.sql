-- Extensions (idempotent)
-- Supabase recommends keeping extensions under the `extensions` schema.
-- https://supabase.com/docs/guides/database/extensions

begin;

create extension if not exists "uuid-ossp" schema extensions;
create extension if not exists "pgcrypto" schema extensions;
create extension if not exists "moddatetime" schema extensions;
-- Optional (search / case-insensitive text)
-- create extension if not exists "pg_trgm" schema extensions;
-- create extension if not exists "citext" schema extensions;

commit;

