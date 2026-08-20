-- Privacy-minimized MCP usage observation and owner-controlled plan presentation.
-- Signed-in accounts receive MCP access; numeric capacity targets are informational and do not enforce a quota.

create table public.cardforge_mcp_allowance_settings (
  plan_key text primary key
    check (plan_key in ('free', 'creator', 'designer', 'enterprise')),
  display_name text not null check (char_length(display_name) between 1 and 80),
  description text not null check (char_length(description) between 1 and 600),
  feature_summary text not null check (char_length(feature_summary) between 1 and 1200),
  cta_label text not null check (char_length(cta_label) between 1 and 80),
  price_label text not null check (char_length(price_label) between 1 and 40),
  price_note text not null check (char_length(price_note) between 1 and 80),
  is_visible boolean not null default true,
  monthly_action_limit integer not null
    check (monthly_action_limit between 0 and 1000000),
  daily_safety_limit integer not null
    check (daily_safety_limit between 0 and 100000),
  online_storage_limit_bytes bigint not null
    check (online_storage_limit_bytes between 0 and 109951162777600),
  updated_at timestamptz not null default now()
);

insert into public.cardforge_mcp_allowance_settings (
  plan_key,
  display_name,
  description,
  feature_summary,
  cta_label,
  price_label,
  price_note,
  is_visible,
  monthly_action_limit,
  daily_safety_limit,
  online_storage_limit_bytes
) values
  ('free', 'Free', 'Explore the browser Studio and try CardForge’s ChatGPT plugin.', E'Full browser Studio\nProjects saved on this device\n30 ChatGPT plugin actions each month\n250 MB private ChatGPT plugin workspace', 'Start creating', '$0', 'No card required', true, 30, 5, 262144000),
  ('creator', 'Creator Pass', 'For regular creators who want finished Studio exports and more ChatGPT plugin capacity.', E'Everything in Free\nWatermark-free Studio exports\nPortable CardForge Studio project files\n300 ChatGPT plugin actions each month\n2 GB private ChatGPT plugin workspace', 'Choose Creator', '$8.99', 'per month', true, 300, 50, 2147483648),
  ('designer', 'Designer Pass', 'For high-volume creators and approved contributors using ChatGPT across larger projects.', E'Everything in Creator\n1,000 ChatGPT plugin actions each month\n10 GB private ChatGPT plugin workspace\nContributor tools when approved', 'Choose Designer', '$19.99', 'per month', true, 1000, 150, 10737418240),
  ('enterprise', 'Business Solutions', 'For teams that need a tailored ChatGPT plugin workflow, integration, capacity, and support.', E'Custom ChatGPT plugin capacity and storage\nTeam workflow consultation\nIntegration planning\nDirect business support', 'Talk with CardForge', 'Custom', 'Built around your team', true, 10000, 1000, 107374182400)
on conflict (plan_key) do nothing;

create table public.cardforge_mcp_usage_daily (
  owner_user_id text not null check (char_length(owner_user_id) between 1 and 255),
  usage_date date not null,
  tool_name text not null check (char_length(tool_name) between 1 and 120),
  attempts integer not null default 0 check (attempts >= 0),
  successes integer not null default 0 check (successes >= 0),
  failures integer not null default 0 check (failures >= 0),
  action_units integer not null default 0 check (action_units >= 0),
  request_bytes bigint not null default 0 check (request_bytes >= 0),
  response_bytes bigint not null default 0 check (response_bytes >= 0),
  duration_ms bigint not null default 0 check (duration_ms >= 0),
  updated_at timestamptz not null default now(),
  primary key (owner_user_id, usage_date, tool_name),
  check (successes + failures = attempts)
);

create index cardforge_mcp_usage_daily_date_idx
  on public.cardforge_mcp_usage_daily (usage_date desc, owner_user_id);

alter table public.cardforge_mcp_allowance_settings enable row level security;
alter table public.cardforge_mcp_usage_daily enable row level security;

revoke all privileges on table
  public.cardforge_mcp_allowance_settings,
  public.cardforge_mcp_usage_daily
from public, anon, authenticated;

grant select, update on table public.cardforge_mcp_allowance_settings to service_role;
grant select, insert, update on table public.cardforge_mcp_usage_daily to service_role;

