# CardForge Studio Public Identity, Trust, SEO, and Support Design

Date: July 16, 2026

Status: Approved direction; implementation is divided into five independently reviewed delivery gates.

## Purpose

CardForge needs a coordinated trust and conversion overhaul rather than another isolated visual refresh. The work must make four facts immediately understandable:

1. CardForge Studio produces reusable card systems and complete sets.
2. The product is credible because it shows real output, real workflows, and its real founder.
3. Product access, contributor participation, and voluntary founder support are distinct.
4. CardForge Studio is a product and brand created and operated by Cameron Locke, an Oregon sole proprietor.

The target brand is modern craft software with restrained forge character: human-built, proof-led, local-first, and production-focused.

## Locked Identity Decision

- Product and brand: **CardForge Studio**
- Legal operator and contracting party: **Cameron Locke**
- Business structure: **sole proprietorship**
- Operating jurisdiction: **Oregon, United States**
- Current public description: **CardForge Studio is a software product created and operated by Cameron Locke, an independent sole proprietor based in Oregon.**
- Neon Black Interactive LLC has no current operator, contracting-party, privacy-controller, billing, receipt, structured-data, or public-brand role for CardForge.

CardForge Studio is not presented as a separate corporation or LLC. The application must not use “Cameron Locke d/b/a CardForge Studio” until an Oregon Assumed Business Name registration or another professionally confirmed basis supports that wording. Oregon registration is an external administrative task and does not change the product name.

A future transfer to Neon Black is outside this implementation. It requires a documented transfer of applicable intellectual property, domains, accounts, customer relationships, provider records, tax responsibilities, and contracts. Git history alone is not transfer evidence.

## Delivery Strategy

The overhaul is delivered through five gates. Each code gate receives its own branch, focused pull request, verification evidence, and explicit merge decision. No gate may leave two active identity, legal, navigation, or billing-purpose systems running in parallel.

### Gate 1: Operator Correction and Business Identity Foundation

Goal: correct the active operator everywhere without waiting for the visual or billing work.

Deliverables:

- Introduce a focused `business-identity` feature as the runtime source of truth for public operator identity.
- Store and normalize brand name, legal operator name, entity type, jurisdiction, assumed-name status, support email, legal/privacy email, website, effective date, and copyright holder.
- Let Owner compose business-identity editing through the feature's public interface; Owner does not own the identity data.
- Replace active Neon Black defaults and operator copy in Public Site, Legal, Contact, health expectations, tests, documentation, and seed/migration paths.
- Update current legal defaults to identify Cameron while preserving honest beta and local-first boundaries.
- Add a future-transfer runbook.
- Prepare a production data migration without applying it.

Production Supabase mutation, legal publication, provider configuration, merge, and deployment remain explicit approval actions.

### Gate 2: Legal Publication, SEO, and Cached Public Delivery

Goal: establish trustworthy public documents and page identity before the visual overhaul.

Deliverables:

- Extend legal publication records with document slug, version, effective date, publication timestamp, body, and business-identity version.
- Publish distinct Privacy, Terms, Creator Pass, Supporter, Refund/Cancellation, Developer, Contact/Legal, Accessibility, and Creator Pool archive records.
- Do not add retroactive acceptance tracking. Document that revised-terms acceptance remains a future product decision.
- Add shared metadata builders for unique title, description, absolute self-canonical, Open Graph URL, social image, and robots directives.
- Use structured data that represents Cameron as `Person` and operator/provider, CardForge Studio as `Brand`, CardForge as `SoftwareApplication`, and `/cameron` as `ProfilePage`.
- Restrict the sitemap to intentional canonical marketing routes. Remove `/studio`, `/account`, `/owner`, private/API routes, and artificial universal modification dates.
- Mark `/studio`, `/account`, and `/owner` as noindex. Creator Pool is archived or noindexed and removed from primary navigation.
- Choose and document one consistent policy for legal-page indexing. The default is public and canonical, excluded from the marketing sitemap, with no noindex unless a specific document creates search confusion.
- Replace unconditional dynamic rendering on public marketing/legal pages with tagged caching or revalidation. Private and account-specific content stays dynamic.
- Make publication operations revalidate only affected public tags/routes.

### Gate 3: Proof-Led Public Site and Public Accessibility

Goal: make the product understandable and credible before visitors read long feature descriptions.

Routes:

- `/`: primary product landing and conversion
- `/examples`: finished CardForge systems and template-to-set demonstrations
- `/account`: free exploration, Creator Pass, and contributor distinction
- `/about`: product mission, local-first philosophy, and reusable-system workflow
- `/cameron`: founder story and sole-proprietor identity
- `/developer`: contributor program
- `/roadmap`: shipped work and direction
- `/contact`: support, billing, legal, and privacy contact
- `/cameron#support`: founder support and payment activation belong to the unified Cameron page

