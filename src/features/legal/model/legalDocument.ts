import {
  DEFAULT_BUSINESS_IDENTITY,
  formatBusinessIdentityDescription,
} from '@/features/business-identity/client';
import { parseLegalBody } from './legalBody';

export type LegalDocumentSlug =
  | 'privacy'
  | 'terms'
  | 'creator-pass-terms'
  | 'supporter-terms'
  | 'refund'
  | 'developer-terms'
  | 'contact'
  | 'accessibility'
  | 'creator-pool';

export interface LegalDocument {
  slug: LegalDocumentSlug;
  version: number;
  title: string;
  effectiveDate: string;
  publishedAt: string;
  body: string;
  businessIdentityVersion: number;
}

export interface LegalDocumentWrite {
  slug: LegalDocumentSlug;
  title: string;
  effectiveDate: string;
  body: string;
  expectedBusinessIdentityVersion: number;
}

const operatorDescription = formatBusinessIdentityDescription(DEFAULT_BUSINESS_IDENTITY);

const privacyBody = `${operatorDescription}

CardForge is designed as a local-first card creation tool. Card projects, imported data, generated previews, personal uploads, export settings, and browser preferences are stored in browser IndexedDB. Portable exports and backups are downloaded project files that remain on the devices and storage locations you choose. This browser-local project data is not automatically uploaded to CardForge; it leaves your browser when you download, share, or intentionally submit it. Clearing site data, changing browsers or devices, or deleting downloaded files can remove copies that CardForge cannot recover.

Clerk provides authentication, account identity, session management, and trusted access metadata. Stripe processes billing and maintains payment, checkout, customer, refund, and subscription records. Supabase stores operational records used for shared platform features, including entitlement status, billing events, roadmap suggestions and votes, developer profiles, developer submissions and votes, asset registry records, contact requests, abuse-prevention records, legal publications, and owner settings. Resend sends communications for contact workflows and other transactional messages. Vercel hosts the site and server routes and may process standard request, device, network, and deployment log information needed to deliver and operate them. Each provider processes information for its role under its own terms and retention practices.

Signed-in users may connect CardForge to ChatGPT, Codex, or another compatible Model Context Protocol client. That client and its provider separately process conversation and tool-call data under their own terms. CardForge receives the tool inputs the client sends and returns the requested tool results. To support continued editing, Supabase stores private assistant working documents tied to the CardForge account. Those documents may contain editable Templates, cards and card sets, production plans, revisions, and artwork intentionally attached through the assistant workflow. They are separate from ordinary browser-local Studio projects and are not published unless the user later chooses a separate review or publication workflow.

CardForge also records aggregate MCP usage tied to the account and tool name, including attempts, success or failure, assisted-action units, request and response byte counts, tool duration, and private assistant document counts and storage size. The aggregate usage table does not store prompts, card content, artwork, or document payloads. Those totals support reliability review, capacity planning, plan presentation, abuse prevention, and future usage-policy decisions; the displayed capacity values are measurement targets and are not currently enforced quotas or overage charges.

CardForge and Clerk use cookies and similar authentication technologies to keep users signed in, maintain sessions, protect account workflows, and remember necessary authentication state. Blocking those technologies may prevent sign-in or other account features from working.

CardForge may also offer optional, privacy-minimized measurement through Google Analytics and PostHog to understand website acquisition and how visitors interact with core creation activities. This measurement is off until you choose "Accept" or "Accept once," and you may decline or turn it off later through the Analytics settings shown by CardForge. If allowed, Google Analytics uses a randomly generated client identifier in a first-party cookie. Google may receive basic session, browser, device, language, and approximate-location information alongside a sanitized page path and title, limited referrer context, approved campaign parameters, and explicit CardForge activity events. PostHog uses an anonymous identifier kept only in browser session storage and receives a sanitized path, basic browser and device context, and allow-listed events such as navigation, card-format choices, card creation, and export outcomes. Approximate-location enrichment is disabled for PostHog events. CardForge does not identify visitors to PostHog or create PostHog person profiles.

CardForge does not use PostHog session replay. PostHog receives only the allow-listed event properties described above; it does not receive recordings of page content, text, form inputs, card content, project or design names, account names, email addresses, uploaded files, non-campaign query values, or raw private workspace content. CardForge does not enable Google advertising storage, Google Signals, ad personalization, or Enhanced Measurement. Google and PostHog control the resulting analytics records under their own processing and retention practices; CardForge reads owner-only reports but does not copy raw visitor events into Supabase. Learn more in Google's privacy policy at https://policies.google.com/privacy and PostHog's privacy information at https://posthog.com/privacy.

Choosing "Accept" or "Decline" stores the analytics choice in a first-party cookie for up to 180 days so CardForge can remember it. Choosing "Accept once" stores permission only for the current browser-tab session. PostHog's anonymous browser state is session-only regardless of which acceptance option you choose. Declining or turning analytics off prevents future Google Analytics and PostHog collection from that browser and clears provider browser state that CardForge can identify, but it does not retroactively delete aggregated or previously processed provider records. You can also block or clear cookies and site storage in your browser. Google Search Console separately provides CardForge with aggregated information about how pages appear and perform in Google Search; it does not depend on the optional CardForge analytics choice.

Information you choose to provide may include an account identifier, email address, optional name, contact requests and their contents, roadmap suggestions and votes, developer profile details, developer submissions, source files, and developer votes. Developer submissions, public source files, and published library assets are intentionally shared with the review pipeline and may become visible to other users. Do not upload confidential files, private client work, or content you do not have permission to share.

Browser IndexedDB data remains until you clear it or the browser removes it, and downloaded project files remain until you delete them from the places where you saved them. Private assistant working documents and aggregate MCP usage remain in CardForge's platform records until they are deleted through an available account or support process, or retained for an operational, security, abuse-prevention, legal, or record-integrity need. Other platform and provider records are retained for periods that vary by record, operational need, legal obligation, and provider setting. Some billing, legal, voting, attribution, published-asset, aggregate usage, and security records may need to remain after an account is disabled or deleted to preserve accurate platform history and system integrity.

For a privacy question or an access or deletion inquiry, including a request concerning private assistant working documents, contact [${DEFAULT_BUSINESS_IDENTITY.legalEmail}](mailto:${DEFAULT_BUSINESS_IDENTITY.legalEmail}). CardForge may need to verify the requester and may be unable to alter records that must remain for security, record-integrity, provider, or legal reasons. Account deletion does not delete browser IndexedDB or downloaded project files under your control.

CardForge uses operational safeguards, but no method of transmission or storage is completely secure. Keep control of your devices, account credentials, and downloaded backups. CardForge does not sell user project files.

CardForge is not directed to children under 13 and does not knowingly collect their personal information. A parent or guardian who believes a child provided information can use the privacy contact above.

Policy changes may be made as CardForge and its data practices develop. An updated publication will identify its version and effective date, so review the current policy when you use the service.`;

