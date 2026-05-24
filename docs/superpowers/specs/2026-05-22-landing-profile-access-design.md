# Landing, Profile, and Access Model Design

## Goal

Give CardForge a real public front door while keeping the core promise Cameron approved: new visitors can enter the studio immediately, and the first hard account/paywall appears only when they try to clean-export or use development/admin tools.

## Routes

- `/` is the public landing page.
- `/studio` is the existing CardForge maker/generator workspace.
- `/account` is the account/profile and tools page.

## Access Model

CardForge uses soft gating:

- **Visitor/free** users can use Template Maker, Generator, local browser templates, data import, previews, and project import/export. Clean PNG/PDF/ZIP export remains locked.
- **Paid** users can use Template Maker, Generator, and clean export. They cannot edit shipped default template files directly.
- **Development** users can use everything paid users can use, and can edit/save shipped default templates when `CARDFORGE_ALLOW_LIBRARY_WRITES=true`. They can also see development/admin tooling status for Stripe, auth, entitlement, and shipped-library writes.

The product must not require sign-in to open the studio.

## Landing Page Design

The landing page should feel like CardForge: fantasy forge, premium card texture, hand-crafted game-table energy, and real product capability. It should not feel like a generic corporate SaaS landing page.

The first screen should include:

- CardForge Studio brand signal.
- Primary CTA: `Start Creating`.
- Secondary CTA: `Account & Export`.
- Clear local-first promise.
- Generated fantasy forge/card imagery as a real production asset.

Down-page content should reinforce:

- Maker and generator are immediately usable.
- Bulk data and template variables are part of the product promise.
- Premium assets and parts are file-backed and expandable.
- Export unlocks with paid/dev entitlement.

## Account/Profile Page

The account page should show:

- Current access mode: free, paid, or dev.
- Whether auth is configured and whether the visitor is signed in.
- Whether clean export is available.
- Local-first storage reminder.
- CTA to start checkout when appropriate.
- CTA back to Studio.

For development users, show a development tools section:

- shipped-library write status
- Stripe checkout configuration status
- auth configuration status
- entitlement source
- reminders that public Clerk metadata is not trusted

This section can be read-only for the current slice. It establishes the proper admin surface without pretending a full Stripe dashboard exists before webhooks/admin APIs are finished.

## API Support

Add a safe billing status route for account/dev tooling. It should expose only configuration booleans and missing key names, never secret values.

## Verification

The slice is complete when:

- `/` renders the landing page and can navigate to `/studio`.
- `/studio` renders the existing maker/generator workspace.
- `/account` renders access/profile state.
- free users still have maker/generator access and export locked.
- paid/dev capability mapping remains covered by unit tests.
- dev tooling status has unit/API coverage where practical.
- lint, typecheck, tests, build, and smoke/browser checks pass or any blocker is documented.
