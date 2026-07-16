-- Create one server-owned runtime identity for CardForge Studio.
-- Legacy identity columns remain on cardforge_owner_settings until post-deploy cleanup,
-- after every deployed consumer has moved to cardforge_business_identity.

create table public.cardforge_business_identity (
  id text primary key default 'cardforge' check (id = 'cardforge'),
  identity_version integer not null default 1 check (identity_version between 1 and 2147483647),
  brand_name text not null check (length(btrim(brand_name)) > 0),
  legal_operator_name text not null check (length(btrim(legal_operator_name)) > 0),
  entity_type text not null check (entity_type in ('sole_proprietor')),
  jurisdiction_state text not null check (length(btrim(jurisdiction_state)) > 0),
  jurisdiction_country text not null check (length(btrim(jurisdiction_country)) > 0),
  assumed_business_name_status text not null check (assumed_business_name_status in ('unverified', 'registered')),
  support_email text not null check (support_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  legal_email text not null check (legal_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  support_phone text,
  website_url text not null check (website_url ~ '^https://[^[:space:]/?#@]+(/[^[:space:]?#]*)?$'),
  effective_date date not null,
  copyright_holder text not null check (length(btrim(copyright_holder)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cardforge_business_identity enable row level security;

revoke all on table public.cardforge_business_identity from public, anon, authenticated, service_role;
grant select, insert, update on table public.cardforge_business_identity to service_role;

create or replace function public.cardforge_increment_business_identity_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.identity_version := 1;
    return new;
  end if;

  if old.identity_version >= 2147483647 then
    raise exception 'CardForge business identity version limit reached.';
  end if;

  new.identity_version := old.identity_version + 1;
  return new;
end;
$$;

revoke all on function public.cardforge_increment_business_identity_version() from public, anon, authenticated, service_role;
grant execute on function public.cardforge_increment_business_identity_version() to service_role;

drop trigger if exists cardforge_business_identity_increment_version on public.cardforge_business_identity;
create trigger cardforge_business_identity_increment_version
  before insert or update on public.cardforge_business_identity
  for each row
  execute function public.cardforge_increment_business_identity_version();

drop trigger if exists cardforge_business_identity_touch_updated_at on public.cardforge_business_identity;
create trigger cardforge_business_identity_touch_updated_at
  before update on public.cardforge_business_identity
  for each row
  execute function public.cardforge_touch_updated_at();

insert into public.cardforge_business_identity (
  id,
  brand_name,
  legal_operator_name,
  entity_type,
  jurisdiction_state,
  jurisdiction_country,
  assumed_business_name_status,
  support_email,
  legal_email,
  support_phone,
  website_url,
  effective_date,
  copyright_holder
)
values (
  'cardforge',
  'CardForge Studio',
  'Cameron Locke',
  'sole_proprietor',
  'Oregon',
  'United States',
  'unverified',
  'pyraliscameron@gmail.com',
  'pyraliscameron@gmail.com',
  null,
  'https://cardforges.com',
  '2026-07-16',
  'Cameron Locke'
)
on conflict (id) do nothing;

-- Keep the old deployed application accurate during the additive rollout window.
update public.cardforge_owner_settings
set
  business_name = 'CardForge Studio',
  owner_name = 'Cameron Locke',
  support_email = 'pyraliscameron@gmail.com',
  website_url = 'https://cardforges.com',
  updated_at = now()
where id = 'cardforge';

-- Replace the retired operator name in each known stale opening without
-- replacing the remainder of an owner-edited legal body. Split patterns avoid
-- carrying the retired identity forward as a new migration constant.
update public.cardforge_legal_documents
set
  body = regexp_replace(
    body,
    '^CardForge is operated by ' || 'Neon ' || 'Black Interactive ' || 'LLC and is designed as a local-first card creation tool\.',
    $privacy$CardForge Studio is a software product created and operated by Cameron Locke, an independent sole proprietor based in Oregon.

CardForge is designed as a local-first card creation tool.$privacy$,
    'i'
  ),
  published_at = now(),
  updated_at = now()
where slug = 'privacy'
  and body ~* ('^CardForge is operated by ' || 'Neon ' || 'Black Interactive ' || 'LLC and is designed as a local-first card creation tool\.');

update public.cardforge_legal_documents
set
  body = regexp_replace(
    body,
    '^CardForge is a service operated by ' || 'Neon ' || 'Black Interactive ' || 'LLC\. It lets users create templates, generate previews, manage local projects, submit developer assets, and export content according to their account access\.',
    $terms$CardForge Studio is a software product created and operated by Cameron Locke, an independent sole proprietor based in Oregon.

Your agreement for the service is with Cameron Locke as the legal operator of CardForge Studio. CardForge lets users create templates, generate previews, manage local projects, submit developer assets, and export content according to their account access.$terms$,
    'i'
  ),
  published_at = now(),
  updated_at = now()
where slug = 'terms'
  and body ~* ('^CardForge is a service operated by ' || 'Neon ' || 'Black Interactive ' || 'LLC\. It lets users create templates, generate previews, manage local projects, submit developer assets, and export content according to their account access\.');

update public.cardforge_legal_documents
set
  body = regexp_replace(
    body,
    '^CardForge is operated by ' || 'Neon ' || 'Black Interactive ' || 'LLC and is currently in public beta\.',
    $refund$CardForge Studio is a software product created and operated by Cameron Locke, an independent sole proprietor based in Oregon.

CardForge is currently in public beta.$refund$,
    'i'
  ),
  published_at = now(),
  updated_at = now()
where slug = 'refund'
  and body ~* ('^CardForge is operated by ' || 'Neon ' || 'Black Interactive ' || 'LLC and is currently in public beta\.');

-- Prepend the approved operator statement only when it is not already present.
update public.cardforge_legal_documents
set
  body = $operator$CardForge Studio is a software product created and operated by Cameron Locke, an independent sole proprietor based in Oregon.$operator$
    || E'\n\n' || body,
  published_at = now(),
  updated_at = now()
where slug in ('privacy', 'terms', 'refund')
  and body not ilike '%' || $operator$CardForge Studio is a software product created and operated by Cameron Locke, an independent sole proprietor based in Oregon.$operator$ || '%';

-- Contact and developer terms keep their complete owner-edited body and gain the
-- same operator sentence only when missing. Creator Pool content is untouched.
update public.cardforge_legal_documents
set
  body = $operator$CardForge Studio is a software product created and operated by Cameron Locke, an independent sole proprietor based in Oregon.$operator$
    || E'\n\n' || body,
  published_at = now(),
  updated_at = now()
where slug in ('contact', 'developer-terms')
  and body not ilike '%' || $operator$CardForge Studio is a software product created and operated by Cameron Locke, an independent sole proprietor based in Oregon.$operator$ || '%';
