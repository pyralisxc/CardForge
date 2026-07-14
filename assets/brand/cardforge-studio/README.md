# CardForge Studio brand assets

This folder is the repository-owned source of truth for the approved CardForge Studio identity.

## Approved identity

- `primary-lockup.svg`: full horizontal CardForge Studio logo.
- `compact-lockup.svg`: smaller header/navigation lockup.
- `brand-mark.svg`: standalone card, CF monogram, spark, and anvil mark.
- `favicon.svg`: simplified square mark intended for favicon and app-icon derivatives.

## Watermarks

- `watermark-horizontal-color.svg`
- `watermark-horizontal-charcoal.svg`
- `watermark-horizontal-white.svg`
- `watermark-mark-color.svg`
- `watermark-mark-charcoal.svg`
- `watermark-mark-white.svg`

The watermark files are full-opacity transparent SVGs. Set opacity in the renderer rather than baking translucency into the source:

- generated-card and normal social watermark: `14%` to `24%`
- promotional/social imagery: `24%` to `38%`
- mark-only placement: lower-right, inset approximately `3%` of image width
- paid clean exports should remain unwatermarked unless the product explicitly communicates otherwise

## Palette

- Charcoal: `#1A1A1C`
- Brass gold: `#B08D45`
- Ivory: `#F6F3EA`

## Usage boundary

Keep this folder as repository starter/source material. Copy only required runtime derivatives into `public/` during the implementation work. Do not introduce a second runtime asset catalog or fallback path.

The SVGs intentionally use controlled geometry and common serif fallbacks for the current approved direction. Before a future trademark or large-format print package, replace the live text with licensed, outlined master typography while preserving these filenames and proportions.