# CardForge Studio brand assets

This folder is the repository-owned source of truth for the approved CardForge Studio identity.

## Logos and favicon

- `primary-lockup.svg`: full horizontal CardForge Studio logo.
- `compact-lockup.svg`: smaller header/navigation logo.
- `brand-mark.svg`: standalone card, CF monogram, spark, and anvil logo mark.
- `favicon.svg`: simplified square favicon and app-icon source.

These are brand identity assets. They are not watermarks.

## Watermark

- `watermark.svg`: the single approved transparent horizontal watermark source.

Set watermark opacity in the renderer rather than baking translucency into the source:

- generated-card and normal social watermark: `14%` to `24%`
- promotional/social imagery: `24%` to `38%`
- paid clean exports should remain unwatermarked unless the product explicitly communicates otherwise

## Palette

- Charcoal: `#1A1A1C`
- Brass gold: `#B08D45`
- Ivory: `#F6F3EA`

## Product concept references

The `concepts/` directory contains **one current visual-intent family only**. Git history is the archive for retired concepts; do not keep parallel alpha/current generations in the working tree.

Current references:

- `home-current.webp`: approved Home desktop/mobile concept. Home is the higher-level spatial Project/Set Desk: authored Sets/Projects feel arranged on a working surface rather than filed in folders, and selected work exposes quick actions without abandoning context.
- `library-current.webp`: approved Library desktop/mobile concept. Library is the structured collection with Personal / Published / Contributor-only Pipeline scopes, visual discovery, provider/source identity, voting, revision inspection, and selected-object detail.
- `studio-current.webp`: approved Studio desktop/mobile concept. Studio is the spatial Set Desk/workbench, with the active object central and Generate, Export, Save, Pipeline/revision/voting, validation, and other tools revealed around it rather than as separate pages.
- `profile-current.webp`: approved Profile desktop/mobile concept. Profile is quiet personal configuration for identity, security, access, provider summary, temporary AI capacity/retention, billing handoff, and Contributor role status.
- `owner-current.png`: the existing approved Owner operating-environment reference. Owner remains a separate protected environment because operating CardForge is a different recurring job. This concept remains current until Owner is deliberately audited/redesigned.

There is **no standalone Contributor/Developer concept image**. Contributor is a capability layer that enhances Home, Library, Studio, and Profile; it must not create a separate visual universe or permanent destination.

The four user-surface WebP files are compressed repository references derived from the approved concept mockups. They preserve hierarchy, spatial intent, responsive pairing, and interaction direction while keeping the repository lightweight. They are not runtime assets or pixel-perfect implementation contracts. `docs/product-direction.md` owns the product model, and `docs/product-surface-map.md` owns shipped-versus-direction placement and parity.

## Visual hierarchy rule

Use:

- real authored previews for Sets, Projects, Templates, artwork, fonts, and other objects;
- recognizable provider/source marks;
- semantic icons for actions/status;
- subtle depth/material changes for selection and focus;
- inspectors/sheets for detail;
- spatial object grouping on Home and Studio where it improves orientation.

Avoid:

- folder/file-manager metaphors on Home;
- walls of equal dashboard cards;
- decorative borders as the primary hierarchy signal;
- long nested tab bars;
- exposing every revision by default;
- creating a separate visual universe for Contributor access.

Home should feel more spatial than Library. Library should remain denser and collection-like. Studio should preserve object position/context while focused tools open. Profile should remain calm and utilitarian. Owner may use denser operational queues because its job is different.

## Usage boundary

This folder is the only editable source for CardForge Studio identity assets. The matching SVG files under `public/brand/cardforge-studio/` are generated runtime mirrors, not independent masters. Run `npm run brand:export` after changing a source SVG; the command resynchronizes required runtime files before producing PNG derivatives.

Do not edit the `public/` copies directly or introduce a second asset catalog.

Concept images are design references only. Replacing them does not automatically change runtime UI, product behavior, or feature ownership.

## Raster exports

Keep the SVG files in this folder as the editable source of truth. Generate transparent PNG derivatives for advertising tools and other raster-only consumers with:

```sh
npm run brand:export
```

The command writes the primary and compact lockups, brand mark, watermark, and common favicon sizes to the ignored `output/brand/cardforge-studio/png/` scratch directory. Generated files are derivatives, not additional brand masters; regenerate them when needed instead of committing them. Do not convert the logos to JPEG because that removes transparency and introduces compression artifacts.

The SVGs intentionally use controlled geometry and common serif fallbacks for the current approved direction. Before a future trademark or large-format print package, replace the live text with licensed, outlined master typography while preserving these filenames and proportions.
