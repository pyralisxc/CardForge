-- Privacy-minimized workflow efficiency telemetry for CardForge MCP editing sequences.
-- Stores only hashed working-document correlation keys and numeric counters; never prompts, card content, titles, asset bytes, or raw document ids.

create table public.cardforge_mcp_workflow_runs (
  id bigint generated always as identity primary key,
  owner_user_id text not null check (char_length(owner_user_id) between 1 and 255),
  document_key text not null check (document_key ~ '^[0-9a-f]{64}$'),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  completion_kind text check (completion_kind in ('final_preview', 'stale')),
  tool_calls integer not null default 0 check (tool_calls >= 0),
  revisions integer not null default 0 check (revisions >= 0),
  canonical_renders integer not null default 0 check (canonical_renders >= 0),
  render_cache_checks integer not null default 0 check (render_cache_checks >= 0),
  cache_hits integer not null default 0 check (cache_hits >= 0 and cache_hits <= render_cache_checks),
  retries integer not null default 0 check (retries >= 0),
  validation_failures integer not null default 0 check (validation_failures >= 0),
  revision_conflicts integer not null default 0 check (revision_conflicts >= 0),
  duplicate_preventions integer not null default 0 check (duplicate_preventions >= 0),
  upload_operations integer not null default 0 check (upload_operations >= 0),
  upload_latency_ms bigint not null default 0 check (upload_latency_ms >= 0),
  render_operations integer not null default 0 check (render_operations >= 0),
  render_latency_ms bigint not null default 0 check (render_latency_ms >= 0),
  check ((completed_at is null and completion_kind is null) or (completed_at is not null and completion_kind is not null))
);

create unique index cardforge_mcp_workflow_runs_active_idx
  on public.cardforge_mcp_workflow_runs (owner_user_id, document_key)
  where completed_at is null;

create index cardforge_mcp_workflow_runs_started_idx
  on public.cardforge_mcp_workflow_runs (started_at desc, owner_user_id);

alter table public.cardforge_mcp_workflow_runs enable row level security;
revoke all privileges on table public.cardforge_mcp_workflow_runs from public, anon, authenticated;
grant select, insert, update on table public.cardforge_mcp_workflow_runs to service_role;

create or replace function public.cardforge_record_mcp_workflow_observation(
  p_owner_user_id text,
  p_document_key text,
  p_tool_calls integer,
  p_revisions integer,
  p_canonical_renders integer,
  p_render_cache_checks integer,
  p_cache_hits integer,
  p_retries integer,
  p_validation_failures integer,
  p_revision_conflicts integer,
  p_duplicate_preventions integer,
  p_upload_operations integer,
  p_upload_latency_ms bigint,
  p_render_operations integer,
  p_render_latency_ms bigint,
  p_complete boolean,
  p_create_if_missing boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.now();
begin
  if pg_catalog.char_length(p_owner_user_id) not between 1 and 255
    or p_document_key !~ '^[0-9a-f]{64}$'
    or p_tool_calls not between 0 and 10000
    or p_revisions not between 0 and 10000
    or p_canonical_renders not between 0 and 100000
    or p_render_cache_checks not between 0 and 100000
    or p_cache_hits not between 0 and p_render_cache_checks
    or p_retries not between 0 and 10000
    or p_validation_failures not between 0 and 10000
    or p_revision_conflicts not between 0 and 10000
    or p_duplicate_preventions not between 0 and 10000
    or p_upload_operations not between 0 and 10000
    or p_upload_latency_ms not between 0 and 86400000
    or p_render_operations not between 0 and 10000
    or p_render_latency_ms not between 0 and 86400000
  then
    raise exception 'Invalid MCP workflow observation';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_owner_user_id || ':' || p_document_key, 0)
  );

  update public.cardforge_mcp_workflow_runs
  set completed_at = v_now,
      completion_kind = 'stale',
      updated_at = v_now
  where owner_user_id = p_owner_user_id
    and document_key = p_document_key
    and completed_at is null
    and updated_at < v_now - interval '2 hours';

  if p_create_if_missing then
    insert into public.cardforge_mcp_workflow_runs (
      owner_user_id,
      document_key,
      tool_calls,
      revisions,
      canonical_renders,
      render_cache_checks,
      cache_hits,
      retries,
      validation_failures,
      revision_conflicts,
      duplicate_preventions,
      upload_operations,
      upload_latency_ms,
      render_operations,
      render_latency_ms,
      updated_at
    ) values (
      p_owner_user_id,
      p_document_key,
      p_tool_calls,
      p_revisions,
      p_canonical_renders,
      p_render_cache_checks,
      p_cache_hits,
      p_retries,
      p_validation_failures,
      p_revision_conflicts,
      p_duplicate_preventions,
      p_upload_operations,
      p_upload_latency_ms,
      p_render_operations,
      p_render_latency_ms,
      v_now
    )
    on conflict (owner_user_id, document_key) where completed_at is null do update
    set tool_calls = public.cardforge_mcp_workflow_runs.tool_calls + excluded.tool_calls,
        revisions = public.cardforge_mcp_workflow_runs.revisions + excluded.revisions,
        canonical_renders = public.cardforge_mcp_workflow_runs.canonical_renders + excluded.canonical_renders,
        render_cache_checks = public.cardforge_mcp_workflow_runs.render_cache_checks + excluded.render_cache_checks,
        cache_hits = public.cardforge_mcp_workflow_runs.cache_hits + excluded.cache_hits,
        retries = public.cardforge_mcp_workflow_runs.retries + excluded.retries,
        validation_failures = public.cardforge_mcp_workflow_runs.validation_failures + excluded.validation_failures,
        revision_conflicts = public.cardforge_mcp_workflow_runs.revision_conflicts + excluded.revision_conflicts,
        duplicate_preventions = public.cardforge_mcp_workflow_runs.duplicate_preventions + excluded.duplicate_preventions,
        upload_operations = public.cardforge_mcp_workflow_runs.upload_operations + excluded.upload_operations,
        upload_latency_ms = public.cardforge_mcp_workflow_runs.upload_latency_ms + excluded.upload_latency_ms,
        render_operations = public.cardforge_mcp_workflow_runs.render_operations + excluded.render_operations,
        render_latency_ms = public.cardforge_mcp_workflow_runs.render_latency_ms + excluded.render_latency_ms,
        updated_at = v_now;
  else
    update public.cardforge_mcp_workflow_runs
    set tool_calls = tool_calls + p_tool_calls,
        revisions = revisions + p_revisions,
        canonical_renders = canonical_renders + p_canonical_renders,
        render_cache_checks = render_cache_checks + p_render_cache_checks,
        cache_hits = cache_hits + p_cache_hits,
        retries = retries + p_retries,
        validation_failures = validation_failures + p_validation_failures,
        revision_conflicts = revision_conflicts + p_revision_conflicts,
        duplicate_preventions = duplicate_preventions + p_duplicate_preventions,
        upload_operations = upload_operations + p_upload_operations,
        upload_latency_ms = upload_latency_ms + p_upload_latency_ms,
        render_operations = render_operations + p_render_operations,
        render_latency_ms = render_latency_ms + p_render_latency_ms,
        updated_at = v_now
    where owner_user_id = p_owner_user_id
      and document_key = p_document_key
      and completed_at is null;
  end if;

  if p_complete then
    update public.cardforge_mcp_workflow_runs
    set completed_at = v_now,
        completion_kind = 'final_preview',
        updated_at = v_now
    where owner_user_id = p_owner_user_id
      and document_key = p_document_key
      and completed_at is null;
  end if;
