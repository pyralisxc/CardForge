# CardForge Blueprint

## Product Position

CardForge helps creators turn card ideas into full, export-ready sets. The fantasy forge is the doorway; underneath is a serious production workflow for reusable templates, structured data, bulk generation, clean exports, and a reviewed contributor library.

## Product Promise

- Build cards faster with reusable templates and live previews.
- Generate complete sets from hand-entered content, CSV, JSON, or structured notes.
- Export clean PNG, ZIP, PDF, and Tabletop Simulator files when the set is ready.
- Shape the forge together through a reviewed developer pipeline for templates, overlays, icons, dividers, textures, and element recipes.

## Product Spirit

CardForge should feel handcrafted and imaginative without hiding its practical workflow. Use forge language for identity and community; use plain product language when explaining what a tool does, what data is stored, or what a user gets.

## Current Architecture (Source of Truth)

> Last updated: May 2026. Keep this section current whenever the data model or storage strategy changes.

### Tech Stack
- **Framework**: Next.js 15+ (App Router), TypeScript strict
- **UI**: TailwindCSS + shadcn/ui (`src/components/ui/`)
- **State**: Zustand with `persist` middleware (localStorage, key `card-forge-app-storage-v3`, launch schema version 1)
- **Canvas**: Freeform pointer-based drag/resize in `CardTemplateMaker.tsx`
- **Library policy**: Prefer commercial-friendly, industry-standard libraries for generic editor infrastructure and keep custom code focused on CardForge-specific template, generation, and export behavior.
- **Template library direction**: Keep pipeline-backed shared templates separate from browser-local user templates, with live previews generated through the same card preview path used by the Studio and generator.
- **Entry model**: `/` is the public landing page, `/studio` is the maker/generator workspace, `/account` is a compact My Forge account overview, `/roadmap` hosts public feature voting and the Forge Chronicle, `/developer` hosts the developer application / Forge Review asset hub, and `/owner` hosts the tabbed Library Command console.

---

### Template Data Model

All templates are `TCGCardTemplate`. The data model is **freeform-only**: there is no `rows`, `columns`, or `layoutMode` field in the launch framework.

```ts
interface TCGCardTemplate {
  id: string | null;
  name: string;
  aspectRatio: string;          // e.g. "63:88"
  frameStyle: string;
  cardBorderWidth?: string;
  cardBorderStyle?: string;
  cardBorderRadius?: string;
  cardBorderColor?: string;
  cardBorderImageSource?: string;
  baseBackgroundColor?: string;
  baseTextColor?: string;
  cardBackgroundImageUrl?: string;
  defaultElementBorderColor?: string;
  appearance?: FreeformAppearance;
  freeformCanvas?: FreeformCanvas;  // Front face canvas
  backCanvas?: FreeformCanvas;      // Optional back face canvas
}
```

`FreeformCanvas` holds an array of `FreeformCardElement` items (type: `text | image | shape | icon`), each with absolute x/y/width/height/zIndex coordinates on a 630×880 default canvas.

---

### Inline Segment Variables

Text elements can now mix static copy with element-scoped inline variables.

- Inline variables belong to the text element they were authored inside unless intentionally reused elsewhere.
- The text element remains the parent structure for preview and export.
- Child variables are stored in `fieldContracts` with an `elementId` so generator, preview, and export preserve the parent/child relationship.
- Variable identity should come from the variable key. Selected fallback text remains sample/default content, not the field name.
- The visual rich text editor is the creator-facing source of truth for text authoring today. Static text and inline variable spans live in one editable flow, with formatting controls directly above the field.
- Field cards are generator contracts plus scoped variable typography. They expose identity, required state, auto-fit, field type, font family, size, color, weight, line height, letter spacing, italic, and underline for the parent/base field and child variables scoped to the selected text element.
- Text field types intentionally stay small:
  - `Text`: one editable value with full rich text controls. If a creator wants plain text, they simply leave formatting unused. `[ability]`, `[effect]`, `[reminder]`, `[flavor]`, `[subtitle]`, `[subtext]`, and `[note]` markers can still apply semantic card-text treatment.
  - `Structured Rows`: one authored text element becomes a repeatable row pattern in the generator. For example `{{trait}}: {{value}}` starts as one row in Layout Studio, then Single Output Entry can add/remove rows, each with its own `trait` and `value`.
- Tiptap powers the editor surface. The stored template string remains the serialization format for now, but users should not need to edit raw `{{Variable:"fallback"}}` syntax during normal authoring.
- Single-card entry and edit-card dialog both use the same grouped generator field UI. Parent/base text and child variables should not be rebuilt separately per surface.

### Preview and Export Truth

`CardPreview` is the visual source of truth for generated cards. The generated-card gallery, PNG export, ZIP export, and PDF export must all render through the same preview component rather than rebuilding the card in separate export-only code paths. Single-card entry intentionally does not keep a competing live preview; users create a generated card, then review/edit/export from the generated reference gallery. Rich text element rendering is centralized in `src/lib/cardTextRender.tsx` so the Maker canvas and preview/export path use the same segment, contract, and auto-fit behavior.

- Export rendering is centralized in `src/lib/cardPreviewExport.tsx`.
- Aspect and physical-size math is centralized in `src/lib/cardExportGeometry.ts`.
- On-screen thumbnails and generated-card gallery previews should render from the template/canvas coordinate space and scale the whole card down for display. Do not rebuild them as tiny independent layouts; fixed CSS padding, borders, radii, and text fitting must preserve the same proportions users will get from the template/export path.
- The generator workspace is organized as task tabs: `Single`, `Bulk Import`, and `Export & Sets`. The generated reference gallery stays visible beside those tools so the output remains the constant review surface.
- Large generated sets use TanStack Virtual-backed responsive browsing instead of unlimited grid expansion. The generated-card gallery adapts columns to available width and renders only the visible rows plus overscan while preserving the shared `CardPreview` source of truth.
- Duplex card support now starts from the same source-of-truth model:
  - `freeformCanvas` is the front face
  - `backCanvas` is the optional back face
  - maker editing keeps the front face primary and only creates `backCanvas` when the user explicitly adds a back face
  - new back faces should seed from the pipeline-backed `default-obsidian-neon-card-back` template so teams start from an intentional reverse-side design instead of a blank canvas
  - maker editing can then switch between front and back
  - per-card export and ZIP export emit both faces when a back exists
  - physical PDF export supports two front/back layouts:
    - separate front/back sheets for duplex printing
    - front + back on the same sheet for review, hand cutting, or manual assembly
  - digital PDF export keeps faces in reading order for review/share workflows
