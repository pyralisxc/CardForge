-- Durable Stripe delivery ledger with deduplication and event-order protection.

create table if not exists public.cardforge_billing_events (
  stripe_event_id text primary key,
  stripe_created_at timestamptz not null,
  event_type text not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  clerk_user_id text,
  processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processed', 'ignored', 'failed')),
  resulting_entitlement text,
  failure_message text,
  attempt_count integer not null default 1 check (attempt_count > 0),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.cardforge_billing_subscriptions (
  stripe_subscription_id text primary key,
  stripe_customer_id text,
  clerk_user_id text,
  last_event_created_at timestamptz not null,
  last_event_id text not null,
  updated_at timestamptz not null default now()
);

alter table public.cardforge_billing_events enable row level security;
alter table public.cardforge_billing_subscriptions enable row level security;
revoke all on table public.cardforge_billing_events from public, anon, authenticated;
revoke all on table public.cardforge_billing_subscriptions from public, anon, authenticated;
grant all on table public.cardforge_billing_events to service_role;
grant all on table public.cardforge_billing_subscriptions to service_role;

create index if not exists cardforge_billing_events_subscription_idx
  on public.cardforge_billing_events (stripe_subscription_id, stripe_created_at desc);
create index if not exists cardforge_billing_events_status_idx
  on public.cardforge_billing_events (processing_status, updated_at desc);

create or replace function public.cardforge_begin_billing_event(
  p_stripe_event_id text,
  p_stripe_created bigint,
  p_event_type text,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_clerk_user_id text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_event_created_at timestamptz := to_timestamp(p_stripe_created);
  v_claimed boolean := false;
  v_subscription_claimed boolean := false;
begin
  insert into public.cardforge_billing_events (
    stripe_event_id,
    stripe_created_at,
    event_type,
    stripe_customer_id,
    stripe_subscription_id,
    clerk_user_id
  ) values (
    p_stripe_event_id,
    v_event_created_at,
    p_event_type,
    p_stripe_customer_id,
    p_stripe_subscription_id,
    p_clerk_user_id
  )
  on conflict (stripe_event_id) do nothing
  returning true into v_claimed;

  if not coalesce(v_claimed, false) then
    update public.cardforge_billing_events
    set
      processing_status = 'pending',
      failure_message = null,
      processed_at = null,
      attempt_count = attempt_count + 1,
      updated_at = now()
    where stripe_event_id = p_stripe_event_id
      and (
        processing_status = 'failed'
        or (processing_status = 'pending' and updated_at < now() - interval '10 minutes')
      )
    returning true into v_claimed;

    if not coalesce(v_claimed, false) then
      if exists (
        select 1 from public.cardforge_billing_events
        where stripe_event_id = p_stripe_event_id and processing_status = 'pending'
      ) then
        return 'pending';
      end if;
      return 'duplicate';
    end if;
  end if;

  if p_stripe_subscription_id is not null then
    insert into public.cardforge_billing_subscriptions (
      stripe_subscription_id,
      stripe_customer_id,
      clerk_user_id,
      last_event_created_at,
      last_event_id
    ) values (
      p_stripe_subscription_id,
      p_stripe_customer_id,
      p_clerk_user_id,
      v_event_created_at,
      p_stripe_event_id
    )
    on conflict (stripe_subscription_id) do update
    set
      stripe_customer_id = excluded.stripe_customer_id,
      clerk_user_id = excluded.clerk_user_id,
      last_event_created_at = excluded.last_event_created_at,
      last_event_id = excluded.last_event_id,
      updated_at = now()
    where excluded.last_event_created_at > public.cardforge_billing_subscriptions.last_event_created_at
      or (
        excluded.last_event_created_at = public.cardforge_billing_subscriptions.last_event_created_at
        and excluded.last_event_id >= public.cardforge_billing_subscriptions.last_event_id
      )
    returning true into v_subscription_claimed;

    if not coalesce(v_subscription_claimed, false) then
      update public.cardforge_billing_events
      set processing_status = 'ignored', processed_at = now(), updated_at = now()
      where stripe_event_id = p_stripe_event_id;
      return 'stale';
    end if;
  end if;

  return 'accepted';
end;
$$;

revoke execute on function public.cardforge_begin_billing_event(text, bigint, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.cardforge_begin_billing_event(text, bigint, text, text, text, text)
  to service_role;
