# CardForge Studio plugin bundle

This directory is the canonical source for the standalone **CardForge Studio** plugin. The plugin is intentionally small: its manifest, production MCP connection, and packaged skills live here while CardForge itself hosts the application and MCP implementation.

## Build the installable ZIP

From the repository root:

```bash
npm run plugin:package
```

The command writes `dist/plugins/cardforge-studio-<version>.zip`. The filename version is read directly from `.codex-plugin/plugin.json`; do not hand-version or manually assemble the archive.

The publishable archive is built from an explicit allowlist and contains only:

- `.codex-plugin/plugin.json`
- `.mcp.json`
- Portable `plugin.json` and `mcp.json`
- Brand `icon.svg`, `assets/logo.png`, and `assets/icon.png`
- `skills/create-editable-template/SKILL.md`
- `skills/create-cards-and-sets/SKILL.md`

`SUBMISSION.md` retains publisher submission instructions and policy context; `REVIEW_CASES.json` is the canonical structured source for the five positive/five negative human review cases. Both remain outside the runtime install archive. The builder embeds the official five-positive/three-negative initial MCP subset into both manifests. The Downloads page provides a separate human review packet for the current version. The package always targets the canonical production MCP endpoint at `https://cardforges.com/mcp`.

The product test suite builds and extracts the real ZIP in a clean temporary directory to verify its allowlist, relative references, skill bytes, exact endpoint, listing assets, structured review case subset and deterministic checksum. Version 1.0.4 is a proposed candidate; the retained 1.0.3 release is never rewritten in place.

## Private Preview connection

`npm run plugin:package:preview` derives both unpublished developer Studio Preview and Owner Preview archives from their canonical product sources. Studio Preview uses the stable `vercel-preview` `/mcp` endpoint and copies these exact skill bytes; it is not a separate implementation or Contributor product. The production command and archive remain unchanged. See `docs/operations.md#preview-developer-plugin-acceptance` for public Preview access, CardForge authentication, developer installation and Staging acceptance gates. Building an archive does not establish a working connection or public availability.
