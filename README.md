# CardForge Studio

A local-first data layout studio. Build layered templates, import structured data, generate preview outputs, and unlock clean exports through account entitlement without storing project files in the cloud.

## Features

- **Layout Studio** - Create layered freeform TCG, TTRPG, business, badge, page, and poster layouts with text, image, shape, icon, font, border, and background controls
- **Generate** - Fill one output manually, or import CSV, JSON, or structured text to generate an entire batch
- **Data Import Tools** - Auto-mapping, advanced mapping overrides, preview warnings, row-level variable styling, and optional strict-mode gating
- **Premium Fantasy Asset Kit** - Arcane Forge textures, dividers, ornaments, and style presets ship as real editor assets, not just landing-page mockups
- **Export Profiles** - Physical Print and Virtual Export modes with configurable DPI and preflight checks
- **Local Project Files** - Export/import project JSON files while keeping user designs local to the browser
- **Entitlement-Only Accounts** - Real accounts can unlock clean PDF/PNG/ZIP export without cloud project storage

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI**: Shadcn/UI & Tailwind CSS
- **State**: Zustand with localStorage persistence
- **Accounts**: Clerk for identity and export entitlement only
- **PDF Export**: jsPDF with shared `CardPreview` capture through `html-to-image`

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

The public landing page is served at `/`. The full maker/generator workspace is at `/studio`, account/export status is at `/account`, public feature voting and launch checkpoints are at `/roadmap`, and the developer application / Forge Review hub is at `/developer`.

### 4. Optional Account Entitlement Setup

CardForge Studio is local-first. Accounts identify whether clean export, Creator Pass assets, developer review tools, owner controls, and custom local asset uploads should be unlocked; project data, templates, imports, generated outputs, and personal custom assets remain in browser storage or downloaded project files.

Copy `.env.example` to `.env.local`, then add Clerk keys when you are ready to test real sign-in. You do not need Stripe to create or sign in to accounts; Stripe is only needed when testing paid checkout and billing-owned export unlocks. Configure social providers in the Clerk Dashboard; recommended MVP providers are Google, Apple, Microsoft, GitHub, and email.

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

In Clerk, create an application, open **User & Authentication / SSO connections**, and enable the providers you want customers and testers to use. Clerk supports social connections such as Google, Apple, GitHub, and Microsoft. Use Clerk's development keys locally and production keys on your host.

After changing Clerk environment variables, restart `npm run dev` so Next.js and Clerk middleware pick up the new keys. The app intentionally keeps `/`, `/studio`, and `/account` public; users are asked to sign in when they want account-aware actions such as clean export or paid checkout.