- Physical print exports target at least 300 DPI. Physical ZIP export produces individual front/back card-face PNG files, while PDF export uses the selected paper size, margins, spacing, cut-line settings, and selected front/back layout.
- Browser exports are RGB. If a vendor requires CMYK, spot colors, bleed boxes, or PDF/X, the exported PNG/PDF should be converted in a prepress tool before production.
- Virtual/display exports target screen readability and warn when DPI is below 96. Digital ZIP export is intended as individual card images, not a cut-sheet workflow.
- Export flows should wait for React render, fonts, and images before capture so text variables, nested rich text, and uploaded assets survive the path from template to output.

### Template Storage Architecture

Templates have **two user-facing storage lanes** plus one pipeline publication index:

#### 1. `data/default-templates/*.json` — Default template library
- One JSON file per template, named by template ID (e.g. `default-arcane-spell-freeform.json`)
- Files here are historical starter import material for `npm run pipeline:sync-defaults`; they are not a runtime fallback catalog.
- Shared defaults are normal editable `TCGCardTemplate` payloads with `templateSource: "default"` and `templateLibrarySource: "pipeline"`.
- Defaults can include `templateOrder` for curated gallery ordering and `templatePreviewData` for non-destructive sample values used by previews and first-run generator data.
- Served by the Next.js API route at `src/app/api/templates/route.ts`.
- Do NOT put `layoutMode`, `rows`, or any other removed fields in these files.

#### 2. `data/user-templates/*.json` — User template library
- One JSON file per user-created, cloned, or saved template.
- User templates carry `templateSource: "user"`.
- This is the expected home for saved customer/user work.
- Release expectation: this folder should contain `.gitkeep` only unless a JSON file is intentionally promoted to shipped sample or fixture content. Any committed user-template JSON needs a named release decision.

Zustand keeps `defaultTemplates` and `userTemplates` separate, then exposes a derived combined list for Maker, Generator, previews, and exports. Persisted localStorage stores user-owned template work plus cards, styles, PDF options, and UI state. Browser-local custom asset buckets cover textures, dividers, icons, and images; the account overview and Layout Studio project import/export path should keep all four buckets visible and portable. Project import/export belongs with template management, not the generator/export panel, and is a paid/dev portability feature. Import accepts the current versioned `cardforge-studio-project.json` document plus local template JSON escape hatches for a standalone template, a template array, or a persisted local workspace snapshot with `state.userTemplates`; stored-card-only JSON is not supported because generated outputs need matching templates. Bulk contract JSON and bulk row JSON stay in the Generator bulk workflow and should not be accepted by the Layout Studio project importer. Paid/free edits to shipped templates save as Personal Library copies with fresh IDs so project export carries them; dev/owner library writers can still update the shipped template lane. Startup bootstrap refreshes shipped templates and merges server-provided user templates without replacing browser-local personal templates; project import is the intentional replace path.

