# Reviewed-source typography candidates — NOT YET PUBLISHED

These four **proposed** first-party faces are not a shadow font registry or auto-published catalog. Their immutable upstream assets and complete corresponding licenses are pinned in this source bundle. The *only* published truth is the existing Forge Pipeline registry, via CardForge's native owner first-party publication path.

Candidates: **Grenze Gotisch** (distinctive fantasy display), **Bricolage Grotesque** (expressive modern display), **Atkinson Hyperlegible Next** (accessible body/rules), and **Chakra Petch Regular** (technical numerals/stats). No two candidates replace an existing saved font ID. Each has an intended task and minimum **proposed** specimen size in [candidates.json](candidates.json); those sizes are design targets rather than validated legibility claims.

All four TTF objects and their unmodified OFL notices come from the official [google/fonts pinned revision](https://github.com/google/fonts/tree/51303ca9e8ac9dcea7b12d307ba568fd0e6fcfca/ofl). Source object SHA, license SHA, file size and original filename are pinned for strict checking. Only *one face per family* is proposed for this first tranche; single static Chakra Petch Regular is not a variable family. The other three carry explicitly checked axes from Google Fonts source metadata.

## Publication gate

1. Run the read-only verified-font source preflight. It must compare every downloaded binary and bundled license against the pinned Git blob IDs, decode glyph outlines and confirm the expected axes / family identity. An unavailable upstream must fail, not fall back to a different font.
2. Inspect physical-card-size alphabet, numeral, punctuation, dense rules, and title specimens. Review pairing suitability and any glyph/language constraints with the one existing CF-CQS-1 quality standard.
3. After explicit editorial approval of this candidate batch, invoke the owner-authenticated **opt-in** first-party font publication command against the intended isolated provider environment, then verify the resulting Pipeline registry identity, actual font URLs and print/export output. No ordinary npm build, Vercel deploy or generic static catalog sync should import these candidates.
4. Do not silently rename the existing compatibility selectors or republish the raw OFL files as detached/uncited new content.

The candidate manifest is a **publication input/provenance receipt**, not a second live catalog. Its role ends when the exact faces are governed by Pipeline. There is no additional CardForge typography store.
