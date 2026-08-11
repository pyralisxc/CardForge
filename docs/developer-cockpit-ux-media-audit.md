# Developer Cockpit media workflow

Last updated: August 11, 2026

`developer-cockpit` owns campaign packages, canonical campaign media, review history, production associations, and the Campaign Media Library. `developer-access` owns contributor identity/status/scopes. `social-publishing` owns the server-only provider boundary. Supabase owns durable metadata and objects; Buffer owns only future connected-channel delivery.

## Canonical production model

Campaign media is a first-class CardForge resource with a stable UUID. Storage bucket/object paths are implementation details and are never package, browser, or agent identity.

- Ingestion preserves a protected immutable original plus a protected normalized 2400px WebP master.
- Media owns intrinsic metadata, SHA-256 content hash, contributor snapshot, rights/credit, focal point, lifecycle/review state, and derivatives.
- A campaign variant retains only service and copy. An attachment references a media UUID and owns contextual alt text, display order, caption override, crop intent, and optional selected derivative.
- Development associations are durable CardForge snapshots for pull requests, commits, releases, features, shared assets, and Jam recordings. They are references, not GitHub/Jam mutation authority.
- Public derivatives have their own UUID, parent relationship, dimensions, format, crop/focal data, exposure state, and approval timestamp. A public URL is derived delivery output, never identity.

The exact content hash is unique. A retry with the same client media idempotency key returns the same record; a permitted reuse attaches the existing media ID without copying source binaries. Campaign creation also requires an idempotency key.

## Human workflow

Contributors assemble a campaign brief, production note, channel copy, and ID-based media attachments. The reuse picker returns only their private media and media they are authorized to reuse; it is not bucket browsing. Rights/credit are set on media at ingest, while alt text remains contextual to each campaign attachment.

Owners use the **Campaign Media** tab in the Developer Cockpit, distinct from **Asset Contributions**. It provides a visual grid/detail view for thumbnail, state, contributor, dimensions, file size, rights/credit, campaigns, delivery history, creation date, reuse relationships, and metadata-derived storage totals. Filters include private, needs review, approved, public, archived, and unused. The interface never offers raw storage control.

Owner approval is the only action that exposes a derivative. Promotion uses a durable `(parent media, purpose, promotion key)` identity and deterministic public output, so retries and media reused by several variants cannot create random duplicate public objects. Originals and unreviewed masters remain private.

## Scoped agent contract

Agents use the same authenticated contributor scopes as humans. Focused routes provide campaign list/read, non-mutating validation, media ingest/list/reuse, idempotent draft creation, optimistic draft update, association replacement, submit/review feedback, revision, and resubmission. Campaign mutations return the changed campaign plus allowed next actions rather than the complete cockpit view.

Validation uses the same campaign normalization as mutation and returns normalized fields, blocking errors, readiness warnings, and next actions without creating database rows or storage objects.

Agents and contributors cannot approve/promote media, expose private media, configure providers, load credentials/channels, create provider drafts, schedule, or publish.

## Security and rollout

All cockpit/media tables have RLS and browser roles have no privileges. The application uses the existing server-owned Supabase boundary. ID-based media previews resolve and authorize the record on the server; clients cannot submit arbitrary bucket/path values or traverse storage paths.

`CARDFORGE_EXTENDED_CONTRIBUTIONS_ENABLED` and `CARDFORGE_BUFFER_PUBLISHING_ENABLED` remain false by default. This change does not apply a production migration, grant scopes, connect Buffer, create provider drafts, schedule, publish, or alter legal terms. Follow the final migration and verification order in `docs/operations.md`.

## Deferred production automation

The registry intentionally makes later screenshot capture, focal-crop suggestions, aspect-ratio derivatives, captions, video processing, and Jam ingestion straightforward. This release does not generate those assets automatically or automate approval/publishing.
