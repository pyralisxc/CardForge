-- Durable, atomic rate limiting for public and authenticated write endpoints.

create table if not exists public.cardforge_rate_limit_buckets (
  key_hash text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.cardforge_rate_limit_buckets enable row level security;
revoke all on table public.cardforge_rate_limit_buckets from public, anon, authenticated;
grant all on table public.cardforge_rate_limit_buckets to service_role;

create or replace function public.cardforge_consume_rate_limit(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_request_count integer;
begin
  if length(p_key_hash) <> 64 or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate limit parameters';
  end if;

  insert into public.cardforge_rate_limit_buckets (
    key_hash,
    window_started_at,
    request_count,
    updated_at
  ) values (
    p_key_hash,
    now(),
    1,
    now()
  )
  on conflict (key_hash) do update
  set
    window_started_at = case
      when public.cardforge_rate_limit_buckets.window_started_at
        <= now() - make_interval(secs => p_window_seconds)
      then now()
      else public.cardforge_rate_limit_buckets.window_started_at
    end,
    request_count = case
      when public.cardforge_rate_limit_buckets.window_started_at
        <= now() - make_interval(secs => p_window_seconds)
      then 1
      else public.cardforge_rate_limit_buckets.request_count + 1
    end,
    updated_at = now()
  returning request_count into v_request_count;

  return v_request_count <= p_limit;
end;
$$;

revoke execute on function public.cardforge_consume_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.cardforge_consume_rate_limit(text, integer, integer)
  to service_role;
