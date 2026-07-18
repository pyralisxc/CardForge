-- Add explicit Stripe billing purpose without disrupting the currently deployed v1 webhook.

alter table public.cardforge_billing_events
  add column if not exists billing_purpose text not null default 'product_access'
    check (billing_purpose in ('product_access', 'creator_support', 'unmatched')),
  add column if not exists billing_offering text
    check (billing_offering is null or billing_offering in ('creator_pass', 'support_one_time', 'support_monthly')),
  add column if not exists stripe_price_id text,
  add column if not exists amount_cents bigint check (amount_cents is null or amount_cents >= 0),
  add column if not exists currency text check (currency is null or currency ~ '^[a-z]{3}$'),
  add column if not exists classification_reason text;

alter table public.cardforge_billing_subscriptions
  add column if not exists billing_purpose text not null default 'product_access'
    check (billing_purpose in ('product_access', 'creator_support')),
  add column if not exists billing_offering text
    check (billing_offering is null or billing_offering in ('creator_pass', 'support_monthly')),
  add column if not exists stripe_price_id text;

create index if not exists cardforge_billing_events_purpose_idx
  on public.cardforge_billing_events (billing_purpose, processing_status, stripe_created_at desc);

create table if not exists public.cardforge_billing_entitlement_locks (
  clerk_user_id text primary key,
  lease_token uuid not null,
  lease_expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.cardforge_billing_entitlement_locks enable row level security;
revoke all on table public.cardforge_billing_entitlement_locks from public, anon, authenticated;
grant all on table public.cardforge_billing_entitlement_locks to service_role;

create or replace function public.cardforge_acquire_billing_entitlement_lock(
  p_clerk_user_id text,
  p_lease_token uuid,
  p_lease_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_acquired boolean := false;
begin
  if nullif(trim(p_clerk_user_id), '') is null then
    raise exception 'Clerk user ID is required';
  end if;
  if p_lease_seconds < 5 or p_lease_seconds > 300 then
    raise exception 'Invalid entitlement lock lease';
  end if;

  insert into public.cardforge_billing_entitlement_locks (
    clerk_user_id,
    lease_token,
    lease_expires_at
  ) values (
    p_clerk_user_id,
    p_lease_token,
    now() + make_interval(secs => p_lease_seconds)
  )
  on conflict (clerk_user_id) do update
  set
    lease_token = excluded.lease_token,
    lease_expires_at = excluded.lease_expires_at,
    updated_at = now()
  where public.cardforge_billing_entitlement_locks.lease_expires_at <= now()
    or public.cardforge_billing_entitlement_locks.lease_token = excluded.lease_token
  returning true into v_acquired;

  return coalesce(v_acquired, false);
end;
$$;

create or replace function public.cardforge_release_billing_entitlement_lock(
  p_clerk_user_id text,
  p_lease_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_released boolean := false;
begin
  delete from public.cardforge_billing_entitlement_locks
  where clerk_user_id = p_clerk_user_id
    and lease_token = p_lease_token
  returning true into v_released;

  return coalesce(v_released, false);
end;
$$;

revoke execute on function public.cardforge_acquire_billing_entitlement_lock(text, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.cardforge_acquire_billing_entitlement_lock(text, uuid, integer)
  to service_role;
revoke execute on function public.cardforge_release_billing_entitlement_lock(text, uuid)
  from public, anon, authenticated;
grant execute on function public.cardforge_release_billing_entitlement_lock(text, uuid)
  to service_role;

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
    and p_billing_offering not in ('creator_pass', 'support_one_time', 'support_monthly') then
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

-- Publish payment-lane terms as new immutable legal-document versions.
with current_identity as (
  select identity_version
  from public.cardforge_business_identity
  where id = 'cardforge'
), publications (slug, title, body) as (
  values
    (
      'supporter-terms',
      'Supporter Terms',
      $supporter$CardForge Studio is a software product created and operated by Cameron Locke, an independent sole proprietor based in Oregon.

These supplemental terms apply only if CardForge Studio separately offers a supporter checkout. Voluntary support for the independent creator is separate from Creator Pass. A support payment does not grant product access or any other CardForge entitlement. An entitlement exists only when a separately identified offering expressly says so and is governed by that offering's own terms.

Support is not a donation, investment, security, equity or ownership interest, profit rights, revenue share, wage, or voting or control rights. CardForge does not represent support as tax deductible. Support does not guarantee a feature, benefit, or roadmap influence.

One-time support is a single charge and does not renew. Recurring support renews monthly at the exact amount shown before payment until canceled. Supporters can stop future renewal charges through the Stripe-hosted supporter management link on the Support Cameron page. Cancellation does not retroactively refund completed charges.

Any refund or cancellation request is handled under the Refund and Cancellation Policy and applicable law.$supporter$
    ),
    (
      'refund',
      'Refund and Cancellation Policy',
      $refund$CardForge Studio is a software product created and operated by Cameron Locke, an independent sole proprietor based in Oregon.

CardForge is currently in public beta. Self-service subscription billing and the customer billing portal are active when offered on the access page.

Use the account billing portal to manage or cancel Creator Pass. Use the Stripe-hosted supporter management link on the Support Cameron page to cancel recurring support. Cancellation stops future renewals; access from a canceled Creator Pass ordinarily continues through the already-paid period unless Stripe shows otherwise.

Creator Pass refund requests are reviewed using the payment record, product-access history, the circumstances of the request, and applicable law. One-time and recurring support payments are voluntary and are ordinarily final once completed, but duplicate, erroneous, fraudulent, or legally required refunds will be reviewed. Canceling recurring support does not automatically refund an earlier support charge. Nothing in this policy limits rights that cannot legally be limited.

If you have a billing, cancellation, or export-access issue, contact support with the account email, transaction reference if available, and a short description of the issue.$refund$
    )
), versioned as (
  select
    publications.slug,
    coalesce((select max(version) from public.cardforge_legal_documents existing where existing.slug = publications.slug), 0) + 1 as version,
    publications.title,
    publications.body
  from publications
)
insert into public.cardforge_legal_documents (
  slug,
  version,
  title,
  body,
  effective_date,
  published_at,
  business_identity_version
)
select
  versioned.slug,
  versioned.version,
  versioned.title,
  versioned.body,
  date '2026-07-17',
  now(),
  current_identity.identity_version
from versioned
cross join current_identity;