Homepage sequence:

1. Outcome-led hero: “Build complete card sets from one reusable system.”
2. Primary action: “Try the Studio.”
3. Secondary action: “See Complete Sets.”
4. Real editor and CardForge-rendered set proof.
5. Four-step template → data → set → review/export workflow.
6. Honest finished-set examples.
7. Clear product-access comparison.
8. Founder strip linking to Cameron and Support.
9. One final Studio action.

Examples are backed by one owned examples model. Each record supports name, description, card count, system type, front/back imagery, template image, source-data format, output formats, alt text, and optional case-study detail. Only real CardForge output is used. No invented testimonials, customers, metrics, logos, or synthetic founder portrait are allowed.

The public visual system retains charcoal, brass, ivory, the approved mark, refined serif display type, and restrained forge language. It introduces shared tokens, readable light/neutral sections, fewer bordered panels, clearer hierarchy, and real product proof as the dominant visual material.

Public marketing, founder, support, and legal pages target WCAG 2.2 AA. Scope includes semantic landmarks, skip navigation, heading order, contrast, 16px-or-larger ordinary copy, visible unobscured focus, reduced motion, accessible mobile navigation, consistent Contact/Help access, labeled forms, error summaries, live status, alternative text, and minimum target sizing. The Studio receives critical accessibility fixes found during this work, but full Studio conformance remains a separately measured product-accessibility program. No site-wide conformance claim is published without complete testing.

### Gate 4: Billing Purpose and Support Implementation

Goal: introduce creator support without allowing support payments to grant product access.

Locked billing purposes:

- `product_access`
- `creator_support`

Configuration:

- Rename `STRIPE_PRICE_ID` to `STRIPE_CREATOR_PASS_PRICE_ID` with no compatibility fallback.
- Validate every price and purpose against server-owned configuration.
- Support one-time customer-selected payments only where Stripe supports them.
- Use fixed prices for recurring monthly support tiers. Customer-selected recurring amounts are not part of the design.

Checkout behavior:

- Creator Pass remains authenticated, uses `product_access`, and can update CardForge entitlement after verified payment/subscription events.
- Creator support may be unauthenticated, uses `creator_support`, collects only provider-required payer information, and never invokes entitlement builders.
- An optional Clerk identifier may be attached to support for reporting convenience, but it does not create access.
- Checkout disclosures state amount, frequency, renewal, cancellation, refund treatment, and the absence of product access or ownership rights.

Webhook behavior:

- Classify each supported event by explicit, server-validated billing purpose before fulfillment.
- Product events preserve durable ordering, deduplication, reconciliation, and entitlement behavior.
- Support events record revenue/refund/cancellation state without changing entitlement.
- Missing, unknown, or mismatched purpose is recorded as unmatched or failed-safe; it is never guessed from Checkout mode alone.
- Use the existing durable event ledger extended with purpose rather than creating a duplicate event system.

Owner reporting separates Creator Pass MRR, recurring supporter revenue, one-time support, refunds, failed events, unmatched events, and reconciliation state. Product cancellation and support cancellation copy remain distinct.

Gate 4 prepares test-mode/provider configuration but does not create live prices, change the Stripe business profile, apply production migrations, or activate support in production.

### Gate 5: Approved Provider and Production Rollout

Goal: align external systems with the reviewed code and prove the complete live data flow.

The rollout inventory covers:

- Oregon Assumed Business Name status and final permitted operator wording
- Stripe legal/business profile, Creator Pass product, support products/prices, statement descriptor, receipts, portal, and webhooks
- Supabase business identity, legal publication, billing-purpose schema, event ledger, and reporting data
- Resend sender and reply-to identity
- Clerk application branding and customer metadata boundaries
- Vercel project/team billing and public deployment identity where applicable
- domain registrar/registrant records where applicable
- Search Console, sitemap, structured-data inspection, and social-share previews
- GitHub and operational documentation where public/operator identity appears

Every provider mutation requires explicit approval immediately before execution. Verification includes one test-mode product checkout, one one-time support checkout, one recurring support checkout, proof that support creates no entitlement, duplicate/stale event handling, cancellation/refund behavior, exact migration verification, legal publication, exact-commit deployment, route health, and scoped runtime-error inspection.

## Feature Ownership

