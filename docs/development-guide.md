# CardForge Development Guide

Last updated: May 25, 2026

This guide is the practical map for working in CardForge without rediscovering the whole app. CardForge helps creators build cards faster, generate complete sets from structured content, and shape the forge together through a reviewed developer asset pipeline. Use `README.md` for setup, `docs/blueprint.md` for product architecture, `docs/backend-data-flow.md` for API/write boundaries, and `docs/release-checklist.md` for launch readiness.

## Development Rules

- Keep user projects local-first unless a feature explicitly belongs to shared platform state.
- Treat starter defaults as pipeline content once synced, while keeping user-created templates and local uploads personal/local until they are explicitly submitted.
- Route creative defaults through the asset registry/developer pipeline when they are site-offered assets, recipes, templates, or styles.
- Prefer feature-owned components over generic buckets. Shared components belong in `src/components/` only when multiple feature areas use them.
- Avoid thin wrappers that simply rename concepts. Add adapters only when they protect a product boundary, isolate an external API, or remove real duplication.
- Verify with the smallest meaningful check first, then run broader suites before claiming a slice is complete.

## Front End Map

### App Entry

- `src/app/page.tsx`: public landing page.
- `src/app/studio/page.tsx`: Studio route.
- `src/app/account/page.tsx`: account overview.
- `src/app/profile/page.tsx`: Clerk-powered profile management.
- `src/app/roadmap/page.tsx`: public roadmap and feature voting.
- `src/app/developer/page.tsx`: developer application and Asset Hub.
- `src/app/owner/page.tsx`: owner console.

### Studio Shell

- `src/features/app-shell/components/CardForgeStudioShell.tsx` composes the heavy authoring workspace.
- `src/features/app-shell/components/StudioHeader.tsx` owns the Studio-only top navigation and account controls.
- `src/features/app-shell/hooks/useCardForgeWorkspaceState.ts` bridges persisted Zustand state into the shell.
- `src/store/appStore.ts` is the persisted local workspace store.
- `src/store/selectors.ts` holds derived template/generated-card selectors.

### Template Editor

- `src/features/template-editor/components/CardTemplateMaker.tsx` is still the main editor coordinator.
- `src/features/template-editor/components/` owns inspector panels, element library, layer tree, top bar, alignment, content, transform, typography, image, icon, shape, border, divider, template settings, and canvas-stage tools.
- `src/features/template-editor/components/TemplateSettingsPanel.tsx` owns template metadata, dimensions, frame kits, base colors, and card background inputs.
- `src/features/template-editor/components/TemplateCanvasStage.tsx` owns the Studio canvas chrome: zoom status, rulers, gutter grid, preview-mode canvas, and canvas accessibility text.
- `src/features/template-editor/components/TemplateEditableElement.tsx` owns live editable element rendering for text, images, icons, vector shapes, dividers, selection outlines, and resize handles.
- `src/features/template-editor/components/TextElementInspector.tsx` owns selected-text authoring and element-scoped variable contract cards.
- `src/features/template-editor/hooks/useTemplateEditorController.ts` owns editor document state, selection, active face, undo, redo, checked layers, and command dispatch.
- `src/features/template-editor/lib/canvasCommands.ts` owns pure canvas commands such as delete, duplicate, group, ungroup, arrange, and reorder.
- `src/features/template-editor/lib/makerDimensions.ts` owns custom card-size parsing and canvas reconstruction math.
- `src/features/template-editor/lib/frameVisualPresets.ts`, `iconOptions.ts`, `elementKits.tsx`, and `elementStylePresets.ts` own remaining local maker primitives/tool presets. Any offerable creative asset or recipe should move through the pipeline registry instead of becoming another hidden default catalog.
- `src/lib/freeformElementRender.ts` centralizes element geometry and source resolution.
- `src/lib/fieldContracts.ts` owns Field Contract v1 normalization: schema version, contract type, required state, default value, example, description, max length, allowed formatting defaults, shared validation, and template repair.
- `src/lib/templateFields.ts` turns template contracts plus placeholder/image inference into the resolved field definitions used by Single, Bulk, previews, and contract downloads.

### Generator And Export

- `src/features/card-generator/components/GenerationWorkspace.tsx` composes Single, Bulk, gallery, export, paper, and set tools.
- `src/features/card-generator/components/SingleCardGenerator.tsx` owns single-output entry.
- `src/features/card-generator/components/BulkGenerator.tsx` owns CSV/JSON/text import, mapping, preview, validation, and bulk output.
- `src/features/card-generator/components/PaperSizeSelector.tsx` owns paper-size selection.
- `src/features/card-generator/components/GeneratedCardGallery.tsx` is the generated output review surface.
- `src/features/card-generator/components/ExportCardImageButton.tsx` and `SaveAsPdfButton.tsx` own generator export actions.
- `src/components/card-forge/CardPreview.tsx` is the visual source of truth for card rendering.
- `src/lib/cardPreviewExport.tsx` renders export captures through the shared preview path.
- `src/lib/cardExportGeometry.ts` centralizes aspect, DPI, and physical-size math.

