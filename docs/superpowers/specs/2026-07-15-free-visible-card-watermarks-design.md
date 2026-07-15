# Free-visible card watermark policy

## Outcome

CardForge will treat watermarking as a viewing-layer entitlement across Studio. Any rendered card surface that a free or otherwise unentitled account can inspect will show the approved centered CardForge watermark. Founder Beta, paid, developer, and owner accounts will continue to see clean Studio card surfaces through the existing `canExportClean` entitlement.

The watermark remains visual presentation only. It is never written into a template, card record, local project, exported project file, or shared clean card renderer.

This document amends the earlier centered-watermark design, which intentionally left the template editor clean. The broader free-visible rule in this document supersedes that exception.

## Surface policy

| Visible surface | Free or unentitled | Founder Beta, paid, developer, owner |
| --- | --- | --- |
| Layout Studio editable canvas | Centered watermark | Clean |
| Layout Studio Preview mode | Centered watermark | Clean |
| Layout Studio template-library card thumbnails | Centered watermark | Clean |
| Generator front/back setup previews | Centered watermark | Clean |
| Generated output gallery | Centered watermark | Clean |
| Share Card square, portrait, and story artwork | Centered watermark | Centered watermark |
| Normal PNG, PDF, ZIP, spritesheet, and project exports | Blocked by the existing gate | Clean |
| Developer and owner review previews | Not available to a free account | Clean |
| Public marketing screenshots and non-card site artwork | Unchanged | Unchanged |

The runtime asset remains `/brand/cardforge-studio/watermark.svg`. Free Studio surfaces use the established 20% opacity and approximately 68% card width. Share Card composition keeps its established 24% opacity.

## Architecture

`canExportClean` remains the single entitlement source. The watermark policy will expose one viewing-layer decision named for all visible card surfaces instead of only generated previews. The app shell passes that decision into the template editor, which passes it to the canvas stage and template-library thumbnails.

The existing `CardWatermarkOverlay` remains the visual implementation. It will be placed inside a positioned card-sized wrapper so it stays centered over the artwork at every zoom and thumbnail size. The overlay remains decorative, excluded from accessibility output, non-draggable, and pointer-inert.

The shared `CardPreview` component and `cardPreviewExport` renderer remain entitlement-agnostic. They will not import the watermark policy or overlay. This explicit boundary prevents the export renderer, which mounts `CardPreview` off-screen, from inheriting Studio-only branding.

## Editor interaction behavior

The canvas overlay will appear in both editable and Preview modes. It will render above the card artwork while using `pointer-events: none`, so pointer selection, dragging, resizing, dropping, keyboard movement, zooming, and panning continue to reach the existing editor controls.

The watermark does not become a selectable layer and does not appear in undo history, the layer tree, saved template JSON, or generated card data. Switching entitlement from free to clean-export access removes the overlay without altering the design.

## Failure handling

A missing watermark asset must not block editing. The browser may fail to display the decorative overlay, while automated production health checks continue to verify that the approved SVG is reachable. Share Card creation retains its stricter existing behavior: it fails visibly rather than silently generating unbranded social artwork when the asset cannot load.

## Verification

Regression coverage will prove:

- the free viewing policy maps `canExportClean=false` to watermark visibility and clean entitlement to no overlay;
- the editable canvas and Preview mode receive the same watermark decision;
- template-library card thumbnails receive that decision;
- existing generated gallery and deck previews remain covered;
- `CardPreview` and `cardPreviewExport` remain free of watermark dependencies;
- a free browser smoke flow can see the watermark on the Layout Studio canvas and a template thumbnail without losing editor interaction;
- entitled source paths do not request the free overlay;
- lint, type checking, the complete unit suite, the production build, GitHub CI, public smoke tests, and the exact production deployment are clean before completion.
