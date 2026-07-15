# CardForge Risk Register

Last updated: July 14, 2026

Every launch risk must be closed, explicitly accepted with a review date, or represented here until a tracked GitHub issue replaces it.

| Area | Risk | Priority | Required closure |
| --- | --- | --- | --- |
| Security | Privileged Supabase functions exposed to public roles | P0 | Migration applied; role tests and advisors clean |
| Identity | Production site uses a Clerk development instance | P0 | Production-instance migration and entitlement reconciliation verified |
| Delivery | No required independent CI or protected-main evidence | P0 | Required PR checks and branch protection enabled |
| Data safety | Binary artwork stored as Data URLs in localStorage | P1 | IndexedDB migration, quota handling, and recovery tests released |
| Abuse | Public contact and mutation routes lack shared throttling | P1 | Per-action rate limits, bot defense, and 429 tests released |
| Billing | Stripe events lack a durable ordered ledger | P1 | Idempotent ledger and owner reconciliation verified |
| Legal | Live operator/refund identity is stale | P1 | Neon Black Interactive LLC identity and current refund terms published |
| Dependencies | Fresh audit reports production advisories | P1 | Fixed or accepted with exact advisory, exposure analysis, and review date |
| Export correctness | Rich text, corrupted import, duplex, and prepress limitations need regression proof | P1 | Critical regression suite and documented CMYK/PDF-X boundary |
| Operations | Console-only error reporting has limited alerting | P2 | Production error aggregation and alert ownership configured |
| Architecture | Owner and template coordinators are oversized | P2 | Behavior-preserving decomposition under feature owners |
| Marketing | Individual card sharing and branded social exports are absent | P2 | Share presets, watermark rules, and attribution flow released |

## Accepted dependency exception

The July 15, 2026 audit is reduced from 22 findings (including one high severity) to two moderate production findings. Both represent the same unresolved PostCSS advisory inherited by Next.js 15.5.20 and reported through `postcss` and `next`; npm reports no compatible fix available. CardForge does not accept user-authored CSS for server-side serialization, which limits exposure to the advisory's unescaped CSS-stringification path. Review again by August 14, 2026 or when a patched Next.js 15 release is available, whichever comes first.

## Accepted product boundary

Native browser export does not claim CMYK or PDF/X production output. Those conversions remain an external prepress step until CardForge explicitly implements and verifies them.