Field-driven generator surfaces should read from `extractTemplateFieldDefinitions()` instead of inspecting raw placeholder text directly. Validation should use `validateCardDataAgainstFieldContracts()` so desktop, bulk, export validation, and future mobile fill flows stay aligned on required state, examples, descriptions, max length, image-source expectations, and formatting permissions. When importing or repairing older templates, use `normalizeTemplateFieldContracts()` to persist explicit v1 contracts instead of letting inference remain the long-term source of truth.

### Account, Developer, Owner

- `src/features/account/` owns account status, profile entry, roadmap panels, and user-facing entitlement copy.
- `src/features/developer-assets/` owns Developer Asset Hub and Owner Developer Program controls. The hub keeps route/state orchestration in `DeveloperAssetHubPanel.tsx`, pure queue/library helpers in `DeveloperAssetHubModel.ts`, shared small widgets in `DeveloperAssetHubUi.tsx`, review row rendering in `DeveloperAssetRows.tsx`, and owner program form widgets in `OwnerDeveloperProgramControls.tsx`.
- `src/features/owner/` owns launch/business/legal/promo/integration command surfaces.
- `src/features/app-shell/components/PublicSiteHeader.tsx` is shared by public/account/developer/owner style pages.

## Back End Map

### API Route Groups

See `docs/backend-data-flow.md` for the durable route-by-route write-boundary map.

- `src/app/api/templates/route.ts`: reads pipeline-backed default templates plus browser-local user templates; default writes sync registry/submission rows.
- `src/app/api/styles/route.ts`: reads and writes pipeline-backed appearance/style presets.
- `src/app/api/assets/route.ts`: reads published database registry assets only.
- `src/app/api/account/entitlement/route.ts`: returns account entitlement and setup status.
- `src/app/api/billing/checkout/route.ts`: Stripe Checkout entrypoint.
- `src/app/api/billing/status/route.ts`: billing/auth/library-write status and Founder Beta public status.
- `src/app/api/founder-beta/claim/route.ts`: signed-in Founder Beta claim endpoint.
- `src/app/api/roadmap/route.ts`: roadmap read, suggestion create, and dev timeline create.
- `src/app/api/roadmap/votes/route.ts`: one-vote-per-user roadmap voting.
- `src/app/api/developer-assets/route.ts`: developer program read, asset submission, owner global settings, and owner per-account profile overrides.
- `src/app/api/developer-assets/upload/route.ts`: developer source file upload into Supabase Storage.
- `src/app/api/developer-assets/[submissionId]/route.ts`: owner status/access-tier updates and uploader edits.
- `src/app/api/developer-assets/[submissionId]/vote/route.ts`: developer asset votes.
- `src/app/api/owner/console/route.ts`: owner business, legal, promo, integration, and maintenance state.

### Server Helpers

- `src/lib/accountEntitlement.ts`: resolves free, paid, dev, and owner-like access from Clerk private metadata, allowlists, or local fallback.
- `src/lib/ownerAccess.ts` and `src/lib/serverOwnerAccess.ts`: owner access resolution.
- `src/lib/supabaseServer.ts`: server-only Supabase client and configuration status.
- `src/lib/ownerConsoleStore.ts`: owner console Supabase adapter.
- `src/lib/roadmapStore.ts`: roadmap storage and vote aggregation.
- `src/lib/developerAssets.ts`: pure developer asset rules, thresholds, caps, decisions, and monthly stats.
- `src/lib/developerAssetStore.ts`: Supabase-backed developer asset program adapter.
- `src/lib/pipelineAssetTaxonomy.ts`: app-facing labels and taxonomy mapping for pipeline assets.
- `src/lib/apiResponses.ts`: no-store JSON responses and error envelopes.
- `src/lib/apiValidation.ts`: request validation helpers.

## Data And Asset Lanes

### Save Destinations

CardForge has two user-facing creator destinations and one internal publication index:

- **Personal Library**: browser-local creator work. New templates, cloned templates, generated cards, local uploads, and saved appearance styles stay in persisted Zustand state unless exported or submitted.
- **Forge Review / Pipeline**: developer/owner-submitted assets, templates, styles, and recipes. CardForge starter content is not special-cased; it is Cameron-owned pipeline content with the same status, tier, voting, archive, and recovery rules as other submissions.
- **Live catalog**: the internal `cardforge_asset_registry` index that tells the app which published pipeline assets should appear in pickers and generators. Users should not have to think of this as a separate save path; publishing or updating pipeline content syncs it.