const termsBody = `${operatorDescription}

Your agreement for the service is with ${DEFAULT_BUSINESS_IDENTITY.legalOperatorName} as the legal operator of ${DEFAULT_BUSINESS_IDENTITY.brandName}. CardForge lets users create templates, generate previews, manage local projects, use connected assistant tools that create private cloud working documents, submit developer assets, and export content according to their account access. You are responsible for the content, artwork, data, trademarks, and intellectual property you bring into the tool or send through a connected assistant.

You keep ownership of the content you create. By using CardForge, you grant CardForge the limited permission needed to operate the service, render previews, process exports, preserve local/project state, and, when you submit assets to the developer pipeline, review, display, publish, archive, and maintain those submitted assets as part of the shared library.

The product is in active beta. Features, pricing, access levels, export behavior, developer rules, and library availability may change as the service develops. Do not use CardForge for unlawful content, infringing content, malicious uploads, harassment, or activity that harms the platform or other users.

CardForge is a creative production tool, not a print vendor or legal clearance service. Always proof exports, keep your own backups, and confirm printer/manufacturer requirements before production.`;

const creatorPassTermsBody = `${operatorDescription}

These supplemental terms apply when CardForge Studio offers Creator Pass or Designer Pass access. The selected pass unlocks the features and limits shown at purchase for the stated billing period; it does not transfer ownership of CardForge Studio, shared library assets, or third-party material. Designer Pass does not grant contributor access unless CardForge separately approves that account for the contributor program.

Keep your own project backups and review exported work before production. Availability, included features, usage limits, and pricing may change for future billing periods, subject to notice and applicable law. Cancellation stops future renewal and does not erase projects stored in your browser or files you downloaded.`;

