-- Core tables
-- Aligns with src/lib/types.ts and requirements.md

begin;

-- User profile (1-1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Courses
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  category text,
  level text,
  status public.course_status not null default 'draft',
  slug text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint slug_lowercase check (slug is null or slug = lower(slug))
);

-- Lessons (order within a course)
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  order_index integer not null default 0 check (order_index >= 0),
  created_at timestamptz not null default now()
);

-- Cards (order within a lesson)
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  card_type public.card_type not null,
  title text,
  tags text[] not null default '{}',
  content jsonb not null,
  order_index integer not null default 0 check (order_index >= 0),
  created_at timestamptz not null default now(),
  -- Basic content shape checks by type (app-level validation remains the source of truth)
  constraint content_shape_text check (
    card_type <> 'text' or (content ? 'body')
  ),
  constraint content_shape_quiz check (
    card_type <> 'quiz' or (content ? 'question' and content ? 'options' and content ? 'answerIndex')
  ),
  constraint content_shape_fill check (
    card_type <> 'fill-blank' or (content ? 'text' and content ? 'answers')
  )
);

-- Learning progress per user&card
create table if not exists public.progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  answer jsonb,
  primary key (user_id, card_id)
);

-- SRS scheduling per user&card
create table if not exists public.srs (
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  ease numeric not null check (ease >= 1.3 and ease <= 3.0),
  interval integer not null default 0 check (interval >= 0),
  due date not null,
  last_rating public.srs_rating,
  primary key (user_id, card_id)
);

-- User flags (bookmark-like)
create table if not exists public.flags (
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  flagged_at timestamptz not null default now(),
  primary key (user_id, card_id)
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- AI drafts/previews (Outline / Lesson-Cards)
create table if not exists public.ai_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.ai_draft_kind not null,
  payload jsonb not null,
  thread_id text,
  created_at timestamptz not null default now()
);

-- Chat threads (per-user)
create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '新しいチャット',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Chat messages (belong to a thread; same user_id as owner)
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.chat_role not null,
  content text not null,
  created_at timestamptz not null default now()
);

commit;
