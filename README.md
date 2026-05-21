# TCG Card Forge

A professional-grade Trading Card Game design tool. Build layered card templates, generate cards from CSV data, and export print-ready PDFs.

## Features

- **Template Editor** - Create layered freeform TCG templates with text, image, shape, icon, font, border, and background controls
- **Card Generator** - Fill in cards manually one at a time, or import a CSV to generate an entire set at once
- **Bulk Validation Tools** - Auto-mapping, advanced mapping overrides, preview warnings, and optional strict-mode gating
- **Export Profiles** - Physical Print and Virtual Export modes with configurable DPI and preflight checks
- **PDF Export** - Print-ready export with configurable margins, card spacing, and optional cut lines

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI**: Shadcn/UI & Tailwind CSS
- **State**: Zustand with localStorage persistence
- **Canvas/Editor Foundation**: Current DOM editor with Konva/React Konva adapter seam for the next interaction-engine migration
- **Export Foundation**: Shared `CardPreview` capture remains the browser fallback, with worker-backed Sharp rasterization, zip.js archives, and `pdf-lib` PDF assembly for production-scale export jobs

## Getting Started

### 1. Install Node.js

This project requires **Node.js 20 or higher**.

**Option A - Direct download (simplest):**  
Download and install Node.js LTS from https://nodejs.org, then restart your terminal.

**Option B - Using nvm (recommended for developers):**  
[nvm](https://github.com/nvm-sh/nvm) lets you manage multiple Node versions.

```bash
# Install nvm (macOS/Linux)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Windows: use nvm-windows -> https://github.com/coreybutler/nvm-windows

# Then inside the project folder, nvm will auto-select the right version:
nvm install   # reads .nvmrc and installs Node 20
nvm use       # switches to Node 20
```

Verify your installation:

```bash
node --version   # should be v20.x.x or higher
npm --version
```

### 2. Clone & Install

```bash
git clone https://github.com/pyralisxc/CardForge.git
cd CardForge
npm install
```

### 3. Run the Dev Server

```bash
npm run dev
```

Then open **http://localhost:9002** in your browser.

Development output is isolated in `.next-dev`, while production builds use `.next` and smoke tests use `.next-smoke`. This prevents `npm run build` or smoke tests from invalidating the chunks used by an already-open local editor.

To access from another device on the same WiFi, find your machine's local IP address:

```bash
# macOS/Linux
ipconfig getifaddr en0

# Windows
ipconfig
# look for "IPv4 Address" under your WiFi adapter
```

Then open **http://<your-ip>:9002** on any device on the network, for example `http://192.168.1.42:9002`.

> **Note:** Your firewall may block port 9002. If other devices can't connect, allow the port through Windows Defender Firewall or your system firewall.

## Commands

```bash
npm run dev        # Local dev server on http://localhost:9002
npm run build      # Production build
npm run lint       # Lint the codebase
npm run typecheck  # TypeScript type-check (no emit)
npm run test:watch # Unit tests (Vitest watch mode)
npm run smoke      # Browser smoke test against the local app
npm run bulk:generate # Generate large CSV batches for prefab testing
npm run export:worker # Process queued ZIP/PDF export jobs from storage/export-jobs
```

## Production Export Worker

Large ZIP/PDF jobs are queued through local file-backed export jobs so the browser does not have to render 1000-card production batches by itself.

1. Start the app with `npm run dev`.
2. In a second terminal, run `npm run export:worker`.
3. Generate cards, open `Export & Sets`, review the worker preflight, then queue a worker ZIP or PDF.
4. The app writes job JSON and artifacts under `storage/export-jobs/`, which is ignored by git.

Worker APIs:

- `POST /api/export-jobs` creates a queued ZIP/PDF job.
- `GET /api/export-jobs/:id` returns status, progress, warnings, artifact metadata, and errors.
- `GET /api/export-jobs/:id/download` downloads a completed artifact.
- `POST /api/export-jobs/:id/cancel` requests cancellation.

The existing browser export path remains available for small jobs and parity fallback. Production certification should prefer the worker path for large print ZIP/PDF runs.

## Current Code Shape

The repo is organized around a few clear ownership areas:

- `src/features/template-editor/components`
  Deep reusable editor tools used by the Card Template Maker
- `src/features/card-generator/components`
  Generator workspace and bulk-generation tool surfaces
- `src/lib/templateModel.ts`
  Shared template and freeform-canvas construction helpers
- `src/store/appStore.ts`
  Persisted app state and actions
- `src/store/selectors.ts`
  Shared derived selectors for templates and generated cards

For the main project references, use `docs/blueprint.md` for architecture and `docs/release-checklist.md` for ship readiness.

## Content and Asset Discovery

CardForge intentionally keeps server-read content and browser-served assets separate:

- `data/default-templates/**/*.json`
  Shipped default templates
- `data/user-templates/**/*.json`
  User-created or cloned templates
- `data/styles/**/*.json`
  One JSON file per appearance style preset
- `data/assets/textures/**/*.json`
  Optional metadata sidecars for discovered textures
- `data/assets/dividers/**/*.json`
  Optional metadata sidecars for discovered dividers
- `public/card-assets/textures/**/*.{svg,png,jpg,jpeg,webp}`
  Browser-served texture assets
- `public/card-assets/dividers/**/*.{svg,png,jpg,jpeg,webp}`
  Browser-served divider assets

### Auto-Discovery Rules

- Templates are loaded by `src/app/api/templates/route.ts`.
- Styles are loaded by `src/app/api/styles/route.ts`.
- Texture and divider assets are discovered recursively by `src/app/api/assets/route.ts`.
- Dropping a new texture into `public/card-assets/textures/` or a new divider into `public/card-assets/dividers/` will make it appear in the app automatically.
- Optional metadata can be added by creating a matching JSON file under `data/assets/textures/` or `data/assets/dividers/` with the same relative path as the asset file.

Example:

```text
public/card-assets/textures/marble/white-vein.png
data/assets/textures/marble/white-vein.json
```

Use metadata sidecars when you want to override the auto-derived defaults for:
- display name
- id
- tile mode
- seamless behavior
- allowed targets
- blend mode
- default opacity
- default scale

Keep `data/` and `public/` separate. `data/` is the server-read content/config layer, while `public/` is the browser-served asset layer.

## Large Batch CSV Generation

Use the built-in generator to create batch files for prefab stress testing.

Generate 500 cards for the Emberclaw prefab:

```bash
npm run bulk:generate -- --template data/default-templates/default-playing-card-theme.json --count 500 --out data/bulk-samples/playing-card-500.csv
```

Generate 10,000 cards (same prefab):

```bash
npm run bulk:generate -- --template data/default-templates/default-playing-card-theme.json --count 10000 --out data/bulk-samples/playing-card-10000.csv
```

You can point `--template` to any shipped default in `data/default-templates` or any user-authored JSON in `data/user-templates`.

Structured repeatable fields use indexed CSV columns, for example `Exits[1].Position`, `Exits[1].Description`, `Exits[2].Position`, and `Exits[2].Description`.

## Troubleshooting

| Problem | Fix |
|---|---|
| `node: command not found` | Install Node.js from https://nodejs.org and restart your terminal |
| `npm install` fails with engine errors | Your Node version is too old - run `nvm use` or reinstall Node 20+ |
| `npm run dev` cannot find Node | Install Node.js from the Windows installer so `C:\Program Files\nodejs\node.exe` exists, or update the package scripts to your Node path |
| Port 9002 already in use | Kill the process using that port, or edit `package.json` `dev` script to use a different port |
| Blank page after `npm run dev` | Open the browser console and terminal output; most likely a missing env var or build error |