const supporterTermsBody = `${operatorDescription}

These supplemental terms apply only if CardForge Studio separately offers a supporter checkout. Voluntary support for the independent creator is separate from Creator Pass and Designer Pass. A support payment does not grant product access or any other CardForge entitlement. An entitlement exists only when a separately identified offering expressly says so and is governed by that offering's own terms.

Support is not a donation, investment, security, equity or ownership interest, profit rights, revenue share, wage, or voting or control rights. CardForge does not represent support as tax deductible. Support does not guarantee a feature, benefit, or roadmap influence.

One-time support is a single charge and does not renew. Recurring support renews monthly at the exact amount shown before payment until canceled. Supporters can stop future renewal charges through the Stripe-hosted supporter management link in the support section of Cameron's page. Cancellation does not retroactively refund completed charges.

Any refund or cancellation request is handled under the Refund and Cancellation Policy and applicable law.`;

const refundBody = `${operatorDescription}

CardForge is currently in public beta. Self-service subscription billing and the customer billing portal are active when offered through the CardForge account.

Use the account billing portal to manage, change, or cancel Creator Pass or Designer Pass. Use the Stripe-hosted supporter management link in the support section of Cameron's page to cancel recurring support. Cancellation stops future renewals; access from a canceled paid pass ordinarily continues through the already-paid period unless Stripe shows otherwise.

Paid-pass refund requests are reviewed using the payment record, product-access history, the circumstances of the request, and applicable law. One-time and recurring support payments are voluntary and are ordinarily final once completed, but duplicate, erroneous, fraudulent, or legally required refunds will be reviewed. Canceling recurring support does not automatically refund an earlier support charge. Nothing in this policy limits rights that cannot legally be limited.

If you have a billing, cancellation, or export-access issue, contact support with the account email, transaction reference if available, and a short description of the issue.`;

const contactBody = `${operatorDescription}

${DEFAULT_BUSINESS_IDENTITY.legalOperatorName} handles support for ${DEFAULT_BUSINESS_IDENTITY.brandName} as its owner and legal operator. For support, developer account requests, legal questions, billing questions, account problems, or asset pipeline concerns, contact the support email listed on this site.

For fastest help, include the account email, the page or workflow where the issue happened, what you expected, what actually happened, and whether the issue involves a local project, export, template, developer asset, or billing/access state.

CardForge is in active development. Support responses are handled by the CardForge owner/operator until a larger support process is introduced.`;

const developerTermsBody = `${operatorDescription}

Your developer contribution agreement is with ${DEFAULT_BUSINESS_IDENTITY.legalOperatorName} as the legal operator of ${DEFAULT_BUSINESS_IDENTITY.brandName}. Forge Review is the developer contribution path for CardForge. Developers may submit templates, icons, dividers, textures, frames, source files, element recipes, and other approved creative assets into the shared review pipeline.

Only submit work you created, own, licensed, or have clear permission to contribute. Do not submit confidential work, client-restricted files, AI-generated material that violates its source license, infringing content, malware, deceptive files, or anything you would not want reviewed, archived, published, or used by other CardForge users.

Submitted assets move through the same platform pipeline as starter assets: draft, submitted, voting, publish candidate, published, archived, or rejected. Developer votes, owner rules, quality scores, access tiers, and platform caps can affect where an asset appears. Published assets may remain available after a developer leaves so existing users and templates do not break.

Contributor records are durable platform history. Deleting or disabling an account should not delete prior votes, source-file references, registry records, published assets, or contribution attribution snapshots. Owners may archive, remove, or edit platform availability for safety, quality, legal, licensing, or operational reasons.

These developer terms describe the current contribution model and do not create employment, partnership, guaranteed payment, or ownership of CardForge unless a separate written agreement says so.`;

const accessibilityBody = `${operatorDescription}

CardForge Studio targets WCAG 2.2 Level AA as the accessibility standard for its public site and core product workflows. This is a target, not a claim that every page, tool, export, or third-party integration currently conforms.

Known limitations may include complex canvas-style editing controls, keyboard interaction in dense creation workflows, generated preview descriptions, color-dependent user-authored designs, and accessibility behavior inside third-party account or billing interfaces. CardForge Studio will prioritize practical improvements as those areas are reviewed.

If an accessibility barrier prevents you from using CardForge Studio, contact the support email listed on this site and include the page, task, assistive technology if relevant, and the format or accommodation that would help.`;