end;
$$;

create or replace function public.cardforge_get_mcp_workflow_efficiency(p_days integer default 30)
returns table (
  editing_sequences bigint,
  completed_workflows bigint,
  average_calls_per_completed_workflow numeric,
  average_revisions_per_sequence numeric,
  average_revisions_per_completed_workflow numeric,
  canonical_renders_per_revision numeric,
  cache_hit_rate numeric,
  retries bigint,
  validation_failures bigint,
  revision_conflicts bigint,
  duplicate_preventions bigint,
  average_upload_latency_ms numeric,
  average_render_latency_ms numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with requested_window as (
    select case
      when p_days < 1 then 1
      when p_days > 365 then 365
      else p_days
    end as days
  ), relevant as (
    select workflow.*
    from public.cardforge_mcp_workflow_runs as workflow
    cross join requested_window
    where workflow.started_at >= pg_catalog.now() - pg_catalog.make_interval(days => requested_window.days)
  )
  select
    pg_catalog.count(*)::bigint,
    pg_catalog.count(*) filter (where completion_kind = 'final_preview')::bigint,
    pg_catalog.round(pg_catalog.avg(tool_calls) filter (where completion_kind = 'final_preview'), 2),
    pg_catalog.round(pg_catalog.avg(revisions), 2),
    pg_catalog.round(pg_catalog.avg(revisions) filter (where completion_kind = 'final_preview'), 2),
    pg_catalog.round(pg_catalog.sum(canonical_renders)::numeric / nullif(pg_catalog.sum(revisions), 0), 3),
    pg_catalog.round(pg_catalog.sum(cache_hits)::numeric / nullif(pg_catalog.sum(render_cache_checks), 0), 3),
    coalesce(pg_catalog.sum(retries), 0)::bigint,
    coalesce(pg_catalog.sum(validation_failures), 0)::bigint,
    coalesce(pg_catalog.sum(revision_conflicts), 0)::bigint,
    coalesce(pg_catalog.sum(duplicate_preventions), 0)::bigint,
    pg_catalog.round(pg_catalog.sum(upload_latency_ms)::numeric / nullif(pg_catalog.sum(upload_operations), 0), 2),
    pg_catalog.round(pg_catalog.sum(render_latency_ms)::numeric / nullif(pg_catalog.sum(render_operations), 0), 2)
  from relevant;
$$;

revoke execute on function public.cardforge_record_mcp_workflow_observation(text, text, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, bigint, integer, bigint, boolean, boolean)
  from public, anon, authenticated;
revoke execute on function public.cardforge_get_mcp_workflow_efficiency(integer)
  from public, anon, authenticated;
grant execute on function public.cardforge_record_mcp_workflow_observation(text, text, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, bigint, integer, bigint, boolean, boolean)
  to service_role;
grant execute on function public.cardforge_get_mcp_workflow_efficiency(integer)
  to service_role;

comment on table public.cardforge_mcp_workflow_runs is
  'Privacy-minimized MCP editing-sequence metrics keyed by a one-way document hash. No prompts, card content, titles, asset bytes, or raw document ids are stored.';
comment on function public.cardforge_get_mcp_workflow_efficiency(integer) is
  'Aggregates MCP efficiency KPIs, especially revisions and calls per completed workflow, without exposing user content.';
