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
- `owner-current.png`: protected Owner operating-reference for governance and operational tooling. It is not a fourth permanent user-navigation environment; current Owner capabilities compose through Profile and the native surfaces that own their work. Keep this image only as a visual reference until those protected controls are deliberately audited or redesigned.

There is **no standalone Contributor/Developer concept image**. Contributor is a capability layer that enhances Home, Library, Studio, and Profile; it must not create a separate visual universe or permanent destination.

The four user-surface WebP files are compressed repository references derived from the approved concept mockups. They preserve hierarchy, spatial intent, responsive pairing, and interaction direction while keeping the repository lightweight. They are not runtime assets or pixel-perfect implementation contracts. `docs/product-direction.md` owns the intended product model; generated `docs/product-surface-map.md` reports the current observed product topology.

## Visual hierarchy rule

Use:

- real authored previews for Sets, Projects, Templates, artwork, fonts, and other objects;
- recognizable provider/source marks;
- semantic icons for actions/status;
- subtle depth/material changes for selection and focus;
- inspectors/sheets for detail;
- spatial object grouping on Home and Studio where it improves orientation.
