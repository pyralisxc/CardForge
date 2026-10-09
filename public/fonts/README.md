# CardForge Bundled Font Compatibility

CardForge self-hosts font binaries used by historical Templates and cards, so existing saved font IDs can render without live Google Fonts requests. **These files are not the governed Published Pipeline font catalog.** Pipeline owns editorial font publication, provenance, approval, discoverability, and eventual starter pairings; bundled/runtime fonts supply deterministic compatibility and technical fallbacks.

## Current bundled families

- Alegreya — one variable weight file
- Barlow Condensed — regular, semibold, bold
- Cinzel — one variable weight file
- Cormorant Garamond — one variable weight file
- EB Garamond — one variable weight file
- Lato — regular, bold, black
- Orbitron — one variable weight file
- Rajdhani — regular, semibold, bold
- Spectral — regular, bold
- Uncial Antiqua — regular

Their existing render IDs/stacks are defined once in `src/domain/rendering/fonts.ts`. Their bundled CSS `@font-face` setup is a runtime implementation detail, not editorial source metadata. A bundled choice remains selectable as **Built-in compatibility**; the Studio/agent discovery of published font content reads only the actual Pipeline registry.

## Provenance/rights gate before Pipeline publication

Earlier notes say these files were downloaded from Google Fonts. The repository currently has **no per-family font license text, recorded exact upstream binary revision/checksum, or complete embed/export-rights review**. An upstream family name or general Google Fonts license FAQ is insufficient to establish the exact provenance of the copies distributed here.

Before proposing any bundled family as a first-party Pipeline asset:

1. Match each exact binary hash, style/weight axis and copyright/license metadata to its trustworthy upstream release and preserve its complete applicable license/attribution notice.
2. Confirm allowed self-hosting, redistribution, embedding, and generated card/PDF/export behavior, including reserved-name restrictions where relevant; do not assume an open license for a different version applies.
3. Verify actual glyph/language coverage, variable axes, and specimen legibility at intended physical card sizes (headline, body/rules, numbers, punctuation).
4. Establish family/weight/style identities and role-specific pairings as approved Pipeline content via existing contributor/editorial governance; never upload an unverified asset or invent a second editorial font list.

Until these checks pass, keep existing templates and built-in rendering compatible, do not silently migrate their saved font IDs, and do not advertise the bundles as newly governed/approved content. User-supplied local/project/Google Drive fonts retain their separate ownership.

Related launch issues: #377 (governed fonts), #379 (coherent starter catalog), #375 (content quality).
