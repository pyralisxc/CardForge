# CardForge Owner plugin

CardForge Owner is the operator-facing companion to CardForge Studio.

- **CardForge Studio** helps signed-in creators make and revise CardForge Templates, cards, Sets, and connected projects.
- **CardForge Owner** helps the authenticated CardForge Owner inspect and operate the property around that product.

The production MCP endpoint is `https://cardforges.com/mcp/owner`. It reuses CardForge's Clerk identity and then fails closed unless the server resolves the linked account as an Owner.

The initial `0.1.0` surface is intentionally read-heavy:
- current Owner-controlled site snapshot;
- provider/readiness projection;
- recent Owner activity.

It does not expose repository editing or generic database operations. Live mutation tools should be added only through the canonical feature-owned Owner command layer so the browser and agent remain peer clients of one state model.
