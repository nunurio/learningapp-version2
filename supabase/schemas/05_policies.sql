-- Row Level Security policies
-- Principle: private-by-default. Only the owner (auth.uid()) can access their data.

begin;

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.courses  enable row level security;
alter table public.lessons  enable row level security;
alter table public.cards    enable row level security;
alter table public.progress enable row level security;
alter table public.srs      enable row level security;
alter table public.flags    enable row level security;
alter table public.notes    enable row level security;
alter table public.ai_drafts enable row level security;

-- Profiles: 1:1 with auth.users (self-only)
drop policy if exists "Profiles are self-selectable" on public.profiles;
create policy "Profiles are self-selectable" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "Profiles are self-updatable" on public.profiles;
create policy "Profiles are self-updatable" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Profiles are self-insertable" on public.profiles;
create policy "Profiles are self-insertable" on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists "Profiles are self-deletable" on public.profiles;
create policy "Profiles are self-deletable" on public.profiles
  for delete using (id = auth.uid());

-- Courses: owner-only
drop policy if exists "Courses are owner-selectable" on public.courses;
create policy "Courses are owner-selectable" on public.courses
  for select using (owner_id = auth.uid());

drop policy if exists "Courses are owner-updatable" on public.courses;
create policy "Courses are owner-updatable" on public.courses
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "Courses are owner-insertable" on public.courses;
create policy "Courses are owner-insertable" on public.courses
  for insert with check (owner_id = auth.uid());

drop policy if exists "Courses are owner-deletable" on public.courses;
create policy "Courses are owner-deletable" on public.courses
  for delete using (owner_id = auth.uid());

-- Lessons: join to courses for ownership
drop policy if exists "Lessons selectable by course owner" on public.lessons;
create policy "Lessons selectable by course owner" on public.lessons
  for select using (
    exists (
      select 1 from public.courses c
      where c.id = lessons.course_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "Lessons updatable by course owner" on public.lessons;
create policy "Lessons updatable by course owner" on public.lessons
  for update using (
    exists (
      select 1 from public.courses c
      where c.id = lessons.course_id and c.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.courses c
      where c.id = lessons.course_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "Lessons insertable by course owner" on public.lessons;
create policy "Lessons insertable by course owner" on public.lessons
  for insert with check (
    exists (
      select 1 from public.courses c
      where c.id = lessons.course_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "Lessons deletable by course owner" on public.lessons;
create policy "Lessons deletable by course owner" on public.lessons
  for delete using (
    exists (
      select 1 from public.courses c
      where c.id = lessons.course_id and c.owner_id = auth.uid()
    )
  );

-- Cards: join to lessons->courses for ownership
drop policy if exists "Cards selectable by course owner" on public.cards;
create policy "Cards selectable by course owner" on public.cards
  for select using (
    exists (
      select 1 from public.lessons l
      join public.courses c on c.id = l.course_id
      where l.id = cards.lesson_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "Cards updatable by course owner" on public.cards;
create policy "Cards updatable by course owner" on public.cards
  for update using (
    exists (
      select 1 from public.lessons l
      join public.courses c on c.id = l.course_id
      where l.id = cards.lesson_id and c.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.lessons l
      join public.courses c on c.id = l.course_id
      where l.id = cards.lesson_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "Cards insertable by course owner" on public.cards;
create policy "Cards insertable by course owner" on public.cards
  for insert with check (
    exists (
      select 1 from public.lessons l
      join public.courses c on c.id = l.course_id
      where l.id = cards.lesson_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "Cards deletable by course owner" on public.cards;
create policy "Cards deletable by course owner" on public.cards
  for delete using (
    exists (
      select 1 from public.lessons l
      join public.courses c on c.id = l.course_id
      where l.id = cards.lesson_id and c.owner_id = auth.uid()
    )
  );

-- Progress (per-user)
drop policy if exists "Progress selectable by self" on public.progress;
create policy "Progress selectable by self" on public.progress
  for select using (user_id = auth.uid());

drop policy if exists "Progress updatable by self" on public.progress;
create policy "Progress updatable by self" on public.progress
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Progress insertable by self" on public.progress;
create policy "Progress insertable by self" on public.progress
  for insert with check (user_id = auth.uid());

drop policy if exists "Progress deletable by self" on public.progress;
create policy "Progress deletable by self" on public.progress
  for delete using (user_id = auth.uid());

-- SRS (per-user)
drop policy if exists "SRS selectable by self" on public.srs;
create policy "SRS selectable by self" on public.srs
  for select using (user_id = auth.uid());

drop policy if exists "SRS updatable by self" on public.srs;
create policy "SRS updatable by self" on public.srs
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "SRS insertable by self" on public.srs;
create policy "SRS insertable by self" on public.srs
  for insert with check (user_id = auth.uid());

drop policy if exists "SRS deletable by self" on public.srs;
create policy "SRS deletable by self" on public.srs
  for delete using (user_id = auth.uid());

-- Flags (per-user)
drop policy if exists "Flags selectable by self" on public.flags;
create policy "Flags selectable by self" on public.flags
  for select using (user_id = auth.uid());

drop policy if exists "Flags updatable by self" on public.flags;
create policy "Flags updatable by self" on public.flags
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Flags insertable by self" on public.flags;
create policy "Flags insertable by self" on public.flags
  for insert with check (user_id = auth.uid());

drop policy if exists "Flags deletable by self" on public.flags;
create policy "Flags deletable by self" on public.flags
  for delete using (user_id = auth.uid());

-- Notes (per-user)
drop policy if exists "Notes selectable by self" on public.notes;
create policy "Notes selectable by self" on public.notes
  for select using (user_id = auth.uid());

drop policy if exists "Notes updatable by self" on public.notes;
create policy "Notes updatable by self" on public.notes
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "Notes insertable by self" on public.notes;
create policy "Notes insertable by self" on public.notes
  for insert with check (user_id = auth.uid());

drop policy if exists "Notes deletable by self" on public.notes;
create policy "Notes deletable by self" on public.notes
  for delete using (user_id = auth.uid());

-- AI drafts (per-user)
drop policy if exists "AI drafts selectable by self" on public.ai_drafts;
create policy "AI drafts selectable by self" on public.ai_drafts
  for select using (user_id = auth.uid());

drop policy if exists "AI drafts updatable by self" on public.ai_drafts;
create policy "AI drafts updatable by self" on public.ai_drafts
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "AI drafts insertable by self" on public.ai_drafts;
create policy "AI drafts insertable by self" on public.ai_drafts
  for insert with check (user_id = auth.uid());

drop policy if exists "AI drafts deletable by self" on public.ai_drafts;
create policy "AI drafts deletable by self" on public.ai_drafts
  for delete using (user_id = auth.uid());

commit;

