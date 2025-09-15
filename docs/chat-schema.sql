-- Chat tables (threads + messages)
-- Execute in Supabase SQL editor or via migration tool.

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null default '新しいチャット',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

-- Basic RLS policies (per-user isolation)
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;

create policy if not exists "own-threads"
  on public.chat_threads for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy if not exists "own-messages"
  on public.chat_messages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end
$$ language plpgsql;

drop trigger if exists chat_threads_set_updated_at on public.chat_threads;
create trigger chat_threads_set_updated_at
before update on public.chat_threads
for each row
execute function public.set_updated_at();

