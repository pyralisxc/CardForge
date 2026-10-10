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

## Preview-only provider preflight (required before any publication)

Before enabling the already-reviewed batch, use the exact provider credentials intended for **Card Forge Staging**. The import now **refuses Production, a different project, or an unrecognized Supabase URL**, regardless of a valid review digest. The pinned staging API origin is `https://mjdugheniazuiqoefnnb.supabase.co`; production `mpmmhjjhdxjedbmuctiv` is deliberately not a permitted target for this workflow.

```sh
node scripts/sync-pipeline-defaults.mjs --preflight-reviewed-fonts
```

This command verifies the original files and licenses again, checks that the configured key can read the **specific staging project**, finds exactly one active matching Owner Contributor profile, checks access to the existing public Pipeline Storage bucket and confirms candidate IDs are available/not tombstoned. It performs **no storage upload or database mutation**. An unavailable or mismatched provider fails closed.

Once the read-only provider preflight is green in a privileged operator environment, use the earlier `--publish-reviewed-fonts` command with the exact manifest digest and verify all four actual Pipeline rows, Preview Studio discovery, card rendering, and export. The production environment requires a future independently approved workflow—not simply changing the project URL. Never paste service credentials into chat or commit them to Git.

## Native first-party catalog provenance

The staging database's original general-purpose first-party importer marks ordinary assets as `contributor`. Forward migration `20261010030000_first_party_font_registry_source.sql` narrows the existing native routine so **only** pinned original OFL Fonts bearing reviewed source/license and batch-digest metadata are classified as **official**. Other Contributor assets and subsequent Owner decisions remain unchanged.

Publication now stores a deterministic, public JSON sidecar containing the **complete original OFL copyright/license text** next to each immutable `font/ttf` in the existing managed Pipeline bucket. Both published URLs remain discoverable from the canonical registry metadata. Post-commit readback requires `library_source='official'`, the original SHA and the correct managed notice URL. The operator must see that the forward migration has arrived in isolated staging before invoking publication.

The existing `--preflight-reviewed-fonts` command is still the only read-only credentialed gate. It and `--publish-reviewed-fonts` both keep PR #441's exact staging origin restriction and refuse Production; there is no new database or CLI auth model.
