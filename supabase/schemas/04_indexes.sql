-- Helpful indexes & unique constraints

begin;

-- Courses
create index if not exists idx_courses_owner on public.courses (owner_id);
create unique index if not exists uq_courses_owner_slug on public.courses (owner_id, slug) where slug is not null;

-- Lessons
create index if not exists idx_lessons_course on public.lessons (course_id);
create unique index if not exists uq_lessons_course_order on public.lessons (course_id, order_index);

-- Cards
create index if not exists idx_cards_lesson on public.cards (lesson_id);
create unique index if not exists uq_cards_lesson_order on public.cards (lesson_id, order_index);

-- Progress
create index if not exists idx_progress_card on public.progress (card_id);

-- SRS (query by user & due date)
create index if not exists idx_srs_user_due on public.srs (user_id, due);

-- Flags/Notes
create index if not exists idx_flags_card on public.flags (card_id);
create index if not exists idx_notes_card on public.notes (card_id);
create index if not exists idx_notes_user_card_created_at on public.notes (user_id, card_id, created_at desc);

-- AI drafts (latest by kind)
create index if not exists idx_ai_drafts_user_kind_created on public.ai_drafts (user_id, kind, created_at desc);

-- Chat
create index if not exists idx_chat_threads_user on public.chat_threads (user_id);
create index if not exists idx_chat_threads_updated on public.chat_threads (updated_at desc);
create index if not exists idx_chat_messages_thread on public.chat_messages (thread_id, created_at);
create index if not exists idx_chat_messages_user on public.chat_messages (user_id);

commit;
