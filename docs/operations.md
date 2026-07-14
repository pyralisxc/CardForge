# CardForge Operations

Last updated: July 14, 2026

This is the current live-operations checklist for CardForge.

## Live Site

- Canonical domain: `https://cardforges.com`
- Vercel production branch: `main`
- Required canonical env var: `NEXT_PUBLIC_APP_URL=https://cardforges.com`
- Robots and sitemap must point to `https://cardforges.com`.
- Google Search Console uses a DNS TXT record on the root `cardforges.com` domain.

## Required Production Services

- Vercel: hosting, production env vars, domains, deployments.
- Clerk: authentication and trusted private metadata.
- Stripe: Creator Pass checkout, subscription events, webhook, customer portal.
- Supabase: owner settings, Founder Beta, roadmap, contact requests, asset/developer pipeline.
- Resend: transactional sending.

## Required Production Environment Variables

Core:

```text
NEXT_PUBLIC_APP_URL=https://cardforges.com
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Stripe:

```text
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_PRICE_ID=
STRIPE_WEBHOOK_SECRET=
```

Email:

```text
RESEND_API_KEY=
CARDFORGE_EMAIL_FROM=CardForge <onboarding@resend.dev>
CARDFORGE_EMAIL_REPLY_TO=
```

Owner/developer allowlists:

```text
CARDFORGE_OWNER_ACCOUNT_EMAILS=
CARDFORGE_DEV_ACCOUNT_EMAILS=
CARDFORGE_PAID_ACCOUNT_EMAILS=
```

## Launch State

- Custom domain is active.
- Stripe has processed the first live sale.
- Founder Beta launch wave is capped at 25 seats.
- Resend test email works with the current Gmail recipient.
- Google Search Console verification may depend on DNS propagation.

## Owner Console Checks

Use `/owner` for:

- launch readiness
- billing snapshot
- email test
- support/contact request history
- site copy
- site mechanics
- Founder Beta access and copy
- legal documents
- developer program settings
- account lookup/access changes

Secrets stay in Vercel/provider dashboards. The owner console should show readiness, not raw secret values.

## Database Security

- Browser-direct writes are not supported.
- Privileged RPCs must revoke `EXECUTE` from `PUBLIC`, `anon`, and `authenticated`.
- The Founder Beta claim RPC is callable only by the server-side `service_role`.
- Run Supabase security and performance advisors after every migration.
- Verify role grants directly; RLS does not protect an exposed `SECURITY DEFINER` function.

## Delivery Gates

- Pull requests must pass CI and public smoke checks before merge.
- Authenticated provider smoke uses protected environment secrets and must never run for untrusted fork code.
- `main` should require a pull request, one approval, required checks, and blocked force pushes.
- Vercel build success alone is not a release-health verdict.
- Production route health runs every six hours; GitHub owns failure notification and Vercel runtime error groups remain the primary server-error aggregation view.

## Verification Commands

Use the smallest relevant check first:

```bash
npm run test
npm run typecheck
npm run build
npm run smoke
```

Before pushing launch-affecting changes:

```bash
git diff --check
```

## Launch-Critical Manual Checks

- Open `https://cardforges.com`.
- Confirm `https://cardforges.com/robots.txt` points to `https://cardforges.com/sitemap.xml`.
- Submit sitemap in Google Search Console after DNS verification.
- Complete one Stripe checkout or customer portal round trip after domain/env changes.
- Send one Owner Console test email after Resend/env changes.
- Confirm unpaid export prompts Creator Pass or Founder Beta, not developer application copy.
