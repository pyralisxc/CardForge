# Operator Identity and Transfer Runbook

Last updated: July 16, 2026

## Current identity

CardForge Studio is a software product created and operated by Cameron Locke, an independent sole proprietor based in Oregon.

CardForge Studio is the product and brand, not a separate corporation. Do not publish `d/b/a CardForge Studio` unless an Oregon Assumed Business Name registration or another professionally confirmed basis supports that wording. Neon Black Interactive LLC has no current role as operator, contracting party, privacy controller, billing entity, receipt identity, or public brand for CardForge.

## Provider-alignment inventory

The business-identity feature owns the browser-safe contract and repository default. The Supabase singleton is the runtime record. Legal fallback copy, the forward migration, health expectation, copyright, and operational documentation consume or align with that identity. Production alignment is not complete until each provider-owned record is checked against the same identity:

- Supabase: business identity row and published legal documents.
- Stripe: account legal/business profile, Creator Pass product copy, receipts, support details, and statement descriptor where applicable.
- Resend: sender name, sender domain, reply-to address, and support routing.
- Clerk: owner account identity, trusted metadata, support-facing account copy, and provider contact details.
- Vercel: public environment configuration and the exact deployed commit.
- Domain registrar and DNS: registrant/business contact, administrative contact, root-domain records, and verified sender records.
- GitHub: repository owner profile, organization or sponsorship identity if used, Actions secrets, and public repository policy.
- Search Console and public SEO: verified property owner, submitted sitemap, structured data, footer, legal pages, owner console, and production health check.
- External records: tax records and Oregon registration status where applicable.

No provider change is performed by this runbook. Migration application, provider edits, merge, and production deployment require explicit approval immediately before execution. Record the approved actor, timestamp, exact commit or migration, and verification result in `docs/operations.md` and `docs/risk-register.md`.

## Approved rollout order

1. Snapshot current provider records and confirm the approved Cameron/Oregon wording.
2. Apply the additive business-identity foundation migration.
3. Deploy the exact reviewed application commit and verify the owner console plus public legal pages.
4. Align Stripe, Resend, and other provider-facing identity records.
5. Run production health and authenticated checks, then record evidence.
6. Remove legacy owner-setting columns only after every deployed consumer uses the canonical identity record.

If any provider cannot represent the current operating structure accurately, stop the rollout and document the mismatch. Do not substitute a former entity or imply a registration that has not been verified.

## Future transfer boundary

A future transfer to another operator is a legal and operational migration, not a copy edit. Before changing the canonical identity, require written confirmation covering intellectual property and assets, domain and trademark rights, customer relationships and contractual obligations, privacy-controller responsibility, provider accounts, billing and tax treatment, support obligations, effective date, and customer notices.

Then inventory and deliberately migrate Supabase, Stripe, Resend, Vercel, Clerk, domain records, legal publications, structured data, support channels, and financial reporting. Git history alone does not establish ownership or transfer authority. Keep the current Cameron-operated identity until the transfer is documented, approved, deployed, and verified end to end.
