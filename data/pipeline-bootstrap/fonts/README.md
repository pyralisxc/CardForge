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

## Exact reviewed batch command

The repository's narrowly scoped read-only CI job runs **verify only** when source, license, or importer code changes. You can run the same command without any Supabase credentials:

```sh
node scripts/sync-pipeline-defaults.mjs --verify-reviewed-fonts
```

It reports exact byte-hash, license, family identity, variation axis, and printable glyph preflight results, plus the **SHA-256 digest of this manifest**. It never uploads files or publishes content.

Only after the candidate typography is visibly reviewed/approved, and the target provider is independently verified to be the intended **Preview/staging** project, may an authorized operator invoke the existing first-party Pipeline importer explicitly:

```sh
CARDFORGE_FONT_BATCH_APPROVAL="<reviewed manifest SHA-256>" node scripts/sync-pipeline-defaults.mjs --publish-reviewed-fonts
```

That action requires the existing configured, authenticated CardForge owner profile and Supabase secret credentials; it re-verifies **all four** sources before writing, then uses the same managed Pipeline Storage and canonical owner bootstrap registry RPC as other first-party content. It refuses retired IDs, preserves existing Owner decisions, and checks actual published registry rows afterward. A provider timeout or unreadable post-commit result requires manual inspection before retrying.

Neither a normal site build nor `scripts/sync-pipeline-defaults.mjs` without the explicit flag publishes this candidate batch. It must not be invoked against Production before its own reviewed provider release gate.
