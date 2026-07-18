delete from public.cardforge_site_content_blocks
where slug in (
  'access.hero.headline',
  'access.hero.body',
  'access.creatorPool.note'
);

alter table public.cardforge_site_content_blocks
  drop constraint if exists cardforge_site_content_blocks_slug_check;

alter table public.cardforge_site_content_blocks
  add constraint cardforge_site_content_blocks_slug_check
  check (slug in (
    'landing.hero.headline',
    'landing.hero.body',
    'landing.hero.support',
    'landing.demo.heading',
    'landing.demo.body',
    'about.hero.headline',
    'about.hero.body',
    'sharing.message'
  ));

insert into public.cardforge_site_content_blocks (slug, body, updated_at)
values (
  'sharing.message',
  'Check out CardForge Studio—a friendly way to design one card and build the whole set.',
  now()
)
on conflict (slug) do nothing;

-- Route consolidation changes where customers find subscription controls.
-- Publish that wording as new immutable legal versions; do not rewrite history.
with current_identity as (
  select identity_version
  from public.cardforge_business_identity
  where id = 'cardforge'
), publications (slug, title, body) as (
  values
    (
      'supporter-terms',
      'Supporter Terms',
      $supporter_consolidated$CardForge Studio is a software product created and operated by Cameron Locke, an independent sole proprietor based in Oregon.

These supplemental terms apply only if CardForge Studio separately offers a supporter checkout. Voluntary support for the independent creator is separate from Creator Pass. A support payment does not grant product access or any other CardForge entitlement. An entitlement exists only when a separately identified offering expressly says so and is governed by that offering's own terms.

Support is not a donation, investment, security, equity or ownership interest, profit rights, revenue share, wage, or voting or control rights. CardForge does not represent support as tax deductible. Support does not guarantee a feature, benefit, or roadmap influence.

One-time support is a single charge and does not renew. Recurring support renews monthly at the exact amount shown before payment until canceled. Supporters can stop future renewal charges through the Stripe-hosted supporter management link in the support section of Cameron's page. Cancellation does not retroactively refund completed charges.

Any refund or cancellation request is handled under the Refund and Cancellation Policy and applicable law.$supporter_consolidated$
    ),
    (
      'refund',
      'Refund and Cancellation Policy',
      $refund_consolidated$CardForge Studio is a software product created and operated by Cameron Locke, an independent sole proprietor based in Oregon.

CardForge is currently in public beta. Self-service subscription billing and the customer billing portal are active when offered through the CardForge account.

Use the account billing portal to manage or cancel Creator Pass. Use the Stripe-hosted supporter management link in the support section of Cameron's page to cancel recurring support. Cancellation stops future renewals; access from a canceled Creator Pass ordinarily continues through the already-paid period unless Stripe shows otherwise.

Creator Pass refund requests are reviewed using the payment record, product-access history, the circumstances of the request, and applicable law. One-time and recurring support payments are voluntary and are ordinarily final once completed, but duplicate, erroneous, fraudulent, or legally required refunds will be reviewed. Canceling recurring support does not automatically refund an earlier support charge. Nothing in this policy limits rights that cannot legally be limited.

If you have a billing, cancellation, or export-access issue, contact support with the account email, transaction reference if available, and a short description of the issue.$refund_consolidated$
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
  date '2026-07-17',
  now(),
  current_identity.identity_version
from versioned
cross join current_identity;
