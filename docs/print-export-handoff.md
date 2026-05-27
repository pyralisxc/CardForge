# CardForge Print and Digital Export Handoff

Last updated: May 25, 2026

CardForge exports are built for creator workflows first: local preview, home print, print-vendor handoff, and digital tabletop setup. Browser export is not a full prepress system, so production print runs should include a final vendor/prepress review.

## Native Export Targets

CardForge currently supports:

- Individual PNG/JPEG/WebP/TIFF-attempt image export from generated cards.
- Physical PNG ZIP export for front/back card-face files.
- Digital PNG ZIP export for lower-resolution sharing and online use.
- PDF sheet export with paper size, margins, spacing, cut lines, and front/back layout options.
- Tabletop Simulator spritesheet ZIP export with 10 x 7 sheets, up to 69 playable cards per sheet, optional matching back sheets, and a JSON manifest.

## Physical Print Expectations

Use the `Physical Print` export profile for vendor or serious home-print workflows.

Recommended settings:

- `300 DPI` minimum for normal card print.
- `600 DPI` only when the source art and browser performance can support it.
- PNG ZIP when a vendor wants one file per face.
- PDF when you need paper-size layout, cut lines, and front/back sheet placement.

CardForge physical validation warns about:

- placeholder image sources
- missing required fields or images
- custom font classes that may not be loaded
- text and icons inside the 4% print safe area
- RGB browser export limits

Keep important text, icons, costs, stats, and QR-like marks at least 4% inside the trim edge unless the element is intentionally decorative or bleeding.

## What CardForge Does Not Promise Natively Yet

The browser export pipeline is RGB. It does not currently generate:

- CMYK-native images
- PDF/X-compliant files
- spot-color separations
- embedded ICC output intents
- vector-preserved production PDFs
- vendor-specific dielines or imposition files

If a printer requires CMYK, PDF/X, spot colors, or custom bleed boxes, export from CardForge first, then convert and inspect in a prepress tool such as Affinity Publisher/Designer, Adobe Acrobat/Illustrator/InDesign, Scribus, or the printer's preferred workflow.

## Tabletop Simulator Handoff

Use `Export Tabletop Simulator ZIP` from the Exports panel after generating cards.

The ZIP contains:

- `tts-sheet-###-front.png`
- optional `tts-sheet-###-back.png`
- `tabletop-simulator-manifest.json`
- `README.txt`

In Tabletop Simulator, create a custom deck with:

- Width: `10`
- Height: `7`
- Number: match the card count listed for that sheet in the manifest
- Back: use the matching back sheet when present

CardForge reserves the last grid slot and splits decks after 69 playable cards per sheet because that convention avoids hidden-slot confusion in Tabletop Simulator.

## Recommended Vendor Handoff Checklist

Before sending files to a printer:

- Export a small proof set first.
- Inspect every face at 100% zoom.
- Confirm safe-area warnings are intentional.
- Confirm backs align with the vendor's duplex orientation.
- Confirm the printer's bleed requirement and whether they want trimmed face files or larger bleed files.
- Ask whether RGB PNG/PDF is acceptable or whether they require CMYK/PDF-X conversion.
- Keep the CardForge project JSON alongside exported files so you can regenerate the batch after corrections.
