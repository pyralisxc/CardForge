create extension if not exists pgcrypto;

create table if not exists public.cardforge_founder_beta_campaigns (
  id text primary key default 'founder_beta',
  enabled boolean not null default true,
  public_slot_cap integer not null default 300 check (public_slot_cap between 1 and 10000),
  release_slot_cap integer not null default 100 check (release_slot_cap between 0 and 10000),
  access_days integer not null default 90 check (access_days between 1 and 365),
  auto_grant boolean not null default true,
  waitlist_enabled boolean not null default true,
  campaign_title text not null default 'Founder Beta Pass',
  landing_message text not null default 'Founder Beta is open first come, first served for the first 300 creators.',
  account_badge_label text not null default 'Founder Beta Pass',
  export_gate_message text not null default 'Founder Beta creators get 90 days of clean export access while helping shape CardForge.',
  stripe_coupon_id text not null default '',
  stripe_promotion_code text not null default '',
  updated_at timestamptz not null default now(),
  check (id = 'founder_beta'),
  check (release_slot_cap <= public_slot_cap)
);

create table if not exists public.cardforge_founder_beta_claims (
  id uuid primary key default gen_random_uuid(),
  campaign_id text not null default 'founder_beta' references public.cardforge_founder_beta_campaigns(id) on delete cascade,
  clerk_user_id text not null,
  email text,
  status text not null default 'active' check (status in ('active', 'revoked')),
  access_expires_at timestamptz not null,
  claimed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists cardforge_founder_beta_claims_active_user_idx
  on public.cardforge_founder_beta_claims (clerk_user_id)
  where status = 'active';

create index if not exists cardforge_founder_beta_claims_campaign_status_idx
  on public.cardforge_founder_beta_claims (campaign_id, status, claimed_at);

drop trigger if exists cardforge_founder_beta_campaigns_touch_updated_at on public.cardforge_founder_beta_campaigns;
create trigger cardforge_founder_beta_campaigns_touch_updated_at
  before update on public.cardforge_founder_beta_campaigns
  for each row
  execute function public.cardforge_touch_updated_at();

drop trigger if exists cardforge_founder_beta_claims_touch_updated_at on public.cardforge_founder_beta_claims;
create trigger cardforge_founder_beta_claims_touch_updated_at
  before update on public.cardforge_founder_beta_claims
  for each row
  execute function public.cardforge_touch_updated_at();

alter table public.cardforge_founder_beta_campaigns enable row level security;
alter table public.cardforge_founder_beta_claims enable row level security;

insert into public.cardforge_founder_beta_campaigns (
  id,
  enabled,
  public_slot_cap,
  release_slot_cap,
  access_days,
  auto_grant,
  waitlist_enabled,
  campaign_title,
  landing_message,
  account_badge_label,
  export_gate_message
)
values (
  'founder_beta',
  true,
  300,
  100,
  90,
  true,
  true,
  'Founder Beta Pass',
  'Founder Beta is open first come, first served for the first 300 creators.',
  'Founder Beta Pass',
  'Founder Beta creators get 90 days of clean export access while helping shape CardForge.'
)
on conflict (id) do nothing;

create or replace function public.cardforge_claim_founder_beta(
  p_clerk_user_id text,
  p_email text
)
returns table (
  claimed boolean,
  reason text,
  access_expires_at timestamptz,
  claimed_slots integer,
  release_slot_cap integer,
  public_slot_cap integer
)
language plpgsql
security definer
set search_path = public
as $cardforge_founder_beta$
declare
  campaign public.cardforge_founder_beta_campaigns%rowtype;
  existing_claim public.cardforge_founder_beta_claims%rowtype;
  active_count integer;
  next_expires_at timestamptz;
begin
  select *
    into campaign
    from public.cardforge_founder_beta_campaigns
    where id = 'founder_beta'
    for update;

  if not found then
    return query select false, 'not_configured', null::timestamptz, 0, 0, 0;
    return;
  end if;

  select count(*)::integer
    into active_count
    from public.cardforge_founder_beta_claims
    where campaign_id = 'founder_beta'
      and status = 'active';

  select *
    into existing_claim
    from public.cardforge_founder_beta_claims
    where campaign_id = 'founder_beta'
      and clerk_user_id = p_clerk_user_id
      and status = 'active'
    limit 1;

  if found then
    return query select true, 'already_claimed', existing_claim.access_expires_at, active_count, campaign.release_slot_cap, campaign.public_slot_cap;
    return;
  end if;

  if not campaign.enabled then
    return query select false, 'campaign_paused', null::timestamptz, active_count, campaign.release_slot_cap, campaign.public_slot_cap;
    return;
  end if;

  if not campaign.auto_grant then
    return query select false, 'manual_grant_required', null::timestamptz, active_count, campaign.release_slot_cap, campaign.public_slot_cap;
    return;
  end if;

  if active_count >= campaign.release_slot_cap then
    return query select false, 'release_slots_full', null::timestamptz, active_count, campaign.release_slot_cap, campaign.public_slot_cap;
    return;
  end if;

  next_expires_at := now() + make_interval(days => campaign.access_days);

  insert into public.cardforge_founder_beta_claims (
    campaign_id,
    clerk_user_id,
    email,
    access_expires_at
  )
  values (
    'founder_beta',
    p_clerk_user_id,
    p_email,
    next_expires_at
  );

  active_count := active_count + 1;
  return query select true, 'claimed', next_expires_at, active_count, campaign.release_slot_cap, campaign.public_slot_cap;
end;
$cardforge_founder_beta$;
