begin;

do $$
begin
  if to_regclass('public.cardforge_legal_documents') is null then
    raise exception 'cardforge_versioned_legal_publications_required';
  end if;
end
$$;

with current_identity as (
  select identity_version
  from public.cardforge_business_identity
  where id = 'cardforge'
), publication (slug, title, body) as (
  values (
    'privacy',
    'Privacy Policy',
    $privacy_analytics$CardForge Studio is a software product created and operated by Cameron Locke, an independent sole proprietor based in Oregon.

CardForge is designed as a local-first card creation tool. Card projects, imported data, generated previews, personal uploads, export settings, and browser preferences are stored in browser IndexedDB. Portable exports and backups are downloaded project files that remain on the devices and storage locations you choose. This browser-local project data is not automatically uploaded to CardForge; it leaves your browser when you download, share, or intentionally submit it. Clearing site data, changing browsers or devices, or deleting downloaded files can remove copies that CardForge cannot recover.

Clerk provides authentication, account identity, session management, and trusted access metadata. Stripe processes billing and maintains payment, checkout, customer, refund, and subscription records. Supabase stores operational records used for shared platform features, including entitlement status, billing events, roadmap suggestions and votes, developer profiles, developer submissions and votes, asset registry records, contact requests, abuse-prevention records, legal publications, and owner settings. Resend sends communications for contact workflows and other transactional messages. Vercel hosts the site and server routes and may process standard request, device, network, and deployment log information needed to deliver and operate them. Each provider processes information for its role under its own terms and retention practices.

CardForge and Clerk use cookies and similar authentication technologies to keep users signed in, maintain sessions, protect account workflows, and remember necessary authentication state. Blocking those technologies may prevent sign-in or other account features from working.

CardForge may also offer optional, privacy-minimized Google Analytics measurement to understand website acquisition and how visitors move into core creation activities. This measurement is off until you choose "Allow analytics," and you may turn it off later through the Analytics settings shown by CardForge. If allowed, Google Analytics uses a randomly generated client identifier in a first-party cookie to distinguish a browser and its sessions. Google may receive basic session, browser, device, language, and approximate-location information alongside a sanitized page path and title, limited referrer context, approved campaign parameters, and explicit events for opening Studio, signing up, creating a card, and completing an export. Card content, project names, account names, email addresses, non-campaign query values, and owner or developer-cockpit activity are not sent as analytics events. CardForge does not enable Google advertising storage, Google Signals, ad personalization, or Enhanced Measurement. Google controls the resulting analytics records and applies its own processing and retention practices; CardForge reads aggregated reports but does not copy raw visitor events into Supabase. You can learn more in Google's privacy policy at https://policies.google.com/privacy.

The analytics choice is stored in a first-party cookie for up to 180 days so CardForge can remember it. Turning analytics off prevents future Google Analytics collection from that browser and removes Google Analytics cookies that CardForge can identify, but it does not retroactively delete aggregated or previously processed Google records. You can also block or clear cookies in your browser. Google Search Console separately provides CardForge with aggregated information about how pages appear and perform in Google Search; it does not depend on the optional CardForge analytics choice.

Information you choose to provide may include an account identifier, email address, optional name, contact requests and their contents, roadmap suggestions and votes, developer profile details, developer submissions, source files, and developer votes. Developer submissions, public source files, and published library assets are intentionally shared with the review pipeline and may become visible to other users. Do not upload confidential files, private client work, or content you do not have permission to share.

Browser IndexedDB data remains until you clear it or the browser removes it, and downloaded project files remain until you delete them from the places where you saved them. Platform and provider records are retained for periods that vary by record, operational need, security and abuse-prevention need, legal obligation, and provider setting. Some billing, legal, voting, attribution, published-asset, and security records may need to remain after an account is disabled or deleted to preserve accurate platform history and system integrity.

For a privacy question or an access or deletion inquiry, contact [pyraliscameron@gmail.com](mailto:pyraliscameron@gmail.com). CardForge may need to verify the requester and may be unable to alter records that must remain for security, record-integrity, provider, or legal reasons. Account deletion does not delete browser IndexedDB or downloaded project files under your control.

CardForge uses operational safeguards, but no method of transmission or storage is completely secure. Keep control of your devices, account credentials, and downloaded backups. CardForge does not sell user project files.

CardForge is not directed to children under 13 and does not knowingly collect their personal information. A parent or guardian who believes a child provided information can use the privacy contact above.

Policy changes may be made as CardForge and its data practices develop. An updated publication will identify its version and effective date, so review the current policy when you use the service.$privacy_analytics$
  )
), versioned as (
  select
    publication.slug,
    coalesce((
      select max(existing.version)
      from public.cardforge_legal_documents existing
      where existing.slug = publication.slug
    ), 0) + 1 as version,
    publication.title,
    publication.body
  from publication
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
  date '2026-08-12',
  now(),
  current_identity.identity_version
from versioned
cross join current_identity;

commit;