const creatorPoolBody = `The Creator Pool concept is archived and inactive. CardForge Studio does not currently operate creator-pool payout infrastructure or accrue creator-pool balances.

The creator pool is not active payout infrastructure today. It is not stock, equity, a security, employment, partnership, a wage promise, or guaranteed income. Any future program would depend on billing, refund handling, tax handling, payout provider setup, creator eligibility rules, legal review, and separately published program terms.

Archived planning language does not create a payable balance or enforceable distribution schedule.`;

const DEFAULT_EFFECTIVE_DATE = '2026-07-16';
const DEFAULT_PUBLISHED_AT = '2026-07-16T00:00:00.000Z';

const createDefaultDocument = (
  slug: LegalDocumentSlug,
  title: string,
  body: string,
  publicationDate = DEFAULT_EFFECTIVE_DATE,
): LegalDocument => ({
  slug,
  version: 1,
  title,
  effectiveDate: publicationDate,
  publishedAt: publicationDate === DEFAULT_EFFECTIVE_DATE
    ? DEFAULT_PUBLISHED_AT
    : `${publicationDate}T00:00:00.000Z`,
  body,
  businessIdentityVersion: DEFAULT_BUSINESS_IDENTITY.identityVersion,
});

export const DEFAULT_LEGAL_DOCUMENTS: LegalDocument[] = [
  createDefaultDocument('privacy', 'Privacy Policy', privacyBody, '2026-08-20'),
  createDefaultDocument('terms', 'Terms of Service', termsBody),
  createDefaultDocument('creator-pass-terms', 'Creator and Designer Pass Terms', creatorPassTermsBody),
  createDefaultDocument('supporter-terms', 'Supporter Terms', supporterTermsBody),
  createDefaultDocument('refund', 'Refund and Cancellation Policy', refundBody),
  createDefaultDocument('developer-terms', 'Developer Contributor Terms', developerTermsBody),
  createDefaultDocument('contact', 'Contact and Support', contactBody, '2026-08-11'),
  createDefaultDocument('accessibility', 'Accessibility Statement', accessibilityBody),
  createDefaultDocument('creator-pool', 'Archived Creator Pool Notice', creatorPoolBody),
];

const legalSlugs = new Set<LegalDocumentSlug>(DEFAULT_LEGAL_DOCUMENTS.map((document) => document.slug));

export type LegalDocumentInputResult =
  | { ok: true; value: LegalDocumentWrite }
  | { ok: false; message: string };

const isIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export const normalizeLegalDocumentInput = (value: {
  slug?: unknown;
  title?: unknown;
  body?: unknown;
  effectiveDate?: unknown;
  expectedBusinessIdentityVersion?: unknown;
}): LegalDocumentInputResult => {
  const slug = typeof value.slug === 'string' ? value.slug : '';
  if (!legalSlugs.has(slug as LegalDocumentSlug)) return { ok: false, message: 'Unknown legal document.' };

  const title = typeof value.title === 'string' ? value.title.trim().replace(/[ \t]+/g, ' ') : '';
  const body = typeof value.body === 'string' ? value.body.trim() : '';
  const effectiveDate = typeof value.effectiveDate === 'string' ? value.effectiveDate.trim() : '';
  const expectedBusinessIdentityVersion = value.expectedBusinessIdentityVersion;

  if (!title) return { ok: false, message: 'Legal document title is required.' };
  if (!body) return { ok: false, message: 'Legal document body is required.' };
  if (!isIsoDate(effectiveDate)) return { ok: false, message: 'Effective date must be a valid date in YYYY-MM-DD format.' };
  if (!Number.isSafeInteger(expectedBusinessIdentityVersion) || Number(expectedBusinessIdentityVersion) <= 0) {
    return { ok: false, message: 'The current business identity version is required.' };
  }

  try {
    parseLegalBody(body);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Legal document body is invalid.' };
  }

  return {
    ok: true,
    value: {
      slug: slug as LegalDocumentSlug,
      title,
      body,
      effectiveDate,
      expectedBusinessIdentityVersion: expectedBusinessIdentityVersion as number,
    },
  };
};

export const getDefaultLegalDocument = (slug: LegalDocumentSlug): LegalDocument =>
  DEFAULT_LEGAL_DOCUMENTS.find((document) => document.slug === slug) ?? DEFAULT_LEGAL_DOCUMENTS[0];