### Local Browser State

Zustand persists user-owned app state in localStorage. This includes user templates, generated cards, styles, PDF/export settings, active tab, and custom browser asset buckets.

This means normal Studio work should survive route changes, refreshes, browser restarts, and accidental tab closes on the same browser profile. The MVP intentionally uses durable browser-local storage instead of session-only storage because creators should not lose cards or templates when the whole browser closes. Project export/import remains the portable backup path when work needs to move between devices, browsers, accounts, or a cleared browser profile.

Project import accepts the current versioned `cardforge-studio-project.json` format plus local template JSON escape hatches: one standalone template, an array of templates, or a persisted local workspace snapshot with `state.userTemplates`. Stored-card-only JSON remains unsupported because generated outputs need matching template definitions to render safely.

### Pipeline-Owned Starter Content

The user-facing creative catalog is Supabase-first. Templates, textures, dividers, custom icons, image assets, overlays, and appearance/style recipes should appear in Studio only after they are present in `cardforge_asset_registry` and linked to `cardforge_developer_asset_submissions`.

The repo still contains historical starter files under `data/default-templates`, `data/styles`, and `public/card-assets` as migration/import source material. Runtime library APIs must not silently repopulate the Studio from those folders. If the Forge Pipeline is unavailable, the app should surface an unavailable/empty catalog and still let users work with primitives and personal uploads.

Use `npm run pipeline:sync-defaults` to import the current repo starter material into Supabase Storage, `cardforge_asset_registry`, and Cameron-owned developer submission rows.

### Supabase Shared State

Supabase stores shared platform state only:

- roadmap items and votes
- owner settings and legal content
- Founder Beta claims and promo settings
- asset registry metadata
- developer profiles, submissions, votes, and source-file pointers

Service-role access stays server-side. Browser-direct Supabase writes are not part of the MVP.

## Developer Asset Pipeline

The developer pipeline is one shared lifecycle for starter library content and developer uploads:

1. A developer submits a source asset, template, style, or recipe into Forge Review.
2. Developers vote while the asset is candidate, published, or archived.
3. Owner settings control self-voting, vote thresholds, owner vote weight, archive size, and tier caps.
4. Assets move through `draft`, `submitted`, `voting`, `publish_candidate`, `published`, `archived`, or `rejected`.
5. Access tier is separate: `hidden`, `free`, `paid`, or `developer`. Published-to-site is lifecycle status; Starter Library and Creator Pass are the user-facing visibility tiers.
6. Published assets sync into `cardforge_asset_registry`.
7. Archive keeps assets recoverable and voteable unless rejected or hidden by owner policy.

Owner Developer Program rules are base-plus-account:

- base monthly submission allowance
- base monthly published requirement
- per-developer submission override
- per-developer published requirement override
- per-developer future creator-pool eligibility flag
- per-developer owner note

The future creator pool is planning-only. The current placeholder policy is 10% of eligible profit split evenly among eligible active developers after payout systems and terms are ready. No payout automation, Stripe Connect flow, tax workflow, or legal payout promise is implemented in the MVP.

## Verification Guide

Fast local checks:

```bash
npm run lint
npm run typecheck
npm run test
```

Focused authenticated pipeline check:

```bash
npx playwright test tests/smoke/auth-account.spec.ts --project=chromium
```

Full browser smoke:

```bash
npm run smoke
```

Local site health audit:

```bash
npm run audit:site
```

Run this while the local dev server is active on `http://localhost:9002`. The audit checks public, Studio, account, developer, and owner routes; uses reusable QA accounts from `.env.local` when present; captures screenshots; and reports route timings, API `Server-Timing` headers, stuck loaders, horizontal overflow, unlabeled visible controls, console warnings, and request failures. Use it before large UI/pipeline handoffs and after changing auth, owner, developer, or Studio shell loading behavior.

Run `git diff --check` before handoff to catch whitespace issues. CRLF warnings on Windows are expected in this repo; actual whitespace errors should be fixed.

## Cleanup Expectations

Before calling a slice MVP-ready:

- User-facing terms match current product vocabulary.
- Docs name live behavior, not planned behavior, unless explicitly labeled future/planning-only.
- Feature components live in their feature folder unless they are truly shared.
- Hardcoded starter material is documented as pipeline import/source material, not confused with the runtime source of truth.
- Tests cover the durable behavior changed by the slice.
- Any remaining launch risk is listed in `docs/release-checklist.md`.
