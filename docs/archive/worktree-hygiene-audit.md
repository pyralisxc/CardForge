# Worktree Hygiene Audit

Last updated: May 26, 2026

This checkpoint classifies the current dirty worktree so future cleanup work can separate intentional architecture moves from suspicious leftovers.

## Current Read

The worktree is large but mostly coherent. The biggest apparent dirt comes from broad architecture moves that Git currently shows as deleted old files plus untracked new files:

- `src/components/card-forge/*` monolith files moved into `src/features/template-editor/*`, `src/features/card-generator/*`, and `src/features/app-shell/*`.
- historical planning docs moved from `docs/superpowers/*` and root docs into `docs/archive/*`.
- new pipeline, audit, server-timing, vector-shape, and reusable-account test support files are still untracked.
- active docs now point at pipeline-first behavior; archived docs intentionally preserve older file-backed/default language.

## Verified Hygiene

- Active code no longer imports the removed monolithic component paths such as `@/components/card-forge/CardTemplateMaker`, `BulkGenerator`, `SingleCardGenerator`, `TextElementInspector`, or old header/export components.
- Active docs no longer instruct contributors to use `docs/superpowers`; remaining matches are cleanup-plan search commands.
- `docs/superpowers` has been emptied from the active docs tree. The remaining May 25 codespace plan was moved into `docs/archive/superpowers/plans/`.
- Active source/tests/docs outside `docs/archive` no longer contain retired base-library, official-default, synthetic-official-contributor, old owner seed, or removed hardcoded default-library symbols.

## Intended Buckets

### Architecture Moves

- Card generator components now live under `src/features/card-generator/components/`.
- Template editor components and local maker helper libraries now live under `src/features/template-editor/`.
- Public/studio shell components now live under `src/features/app-shell/components/`.
- Shared card rendering primitives that are still broadly reused remain under `src/components/card-forge/`, such as `CardPreview`, `TemplateThumbnail`, `CardForgeRichTextEditor`, and vector shape rendering.

### Pipeline-First Cleanup

- `/api/assets`, `/api/templates`, and `/api/styles` are moving toward registry-backed shared content.
- Repo starter files under `data/` and `public/card-assets/` are import material for pipeline sync, not runtime fallback catalogs.
- Starter content should be normal contributor-owned pipeline content with status, contributor, tier, vote, archive, and recovery behavior.

### Docs Cleanup

- Current source-of-truth docs should be `README.md`, `docs/README.md`, `docs/development-guide.md`, `docs/backend-data-flow.md`, `docs/blueprint.md`, and `docs/release-checklist.md`.
- Historical implementation plans/specs belong under `docs/archive/`.
- New cleanup or audit docs should be promoted into `docs/README.md` only when they remain useful after the current cleanup phase.

### Verification Support

- `scripts/audit-site-health.mjs` supports route/control/stability audits.
- `scripts/sync-pipeline-defaults.mjs` imports starter assets into the Supabase-backed pipeline.
- New unit tests cover moved helpers and pipeline behavior.

## Suspicious Or Needs Follow-Up

- Git rename detection will remain noisy until the moved files are staged/committed together.
- The `official` access tier still exists in types and compatibility paths. It should stay until a schema/type migration removes or formally reserves it.
- The active cleanup plan still contains search commands referencing old paths; that is acceptable as audit evidence, but it should not become contributor guidance.
- Full smoke coverage should run after the move/refactor bucket is staged, because import checks and targeted tests do not prove every user workflow.

## Recommended Commit Batches

1. **Folder architecture move**: old component deletions plus new feature-folder component files.
2. **Pipeline-first data/library behavior**: asset registry, template/style APIs, developer pipeline store/UI, Supabase migration, sync script, and related tests.
3. **Studio tooling quality**: inspector panels, vector shapes, template editor helper libraries, and maker/generator tests.
4. **Account/owner/roadmap/demo polish**: account pages, owner console, roadmap updates, Founder Beta/demo capacity, and authenticated smoke.
5. **Docs archive and source-of-truth docs**: `docs/archive`, `docs/README.md`, development/backend/blueprint/release docs, and cleanup plans.

## Next Move

Run a staging-preview pass by bucket before committing. The goal is not to squash everything into one blob; it is to let Git show the project shape:

```bash
git status --short
git diff --name-status --find-renames=50%
rg -n "@/components/card-forge/(CardTemplateMaker|BulkGenerator|SingleCardGenerator|TextElementInspector|Header|PublicSiteHeader)" src tests
npm run lint
npm run typecheck
npm test
```