CardForge treats Clerk account testing as configured only when both `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are present. If the publishable key exists but the secret key is missing, `/account` shows a setup state instead of a fake signed-in or dev-account state.

For developer/tester accounts:

1. Ask each tester to sign up through the app with their preferred provider.
2. Open that user in the Clerk Dashboard and set trusted private metadata:

```json
{
  "cardforgeAccess": "dev"
}
```

The developer login path is the normal CardForge account path: open `/account`, sign in with Clerk, update the user's private metadata in Clerk, then refresh `/account`. `CARDFORGE_DEV_ACCOUNT_EMAILS` remains available as a local/server fallback, but Clerk private metadata is the preferred MVP tester workflow.

Default-template and style library writes use a two-part gate: the host must set `CARDFORGE_ALLOW_LIBRARY_WRITES=true`, and when Clerk is configured the signed-in account must resolve to `dev` from Clerk private metadata or the server-only dev allowlist. Hiding dev controls in the UI is not the security boundary; the API routes enforce the same gate before writing shipped files.

Use separate test emails or metadata values to validate each MVP state:

- no entitlement: `free`
- private `cardforgeAccess: "paid"`: paid export access
- private `cardforgeAccess: "paid"` with `cardforgeAccessExpiresAt`: time-boxed beta paid access
- private `cardforgeAccess: "dev"` or `CARDFORGE_DEV_ACCOUNT_EMAILS`: dev export access

For a three-month beta grant, set private metadata like this:

```json
{
  "cardforgeAccess": "paid",
  "cardforgeAccessExpiresAt": "2026-08-22T00:00:00.000Z"
}
```

Leave `cardforgeAccessExpiresAt` off for a non-expiring manual paid grant. Expired paid metadata resolves back to `free`; dev metadata does not use this paid-beta expiration.

Do not use public Clerk metadata as an entitlement source. CardForge treats public metadata as display/client-readable data only; paid/dev unlocks must come from private metadata, server-only email allowlists, or a future billing webhook.

The Exports panel shows the current auth configuration, session state, access mode, and account email/source so live testers can confirm which path they are testing.

### 5. Optional Supabase Forge Chronicle Database

CardForge uses Supabase for tiny shared MVP state such as the Forge Chronicle timeline, public roadmap votes, compact beta feature suggestions, and developer-managed ROI checkpoints. User project files still remain local-first; Supabase is not storing card projects in this slice.

Create a Supabase project, enable the Data API, and keep automatic RLS enabled for exposed tables. Add these server-only values to `.env.local` and to your host's production environment:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

The service key must stay server-side. The roadmap API routes use Clerk to identify the signed-in user, then write to Supabase from the server. Direct browser writes are intentionally not used for the MVP Chronicle.

Run these SQL migrations in order from the Supabase SQL editor:

1. `supabase/migrations/202605220001_cardforge_roadmap.sql`
2. `supabase/migrations/202605220002_forge_chronicle_timeline.sql`

They create and expand:

- `cardforge_roadmap_items`
- `cardforge_roadmap_votes`

Both tables have RLS enabled. There are no public client policies because the Next.js API routes mediate reads and writes. The migrations seed the current public ROI timeline with exact MRR unlock checkpoints; the page simply ends at the last populated checkpoint until dev users add more. Public feature suggestions default to 50 active items with 200 characters per suggestion. The owner console can tune those caps and the negative-signal archive rules that move user-created feature requests out of the active board.

Developer accounts (`cardforgeAccess: "dev"`) can add Chronicle ROI checkpoints, shipped progress entries, feature-board items, and delete public roadmap items from `/roadmap`. Public users can view the company timeline, sort the feature board by most votes, least votes, newest, and oldest, vote once per item, and send developer account requests by email.

Run `supabase/migrations/202605220003_owner_console.sql` after the Chronicle migrations to enable the owner console and editable legal pages. Owner role is separate from developer roster membership, but trusted owner access implies developer-grade export/tools so the owner never needs a paid subscription or a second dev flag. Grant owner access through Clerk private metadata:

```json
{
  "cardforgeRole": "owner",
  "cardforgeAccess": "dev"
}
```

`cardforgeRole: "owner"` unlocks `/owner`, clean export, and developer-grade account tools. `cardforgeAccess: "dev"` is still useful for non-owner developers. As a server fallback, set:

```bash
CARDFORGE_OWNER_ACCOUNT_EMAILS=owner@example.com
```

The owner console can edit the public business profile, feature-voting mechanics, and legal pages at `/privacy`, `/terms`, `/refund`, and `/contact`. It shows integration status and maintenance links for Clerk, Supabase, Stripe, hosting, and OpenAI, but it intentionally does not expose or edit raw secret keys in the browser.

Run `supabase/migrations/202605220004_founder_beta_campaign.sql` to enable owner-managed Founder Beta promo controls. The default public cap is 300 slots, with the first release wave capped at 100 until the owner raises it. Founder Beta is CardForge-owned entitlement first: signed-in users claim a slot through the app, then the server records the claim in Supabase and writes trusted Clerk private metadata for 90 days of clean export access. Stripe coupon and promotion-code fields live in the owner console for the later paid-billing launch, but raw Stripe secrets stay in environment variables and the Stripe dashboard.

Run `supabase/migrations/202605230001_developer_asset_pipeline.sql` to enable the developer asset program framework. Developer and owner accounts get the `/developer` Asset Hub for site-library submissions and peer voting. Owner accounts also get tabbed `/owner` controls for max active developer slots, monthly submission limits, monthly published requirements, vote thresholds, visible archive size, future creator-pool percentage, paid-preview behavior, and one-row-per-asset-type caps for Starter Library and Creator Pass. Publish Total is computed from Starter plus Creator Pass so live-library capacity has one source of truth. This is an auditable contribution framework only; it does not automate Stripe payouts or make normal user uploads cloud-backed.

Developer-submitted asset status is separate from user access tier:

- status tracks pipeline state: `draft`, `submitted`, `voting`, `publish_candidate`, `published`, `archived`, or `rejected`
- access tier tracks who can use it: `hidden`, `free`, `paid`, `developer`, or `official`
- the default ladder keeps assets under 5 votes in Forge Review, hides assets below 60% positive votes, assigns 60-79% positive assets to the Starter Library, assigns 80%+ positive assets to Creator Pass, and lets owners force Starter, Pass, Official, or Hidden visibility

Keep the asset ownership boundary explicit:

- shipped CardForge defaults are file-backed in `data/` and `public/card-assets/`
- developer submissions are account-backed candidates that owners can publish, archive, or reject
- signed-in paid/free user uploads remain local to the browser or project document unless a future submission/cloud flow is intentionally added

Add Stripe Checkout settings when you are ready to test paid export checkout:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_ID=price_...
NEXT_PUBLIC_APP_URL=https://your-dev-or-production-domain.example
```