#### Load flow on app start
1. Zustand rehydrates from localStorage (user's saved templates + cards)
2. `_rehydrateCallback` fires → fixes `singleCardGeneratorSelectedTemplateId` if its template was deleted
3. `page.tsx` `useEffect` fires → `GET /api/templates` → `setDefaultTemplatesFromFiles()` and `setUserTemplatesFromFiles()`

#### Save flow when user saves a template
1. `handleSaveTemplate` preserves the selected template source: editing a default updates that default id/source, while editing or cloning a user template stays in the user collection.
2. User templates continue through `addOrUpdateTemplate()` in the source-specific store collection.
3. When library writes are explicitly enabled with `CARDFORGE_ALLOW_LIBRARY_WRITES=true` and the user has dev access, `POST /api/templates` updates the pipeline registry/submission row for default templates or the local user-template folder for user templates.
4. If library writes are disabled or the account lacks dev/owner access, the server returns `403`; browser-local state may still change for the session, so the UI should continue moving toward explicit `Save a copy` vs `Update site default` choices for non-developer users.

#### Delete flow
1. `handleConfirmDeleteTemplate` → `deleteTemplate()` in store
2. When library writes are explicitly enabled with `CARDFORGE_ALLOW_LIBRARY_WRITES=true` and the user has dev access, `DELETE /api/templates` archives/hides the pipeline row for default templates or removes the local user-template file. Otherwise the API returns `403` and the shared library stays protected.

---

### Key Source Files

| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Public CardForge landing page with soft-gated studio/account entry |
| `src/app/studio/page.tsx` | Studio route that renders the maker/generator workspace |
| `src/app/account/page.tsx` | Compact My Forge account overview for entitlement, beta access, local asset status, and role-specific links |
| `src/app/roadmap/page.tsx` | Public Forge Chronicle and feature voting route with developer Chronicle controls |
| `src/app/developer/page.tsx` | Developer application and Forge Review asset hub route |
| `src/app/owner/page.tsx` | Owner-only Library Command console route |
| `src/app/profile/page.tsx` | Signed-in profile-management route powered by Clerk's user profile component |
| `src/store/appStore.ts` | Zustand store implementation — persisted state and actions |
| `src/store/selectors.ts` | Shared derived selectors for templates, generated cards, and edit state |
| `src/features/app-shell/components/CardForgeStudioShell.tsx` | Studio shell — orchestrates template/style load/save/delete and composes feature workspaces |
| `src/app/api/templates/route.ts` | REST API for pipeline-backed default templates and browser-local user templates |
| `src/app/api/styles/route.ts` | REST API for pipeline-backed appearance/style presets |
| `src/app/api/assets/route.ts` | Registry-backed live asset catalog for textures, dividers, icons, images, overlays, templates, and element presets |
| `src/app/api/account/entitlement/route.ts` | Account entitlement snapshot for export gating |
| `src/app/api/billing/checkout/route.ts` | Stripe Checkout session entrypoint for paid export |
| `src/app/api/billing/status/route.ts` | Safe billing/auth/library-write configuration status and public Founder Beta campaign status for account/dev tooling |
| `src/app/api/founder-beta/claim/route.ts` | Signed-in Founder Beta claim endpoint that records Supabase claim state and writes trusted Clerk private metadata |
| `src/app/api/roadmap/route.ts` | Supabase-backed Forge Chronicle read endpoint, compact public feature suggestion endpoint, and dev-managed timeline creation endpoint |
| `src/app/api/roadmap/votes/route.ts` | Supabase-backed one-vote-per-Clerk-user Chronicle voting endpoint |
| `src/app/api/roadmap/items/[itemId]/route.ts` | Dev-only Chronicle item delete endpoint |
| `src/app/api/developer-assets/route.ts` | Developer asset program read/create/settings endpoint for submissions, voting queues, and owner rules |
| `src/app/api/developer-assets/upload/route.ts` | Developer-only Supabase Storage upload endpoint for site-library candidate source files |
| `src/app/api/developer-assets/[submissionId]/route.ts` | Owner-only submission status and access-tier override endpoint |
| `src/app/api/developer-assets/[submissionId]/vote/route.ts` | Developer peer-vote endpoint that recalculates submission status and access tier |
| `src/app/api/owner/console/route.ts` | Owner-only business profile, legal document, integration status, and maintenance-link endpoint |
| `src/lib/apiResponses.ts` | Shared no-store JSON responses and correlation-id error envelopes for API routes |
| `src/lib/accountEntitlement.ts` | Server-side entitlement resolution from Clerk private metadata, allowlists, or local fallback mode |
| `src/lib/ownerAccess.ts` | Owner-role resolution from Clerk private metadata or server-only owner email allowlist |
| `src/lib/ownerConsoleStore.ts` | Supabase-backed owner settings, legal document, and Founder Beta promo store |
| `src/lib/roadmapStore.ts` | Server-side roadmap storage adapter, vote aggregation, and auto-archive workflow |
| `src/lib/developerAssets.ts` | Pure developer asset program rules for status, vote thresholds, monthly stats, tier caps, and access-tier decisions |
| `src/lib/developerAssetStore.ts` | Supabase-backed developer asset program adapter and submission mapping |
| `src/lib/supabaseServer.ts` | Server-only Supabase client and configuration status helper |
| `src/features/template-editor/components/CardTemplateMaker.tsx` | Freeform canvas template editor coordinator |
| `src/features/template-editor/components/` | Feature-local template editor panels, text inspector, layer tree, and inspector tools |
| `src/features/card-generator/components/` | Generation workspace, Single entry, Bulk import, generated gallery, paper/export controls, and generator-owned export buttons |
| `src/components/card-forge/TemplateThumbnail.tsx` | Shared sidebar/gallery thumbnail renderer for templates |
| `src/components/card-forge/CardForgeRichTextEditor.tsx` | Shared Tiptap rich text editor and inline variable authoring surface |
| `src/features/card-generator/components/GeneratorFieldInput.tsx` | Generator/edit/bulk field input renderer |
| `src/features/card-generator/components/GeneratorFieldGroups.tsx` | Grouped parent/child field UI for single-card entry and edit dialog |
| `src/features/card-generator/components/EditCardDialog.tsx` | Generated-card edit and duplicate dialog |
| `src/components/card-forge/CardPreview.tsx` | Renders a `TCGCardTemplate` + `CardData` to a visual card |
| `src/lib/cardTextRender.tsx` | Shared rich text element renderer for Maker canvas, generated previews, and export |
| `src/lib/freeformElementRender.ts` | Shared freeform element geometry, clipping, and image-source resolution helpers |
| `src/lib/cardPreviewExport.tsx` | Shared offscreen `CardPreview` renderer for PNG, ZIP, and PDF export |
| `src/lib/cardExportGeometry.ts` | Shared card aspect, pixel-height, and physical-size calculations |
| `src/lib/cardDataDefaults.ts` | Shared card-data initialization and fallback completion for generator/edit flows |
| `src/lib/textElementContracts.ts` | Shared text element contract, content-model, and auto-fit decisions for Maker and preview |
| `src/features/template-editor/lib/frameVisualPresets.ts` | Whole-template frame visual defaults for the template settings panel |
| `src/features/template-editor/lib/iconOptions.ts` | Built-in icon name options for icon elements |
| `src/features/template-editor/lib/elementKits.tsx` | Local element rail seed kits for insertable text, image, icon, shape, divider, and ornament elements |
| `src/features/template-editor/lib/elementStylePresets.ts` | Legacy local material/style presets for the Material & Effects panel |
| `src/features/template-editor/lib/makerTheme.ts` | Template editor theme class tokens shared by editor panels |
| `src/features/template-editor/lib/makerGeometry.ts` | Template editor geometry helpers such as unit conversion and clamping |
| `src/features/template-editor/lib/makerTemplateFactory.ts` | New freeform template factory |
| `src/features/template-editor/components/ColorField.tsx` | Shared template-editor color picker field |
| `src/lib/templateModel.ts` | Shared template reconstruction and freeform canvas defaults |
| `src/lib/constants.ts` | Shared option arrays (`FONT_WEIGHTS`, `PAPER_SIZES`, etc.) |
| `src/lib/appearance.ts` | Appearance system — material, border, texture |
| `src/types/index.ts` | All TypeScript types |
| `data/default-templates/` | Historical starter template import material for pipeline sync |
| `data/user-templates/` | User-created or cloned template JSON files |
| `data/styles/` | Historical starter appearance/style import material for pipeline sync |
| `data/assets/textures/` | Historical texture metadata import material |
| `data/assets/dividers/` | Historical divider metadata import material |
| `data/assets/parts/` | Historical metadata sidecars for image/overlay source assets during pipeline sync |
| `public/card-assets/textures/` | Historical texture source files for pipeline sync |
| `public/card-assets/dividers/` | Historical divider source files for pipeline sync |
| `public/card-assets/parts/` | Historical image/overlay source-file folder; not an active user-facing catalog |

---

### Maintainability Snapshot

The repo is intentionally organized around a small number of feature boundaries:

- `src/features/template-editor/components`
  Deep reusable editor tools used by the Card Template Maker
- `src/features/card-generator/components`
  Generator workspace and bulk-generation tool surfaces
- `src/lib/`
  Shared model, rendering, export, and data-shaping helpers
- `src/store/`
  Persisted state plus derived selectors

These files are still intentionally large:

- `src/features/template-editor/components/CardTemplateMaker.tsx`
  Editor orchestration, canvas state, pointer/depth-selection logic, history, and feature-panel composition. Do not split just for line count; the next good seam is an editor-state/action controller or a future canvas library adapter.
- `src/features/template-editor/lib/elementKits.tsx` and `src/features/template-editor/lib/elementStylePresets.ts`
  Local element insertion kits and remaining hardcoded style presets. Frame visuals, icon names, theme tokens, geometry helpers, color UI, and the new-template factory now live in focused template-editor modules.
- `src/components/card-forge/CardPreview.tsx`
  Shared visual renderer for generated cards and export capture. Keep preview behavior centralized here unless a future renderer abstraction replaces it.
- `src/store/appStore.ts`
  Persisted app state and actions

Future library swaps should happen at clear seams rather than through broad rewrites:

- template editor canvas internals: `CardTemplateMaker.tsx`, `src/lib/freeformEditor.ts`, `src/lib/templateModel.ts`
- rich text authoring and rendering internals: `CardForgeRichTextEditor.tsx`, `src/lib/cardTextRender.tsx`, `src/lib/richTextDocument.ts`
- bulk generation workflow internals: `src/features/card-generator/components/BulkGenerator.tsx`, `src/lib/bulkGeneration.ts`, `src/features/card-generator/components/`
- export pipeline internals: `CardPreview.tsx`, `src/lib/cardPreviewExport.tsx`, `src/lib/cardExportGeometry.ts`, `src/features/card-generator/components/SaveAsPdfButton.tsx`

---

### Pipeline Asset Sync

#### Styles

- Styles that the Studio offers to users should be represented as pipeline-backed `elementPreset` or style rows.
- `src/app/api/styles/route.ts` reads pipeline-backed appearance/style rows and writes registry/submission updates when library writes are explicitly enabled.
- Repo JSON style files under `data/styles/` are historical sync inputs, not a runtime style catalog.

#### Source Assets

- `src/app/api/assets/route.ts` reads published registry rows from `cardforge_asset_registry`.
- Textures, dividers, custom icons, images, and image/overlay source files become available to the Studio after they are synced or published into the pipeline.
- Repo folders under `public/card-assets/` and metadata sidecars under `data/assets/` are import/source material for `npm run pipeline:sync-defaults`.
- Adding a file to those folders no longer makes it appear in the app by itself; it must be synced into Supabase or submitted through Forge Review.
- The historical `parts` folder should be described as image/overlay source material in UI and docs. Avoid reviving `Card Parts` or a separate parts catalog as product language.

#### Storage Boundary

- Keep `data/` and `public/` physically separate.
- `data/` is the content and metadata layer consumed by server routes.
- `public/` is the static asset layer exposed to the browser.

#### Starter Import Inventory

The repo starter/source inventory should stay small and intentional:

- `data/default-templates/`: starter templates, including one optional back preset (`default-obsidian-neon-card-back.json`)
- `data/styles/`: starter style and recipe JSON inputs
- `data/assets/`: metadata sidecars for starter source files
- `data/user-templates/`: `.gitkeep` only before release; user-created JSON files should not be committed accidentally
- `public/card-assets/textures/`: starter texture/frame source assets
- `public/card-assets/dividers/`: starter SVG divider source assets
- `public/card-assets/parts/`: historical source folder for image/overlay asset imports

Generated QA artifacts, smoke outputs, local logs, and `tests/examples/` are intentionally ignored. Recreate them during QA; do not ship them as repo assets.

#### Premium Launch Art Layer

The Arcane Forge premium kit is a reusable product-art layer, not only decoration for the default examples. Landing/account imagery, editor style presets, and default templates should all draw from the same fantasy-forge asset language so the public promise matches what users can actually build. The current premium pass upgrades:

- `default-mtg-theme.json`
- `default-ttrpg-stat-sheet.json`
- `default-playing-card-theme.json`
- `default-obsidian-neon-card-back.json`
- frame-kit and source-image options should move through pipeline-backed recipes or templates instead of expanding a separate product catalog

Keep the launch back-face inventory to the single Obsidian Neon card back unless product direction changes.

---

### Account and Billing Boundary

CardForge accounts are entitlement-only for the current release. Project files, imported data, generated sets, uploaded assets, and user-authored templates stay local to the browser or downloaded project files unless a future cloud workspace is explicitly added. Free users can design locally and generate previews; paid/dev access unlocks project-file portability plus clean rendered export.

Trusted export entitlement sources are:

- Clerk private user metadata: `cardforgeAccess: "paid"` or `cardforgeAccess: "dev"`
- optional paid-beta expiration metadata: `cardforgeAccessExpiresAt` as an ISO date on paid private metadata
- server-only email allowlists: `CARDFORGE_PAID_ACCOUNT_EMAILS` and `CARDFORGE_DEV_ACCOUNT_EMAILS`
- local fallback access mode when Clerk is not configured
- a future Stripe webhook or billing-owned entitlement store

Public Clerk metadata is intentionally ignored for paid/dev unlocks because it is client-readable. API routes should return shared no-store JSON error envelopes from `src/lib/apiResponses.ts` so account, billing, template, style, and asset bootstrap failures have correlation ids instead of raw framework errors.

Clerk is wired through `src/app/layout.tsx` and `middleware.ts` only when Clerk keys are present. The middleware matcher includes Clerk's `__clerk` proxy path, but all user-facing routes remain public until an account-aware action requests sign-in. Developers use the same `/account` Clerk sign-in path as customers; dev mode is granted by setting Clerk private metadata to `cardforgeAccess: "dev"` and refreshing the account entitlement.

Early beta users can be granted export access before Stripe is live by setting Clerk private metadata to `cardforgeAccess: "paid"` and, when the grant should expire, `cardforgeAccessExpiresAt` to an ISO timestamp. Expired paid metadata resolves back to free access. The checkout CTA should explain that beta access is manual when Stripe checkout configuration is missing.

Founder Beta is a CardForge-owned promo entitlement, not a Stripe coupon in the MVP. The owner console controls campaign status, public slot cap, current release cap, 90-day access duration, auto-grant behavior, waitlist mode, public copy, and optional Stripe coupon/promotion-code references for the later billing launch. The default public cap is 300 founder slots and the initial release wave is 100. A signed-in user can claim an available slot through `/api/founder-beta/claim`; the API records the claim in Supabase and writes trusted Clerk private metadata so existing entitlement resolution unlocks clean export.

For MVP QA, account UI should distinguish incomplete setup from real account entitlement. A publishable Clerk key without `CLERK_SECRET_KEY` is treated as setup-incomplete, not as a signed-in, paid, or dev user. Local development may still use fallback export behavior, but the visible account path must tell testers to add the missing secret and restart the dev server.

Shipped library writes are additionally protected by `src/lib/serverProjectAccess.ts`: the host must opt in with `CARDFORGE_ALLOW_LIBRARY_WRITES=true`, and when Clerk is configured the current signed-in account must resolve to `dev`. UI visibility is convenience only; template/style write APIs enforce the server gate before touching shipped files.

The `/account` route also acts as the beta command center and Forge Chronicle. It can read a public living timeline, monthly unlock targets derived as 12x the running monthly roadmap cost, public roadmap votes, and compact feature suggestions from Supabase while keeping user card projects local-first. The timeline ends at the last populated checkpoint instead of inventing a fixed multi-year horizon. Clerk identity is still the user boundary: Next.js API routes read the signed-in Clerk user, then perform server-side Supabase writes with the secret key. Browser-direct Supabase writes are out of scope for the MVP Chronicle.

Roadmap voting rules:

- CardForge-authored Chronicle items are controlled by CardForge and remain visible independent of vote sentiment
- owner-controlled Site Mechanics set the active user-suggestion cap, suggestion length, archive vote floor, and downvote percentage
- user-created suggestions default to 50 active public items
- each suggestion defaults to 200 normalized characters
- each signed-in Clerk user gets one thumbs up or one "not for me" vote per item
- user-created suggestions are archived from the active board once they meet both the configured vote floor and downvote percentage
- developer-account requests are routed to email and are not granted automatically by voting or suggestion activity
- developer accounts can add Chronicle level-up checkpoints, shipped progress entries, feature-board items, and delete public roadmap items
- public feature-board sorting supports most votes, least votes, newest, and oldest

Owner role is separate from developer roster membership, but trusted owner access implies developer-grade export/tools. `cardforgeRole: "owner"` in Clerk private metadata or `CARDFORGE_OWNER_ACCOUNT_EMAILS` grants `/owner`, clean export, and developer-grade account tools without a paid subscription. Owner tools can edit business profile variables, public feature-voting mechanics, legal documents, Founder Beta promo settings, integration status, and maintenance links. Owner tools must not expose raw secret keys in browser UI; secrets remain in environment variables and provider dashboards.

The developer asset program is the financial-launch-ready content pipeline, not a payout system yet. Developer and owner accounts can submit candidate templates, element presets, textures, dividers, icons, image assets, and image/overlay source assets from `/account`; eligible developers can vote on submitted assets. Owner tools in `/owner` control max active developer slots, base monthly submission limits, base monthly published requirements, per-account developer contract overrides, future creator-pool eligibility flags, voting thresholds, owner vote weight, visible archive size, future creator-pool percentage, paid-preview behavior, contributor self-voting, owner access-tier overrides, and one consolidated asset-type cap row for Starter Library and Creator Pass. Publish Total is derived from Starter plus Creator Pass, so owners do not manage a conflicting third cap. The default launch settings are 25 active developers, 25 monthly submissions per developer, 5 monthly published assets, 5 votes before grading, 70% positive vote threshold, 5 votes before tier assignment, 60% positive for Starter Library, 80% positive for Creator Pass, contributor self-voting enabled for solo/demo review, 1x owner vote weight, 100 visible archived assets, and a 10% future creator-pool placeholder. Owner voting presets can temporarily reduce review thresholds for a solo owner test account, then scale back up for current-roster, launch-roster, or full-council review.

Developer submissions move through `draft`, `submitted`, `voting`, `publish_candidate`, `published`, `archived`, or `rejected`. Published-to-site status is lifecycle state, not a library tier. Access tier is stored separately as `hidden`, `free`, `paid`, or `developer`; votes recalculate `qualityScore`, `calculatedAccessTier`, and `tierDecisionReason`, while owners can set Starter Library, Creator Pass, Forge Review, or Hidden visibility. Only `published` submissions count toward monthly developer requirements and future contribution eligibility. Signed-in paid/free user uploads remain browser/project-local, normalize to `localOnly`, and are visibly separate from the site/developer submission pipeline; anonymous visitors can explore but must sign in before adding custom art to their local asset library.

The live asset library should be consumed through one registry contract. `/api/assets` reads published `cardforge_asset_registry` rows and does not silently rebuild the user-facing catalog from repo starter folders. If the pipeline database is unavailable or unseeded, the shared catalog should appear unavailable/empty while the Studio still lets users work with primitives and personal uploads. The registry stores metadata, access tier, status, source, and file/storage pointers. Starter assets are synced as Cameron-contributed, published pipeline rows, so they are visible in the app and participate in the same continuous developer voting pipeline as every developer upload. Registry asset types cover uploadable/resizable creation assets: textures, dividers, image/overlay source assets, icons, images, templates, and Pipeline Recipes. Templates and element presets carry embedded JSON payloads in registry metadata, so `/api/templates` and `/api/styles` read pipeline-backed defaults instead of falling back to shipped-file catalogs. Developer submissions upload their source file to the public `cardforge-developer-assets` storage bucket first; owner-published submissions then upsert into `cardforge_asset_registry`, while archived or rejected submissions are hidden from the live library. Executable `.tsx` assets are not live-executed from uploads in the MVP; they need a future sandbox/review build path before becoming runtime components.

Defaults are not a special bypass. Reducing an asset-type cap rebalances the same pipeline: the highest-signal assets remain published, over-cap passing assets move back to publish-candidate review, and failing assets move to archive. Developer votes update quality and tier signal for published defaults and incoming uploads alike. Contributor self-voting is an owner rule: enabled for solo/demo development and disabled when CardForge wants strict peer-only review. Owner vote weight is also an owner rule: at 1x the owner votes like any other developer, while 2x or 3x lets owner taste break close calls without changing file management or asset lifecycle rules. Developer monthly contribution settings work as a base contract with per-account overrides: owners set default submission and published requirements, can adjust a specific developer's limits and future creator-pool eligibility, and the app calculates that contributor's effective submissions left and missing published requirement for the current month. The planned creator pool remains future-facing: the default policy is 10% of eligible profit split evenly among eligible active developers after payout systems and terms are ready. Saving a modified default template keeps the default template id/source and updates the registry-backed default payload instead of creating a user-template copy.

Contribution history outlives account access. If a developer deletes their account, leaves the program, or is suspended, their submitted assets, published registry rows, vote records, source metadata, and contributor credit remain in the pipeline. The app should remove access by changing account entitlement or developer profile status, not by deleting historical contribution rows. When removal is required for moderation, use asset status (`archived`, `rejected`, or hidden tier) rather than deleting the ledger.

The current makerspace map is intentionally mixed while the pipeline is being consolidated:

| Feature group | Pipeline-backed today | Current gap |
| --- | --- | --- |
| Texture assets, divider assets, icons, images, image/overlay source assets | Yes through `/api/assets` and the registry | Editor catalogs now share source/tier labels; deeper entitlement affordances still need polish. |
| Templates and element presets | Yes through `/api/templates`, `/api/styles`, and embedded registry payloads | Save UX needs explicit `Update site default` vs `Save a copy` behavior by entitlement. |
| Appearance Studio style buttons | Partially through `/api/styles` | Hardcoded quick styles still bypass the developer pipeline. |
| Frame kits | No, currently repo constants | Needs a `frameKit` asset kind or structured `elementPreset` recipe model. |
| Frame presets, border presets, symbol presets, shape presets, role presets, divider quick presets | No, currently repo constants | Migrate into registry-backed `elementPreset` records with applicability metadata. |
| Shape Studio primitives | No, local editor behavior | Keep primitive creation local, but role/style recipes should be pipeline assets. |

Shape Studio is the first consolidation lane: blank primitive shapes remain local editor tools, while shape role recipes now use typed `ElementPresetRecipe` seeds with contributor, status, tier, and applicability metadata. Text frames, borders, icon styles, divider recipes, and frame kits now use the same typed recipe model, and registry-backed `/api/styles` entries are hydrated into that model for maker display.

The next makerspace model should stop using broad `element` targets for every preset. Pipeline assets and presets should declare applicability by `elementType`, semantic `role`, styled `surface`, and `assetKind/styleKind`; for example, divider recipes apply to `dividerRail`, icon controls apply to `iconGlyph`, texture assets apply to `textPanel`, `shapeFill`, or `templateCanvas`, and frame kits apply to `templateCanvas`.

The quality bar for presets is not "can be clicked." Every preset or asset exposed in Layout Studio should either create a visible element-specific improvement, declare exactly which element roles it applies to, or be removed from the primary workflow until it is represented as a developer-pipeline element preset with reviewable metadata. See `docs/preset-quality-audit.md` for the current grade, preset-family findings, and the recommended migration slice.

Owner asset management should be predictable before it is fully automated. Developer Program storage forecasting estimates the maximum managed footprint from published slot caps, a full month of voting submissions, and visible archive capacity. The forecast is planning math, not billing truth: actual uploaded binaries belong in object storage, while database rows keep metadata and source pointers. Archive automation should move extra or failed assets out of active library visibility first; permanent deletion should remain an owner-controlled cleanup action until retention rules and developer/user-facing terms are final.

---

### Launch Persist Schema

CardForge ships against the current freeform schema only. The launch build should not carry migration adapters for removed prototype fields; when the model changes before launch, update the stored schema, default JSON, tests, and docs together.

Persisted keys:
- `userTemplates`
- `appearanceStyles`
- `storedCards`
- `selectedPaperSize`
- `activeTab`
- `richTextHighlightColor`
- `singleCardGeneratorSelectedTemplateId`
- `pdfMarginMm`
- `pdfCardSpacingMm`
- `pdfIncludeCutLines`
- `exportMode`
- `exportDpi`

---

### Unsupported Patterns

These patterns are outside the launch framework and must not be reintroduced:
- Section/row template composition. Use `FreeformCardElement` on `FreeformCanvas`.
- Template `layoutMode` or `rows` fields. All templates are freeform.
- Hardcoded default-template arrays. Use `data/default-templates/*.json` through the template API.
- Hardcoded texture or divider registries as the only discovery source. Use the asset discovery route and optional sidecar metadata.
- Separate section or column editors. The template-editor feature owns the freeform maker workflow.

---

## Product Expectations (Locked)

CardForge is expected to be a universal card-system template creator with easy single and bulk generation and reliable print/export output.

The expected user experience:
- Deep visual customization without technical friction.
- Text and image variables that are easy to define and reuse.
- Specialized text zones (abilities, flavor text, subtitles) that support controlled formatting.
- Native-feel editing interactions (toolbar + keyboard + right-click context actions).
- Clear bulk documentation and guided CSV workflows.

---

## Core Design Truths

These are non-negotiable principles for roadmap and implementation decisions.

1. Template is structure, data is payload.
- Templates define zones, styling, and variable bindings.
- Single and bulk generators provide values only.

2. Variables are first-class contracts.
- Every variable should have explicit metadata: type, required, default, validation, formatting allowances, and examples.
- The same contract must drive Maker, Single, Bulk, and export behavior.

3. One formatting language everywhere.
- Rich text behavior must be consistent across Maker preview, single entry, bulk preview, and final export.
- If entry is markup-driven, users still need a live formatted surface nearby.

4. Bulk is a production pipeline.
- Bulk flow must be deterministic, inspectable, and self-documenting.
- Mapping, validation, and recovery are core product functionality.

5. Print trust is a product promise.
- Users should see quality and preflight issues before final export.

6. Power should feel easy.
- Advanced controls should be available without overloading first-run users.
- Progressive disclosure is required.

### Editing and Contract Direction

- Inline rich text variables belong to the text element where they were authored unless intentionally reused elsewhere.
- Variable identity comes from the variable key; fallback text is sample content, not the field name.
- Parent text context should stay visible when editing child variables.
- Generator field cards are settings and contract controls, not a second styling surface.
- Rich text behavior should stay aligned across Maker, Single, Bulk, preview, and export.
- Overlapping canvas elements should support intentional deep selection without forcing constant layer-tree detours.
- Grouped parent/child behavior must follow professional editor expectations:
  - moving a parent moves its children
  - resizing a transform parent scales/repositions children proportionally
  - selection between parent and child remains understandable in both canvas and layer tree

---

## Growth Areas (Quality-Complete Focus)

### Publish Cleanup Baseline

Completed cleanup work in the current consolidation phase:

- Reduced the repo to a smaller core doc set: `README.md`, `docs/blueprint.md`, and `docs/release-checklist.md`.
- Split appearance styles into one-file-per-style storage under `data/styles/`.
- Added recursive texture and divider discovery through `/api/assets`.
- Added optional asset metadata sidecars under `data/assets/textures/` and `data/assets/dividers/`.
- Reorganized major UI surfaces into clearer feature boundaries for the template editor and generator flows.
- Verified core app stability with lint, typecheck, unit tests, smoke tests, and browser workflow abuse testing.

Quality gates to keep watching:

- Continue validating accidental double-submit protection in single-card generation. Repeated `Create Generated Card` clicks should add only one card per action.
- Tighten bulk CSV gating so obviously malformed data cannot proceed as far into generation.
- Reduce ambiguous repeated control names where that improves clarity and lowers automation/test fragility.
- Re-run export-focused browser QA after the next generator/input polish pass.

Rich text and variable editing still need a dedicated deep verification pass. Current browser QA covered general workflow stability, selection/deselection, generator entry, and bulk generation pressure, but it did **not** fully validate:

- creating inline variables from selected text
- deleting or renaming inline variables
- editing rich text formatting across mixed static and variable content
- confirming seamless preview updates in Maker, Single, Bulk, and generated card output
- confirming generator fields preserve authored template rich text while remaining easy to edit intentionally

That deep pass should be treated as a first-class QA milestone before calling text authoring fully polished.

### 1. Field Contract System (Highest Priority)
- Field Contract v1 is now the generator-facing source of truth for variable metadata. Placeholder inference still exists as compatibility input, but Single, Bulk, downloadable contract JSON, and future mobile fill flows should consume resolved field definitions rather than re-infer behavior from raw `{{variable}}` text.
- `src/lib/fieldContracts.ts` owns v1 defaults, validation, repair/normalization, and the exported schema marker `FIELD_CONTRACT_VERSION = 1`. `src/lib/templateFields.ts` resolves template field definitions from explicit contracts, scoped element contracts, fallback placeholder text, image layers, and older element flags.
- `TemplateFieldContract` supports:
  - key
  - elementId
  - label
  - type (`text | structuredRows | image`)
  - required
  - multiline
  - defaultValue
  - description
  - example
  - maxLength
  - allowedFormatting
  - scoped typography overrides such as font family, size, color, weight, line height, and letter spacing
- Default formatting permissions are contract-driven. `text` and `structuredRows` fields allow emphasis, underline, color, highlight, lists, and semantic markers such as `[ability]`, `[effect]`, `[reminder]`, `[flavor]`, and `[subtitle]`; image fields allow no text formatting.
- Text inspector field cards let creators edit default value, example, description, max length, required state, auto-fit, type, and typography. New inline variables seed both `defaultValue` and `example` from the selected text so generated outputs have a stable fallback while external tools still get a sample value.
- Bulk preview and export quality checks now run shared contract validation for mapped/generated data, including required fields, max length, image-source shape, and formatting-permission warnings. Downloaded contract JSON includes `contractVersion: 1`, `description`, `example`, `maxLength`, `allowedFormatting`, defaults, required state, rich-text support, and style override columns.
- `normalizeTemplateFieldContracts()` is the repair path for older or inferred templates. It scans current template canvases and writes explicit v1 contracts for detected text variables and image fields while preserving existing scoped typography metadata.

Why this matters:
- Eliminates ambiguity.
- Aligns single and bulk behavior.
- Improves validation and error clarity.
- Gives mobile-oriented entry flows compact metadata for guided inputs, validation, examples, and progressive disclosure without needing the full desktop editor context.
- Gives future schema changes a named version boundary instead of silently changing what exported contracts mean.

### 2. Rich Text Maturity
- Keep the current marker system, but formalize support by field type.
- Add a shared command layer for formatting operations.
- Support native-feel text interactions including right-click context actions.
- Short-term display target:
  - markup entry surface,
  - live formatted preview,
  - parent composed preview for segmented text elements.
- Long-term target:
  - tokenized inline editor in visual mode so users see chips/segments rather than raw placeholder syntax.

Why this matters:
- Reduces learning friction.
- Improves confidence in advanced text workflows.

### 3. Bulk Contract and Documentation UX
- Add a first-class Bulk Contract panel showing:
  - required fields
  - supported formats
  - multiline quoting examples
  - rich text examples
- Allow download of example CSV and machine-readable contract JSON.

Why this matters:
- Faster onboarding for bulk users.
- Fewer CSV/mapping failures.

### 4. Template Maker Maintainability
- Break up `CardTemplateMaker.tsx` into focused modules:
  - canvas interaction
  - inspector state
  - layer tree operations
  - text editing commands
  - presets and assets

Additional trust-critical editor work:
- overlap selection depth behavior is now implemented through repeated-click depth cycling on overlapping canvas targets
- parent/child transform semantics now treat grouped parents as transform groups:
  - dragging a grouped parent carries its children with it
  - resizing a grouped parent scales and repositions children proportionally
- grouped-layer visibility and reselection clarity should continue improving, but grouped parents now present more clearly in the layer tree

Why this matters:
- Lowers feature risk.
- Speeds future iteration.

### 5. Quality and Accessibility Gates
- Add parity tests for rich text rendering across surfaces.
- Add keyboard and accessibility smoke tests for core workflows.
- Add regression tests for mapping and strict-mode behavior.

Why this matters:
- Prevents cross-surface drift.
- Protects product trust as features expand.

---

## Definition of Quality Complete

CardForge reaches quality-complete for this phase when all criteria below are met:

1. Contract clarity
- 100% of generated input fields are backed by explicit variable contracts (not inference-only).

2. Rich text consistency
- The same formatted input renders identically in Maker preview, single generator, bulk preview, and export output.

3. Native editing confidence
- Core text actions are available via toolbar, keyboard shortcut, and context menu.

3a. Editor interaction trust
- Overlapping elements can be intentionally selected at different depth levels.
- Group transforms behave consistently and match visible editor affordances.
- Parent and child layers remain understandable during selection, movement, and resizing.
- Selecting an element should return keyboard focus to the canvas so arrow-key transforms remain reliable after layer-tree and inspector interactions.

4. Bulk success rate
- A first-time user can complete a valid bulk generation workflow in under 5 minutes using in-app guidance.

5. Failure recoverability
- Blocking validation errors always provide actionable next steps.

6. Accessibility baseline
- Core workflows are keyboard-completable and meet WCAG 2.1 AA targets for the primary UI surfaces.

---

## Delivery Sequence (Recommended)

1. Field Contract v1 and validation hardening.
2. Shared rich text command layer and right-click support.
3. Bulk contract docs panel and downloadable schema assets.
4. Maker modular refactor for maintainability.
5. Ongoing parity, accessibility, and performance hardening.

### Next QA Pass

The highest-value next manual/browser QA pass should focus on rich text and variable authoring end to end:

1. Create a new text element and author mixed static text plus inline variables.
2. Apply bold, italic, underline, highlight, list, and text-color changes.
3. Rename, delete, and recreate variables to verify contract stability.
4. Confirm live changes in Maker preview with no stale inspector or generator state.
5. Open the same template in Single Card Entry and verify grouped fields preserve the authored rich text structure.
6. Run a bulk example that exercises rich text, multiline values, and semantic text markers.
7. Confirm generated card previews and export-facing renderers match the authored formatting.

### Library Selection Guidance

When adopting new libraries, prefer options that are:

- actively maintained
- commercially safe and permissively licensed where possible
- deep enough to replace a whole category of custom infrastructure
- stable in Next.js, React, TypeScript, and browser export workflows

Use libraries for generic infrastructure such as rich text editing, drag/resize/ordering, CSV parsing, runtime validation, and export packaging. Keep CardForge-owned code focused on template semantics, field contracts, preview truth, and print/export behavior.

### Entry Architecture

The current app opens at a public CardForge landing page. Users can enter `/studio` without signing in, use Template Maker and Generator immediately, and only hit hard account/payment gating when they try clean export or development-only shipped-library writes.

Routes:

- `/`: public landing page with fantasy CardForge positioning and CTAs.
- `/studio`: heavy maker/generator workspace.
- `/account`: personal Forge status, export entitlement, checkout CTA, Forge Chronicle timeline, sortable feature voting, developer-account request CTA, and development-status tooling.
- `/profile`: signed-in profile management for sign-in methods, profile details, and user-controlled account deletion where Clerk self-delete is enabled.

Future account work should add user-owned cloud workspace context only as an explicit product phase. The current storage model remains local-first.

---

## Short-Term Pivot Decision

Do not pivot away from the current architecture.

Do pivot execution focus toward:
- contract-first variable design,
- native-feel editing interactions,
- bulk documentation and recovery UX,
- cross-surface consistency and quality gates.

This preserves the product's strongest foundation while directly addressing the highest-impact experience gaps.
