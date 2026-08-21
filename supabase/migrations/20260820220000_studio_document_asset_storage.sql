insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'cardforge-studio-document-assets',
  'cardforge-studio-document-assets',
  false,
  8388608,
  array['image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on column public.cardforge_studio_documents.document_payload is
  'Canonical editable CardForge project document. Private raster artwork is content-addressed in cardforge-studio-document-assets and represented here by stable cardforge-studio-asset references.';

create or replace function public.cardforge_studio_document_asset_bytes(
  p_owner_user_id text,
  p_document_id uuid
)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(pg_catalog.sum(
    ((object.metadata ->> 'size')::bigint)
  ), 0::bigint)::bigint
  from storage.objects as object
  where object.bucket_id = 'cardforge-studio-document-assets'
    and pg_catalog.left(
      object.name,
      pg_catalog.char_length(p_owner_user_id || '/' || p_document_id::text || '/')
    ) = p_owner_user_id || '/' || p_document_id::text || '/';
$$;

create or replace function public.cardforge_get_mcp_account_usage(
  p_owner_user_id text
)
returns table (
  current_month_start date,
  monthly_action_units bigint,
  daily_action_units bigint,
  tool_calls bigint,
  successful_calls bigint,
  failed_calls bigint,
  request_bytes bigint,
  response_bytes bigint,
  duration_ms bigint,
  document_count bigint,
  document_bytes bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with boundaries as (
    select
      (pg_catalog.date_trunc('month', pg_catalog.timezone('utc', pg_catalog.now())))::date as month_start,
      (pg_catalog.timezone('utc', pg_catalog.now()))::date as today
  ), usage as (
    select
      coalesce(pg_catalog.sum(daily.action_units), 0::bigint)::bigint as monthly_action_units,
      coalesce(pg_catalog.sum(daily.action_units) filter (
        where daily.usage_date = boundaries.today
      ), 0::bigint)::bigint as daily_action_units,
      coalesce(pg_catalog.sum(daily.attempts), 0::bigint)::bigint as tool_calls,
      coalesce(pg_catalog.sum(daily.successes), 0::bigint)::bigint as successful_calls,
      coalesce(pg_catalog.sum(daily.failures), 0::bigint)::bigint as failed_calls,
      coalesce(pg_catalog.sum(daily.request_bytes), 0::bigint)::bigint as request_bytes,
      coalesce(pg_catalog.sum(daily.response_bytes), 0::bigint)::bigint as response_bytes,
      coalesce(pg_catalog.sum(daily.duration_ms), 0::bigint)::bigint as duration_ms
    from public.cardforge_mcp_usage_daily as daily
    cross join boundaries
    where daily.owner_user_id = p_owner_user_id
      and daily.usage_date >= boundaries.month_start
  ), documents as (
    select
      pg_catalog.count(*)::bigint as document_count,
      coalesce(pg_catalog.sum(
        pg_catalog.octet_length(pg_catalog.convert_to(document.document_payload::text, 'UTF8'))
        + public.cardforge_studio_document_asset_bytes(document.owner_user_id, document.id)
      ), 0::bigint)::bigint as document_bytes
    from public.cardforge_studio_documents as document
    where document.owner_user_id = p_owner_user_id
  )
  select
    boundaries.month_start,
    usage.monthly_action_units,
    usage.daily_action_units,
    usage.tool_calls,
    usage.successful_calls,
    usage.failed_calls,
    usage.request_bytes,
    usage.response_bytes,
    usage.duration_ms,
    documents.document_count,
    documents.document_bytes
  from boundaries
  cross join usage
  cross join documents;
$$;

create or replace function public.cardforge_get_mcp_owner_usage()
returns table (
  current_month_start date,
  monthly_action_units bigint,
  tool_calls bigint,
  successful_calls bigint,
  failed_calls bigint,
  active_users bigint,
  request_bytes bigint,
  response_bytes bigint,
  duration_ms bigint,
  document_count bigint,
  document_bytes bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with boundaries as (
    select (pg_catalog.date_trunc('month', pg_catalog.timezone('utc', pg_catalog.now())))::date as month_start
  ), usage as (
    select
      coalesce(pg_catalog.sum(daily.action_units), 0::bigint)::bigint as monthly_action_units,
      coalesce(pg_catalog.sum(daily.attempts), 0::bigint)::bigint as tool_calls,
      coalesce(pg_catalog.sum(daily.successes), 0::bigint)::bigint as successful_calls,
      coalesce(pg_catalog.sum(daily.failures), 0::bigint)::bigint as failed_calls,
      pg_catalog.count(distinct daily.owner_user_id)::bigint as active_users,
      coalesce(pg_catalog.sum(daily.request_bytes), 0::bigint)::bigint as request_bytes,
      coalesce(pg_catalog.sum(daily.response_bytes), 0::bigint)::bigint as response_bytes,
      coalesce(pg_catalog.sum(daily.duration_ms), 0::bigint)::bigint as duration_ms
    from public.cardforge_mcp_usage_daily as daily
    cross join boundaries
    where daily.usage_date >= boundaries.month_start
  ), documents as (
    select
      pg_catalog.count(*)::bigint as document_count,
      coalesce(pg_catalog.sum(
        pg_catalog.octet_length(pg_catalog.convert_to(document.document_payload::text, 'UTF8'))
        + public.cardforge_studio_document_asset_bytes(document.owner_user_id, document.id)
      ), 0::bigint)::bigint as document_bytes
    from public.cardforge_studio_documents as document
  )
  select
    boundaries.month_start,
    usage.monthly_action_units,
    usage.tool_calls,
    usage.successful_calls,
    usage.failed_calls,
    usage.active_users,
    usage.request_bytes,
    usage.response_bytes,
    usage.duration_ms,
    documents.document_count,
    documents.document_bytes
  from boundaries
  cross join usage
  cross join documents;
$$;

revoke execute on function public.cardforge_studio_document_asset_bytes(text, uuid)
  from public, anon, authenticated;
grant execute on function public.cardforge_studio_document_asset_bytes(text, uuid)
  to service_role;

comment on function public.cardforge_studio_document_asset_bytes(text, uuid) is
  'Counts normalized private artwork bytes for one account-owned Studio document so owner and account usage remain accurate after JSON artwork externalization.';