- `business-identity`: current operator contract, normalization, persistence, versioning, and public/server interfaces
- `public-site`: marketing content, examples, public shell, navigation, footer, and public presentation
- `legal`: versioned legal publication and rendering using business identity
- `billing`: Stripe configuration, purposes, checkout, portal, webhook, ledger, reconciliation, and revenue reporting
- `account`: customer account status and product entitlement
- `contact`: purpose-specific contact intake and routing
- `developer-assets`: contributor program and published asset pipeline
- `app-shell`: route composition only
- `owner`: owner authorization and lazy composition of feature-owned operational panels
- `domain`: pure business rules and cross-feature data contracts that contain no persistence or framework behavior
- `shared`: true cross-feature primitives only

No root `src/lib`, catch-all Owner store, duplicate operator catalog, compatibility environment variable, or parallel legal body source is reintroduced.

## Legal and Public Copy Boundaries

Support is described as voluntary support for an independent creator, not a donation, investment, security, equity interest, profit right, charitable contribution, or guaranteed roadmap influence. Support grants no CardForge entitlement unless a separately identified offering explicitly says so.

Legal text may describe the actual product and data flow but must not invent arbitration, class-action waivers, liability caps, tax treatment, or consumer-right waivers. Oregon counsel and a tax professional remain the final reviewers for public legal/tax claims.

The privacy architecture must accurately cover browser IndexedDB, downloaded project files, Clerk authentication, Stripe billing, Supabase operational records, Resend communications, Vercel hosting, cookies/authentication technology, contact requests, roadmap participation, developer submissions, retention, deletion/access requests, security limitations, children, policy changes, and contact channels.

## Error and Safety Design

- Public content falls back only to the current Cameron-owned repository default, never Neon Black.
- A failed public-content lookup must not expose private provider details or cause a permanent “Connecting…” state.
- Business-identity updates validate required fields and produce an auditable version.
- Legal publication rejects unknown slugs, empty bodies, and identity-version mismatches.
- Billing rejects unknown prices, purposes, missing purpose metadata, and purpose/price conflicts.
- Webhook retries are idempotent. Stale events cannot reverse newer state.
- Support checkout endpoints use durable public-mutation rate limiting and do not expose Stripe secrets.
- Public caching never includes account, owner, entitlement, or private provider state.
- User card projects remain browser-local unless explicitly exported or submitted.

## Verification Contract

Every gate runs the repository's complete applicable checks:

```bash
npm run lint
npm run typecheck
npm run test
npm run architecture:check
npm run build
npm run smoke
git diff --check
```

Focused coverage across the series includes:

- business-identity normalization, versioning, and Cameron rendering
- no active Neon Black operator references
- legal identity/version rendering
- route metadata, canonicals, robots, sitemap, and structured data
- cached public delivery and publication revalidation
- navigation, mobile menu, the unified founder-support flow, and accessibility axe checks
- examples model and truthful output rendering
- product/support checkout purposes and price validation
- support events never changing entitlement
- product events preserving entitlement behavior
- one-time and recurring support
- duplicate delivery and stale ordering
- support cancellation/refund handling
- separated Owner reporting

Repository-wide stale-reference scans cover `Neon Black Interactive`, `STRIPE_PRICE_ID`, `cardforge-studio-export`, `creator-pool`, `rel="canonical"`, `noindex`, `billingPurpose`, `creator_support`, and `product_access`. Each remaining match must be intentional and explained in its pull request.

Manual verification covers desktop/mobile layouts, keyboard navigation, landmarks/headings, reduced motion, contrast, public identity, legal documents, checkout disclosures, cancellation/refund paths, sitemap/robots, social previews, and Owner composition. Provider-backed claims are not marked complete until Gate 5 live verification passes.

## Pull Request Standard

Each pull request documents:

- changed behavior and reason
- feature ownership boundaries
- legal, privacy, and data implications
- automated and manual evidence
- legacy paths removed
- provider work still pending
- unresolved risk and rollback boundary

Each gate is merged only after its own review and required checks. Gate 1 is intentionally small enough to correct the current operator without waiting for the rest of the program.

## Planning References

- Oregon Secretary of State, sole proprietorship and assumed-business-name guidance: <https://sos.oregon.gov/business/pages/select-business-name-structure.aspx>
- Oregon Department of Revenue, sole-proprietor tax registration overview: <https://www.oregon.gov/dor/programs/businesses/Pages/business-registration.aspx>
- Stripe Payment Links pricing models and customer-selected amount limitation: <https://docs.stripe.com/payment-links/create>
- Google canonical guidance: <https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls>
- Google sitemap guidance: <https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap>
- W3C Web Content Accessibility Guidelines 2.2: <https://www.w3.org/TR/WCAG22/>
