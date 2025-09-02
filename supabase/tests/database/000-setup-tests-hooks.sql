-- Global pre-test hook: install pgTAP and helpers (idempotent)
-- This file runs first (alphabetical) and prepares shared test utilities.

-- 1) Ensure pgTAP is available in the extensions schema
create extension if not exists pgtap with schema extensions;

-- 2) Optional: install dbdev + Basejump test helpers
--    Reference: Supabase "Advanced pgTAP Testing" guide.
--    Safe to re-run; wrapped to avoid failing if network is unavailable.
do $$
begin
  -- Required dependencies for dbdev installer
  create extension if not exists http with schema extensions;
  create extension if not exists pg_tle;

  -- Install/refresh supabase-dbdev from database.dev
  begin
    drop extension if exists "supabase-dbdev";
    perform pgtle.uninstall_extension_if_exists('supabase-dbdev');
  exception when undefined_function then
    -- pg_tle not present or helper missing; continue
    null;
  end;

  begin
    perform pgtle.install_extension(
      'supabase-dbdev',
      resp.contents ->> 'version',
      'PostgreSQL package manager',
      resp.contents ->> 'sql'
    )
    from http((
      'GET',
      'https://api.database.dev/rest/v1/' ||
      'package_versions?select=sql,version' ||
      '&package_name=eq.supabase-dbdev' ||
      '&order=version.desc' ||
      '&limit=1',
      array[(
        'apiKey',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtdXB0cHBsZnZpaWZyYndtbXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODAxMDczNzIsImV4cCI6MTk5NTY4MzM3Mn0.z2CN0mvO2No8wSi46Gw59DFGCTJrzM0AQKsu_5k134s'
      )::http_header],
      null,
      null
    )) x,
    lateral (select ((row_to_json(x) -> 'content') #>> '{}')::json -> 0) resp(contents);

    create extension "supabase-dbdev";
    perform dbdev.install('supabase-dbdev');
  exception when others then
    -- If any network/permission error occurs, skip dbdev install.
    null;
  end;

  -- Try to install Basejump test helpers if dbdev is available
  begin
    perform dbdev.install('basejump-supabase_test_helpers');
  exception when undefined_function then
    -- dbdev not installed; ignore
    null;
  end;

  -- Activate helpers if present (kept only for test session)
  begin
    create extension if not exists "basejump-supabase_test_helpers" version '0.0.6';
  exception when others then
    null;
  end;
end$$;

-- Minimal no-op test to assert setup ran
begin;
select plan(1);
select ok(true, 'Pre-test setup completed');
select * from finish();
rollback;

