# Frame Kit Parts Library Design

## Goal

CardForge should keep full-card backgrounds as starter/template support, while making the premium fantasy ingredients available as individual, expandable assets that users and maintainers can add by dropping files into project folders.

## Product Direction

The full-card backgrounds remain useful for instant results, marketing alignment, and fallback previews. They should not be the main customization engine. The editor needs a parts library that exposes high-fantasy building blocks: title plates, art windows, rules boxes, stat panels, cost orbs, corner ornaments, rails, overlays, and texture fills.

## Architecture

Assets stay file-backed and human-editable. Browser-served files live under `public/card-assets/`; metadata sidecars live under `data/assets/`. The `/api/assets` bootstrap route discovers textures, dividers, and premium parts recursively. Frame kits can reference full backgrounds and part assets, while Layout Studio can insert individual parts as editable image elements.

## Supported Asset Formats

The discovery path supports `.svg`, `.png`, `.jpg`, `.jpeg`, and `.webp`. WebP is preferred for generated premium raster art because it keeps the visual quality high without shipping multi-megabyte PNGs.

## Initial Slice

This slice adds:

- A `parts` asset kind with optional `partRole`, `defaultWidth`, and `defaultHeight` metadata.
- Recursive discovery for `public/card-assets/parts/` with sidecars in `data/assets/parts/`.
- A clean empty catalog path for human-made premium parts, without shipping generated placeholder pieces as the quality standard.
- A Layout Studio “Premium Parts” element section that inserts discovered parts as editable image elements.
- Tests and docs that prove the folder expansion path is intentional.

## Out Of Scope

This slice does not build a full visual kit composer, masking system, generated starter-art pack, or native transparent-generation pipeline. Those are good follow-up layers after the file-backed parts library is stable.
