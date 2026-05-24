# Developer Asset Pipeline Design

## Goal

Create the financial-launch-ready framework for CardForge's developer content program without requiring Stripe payouts or public marketplace automation in the MVP. The system should let Cameron control developer roster size, contribution requirements, voting rules, publish caps, and default-library promotion while keeping normal user uploads local to the browser/project.

The first version should create interaction and quality pressure among trusted developers. It should not become a full marketplace, public user cloud library, or automated payout system yet.

## Product Model

CardForge has three asset ownership layers:

- **Site Defaults**: shipped CardForge content that appears in the official template, element, and asset libraries.
- **Developer Submissions**: account-backed candidate assets from trusted developers that can be voted on, reviewed, archived, or promoted into Site Defaults.
- **Local User Assets**: uploads from paid or unpaid users stored in the browser and project files, clearly labeled as local rather than official site content.

Only Site Defaults become official CardForge library content. Developer Submissions are eligible for promotion. Local User Assets never become site defaults unless a future explicit submission flow is added.

## Developer Roster

Owner Hub should expose developer program settings:

- max active developer slots, default `25`
- monthly submission limit per developer, default `25`
- monthly published asset requirement, default `5`
- requirement period: monthly first, with quarterly/yearly support as future configuration
- active, inactive, suspended, or invited developer status
- per-developer override for upload limit, requirement target, and eligibility

The roster cap limits active developers, not all historical developer accounts. Inactive or suspended developers remain visible for audit history but do not consume active slots unless the owner chooses otherwise.

## Asset Types

Developer submissions should support the same official content families the editor accepts:

- templates
- element presets
- textures
- dividers
- icons
- image assets
- parts

Element presets should be file-backed by accepted element class:

- `text`
- `image`
- `icon`
- `shape`
- `part`

Developer-authored TSX can be supported only as repo-owned developer default modules that are reviewed and shipped with the app. Arbitrary user or developer TSX uploads must not run in production because they are executable code.

## Asset Lifecycle

Each developer-submitted asset moves through a clear lifecycle:

1. `draft`: visible only to the submitting developer and owners.
2. `submitted`: ready for validation and voting.
3. `voting`: visible to eligible peer developers.
4. `publish_candidate`: passed voting thresholds and type caps allow it to be considered for publishing.
5. `published`: promoted into official CardForge defaults.
6. `archived`: removed from active voting/publish flow.
7. `rejected`: owner- or system-rejected and not eligible for automatic archival rotation.

Owner override should be available at every stage. Published assets count toward developer contribution requirements and future profit-share eligibility. Drafts, rejected assets, and raw upload attempts do not count.

## Voting Rules

Owner Hub should make voting rules configurable:

- minimum total votes before an asset can be graded
- minimum positive vote percentage for promotion
- archive rule when total votes are above the minimum and negative votes exceed positive votes
- voting eligibility, starting with active developers only
- optional owner final review before publish

Assets below the minimum vote count remain in voting and are not graded. Assets with enough votes and a failing positive/negative balance move to archive. Assets with enough votes and the configured positive percentage become publish candidates, subject to per-type publish caps.

Public users should not vote on publish decisions in the MVP. Future public/user behavior can feed a separate `Site Favorites` pool through opt-in usage signals.

## Archive Rules

The active archive view should keep the latest `100` archived assets by timeline. Older archived records can remain in the database for audit/reporting, but the product surface should show the most recent 100 unless the owner expands or filters the view.

Rejected assets are not the same as archived assets. Rejected assets are owner/system decisions and should stay available to owners for moderation history.

## Publish Caps

Owner Hub should expose max published assets per period by type:

- templates
- element presets
- textures
- dividers
- icons
- image assets
- parts

Caps prevent the official library from flooding even when many assets pass voting. When more assets qualify than the configured cap, the system should prioritize by vote score, positive ratio, recency, and owner override.

## Developer Asset Hub

Developer accounts should get an asset hub on their account/profile surface. It should include:

- upload/submission entry points by asset type
- visual asset browser with source/status badges
- draft/submitted/voting/published/archived filters
- monthly progress toward requirement
- remaining submission count for the current period
- peer voting queue
- feedback and owner decision history

The UI should make it obvious when an asset is local, submitted, or official. Developers should never confuse uploading a local asset with publishing to the CardForge site library.

## Owner Hub

Owner Hub should include a developer program panel with:

- roster cap and developer list
- per-developer status and overrides
- global monthly upload and published asset requirements
- voting thresholds
- per-type publish caps
- review queue
- archive queue
- monthly contribution report
- future payout eligibility report

Owner tools must stay separate from normal developer tools. Developers can submit and vote; owners decide program rules and retain override authority.

## Financial Launch Readiness

The MVP should track contribution eligibility but not move money.

Store enough data for future financial launch:

- developer id
- eligible published asset count by period
- contribution requirement progress
- owner eligibility override
- configured profit-share pool percentage, default `10%`
- period-level estimated share
- payout status placeholder

The intended future rule is: CardForge reserves a configurable creator pool, default 10% of eligible net profit, split equally among qualifying developers for the payout period unless the owner changes the policy.

Automated payouts should wait for Stripe Connect onboarding, tax/legal requirements, refund handling, payout schedules, and production billing webhooks. The initial implementation should be an auditable ledger and owner report only.

## Future Usage Signals

After account/cloud analytics are intentionally added, user behavior can feed a separate Site Favorites pool:

- inserted count
- used in exported projects
- used in saved templates
- favorited
- removed or hidden after insertion

These signals should not replace owner control. They can recommend official favorites and improve browsing rank once user data collection and privacy rules are explicit.

## MVP Scope

Build first:

- data model and Supabase migration for developer roster settings, submissions, votes, lifecycle status, and rule settings
- owner rule management for roster cap, upload limits, monthly requirement, voting thresholds, archive count, and per-type publish caps
- developer asset hub with upload/submission list, status filters, monthly stats, and peer voting
- owner review/publish/archive controls
- durable docs for developer defaults, local user uploads, and the official content pipeline

Defer:

- automatic Stripe payouts
- public-user voting
- usage analytics and Site Favorites
- direct production repo mutation from the browser
- arbitrary TSX uploads
- cloud storage for normal user local assets

## Data and Access Rules

Use trusted account roles:

- `owner` can manage rules, roster, overrides, publish, archive, and reject.
- `dev` can submit assets and vote on eligible peer submissions.
- `paid` and `free` can upload local assets only.

Server-side checks must enforce these roles. Public Clerk metadata must remain display-only and must not grant owner, developer, paid, publishing, or voting authority.

## Verification

The implementation is complete when:

- owner settings normalize defaults for 25 active developer slots, 25 monthly submissions, and 5 monthly published assets
- developer submissions can move through the lifecycle with server-side role checks
- voting thresholds classify assets into voting, publish candidate, or archived states
- per-type publish caps are enforced before assets become official defaults
- monthly developer stats distinguish submitted, approved/published, archived, and rejected assets
- local user uploads remain local and are visibly separate from site/developer assets
- unit tests cover rule evaluation, quota counting, role checks, and archive rotation
- relevant UI flows pass browser smoke checks
- docs explain how developers add defaults and how users upload local assets