create or replace function public.cardforge_record_mcp_usage(
  p_owner_user_id text,
  p_tool_name text,
  p_succeeded boolean,
  p_action_units integer,
  p_request_bytes bigint,
  p_response_bytes bigint,
  p_duration_ms bigint
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_usage_date date := (pg_catalog.timezone('utc', pg_catalog.now()))::date;
begin
  if pg_catalog.char_length(p_owner_user_id) not between 1 and 255
    or pg_catalog.char_length(p_tool_name) not between 1 and 120
    or p_action_units not between 0 and 1
    or p_request_bytes not between 0 and 1073741824
    or p_response_bytes not between 0 and 1073741824
    or p_duration_ms not between 0 and 86400000
  then
    raise exception 'Invalid MCP usage observation';
  end if;

  insert into public.cardforge_mcp_usage_daily (
    owner_user_id,
    usage_date,
    tool_name,
    attempts,
    successes,
    failures,
    action_units,
    request_bytes,
    response_bytes,
    duration_ms,
    updated_at
  ) values (
    p_owner_user_id,
    v_usage_date,
    p_tool_name,
    1,
    case when p_succeeded then 1 else 0 end,
    case when p_succeeded then 0 else 1 end,
    case when p_succeeded then p_action_units else 0 end,
    p_request_bytes,
    p_response_bytes,
    p_duration_ms,
    pg_catalog.now()
  )
  on conflict (owner_user_id, usage_date, tool_name) do update
  set
    attempts = public.cardforge_mcp_usage_daily.attempts + 1,
    successes = public.cardforge_mcp_usage_daily.successes
      + case when p_succeeded then 1 else 0 end,
    failures = public.cardforge_mcp_usage_daily.failures
      + case when p_succeeded then 0 else 1 end,
    action_units = public.cardforge_mcp_usage_daily.action_units
      + case when p_succeeded then p_action_units else 0 end,
    request_bytes = public.cardforge_mcp_usage_daily.request_bytes + p_request_bytes,
    response_bytes = public.cardforge_mcp_usage_daily.response_bytes + p_response_bytes,
    duration_ms = public.cardforge_mcp_usage_daily.duration_ms + p_duration_ms,
    updated_at = pg_catalog.now();
end;
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
      pg_catalog.coalesce(pg_catalog.sum(daily.action_units), 0)::bigint as monthly_action_units,
      pg_catalog.coalesce(pg_catalog.sum(daily.action_units) filter (
        where daily.usage_date = boundaries.today
      ), 0)::bigint as daily_action_units,
      pg_catalog.coalesce(pg_catalog.sum(daily.attempts), 0)::bigint as tool_calls,
      pg_catalog.coalesce(pg_catalog.sum(daily.successes), 0)::bigint as successful_calls,
      pg_catalog.coalesce(pg_catalog.sum(daily.failures), 0)::bigint as failed_calls,
      pg_catalog.coalesce(pg_catalog.sum(daily.request_bytes), 0)::bigint as request_bytes,
      pg_catalog.coalesce(pg_catalog.sum(daily.response_bytes), 0)::bigint as response_bytes,
      pg_catalog.coalesce(pg_catalog.sum(daily.duration_ms), 0)::bigint as duration_ms
    from public.cardforge_mcp_usage_daily as daily
    cross join boundaries
    where daily.owner_user_id = p_owner_user_id
      and daily.usage_date >= boundaries.month_start
  ), documents as (
    select
      pg_catalog.count(*)::bigint as document_count,
      pg_catalog.coalesce(pg_catalog.sum(
        pg_catalog.octet_length(pg_catalog.convert_to(document.document_payload::text, 'UTF8'))
      ), 0)::bigint as document_bytes
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
      pg_catalog.coalesce(pg_catalog.sum(daily.action_units), 0)::bigint as monthly_action_units,
      pg_catalog.coalesce(pg_catalog.sum(daily.attempts), 0)::bigint as tool_calls,
      pg_catalog.coalesce(pg_catalog.sum(daily.successes), 0)::bigint as successful_calls,
      pg_catalog.coalesce(pg_catalog.sum(daily.failures), 0)::bigint as failed_calls,
      pg_catalog.count(distinct daily.owner_user_id)::bigint as active_users,
      pg_catalog.coalesce(pg_catalog.sum(daily.request_bytes), 0)::bigint as request_bytes,
      pg_catalog.coalesce(pg_catalog.sum(daily.response_bytes), 0)::bigint as response_bytes,
      pg_catalog.coalesce(pg_catalog.sum(daily.duration_ms), 0)::bigint as duration_ms
    from public.cardforge_mcp_usage_daily as daily
    cross join boundaries
    where daily.usage_date >= boundaries.month_start
  ), documents as (
    select
      pg_catalog.count(*)::bigint as document_count,
      pg_catalog.coalesce(pg_catalog.sum(
        pg_catalog.octet_length(pg_catalog.convert_to(document.document_payload::text, 'UTF8'))
      ), 0)::bigint as document_bytes
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

revoke execute on function public.cardforge_record_mcp_usage(text, text, boolean, integer, bigint, bigint, bigint)
  from public, anon, authenticated;
revoke execute on function public.cardforge_get_mcp_account_usage(text)
  from public, anon, authenticated;
revoke execute on function public.cardforge_get_mcp_owner_usage()
  from public, anon, authenticated;

grant execute on function public.cardforge_record_mcp_usage(text, text, boolean, integer, bigint, bigint, bigint)
  to service_role;
grant execute on function public.cardforge_get_mcp_account_usage(text)
  to service_role;
grant execute on function public.cardforge_get_mcp_owner_usage()
  to service_role;

comment on table public.cardforge_mcp_usage_daily is
  'Privacy-minimized daily MCP tool aggregates. Prompts, card content, and document payloads are never stored here.';
comment on table public.cardforge_mcp_allowance_settings is
  'Owner-controlled plan presentation and observation-only capacity targets. Signed-in account access is fixed; numeric targets do not enforce access or billing.';

-- Plan visibility now has one owner in cardforge_mcp_allowance_settings.
alter table public.cardforge_owner_settings
  drop column if exists creator_pass_offer_visible;

-- Business Solutions is inquiry-led and uses the existing private contact workflow.
alter table public.cardforge_contact_requests
  drop constraint if exists cardforge_contact_requests_kind_check;
alter table public.cardforge_contact_requests
  add constraint cardforge_contact_requests_kind_check
  check (kind in ('support', 'developer', 'business'));

update public.cardforge_site_content_blocks
set
  body = 'The complete Studio at every level, with more ChatGPT plugin power as you grow.',
  updated_at = now()
where slug = 'landing.access.headline'
  and body in (
    'Start free. Upgrade when you need watermark-free downloads.',
    'The complete Studio at every level. More creative power when you want it.'
  );