Stripe hosted Checkout can display Apple Pay and Google Pay when wallet payment methods are enabled in Stripe, the app is served over HTTPS, the domain is registered as required by Stripe, and the customer's browser/device has a supported wallet configured.

Template library writes are disabled by default for hosted-style runs. To test server-side template save/delete locally, sign in with dev access or use local fallback dev access, then set:

```bash
CARDFORGE_ALLOW_LIBRARY_WRITES=true
```

Until Stripe or another billing source is connected, export entitlement can be assigned through Clerk private metadata or server-only allowlists:

```bash
CARDFORGE_PAID_ACCOUNT_EMAILS=maker@example.com
CARDFORGE_DEV_ACCOUNT_EMAILS=founder@example.com
```

Local development defaults to `dev` export entitlement when Clerk is not configured. Hosted production defaults to `free`, so users can design, import, generate previews, and export/import local project files while clean PDF/PNG/ZIP export stays locked until their signed-in account has paid or dev entitlement.

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
npm run test       # Unit tests (Vitest)
npm run test:watch # Unit tests (Vitest watch mode)
npm run smoke      # Browser smoke test against the local app
npm run bulk:generate # Generate large CSV batches for prefab testing
```

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
Use `docs/cardforge-aaa-upgrade-pathway.md` for the current AAA upgrade roadmap and completed Phase 1-3 engineering checkpoints.
Use `docs/print-export-handoff.md` for print-vendor, prepress, and Tabletop Simulator export expectations.

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
- `public/card-assets/parts/**/*.{svg,png,jpg,jpeg,webp}`
  Browser-served premium card parts such as title plates, art windows, rules boxes, corners, and orbs

### Auto-Discovery Rules

- Templates are loaded by `src/app/api/templates/route.ts`.
- Styles are loaded by `src/app/api/styles/route.ts`.
- Texture, divider, and part assets are discovered recursively by `src/app/api/assets/route.ts`.
- Dropping a new texture into `public/card-assets/textures/`, a new divider into `public/card-assets/dividers/`, or a new premium part into `public/card-assets/parts/` will make it available through the bootstrap asset payload.
- Optional metadata can be added by creating a matching JSON file under `data/assets/textures/`, `data/assets/dividers/`, or `data/assets/parts/` with the same relative path as the asset file.

Example:

```text
public/card-assets/textures/marble/white-vein.png
data/assets/textures/marble/white-vein.json

public/card-assets/parts/my-pack/title-plates/gold-title.webp
data/assets/parts/my-pack/title-plates/gold-title.json
```

Part sidecars can also include `partRole`, `defaultWidth`, and `defaultHeight` so Layout Studio inserts the asset at a useful starting size.

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

### Premium Launch Art

The Arcane Forge premium kit lives in:

- `public/card-assets/textures/arcane-forge/`
- `public/card-assets/dividers/arcane-forge/`
- `data/assets/textures/arcane-forge/`
- `data/assets/dividers/arcane-forge/`

Premium parts are intentionally human-addable instead of generated placeholder art. Add production parts under:

- `public/card-assets/parts/<pack-name>/`
- `data/assets/parts/<pack-name>/`

The upgraded launch examples use those same assets directly:

- `default-mtg-theme.json`
- `default-ttrpg-stat-sheet.json`
- `default-playing-card-theme.json`
- `default-obsidian-neon-card-back.json`
- `src/lib/cardFrameKits.ts` exposes the same full-frame artwork as one-click frame foundations inside Layout Studio.

Landing-page and account-flow visuals should stay aligned with these real editor assets so users can build what the product shows.

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

## Troubleshooting

| Problem | Fix |
|---|---|
| `node: command not found` | Install Node.js from https://nodejs.org and restart your terminal |
| `npm install` fails with engine errors | Your Node version is too old - run `nvm use` or reinstall Node 20+ |
| `npm run dev` cannot find Node | Install Node.js from the Windows installer so `C:\Program Files\nodejs\node.exe` exists, or update the package scripts to your Node path |
| Port 9002 already in use | Kill the process using that port, or edit `package.json` `dev` script to use a different port |
| Blank page after `npm run dev` | Open the browser console and terminal output; most likely a missing env var or build error |
