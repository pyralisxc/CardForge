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

## Usage boundary

This folder is the only editable source. The matching SVG files under
`public/brand/cardforge-studio/` are generated runtime mirrors, not independent
masters. Run `npm run brand:export` after changing a source SVG; the command
resynchronizes the required runtime files before producing PNG derivatives.
Do not edit the `public/` copies directly or introduce a second asset catalog.

## Raster exports

Keep the SVG files in this folder as the editable source of truth. Generate transparent PNG derivatives for advertising tools and other raster-only consumers with:

```sh
npm run brand:export
```

The command writes the primary and compact lockups, brand mark, watermark, and common favicon sizes to the ignored `output/brand/cardforge-studio/png/` scratch directory. Generated files are derivatives, not additional brand masters; regenerate them when needed instead of committing them. Do not convert the logos to JPEG because that removes transparency and introduces compression artifacts.

The SVGs intentionally use controlled geometry and common serif fallbacks for the current approved direction. Before a future trademark or large-format print package, replace the live text with licensed, outlined master typography while preserving these filenames and proportions.
