begin;

revoke all on function public.cardforge_claim_founder_beta(text, text) from public;
revoke all on function public.cardforge_claim_founder_beta(text, text) from anon;
revoke all on function public.cardforge_claim_founder_beta(text, text) from authenticated;
revoke all on function public.cardforge_claim_founder_beta(text, text) from service_role;
drop function if exists public.cardforge_claim_founder_beta(text, text);

drop function if exists public.cardforge_database_metrics();

create function public.cardforge_database_metrics()
returns table (
  database_size_bytes bigint,
  cardforge_table_size_bytes bigint,
  storage_size_bytes bigint,
  asset_registry_count bigint,
  developer_submission_count bigint
)
language sql
stable
set search_path = public, pg_catalog, storage
as $$
  select
    pg_database_size(current_database())::bigint,
    coalesce((
      select sum(pg_total_relation_size(format('%I.%I', schemaname, tablename)::regclass))::bigint
      from pg_tables
      where schemaname = 'public'
        and tablename like 'cardforge_%'
    ), 0)::bigint,
    coalesce((
      select sum(
        case
          when metadata ? 'size' and (metadata->>'size') ~ '^[0-9]+$'
            then (metadata->>'size')::bigint
          else 0
        end
      )::bigint
      from storage.objects
    ), 0)::bigint,
    (select count(*)::bigint from public.cardforge_asset_registry),
    (select count(*)::bigint from public.cardforge_developer_asset_submissions);
$$;

revoke all on function public.cardforge_database_metrics() from public;
revoke all on function public.cardforge_database_metrics() from anon;
revoke all on function public.cardforge_database_metrics() from authenticated;
grant execute on function public.cardforge_database_metrics() to service_role;

delete from public.cardforge_site_content_blocks
where slug in ('landing.demo.heading', 'landing.demo.body');

alter table public.cardforge_site_content_blocks
  drop constraint if exists cardforge_site_content_blocks_slug_check;

alter table public.cardforge_site_content_blocks
  add constraint cardforge_site_content_blocks_slug_check
  check (slug in (
    'landing.hero.headline',
    'landing.hero.body',
    'landing.hero.support',
    'about.hero.headline',
    'about.hero.body',
    'sharing.message'
  ));

do $$
begin
  if to_regclass('public.cardforge_site_content_proposals') is null then
    raise exception 'cardforge_developer_contribution_cockpit_required';
  end if;
end
$$;

delete from public.cardforge_site_content_proposals
where slug in ('landing.demo.heading', 'landing.demo.body');

alter table public.cardforge_site_content_proposals
  drop constraint if exists cardforge_site_content_proposals_slug_check;

alter table public.cardforge_site_content_proposals
  add constraint cardforge_site_content_proposals_slug_check
  check (slug in (
    'landing.hero.headline',
    'landing.hero.body',
    'landing.hero.support',
    'about.hero.headline',
    'about.hero.body',
    'sharing.message'
  ));

drop table if exists public.cardforge_founder_beta_claims;
drop table if exists public.cardforge_founder_beta_campaigns;

with current_identity as (
  select identity_version
  from public.cardforge_business_identity
  where id = 'cardforge'
), publications (slug, title, body) as (
  values
    (
      'privacy',
      'Privacy Policy',
      $privacy_retired_demo$CardForge Studio is a software product created and operated by Cameron Locke, an independent sole proprietor based in Oregon.

CardForge is designed as a local-first card creation tool. Card projects, imported data, generated previews, personal uploads, export settings, and browser preferences are stored in browser IndexedDB. Portable exports and backups are downloaded project files that remain on the devices and storage locations you choose. This browser-local project data is not automatically uploaded to CardForge; it leaves your browser when you download, share, or intentionally submit it. Clearing site data, changing browsers or devices, or deleting downloaded files can remove copies that CardForge cannot recover.

Clerk provides authentication, account identity, session management, and trusted access metadata. Stripe processes billing and maintains payment, checkout, customer, refund, and subscription records. Supabase stores operational records used for shared platform features, including entitlement status, billing events, roadmap suggestions and votes, developer profiles, developer submissions and votes, asset registry records, contact requests, abuse-prevention records, legal publications, and owner settings. Resend sends communications for contact workflows and other transactional messages. Vercel hosts the site and server routes and may process standard request, device, network, and deployment log information needed to deliver and operate them. Each provider processes information for its role under its own terms and retention practices.

CardForge and Clerk use cookies and similar authentication technologies to keep users signed in, maintain sessions, protect account workflows, and remember necessary authentication state. Blocking those technologies may prevent sign-in or other account features from working.

Information you choose to provide may include an account identifier, email address, optional name, contact requests and their contents, roadmap suggestions and votes, developer profile details, developer submissions, source files, and developer votes. Developer submissions, public source files, and published library assets are intentionally shared with the review pipeline and may become visible to other users. Do not upload confidential files, private client work, or content you do not have permission to share.

Browser IndexedDB data remains until you clear it or the browser removes it, and downloaded project files remain until you delete them from the places where you saved them. Platform and provider records are retained for periods that vary by record, operational need, security and abuse-prevention need, legal obligation, and provider setting. Some billing, legal, voting, attribution, published-asset, and security records may need to remain after an account is disabled or deleted to preserve accurate platform history and system integrity.

For a privacy question or an access or deletion inquiry, contact [pyraliscameron@gmail.com](mailto:pyraliscameron@gmail.com). CardForge may need to verify the requester and may be unable to alter records that must remain for security, record-integrity, provider, or legal reasons. Account deletion does not delete browser IndexedDB or downloaded project files under your control.

CardForge uses operational safeguards, but no method of transmission or storage is completely secure. Keep control of your devices, account credentials, and downloaded backups. CardForge does not sell user project files.

CardForge is not directed to children under 13 and does not knowingly collect their personal information. A parent or guardian who believes a child provided information can use the privacy contact above.

Policy changes may be made as CardForge and its data practices develop. An updated publication will identify its version and effective date, so review the current policy when you use the service.$privacy_retired_demo$
    ),
    (
      'contact',
      'Contact and Support',
      $contact_retired_demo$CardForge Studio is a software product created and operated by Cameron Locke, an independent sole proprietor based in Oregon.

Cameron Locke handles support for CardForge Studio as its owner and legal operator. For support, developer account requests, legal questions, billing questions, account problems, or asset pipeline concerns, contact the support email listed on this site.

For fastest help, include the account email, the page or workflow where the issue happened, what you expected, what actually happened, and whether the issue involves a local project, export, template, developer asset, or billing/access state.

CardForge is in active development. Support responses are handled by the CardForge owner/operator until a larger support process is introduced.$contact_retired_demo$
    )
), versioned as (
  select
    publications.slug,
    coalesce((
      select max(existing.version)
      from public.cardforge_legal_documents existing
      where existing.slug = publications.slug
    ), 0) + 1 as version,
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
  date '2026-08-11',
  now(),
  current_identity.identity_version
from versioned
cross join current_identity;

commit;
