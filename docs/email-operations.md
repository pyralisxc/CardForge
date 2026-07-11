# Email Operations

CardForge now has server-sent support and developer request forms backed by Resend, plus owner-configured support email fallbacks. Delivery still depends on the sender domain being verified in Resend.

## Current State

- Clerk owns authentication emails such as sign-in, verification, account security, and passwordless flows.
- CardForge owns product/contact email routing such as support, developer requests, asset-pipeline notices, and future owner alerts.
- Contact and developer-request forms route to the owner support email from Owner Console business settings and store audit rows in Supabase when the owner operations migration is applied.
- The app does not manage newsletter lists, marketing subscriptions, or unsubscribe state yet.

## Recommended Setup

When the business email is ready:

1. Create the human inbox, for example `support@yourdomain.com`.
2. Choose a transactional sender. The preferred path is Resend for delivery and React Email for templates.
3. Verify a sending domain or subdomain in Resend, for example `send.yourdomain.com`.
4. Add the DNS records Resend requests for SPF, DKIM, and DMARC.
5. Add Vercel environment variables:
   - `RESEND_API_KEY`
   - `CARDFORGE_EMAIL_FROM`, for example `CardForge <notifications@yourdomain.com>`
   - `CARDFORGE_EMAIL_REPLY_TO`, usually the support inbox
6. Send a test email from Owner Console before relying on server delivery. If Resend returns a domain verification error, verify a sending domain/subdomain in Resend or temporarily use Resend's approved testing sender for non-production tests.

Interim setup may use the owner's current inbox as the reply-to address. The editable support inbox belongs in Owner Console business settings; the Resend API key and sender identity remain environment/provider configuration until a verified sending domain is ready.

## Owner Console

Owner Console should remain the operational control surface for:

- support inbox
- email routing mode
- delivery provider readiness
- missing environment variables
- a test-email button
- recent contact/developer-request submission logs

Do not expose raw provider API keys in the browser. Secrets belong in Vercel environment variables and provider dashboards.

## Lists And Marketing

Do not build newsletter or marketing-list management into CardForge until it is a clear product requirement. Marketing lists need unsubscribe handling, consent state, import/export rules, and provider-specific compliance behavior.

If newsletters become important, use a dedicated list provider rather than mixing subscribers into the transactional support/developer pipeline.

## Future App Flows

The first server-sent email flows are:

- contact/support form sends to the support inbox and stores a Supabase audit row
- developer request form sends to the developer/support inbox and stores request status
- owner test-email action verifies provider configuration

Asset archive/reject notifications can come later. In-product owner notes remain the durable source of truth for pipeline decisions.
