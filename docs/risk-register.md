# CardForge Risk Register

Last updated: July 15, 2026

Every launch risk must be closed, explicitly accepted with a review date, or represented here until a tracked GitHub issue replaces it.

| Area | Risk | Priority | Status | Evidence / next review |
| --- | --- | --- | --- | --- |
| Security | Privileged Supabase functions exposed to public roles | P0 | Closed | July 15 live role checks deny Founder Beta and billing RPC execution to `anon` and `authenticated`, allow `service_role`, and show no warning/error security advisor findings. |
| Identity | Production authentication may use the wrong Clerk instance or fail to initialize | P0 | Awaiting live verification | Production embeds `pk_live_`, loads from `clerk.cardforges.com`, and reports Clerk environment `production`. Close after the signed-out modal test, real sign-in/sign-out, and authenticated smoke pass. |
| Delivery | Production changes can bypass independent checks | P0 | Implemented; rules update required | CI and Public smoke pass on PRs. The active ruleset requires PRs, thread resolution, and blocks deletion/non-fast-forward updates; required status checks still need enabling. |
| Data safety | Artwork and workspace state can exhaust localStorage | P1 | Closed; stress review scheduled | IndexedDB migration, asset limits, optimization, quota warnings, recovery snapshots, backup prompts, and automated persistence/import tests are released. Run the long-session artwork stress pass by August 15, 2026. |
| Abuse | Public contact and mutation routes can be automated | P1 | Closed; monitor | Atomic database throttling, honeypot protection, route coverage, tests, and live rate-limit bucket activity are present. Review abuse telemetry monthly. |
| Billing | Stripe and Clerk state can diverge or process duplicate/out-of-order events | P1 | Awaiting live verification | Durable ordering/deduplication is released. This closure PR adds conflict-safe reconciliation baselines; close after live reconciliation and duplicate resend proof. |
| Legal | Operator, support, refund, and billing identity can diverge | P1 | Closed | Neon Black Interactive LLC and the configured public support identity are published in code and production data. Human legal review remains an owner responsibility. |
| Dependencies | Production dependency advisories remain without an upstream fix | P1 | Accepted | Two moderate PostCSS-path findings are accepted under the exposure analysis below. Review by August 14, 2026 or on a patched compatible Next.js release. |
| Export correctness | Rich text, import corruption, duplex, and prepress boundaries need proof | P1 | Accepted | Critical rendering/import/print tests are restored. CMYK and PDF/X remain an explicit external-prepress boundary; printer-specific duplex validation remains release QA. |
| Operations | Route health exists without complete business-signal alert ownership | P2 | Implemented; alert ownership open | Six-hour route health, Vercel runtime aggregation, and authenticated smoke exist. Assign owner notifications for checkout, webhook, reconciliation, persistence, contact, and smoke failures by August 15, 2026. |
| Architecture | Owner and template coordinators are oversized | P2 | Open | Decompose behavior-preservingly before multi-contributor work on those surfaces. Review scope by August 31, 2026. |
| Marketing | Card sharing and coherent entitlement-aware watermarking are absent | P2 | Closed | Square, portrait, and story Share Card exports plus free-visible centered watermarks are released; entitled Studio views and normal exports remain clean. |

## Accepted dependency exception

The July 15, 2026 audit is reduced from 22 findings (including one high severity) to two moderate production findings. Both represent the same unresolved PostCSS advisory inherited by Next.js 15.5.20 and reported through `postcss` and `next`; npm reports no compatible fix available. CardForge does not accept user-authored CSS for server-side serialization, which limits exposure to the advisory's unescaped CSS-stringification path. Review again by August 14, 2026 or when a patched Next.js 15 release is available, whichever comes first.

## Accepted product boundary

Native browser export does not claim CMYK or PDF/X production output. Those conversions remain an external prepress step until CardForge explicitly implements and verifies them.
