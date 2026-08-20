begin;

alter table public.cardforge_billing_events
  drop constraint if exists cardforge_billing_events_billing_offering_check;
alter table public.cardforge_billing_events
  add constraint cardforge_billing_events_billing_offering_check
  check (billing_offering is null or billing_offering in (
    'creator_pass',
    'designer_pass',
    'support_one_time',
    'support_monthly'
  ));

alter table public.cardforge_billing_subscriptions
  drop constraint if exists cardforge_billing_subscriptions_billing_offering_check;
alter table public.cardforge_billing_subscriptions
  add constraint cardforge_billing_subscriptions_billing_offering_check
  check (billing_offering is null or billing_offering in (
    'creator_pass',
    'designer_pass',
    'support_monthly'
  ));

create or replace function public.cardforge_begin_billing_event_v2(
  p_stripe_event_id text,
  p_stripe_created bigint,
  p_event_type text,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_clerk_user_id text,
  p_billing_purpose text,
  p_billing_offering text,
  p_stripe_price_id text,
  p_amount_cents bigint,
  p_currency text,
  p_classification_reason text
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
  if p_billing_purpose not in ('product_access', 'creator_support', 'unmatched') then
    raise exception 'Unknown billing purpose';
  end if;
  if p_billing_offering is not null
    and p_billing_offering not in (
      'creator_pass',
      'designer_pass',
      'support_one_time',
      'support_monthly'
    ) then
    raise exception 'Unknown billing offering';
  end if;

  insert into public.cardforge_billing_events (
    stripe_event_id,
    stripe_created_at,
    event_type,
    stripe_customer_id,
    stripe_subscription_id,
    clerk_user_id,
    billing_purpose,
    billing_offering,
    stripe_price_id,
    amount_cents,
    currency,
    classification_reason
  ) values (
    p_stripe_event_id,
    v_event_created_at,
    p_event_type,
    p_stripe_customer_id,
    p_stripe_subscription_id,
    p_clerk_user_id,
    p_billing_purpose,
    p_billing_offering,
    p_stripe_price_id,
    p_amount_cents,
    lower(p_currency),
    left(p_classification_reason, 1000)
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

  if p_stripe_subscription_id is not null and p_billing_purpose <> 'unmatched' then
    insert into public.cardforge_billing_subscriptions (
      stripe_subscription_id,
      stripe_customer_id,
      clerk_user_id,
      billing_purpose,
      billing_offering,
      stripe_price_id,
      last_event_created_at,
      last_event_id
    ) values (
      p_stripe_subscription_id,
      p_stripe_customer_id,
      p_clerk_user_id,
      p_billing_purpose,
      p_billing_offering,
      p_stripe_price_id,
      v_event_created_at,
      p_stripe_event_id
    )
    on conflict (stripe_subscription_id) do update
    set
      stripe_customer_id = excluded.stripe_customer_id,
      clerk_user_id = excluded.clerk_user_id,
      billing_purpose = excluded.billing_purpose,
      billing_offering = excluded.billing_offering,
      stripe_price_id = excluded.stripe_price_id,
      last_event_created_at = excluded.last_event_created_at,
      last_event_id = excluded.last_event_id,
      updated_at = now()
    where excluded.last_event_created_at >= public.cardforge_billing_subscriptions.last_event_created_at
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

revoke execute on function public.cardforge_begin_billing_event_v2(
  text, bigint, text, text, text, text, text, text, text, bigint, text, text
) from public, anon, authenticated;
grant execute on function public.cardforge_begin_billing_event_v2(
  text, bigint, text, text, text, text, text, text, text, bigint, text, text
) to service_role;

commit;
