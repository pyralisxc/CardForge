# CardForge Risk Register

Last updated: July 16, 2026

Every launch risk must be closed, explicitly accepted with a review date, or represented here until a tracked GitHub issue replaces it.

| Area | Risk | Priority | Status | Evidence / next review |
| --- | --- | --- | --- | --- |
| Security | Privileged Supabase functions exposed to public roles | P0 | Closed | July 15 live role checks deny Founder Beta and billing RPC execution to `anon` and `authenticated`, allow `service_role`, and show no warning/error security advisor findings. |
| Identity | Production authentication may use the wrong Clerk instance or fail to initialize | P0 | Closed | Production embeds `pk_live_`, loads from `clerk.cardforges.com`, and reports Clerk environment `production`. Authenticated smoke run [29469266134](https://github.com/pyralisxc/CardForge/actions/runs/29469266134) passed the signed-out modal/network check and all reusable-account sign-in transitions with no Clerk bootstrap response at HTTP 400 or greater. |
| Delivery | Production changes can bypass independent checks | P0 | Implemented; rules update required | CI and Public smoke pass on PRs. The active ruleset requires PRs, thread resolution, and blocks deletion/non-fast-forward updates; required status checks still need enabling. |
| Data safety | Artwork and workspace state can exhaust localStorage | P1 | Closed; stress review scheduled | IndexedDB migration, asset limits, optimization, quota warnings, recovery snapshots, backup prompts, and automated persistence/import tests are released. Run the long-session artwork stress pass by August 15, 2026. |
| Abuse | Public contact and mutation routes can be automated | P1 | Closed; monitor | Atomic database throttling, honeypot protection, route coverage, tests, and live rate-limit bucket activity are present. Review abuse telemetry monthly. |
| Billing | Stripe and Clerk state can diverge or process duplicate/out-of-order events | P1 | Customer account mapping pending | Durable ordering/deduplication is live-proven. Two deliveries of the same `customer.subscription.created` event returned HTTP 200; Supabase retained exactly one ignored event row with no failure or entitlement change because the July 12 event predates the July 15 reconciliation baseline. The second delivery was deduplicated. The existing subscriber must still sign in or register with the Stripe email and be reconciled; they must not purchase again. |
| Legal | Operator, support, refund, and billing identity can diverge | P1 | Closed | Neon Black Interactive LLC and the configured public support identity are published in code and production data. Human legal review remains an owner responsibility. |
| Dependencies | Production dependency advisories remain without an upstream fix | P1 | Accepted | Two moderate PostCSS-path findings are accepted under the exposure analysis below. Review by August 14, 2026 or on a patched compatible Next.js release. |
| Export correctness | Rich text, import corruption, duplex, and prepress boundaries need proof | P1 | Accepted | Critical rendering/import/print tests are restored. CMYK and PDF/X remain an explicit external-prepress boundary; printer-specific duplex validation remains release QA. |
| Operations | Route health exists without complete business-signal alert ownership | P2 | Implemented; alert ownership open | Six-hour route health and Vercel runtime aggregation are active. Authenticated smoke run [29469266134](https://github.com/pyralisxc/CardForge/actions/runs/29469266134) passed all 6 production scenarios and retained evidence artifact [8364183870](https://github.com/pyralisxc/CardForge/actions/runs/29469266134/artifacts/8364183870) for 14 days. Assign owner notifications for checkout, webhook, reconciliation, persistence, contact, and smoke failures by August 15, 2026. |
| Architecture | Owner and template coordinators are oversized | P2 | Open | Decompose behavior-preservingly before multi-contributor work on those surfaces. Review scope by August 31, 2026. |
| Marketing | Card sharing and coherent entitlement-aware watermarking are absent | P2 | Closed | Square, portrait, and story Share Card exports plus free-visible centered watermarks are released; entitled Studio views and normal exports remain clean. |

## July 15–16 launch verification evidence

- Clerk QA metadata cleanup was corrected and merged through [PR #24](https://github.com/pyralisxc/CardForge/pull/24). Clerk replacement semantics now remove stale entitlement keys while preserving unrelated private metadata.
- Production deployment `dpl_2dChCES3TdMLuX396zoHYRSF8up6` is READY on `cardforges.com` at exact `main` commit `03edd527ac3b236944c61ee5aba0e056ac76981a`; five route-health checks passed and the new deployment had no error or fatal runtime logs during verification.
- Authenticated production smoke [run 29469266134](https://github.com/pyralisxc/CardForge/actions/runs/29469266134) passed 6 of 6 scenarios in 1.4 minutes. The run covered signed-out Clerk initialization, the reusable free/paid/developer/owner matrix, Founder Beta, developer and owner operations, and paid project export/import recovery.
- Billing delivery proof: Vercel recorded two HTTP 200 deliveries to `/api/billing/webhook`. Supabase retained one `customer.subscription.created` row with status `ignored`, no failure, no resulting entitlement, and a single attempt. The event correctly predates the reconciliation baseline, and the repeat delivery created no second row. Only the existing customer-to-Clerk account reconciliation remains open.
- July 16 repository sanity check: lint, TypeScript, 54 Vitest files with 357 tests, and the production build passed. Production route health passed all five checks. Deployment `dpl_HtRssheY5FbhcygbmtPKk8pw7Fpe` is READY on `cardforges.com` at exact `main` commit `e1f44cab43259d7564dcb225b86108116c9316ba` with no error or fatal logs on that deployment during verification.

## Accepted dependency exception

The July 16, 2026 audit remains at two moderate production findings. Both represent the same unresolved PostCSS advisory inherited by Next.js 15.5.20 and reported through `postcss` and `next`; npm reports no compatible fix available. CardForge does not accept user-authored CSS for server-side serialization, which limits exposure to the advisory's unescaped CSS-stringification path. Review again by August 14, 2026 or when a patched Next.js 15 release is available, whichever comes first.

## Accepted product boundary

Native browser export does not claim CMYK or PDF/X production output. Those conversions remain an external prepress step until CardForge explicitly implements and verifies them.
