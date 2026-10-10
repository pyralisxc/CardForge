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
- `skills/create-editable-template/SKILL.md`
- `skills/create-cards-and-sets/SKILL.md`

`SUBMISSION.md` remains the store/reviewer listing source in Git, but it is not part of the runtime install archive. The package always targets the canonical production MCP endpoint at `https://cardforges.com/mcp`.

The product test suite builds and extracts the real ZIP in a clean temporary directory to verify its contents, relative references, skill bytes, endpoint, and deterministic output.

## Private Preview connection

`npm run plugin:package:preview` derives both private Studio Preview and Owner Preview archives from their canonical product sources. Studio Preview uses the stable `vercel-preview` `/mcp` endpoint and copies these exact skill bytes; it is not a separate implementation or Contributor product. The production command and archive remain unchanged. See `docs/operations.md#private-preview-plugin-acceptance` for protection, authentication, installation and Staging acceptance gates. Building an archive does not establish a working connection or public availability.
