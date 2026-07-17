-- Convert the existing owner-edited legal registry into immutable publications.
-- Existing rows keep their title and body as version 1; this migration only
-- fills publication metadata and inserts documents that do not yet exist.

alter table public.cardforge_legal_documents
  add column if not exists version integer,
  add column if not exists effective_date date,
  add column if not exists business_identity_version integer;

update public.cardforge_legal_documents
set
  version = 1,
  effective_date = coalesce(
    effective_date,
    published_at::date,
    updated_at::date,
    date '2026-07-16'
  ),
  published_at = coalesce(published_at, updated_at, now()),
  business_identity_version = coalesce(
    business_identity_version,
    (select identity_version from public.cardforge_business_identity where id = 'cardforge'),
    1
  );

alter table public.cardforge_legal_documents
  alter column version set not null,
  alter column effective_date set not null,
  alter column published_at set not null,
  alter column business_identity_version set not null;

alter table public.cardforge_legal_documents
  drop constraint if exists cardforge_legal_documents_pkey,
  drop constraint if exists cardforge_legal_documents_slug_check,
  drop constraint if exists cardforge_legal_documents_version_check,
  drop constraint if exists cardforge_legal_documents_business_identity_version_check;

alter table public.cardforge_legal_documents
  add constraint cardforge_legal_documents_slug_check
    check (slug in (
      'privacy',
      'terms',
      'creator-pass-terms',
      'supporter-terms',
      'refund',
      'developer-terms',
      'contact',
      'accessibility',
      'creator-pool'
    )),
  add constraint cardforge_legal_documents_version_check
    check (version between 1 and 2147483647),
  add constraint cardforge_legal_documents_business_identity_version_check
    check (business_identity_version between 1 and 2147483647),
  add constraint cardforge_legal_documents_pkey primary key (slug, version);

with current_identity as (
  select identity_version
  from public.cardforge_business_identity
  where id = 'cardforge'
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
  publication.slug,
  1,
  publication.title,
  publication.body,
  date '2026-07-16',
  now(),
  coalesce(current_identity.identity_version, 1)
from current_identity
cross join (
  values
    (
      'creator-pass-terms',
      'Creator Pass Terms',
      $creator_pass$CardForge Studio is a software product created and operated by Cameron Locke, an independent sole proprietor based in Oregon.

These supplemental terms apply when CardForge Studio offers Creator Pass access. Creator Pass unlocks the features and limits shown at purchase for the stated billing period; it does not transfer ownership of CardForge Studio, shared library assets, or third-party material.

Keep your own project backups and review exported work before production. Availability, included features, usage limits, and pricing may change for future billing periods, subject to notice and applicable law. Cancellation stops future renewal and does not erase projects stored in your browser or files you downloaded.$creator_pass$
    ),
    (
      'supporter-terms',
      'Supporter Terms',
      $supporter$CardForge Studio is a software product created and operated by Cameron Locke, an independent sole proprietor based in Oregon.

These supplemental terms apply only if CardForge Studio separately offers a supporter checkout. Voluntary support for the independent creator is separate from Creator Pass. A support payment does not grant product access or any other CardForge entitlement. An entitlement exists only when a separately identified offering expressly says so and is governed by that offering's own terms.

Support is not a donation, investment, security, equity or ownership interest, profit rights, revenue share, wage, or voting or control rights. CardForge does not represent support as tax deductible. Support does not guarantee a feature, benefit, or roadmap influence.

One-time support is a single charge and does not renew. Recurring support renews at the amount and frequency shown at checkout until canceled; cancellation stops future renewal charges. Publishing these terms does not activate supporter billing or mean that either support option is currently available.

Any refund or cancellation request is handled under the Refund and Cancellation Policy and applicable law.$supporter$
    ),
    (
      'accessibility',
      'Accessibility Statement',
      $accessibility$CardForge Studio is a software product created and operated by Cameron Locke, an independent sole proprietor based in Oregon.

CardForge Studio targets WCAG 2.2 Level AA as the accessibility standard for its public site and core product workflows. This is a target, not a claim that every page, tool, export, or third-party integration currently conforms.

Known limitations may include complex canvas-style editing controls, keyboard interaction in dense creation workflows, generated preview descriptions, color-dependent user-authored designs, and accessibility behavior inside third-party account or billing interfaces. CardForge Studio will prioritize practical improvements as those areas are reviewed.

If an accessibility barrier prevents you from using CardForge Studio, contact the support email listed on this site and include the page, task, assistive technology if relevant, and the format or accommodation that would help.$accessibility$
    )
) as publication(slug, title, body)
on conflict (slug, version) do nothing;

alter table public.cardforge_legal_documents enable row level security;

revoke all on table public.cardforge_legal_documents from public, anon, authenticated, service_role;
grant select, insert on table public.cardforge_legal_documents to service_role;

create or replace function public.publish_cardforge_legal_document(
  p_slug text,
  p_title text,
  p_body text,
  p_effective_date date,
  p_expected_identity_version integer
)
returns public.cardforge_legal_documents
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_identity_version integer;
  v_next_version integer;
  v_publication public.cardforge_legal_documents;
begin
  if p_slug not in (
    'privacy',
    'terms',
    'creator-pass-terms',
    'supporter-terms',
    'refund',
    'developer-terms',
    'contact',
    'accessibility',
    'creator-pool'
  ) then
    raise exception using errcode = '22023', message = 'cardforge_legal_document_slug_invalid';
  end if;

  if length(btrim(coalesce(p_title, ''))) = 0
    or length(btrim(coalesce(p_body, ''))) = 0
    or p_effective_date is null
    or p_expected_identity_version is null
    or p_expected_identity_version < 1
  then
    raise exception using errcode = '22023', message = 'cardforge_legal_document_input_invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_slug, 0));

  select identity_version
  into v_identity_version
  from public.cardforge_business_identity
  where id = 'cardforge'
  for update;

  if v_identity_version is null then
    raise exception using errcode = 'P0001', message = 'cardforge_business_identity_storage_not_ready';
  end if;

  if v_identity_version <> p_expected_identity_version then
    raise exception using errcode = 'P0001', message = 'cardforge_business_identity_version_conflict';
  end if;

  select coalesce(max(version), 0) + 1
  into v_next_version
  from public.cardforge_legal_documents
  where slug = p_slug;

  insert into public.cardforge_legal_documents (
    slug,
    version,
    title,
    body,
    effective_date,
    published_at,
    business_identity_version
  ) values (
    p_slug,
    v_next_version,
    btrim(p_title),
    btrim(p_body),
    p_effective_date,
    now(),
    v_identity_version
  )
  returning * into v_publication;

  return v_publication;
end;
$$;

revoke execute on function public.publish_cardforge_legal_document(text, text, text, date, integer)
  from public, anon, authenticated;
revoke execute on function public.publish_cardforge_legal_document(text, text, text, date, integer)
  from service_role;
grant execute on function public.publish_cardforge_legal_document(text, text, text, date, integer)
  to service_role;
