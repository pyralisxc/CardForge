# CardForge Owner plugin

CardForge Owner is the operator-facing companion to CardForge Studio.

- **CardForge Studio** helps signed-in creators make and revise CardForge Templates, cards, Sets, and connected projects.
- **CardForge Owner** helps the authenticated CardForge Owner inspect and operate the property around that product.

The production MCP endpoint is `https://cardforges.com/mcp/owner`. It reuses CardForge's Clerk identity and then fails closed unless the server resolves the linked account as an Owner.

The `0.2.0` surface remains read-heavy:
- current Owner-controlled site snapshot;
- provider/readiness projection;
- recent Owner activity;
- one bounded site-copy publication command.

Site-copy publication requires the exact `updatedAt` revision returned by the Owner snapshot. A stale browser or agent is rejected instead of overwriting newer work. In production that command publishes live; in Preview it changes staging only.

It does not expose repository editing or generic database operations. Additional live mutation tools should be added only through the canonical feature-owned Owner command layer so the browser and agent remain peer clients of one state model.

`npm run plugin:package:preview` derives the private **CardForge Owner Preview** archive from this canonical source, pinned to the stable `vercel-preview` `/mcp/owner` endpoint. It adds no Studio tools, credentials or Owner authority. `npm run plugin:package:owner` continues to produce the unchanged production archive. Follow `docs/operations.md#private-preview-plugin-acceptance` before installing or connecting Preview.
