-- Policy metadata checks: expected policy names exist (and only those)
create extension if not exists pgtap with schema extensions;

begin;
select no_plan();

select policies_are('public','courses', ARRAY[
  'Courses are owner-selectable',
  'Courses are owner-updatable',
  'Courses are owner-insertable',
  'Courses are owner-deletable'
]);

select policies_are('public','lessons', ARRAY[
  'Lessons selectable by course owner',
  'Lessons updatable by course owner',
  'Lessons insertable by course owner',
  'Lessons deletable by course owner'
]);

select policies_are('public','cards', ARRAY[
  'Cards selectable by course owner',
  'Cards updatable by course owner',
  'Cards insertable by course owner',
  'Cards deletable by course owner'
]);

select policies_are('public','progress', ARRAY[
  'Progress selectable by self',
  'Progress updatable by self',
  'Progress insertable by self',
  'Progress deletable by self'
]);

select policies_are('public','srs', ARRAY[
  'SRS selectable by self',
  'SRS updatable by self',
  'SRS insertable by self',
  'SRS deletable by self'
]);

select policies_are('public','flags', ARRAY[
  'Flags selectable by self',
  'Flags updatable by self',
  'Flags insertable by self',
  'Flags deletable by self'
]);

select policies_are('public','notes', ARRAY[
  'Notes selectable by self',
  'Notes updatable by self',
  'Notes insertable by self',
  'Notes deletable by self'
]);

select policies_are('public','profiles', ARRAY[
  'Profiles are self-selectable',
  'Profiles are self-updatable',
  'Profiles are self-insertable',
  'Profiles are self-deletable'
]);

select policies_are('public','ai_drafts', ARRAY[
  'AI drafts selectable by self',
  'AI drafts updatable by self',
  'AI drafts insertable by self',
  'AI drafts deletable by self'
]);

select * from finish();
rollback;

