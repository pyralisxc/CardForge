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

-- Preserve the historical production rows above as version 1, then make the
-- reviewed Gate 2 documents the current publications. Missing slugs also keep
-- their minimal version 1 seed so the publication history is consistent.
with current_identity as (
  select identity_version
  from public.cardforge_business_identity
  where id = 'cardforge'
), reviewed_gate_two_publications(slug, version, title, body) as (
  values
    (
      'privacy',
      2,
      'Privacy Policy',
      $privacy_reviewed$CardForge Studio is a software product created and operated by Cameron Locke, an independent sole proprietor based in Oregon.

CardForge is designed as a local-first card creation tool. Card projects, imported data, generated previews, personal uploads, export settings, and browser preferences are stored in browser IndexedDB. Portable exports and backups are downloaded project files that remain on the devices and storage locations you choose. This browser-local project data is not automatically uploaded to CardForge; it leaves your browser when you download, share, or intentionally submit it. Clearing site data, changing browsers or devices, or deleting downloaded files can remove copies that CardForge cannot recover.

Clerk provides authentication, account identity, session management, and trusted access metadata. Stripe processes billing and maintains payment, checkout, customer, refund, and subscription records. Supabase stores operational records used for shared platform features, including entitlement status, billing events, Founder Beta claims, roadmap suggestions and votes, developer profiles, developer submissions and votes, asset registry records, contact requests, abuse-prevention records, legal publications, and owner settings. Resend sends communications for contact workflows and other transactional messages. Vercel hosts the site and server routes and may process standard request, device, network, and deployment log information needed to deliver and operate them. Each provider processes information for its role under its own terms and retention practices.

CardForge and Clerk use cookies and similar authentication technologies to keep users signed in, maintain sessions, protect account workflows, and remember necessary authentication state. Blocking those technologies may prevent sign-in or other account features from working.

Information you choose to provide may include an account identifier, email address, optional name, contact requests and their contents, Founder Beta participation, roadmap suggestions and votes, developer profile details, developer submissions, source files, and developer votes. Developer submissions, public source files, and published library assets are intentionally shared with the review pipeline and may become visible to other users. Do not upload confidential files, private client work, or content you do not have permission to share.

Browser IndexedDB data remains until you clear it or the browser removes it, and downloaded project files remain until you delete them from the places where you saved them. Platform and provider records are retained for periods that vary by record, operational need, security and abuse-prevention need, legal obligation, and provider setting. Some billing, legal, voting, attribution, published-asset, and security records may need to remain after an account is disabled or deleted to preserve accurate platform history and system integrity.

For a privacy question or an access or deletion inquiry, contact [pyraliscameron@gmail.com](mailto:pyraliscameron@gmail.com). CardForge may need to verify the requester and may be unable to alter records that must remain for security, record-integrity, provider, or legal reasons. Account deletion does not delete browser IndexedDB or downloaded project files under your control.

CardForge uses operational safeguards, but no method of transmission or storage is completely secure. Keep control of your devices, account credentials, and downloaded backups. CardForge does not sell user project files.

CardForge is not directed to children under 13 and does not knowingly collect their personal information. A parent or guardian who believes a child provided information can use the privacy contact above.

Policy changes may be made as CardForge and its data practices develop. An updated publication will identify its version and effective date, so review the current policy when you use the service.$privacy_reviewed$
    ),
    (
      'terms',
      2,
      'Terms of Service',
      $terms_reviewed$CardForge Studio is a software product created and operated by Cameron Locke, an independent sole proprietor based in Oregon.

Your agreement for the service is with Cameron Locke as the legal operator of CardForge Studio. CardForge lets users create templates, generate previews, manage local projects, submit developer assets, and export content according to their account access. You are responsible for the content, artwork, data, trademarks, and intellectual property you bring into the tool.

You keep ownership of the content you create. By using CardForge, you grant CardForge the limited permission needed to operate the service, render previews, process exports, preserve local/project state, and, when you submit assets to the developer pipeline, review, display, publish, archive, and maintain those submitted assets as part of the shared library.

The product is in active beta. Features, pricing, access levels, export behavior, developer rules, and library availability may change as the service develops. Do not use CardForge for unlawful content, infringing content, malicious uploads, harassment, or activity that harms the platform or other users.

CardForge is a creative production tool, not a print vendor or legal clearance service. Always proof exports, keep your own backups, and confirm printer/manufacturer requirements before production.$terms_reviewed$
    ),
    (
      'creator-pass-terms',
      2,
      'Creator Pass Terms',
      $creator_pass_reviewed$CardForge Studio is a software product created and operated by Cameron Locke, an independent sole proprietor based in Oregon.

These supplemental terms apply when CardForge Studio offers Creator Pass access. Creator Pass unlocks the features and limits shown at purchase for the stated billing period; it does not transfer ownership of CardForge Studio, shared library assets, or third-party material.

Keep your own project backups and review exported work before production. Availability, included features, usage limits, and pricing may change for future billing periods, subject to notice and applicable law. Cancellation stops future renewal and does not erase projects stored in your browser or files you downloaded.$creator_pass_reviewed$
    ),
    (
      'supporter-terms',
      2,
      'Supporter Terms',
      $supporter_reviewed$CardForge Studio is a software product created and operated by Cameron Locke, an independent sole proprietor based in Oregon.

These supplemental terms apply only if CardForge Studio separately offers a supporter checkout. Voluntary support for the independent creator is separate from Creator Pass. A support payment does not grant product access or any other CardForge entitlement. An entitlement exists only when a separately identified offering expressly says so and is governed by that offering's own terms.

Support is not a donation, investment, security, equity or ownership interest, profit rights, revenue share, wage, or voting or control rights. CardForge does not represent support as tax deductible. Support does not guarantee a feature, benefit, or roadmap influence.

One-time support is a single charge and does not renew. Recurring support renews at the amount and frequency shown at checkout until canceled; cancellation stops future renewal charges. Publishing these terms does not activate supporter billing or mean that either support option is currently available.

Any refund or cancellation request is handled under the Refund and Cancellation Policy and applicable law.$supporter_reviewed$
    ),
    (
      'refund',
      2,
      'Refund and Cancellation Policy',
      $refund_reviewed$CardForge Studio is a software product created and operated by Cameron Locke, an independent sole proprietor based in Oregon.

CardForge is currently in public beta. Self-service subscription billing and the customer billing portal are active when offered on the access page.

Use the account billing portal to manage or cancel an active subscription. Refund requests should be sent to the support email listed on this site and are reviewed using the payment record, product-access history, the circumstances of the request, and applicable law. Nothing in this policy limits rights that cannot legally be limited.

If you have a billing, cancellation, or export-access issue, contact support with the account email, transaction reference if available, and a short description of the issue.$refund_reviewed$
    ),
    (
      'developer-terms',
      2,
      'Developer Contributor Terms',
      $developer_reviewed$CardForge Studio is a software product created and operated by Cameron Locke, an independent sole proprietor based in Oregon.

Your developer contribution agreement is with Cameron Locke as the legal operator of CardForge Studio. Forge Review is the developer contribution path for CardForge. Developers may submit templates, icons, dividers, textures, frames, source files, element recipes, and other approved creative assets into the shared review pipeline.

Only submit work you created, own, licensed, or have clear permission to contribute. Do not submit confidential work, client-restricted files, AI-generated material that violates its source license, infringing content, malware, deceptive files, or anything you would not want reviewed, archived, published, or used by other CardForge users.

Submitted assets move through the same platform pipeline as starter assets: draft, submitted, voting, publish candidate, published, archived, or rejected. Developer votes, owner rules, quality scores, access tiers, and platform caps can affect where an asset appears. Published assets may remain available after a developer leaves so existing users and templates do not break.

Contributor records are durable platform history. Deleting or disabling an account should not delete prior votes, source-file references, registry records, published assets, or contribution attribution snapshots. Owners may archive, remove, or edit platform availability for safety, quality, legal, licensing, or operational reasons.

These developer terms describe the current contribution model and do not create employment, partnership, guaranteed payment, or ownership of CardForge unless a separate written agreement says so.$developer_reviewed$
    ),
    (
      'contact',
      2,
      'Contact and Support',
      $contact_reviewed$CardForge Studio is a software product created and operated by Cameron Locke, an independent sole proprietor based in Oregon.

Cameron Locke handles support for CardForge Studio as its owner and legal operator. For support, beta access, developer account requests, legal questions, billing questions, account problems, or asset pipeline concerns, contact the support email listed on this site.

For fastest help, include the account email, the page or workflow where the issue happened, what you expected, what actually happened, and whether the issue involves a local project, export, template, developer asset, or billing/access state.

CardForge is in active development. Support responses are handled by the CardForge owner/operator until a larger support process is introduced.$contact_reviewed$
    ),
    (
      'accessibility',
      2,
      'Accessibility Statement',
      $accessibility_reviewed$CardForge Studio is a software product created and operated by Cameron Locke, an independent sole proprietor based in Oregon.

CardForge Studio targets WCAG 2.2 Level AA as the accessibility standard for its public site and core product workflows. This is a target, not a claim that every page, tool, export, or third-party integration currently conforms.

Known limitations may include complex canvas-style editing controls, keyboard interaction in dense creation workflows, generated preview descriptions, color-dependent user-authored designs, and accessibility behavior inside third-party account or billing interfaces. CardForge Studio will prioritize practical improvements as those areas are reviewed.

If an accessibility barrier prevents you from using CardForge Studio, contact the support email listed on this site and include the page, task, assistive technology if relevant, and the format or accommodation that would help.$accessibility_reviewed$
    ),
    (
      'creator-pool',
      2,
      'Archived Creator Pool Notice',
      $creator_pool_reviewed$The Creator Pool concept is archived and inactive. CardForge Studio does not currently operate creator-pool payout infrastructure or accrue creator-pool balances.

The creator pool is not active payout infrastructure today. It is not stock, equity, a security, employment, partnership, a wage promise, or guaranteed income. Any future program would depend on billing, refund handling, tax handling, payout provider setup, creator eligibility rules, legal review, and separately published program terms.

Archived planning language does not create a payable balance or enforceable distribution schedule.$creator_pool_reviewed$
    )
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
  reviewed.slug,
  reviewed.version,
  reviewed.title,
  reviewed.body,
  date '2026-07-16',
  now(),
  current_identity.identity_version
from reviewed_gate_two_publications as reviewed
cross join current_identity
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
