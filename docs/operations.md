# CardForge Operations

Last updated: July 13, 2026

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
CARDFORGE_EMAIL_REPLY_TO=pyraliscameron@gmail.com
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
