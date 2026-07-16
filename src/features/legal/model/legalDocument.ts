export type LegalDocumentSlug =
  | 'privacy'
  | 'terms'
  | 'refund'
  | 'contact'
  | 'developer-terms'
  | 'creator-pool';

export interface LegalDocument {
  slug: LegalDocumentSlug;
  title: string;
  body: string;
  publishedAt: string | null;
}

const privacyBody = `CardForge is operated by Neon Black Interactive LLC and is designed as a local-first card creation tool. Card projects, imported data, generated previews, personal uploads, and export settings stay in browser database storage or downloaded project files unless you choose to submit something to the platform or CardForge introduces an explicit cloud save feature.

We use account and infrastructure providers to identify signed-in users, unlock access, run the site, protect owner/developer tools, process payments, prevent abuse, and store shared platform records. Those records may include account identifiers, email addresses, optional first and last names, entitlement status, billing-event records, Founder Beta claims, roadmap votes, feature suggestions, developer profiles, developer submissions, developer votes, asset registry records, contact requests, legal documents, and owner settings.

Developer submissions, public source files, and published library assets are intentionally shared with the review pipeline and may become visible to other users. Do not upload confidential files, private client work, or content you do not have permission to share.

CardForge does not sell user project files. We do not intentionally collect information from children under 13. If you need privacy support, contact the support email listed on this site.`;

const termsBody = `CardForge is a service operated by Neon Black Interactive LLC. It lets users create templates, generate previews, manage local projects, submit developer assets, and export content according to their account access. You are responsible for the content, artwork, data, trademarks, and intellectual property you bring into the tool.

You keep ownership of the content you create. By using CardForge, you grant CardForge the limited permission needed to operate the service, render previews, process exports, preserve local/project state, and, when you submit assets to the developer pipeline, review, display, publish, archive, and maintain those submitted assets as part of the shared library.

The product is in active beta. Features, pricing, access levels, export behavior, developer rules, and library availability may change as the service develops. Do not use CardForge for unlawful content, infringing content, malicious uploads, harassment, or activity that harms the platform or other users.

CardForge is a creative production tool, not a print vendor or legal clearance service. Always proof exports, keep your own backups, and confirm printer/manufacturer requirements before production.`;

const refundBody = `CardForge is operated by Neon Black Interactive LLC and is currently in public beta. Self-service subscription billing and the customer billing portal are active when offered on the access page.

Use the account billing portal to manage or cancel an active subscription. Refund requests should be sent to the support email listed on this site and are reviewed using the payment record, product-access history, the circumstances of the request, and applicable law. Nothing in this policy limits rights that cannot legally be limited.

If you have a billing, cancellation, or export-access issue, contact support with the account email, transaction reference if available, and a short description of the issue.`;

const contactBody = `For support, beta access, developer account requests, legal questions, billing questions, account problems, or asset pipeline concerns, contact the support email listed on this site.

For fastest help, include the account email, the page or workflow where the issue happened, what you expected, what actually happened, and whether the issue involves a local project, export, template, developer asset, or billing/access state.

CardForge is in active development. Support responses are handled by the CardForge owner/operator until a larger support process is introduced.`;

const developerTermsBody = `Forge Review is the developer contribution path for CardForge. Developers may submit templates, icons, dividers, textures, frames, source files, element recipes, and other approved creative assets into the shared review pipeline.

Only submit work you created, own, licensed, or have clear permission to contribute. Do not submit confidential work, client-restricted files, AI-generated material that violates its source license, infringing content, malware, deceptive files, or anything you would not want reviewed, archived, published, or used by other CardForge users.

Submitted assets move through the same platform pipeline as starter assets: draft, submitted, voting, publish candidate, published, archived, or rejected. Developer votes, owner rules, quality scores, access tiers, and platform caps can affect where an asset appears. Published assets may remain available after a developer leaves so existing users and templates do not break.

Contributor records are durable platform history. Deleting or disabling an account should not delete prior votes, source-file references, registry records, published assets, or contribution attribution snapshots. Owners may archive, remove, or edit platform availability for safety, quality, legal, licensing, or operational reasons.

These developer terms describe the current contribution model and do not create employment, partnership, guaranteed payment, or ownership of CardForge unless a separate written agreement says so.`;

const creatorPoolBody = `CardForge is building toward a creator pool that can share a portion of eligible platform profit with eligible active developers. The current planning target is a configurable percentage, currently represented in the product as 10% by default, split evenly among eligible active developers after financial launch systems are ready.

The creator pool is not active payout infrastructure today. It is not stock, equity, a security, employment, partnership, a wage promise, or guaranteed income. It depends on future billing, refund handling, tax handling, payout provider setup, creator eligibility rules, legal review, and owner-published program terms.

The owner console controls the visible planning percentage, developer eligibility flags, vote weights, voting rules, monthly contribution expectations, and access-tier rules. Changes should be published clearly before they affect active developers.

Until payout systems and final legal terms are live, treat creator-pool language as the product direction for the collective, not as a payable balance or enforceable distribution schedule.`;

export const DEFAULT_LEGAL_DOCUMENTS: LegalDocument[] = [
  { slug: 'privacy', title: 'Privacy Policy', body: privacyBody, publishedAt: null },
  { slug: 'terms', title: 'Terms of Service', body: termsBody, publishedAt: null },
  { slug: 'refund', title: 'Refund and Cancellation Policy', body: refundBody, publishedAt: null },
  { slug: 'contact', title: 'Contact and Support', body: contactBody, publishedAt: null },
  { slug: 'developer-terms', title: 'Developer Contributor Terms', body: developerTermsBody, publishedAt: null },
  { slug: 'creator-pool', title: 'Creator Pool Notice', body: creatorPoolBody, publishedAt: null },
];

const legalSlugs = new Set<LegalDocumentSlug>(
  DEFAULT_LEGAL_DOCUMENTS.map((document) => document.slug),
);

export type LegalDocumentInputResult =
  | { ok: true; value: Pick<LegalDocument, 'slug' | 'title' | 'body'> }
  | { ok: false; message: string };

export const normalizeLegalDocumentInput = (value: {
  slug?: unknown;
  title?: unknown;
  body?: unknown;
}): LegalDocumentInputResult => {
  const slug = typeof value.slug === 'string' ? value.slug : '';
  if (!legalSlugs.has(slug as LegalDocumentSlug)) {
    return { ok: false, message: 'Unknown legal document.' };
  }

  const title = typeof value.title === 'string'
    ? value.title.trim().replace(/[ \t]+/g, ' ')
    : '';
  const body = typeof value.body === 'string' ? value.body.trim() : '';

  if (!title) return { ok: false, message: 'Legal document title is required.' };
  if (!body) return { ok: false, message: 'Legal document body is required.' };

  return { ok: true, value: { slug: slug as LegalDocumentSlug, title, body } };
};

export const getDefaultLegalDocument = (slug: LegalDocumentSlug): LegalDocument =>
  DEFAULT_LEGAL_DOCUMENTS.find((document) => document.slug === slug) ?? DEFAULT_LEGAL_DOCUMENTS[0];
