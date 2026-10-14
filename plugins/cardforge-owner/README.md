# CardForge Owner plugin

CardForge Owner is the operator-facing companion to CardForge Studio.

- **CardForge Studio** helps signed-in creators make and revise CardForge Templates, cards, Sets, and connected projects.
- **CardForge Owner** helps the authenticated CardForge Owner inspect and operate the property around that product.

The production MCP endpoint is `https://cardforges.com/mcp/owner`. It reuses CardForge's Clerk identity and then fails closed unless the server resolves the linked account as an Owner.

The `0.3.0` surface remains read-heavy:
- current Owner-controlled site snapshot;
- provider/readiness projection;
- recent Owner activity;
- bounded site-copy publication;
- current CTA/navigation labels and announcement state with their shared settings revision;
- single-field CTA/navigation-label and announcement-text publication through the same command as on-page Owner editing.

Site-copy publication requires the exact `updatedAt` revision returned by the Owner snapshot. A stale browser or agent is rejected instead of overwriting newer work. In production that command publishes live; in Preview it changes staging only.

Use `get_owner_site_fields` before `publish_owner_site_field`. Supply the exact settings `updatedAt`; navigation edits also require an item id returned by the read. These tools change text only: link destinations, visibility and announcement enabled state remain contextual reads. A null settings revision cannot be published. After a conflict, reload and review current settings. A committed receipt is terminal even if refresh or activity recording is incomplete; verify state before further changes rather than repeating the write.

It does not expose repository editing or generic database operations. Additional live mutation tools should be added only through the canonical feature-owned Owner command layer so the browser and agent remain peer clients of one state model.

`npm run plugin:package:preview` derives the unpublished developer **CardForge Owner Preview** archive from this canonical source, pinned to the stable `vercel-preview` `/mcp/owner` endpoint. It adds no Studio tools, credentials or Owner authority. `npm run plugin:package:owner` continues to produce the unchanged production archive. Follow `docs/operations.md#preview-developer-plugin-acceptance` before installing or connecting Preview.

Full Site settings parity uses `get_owner_site_configuration` and `publish_owner_site_configuration`. Publish only changed settings in `patch`, with the exact `expectedUpdatedAt`. Arrays replace their complete collection; preserve navigation/section entries and exact Template revision pins. Prices, credentials, code capabilities and account permissions are outside these presentation commands.

`get_owner_presentation_editor` and `publish_owner_presentation` reuse the browser's Identity, Founder and Experience feature owners. Read complete values, omit the read-only `identityVersion`/`updatedAt` from edited values, and supply that exact revision separately. Founder permits a null revision only for first publication of a missing/default-backed profile; concurrent creation fails closed. Experience shares the actual Owner settings-row revision with Site settings. Browser and MCP receive the committed canonical value and a terminal receipt; refresh/history failure must not replay the write. Media, legal, roadmap and wider operational parity remain distinct capabilities to complete.
