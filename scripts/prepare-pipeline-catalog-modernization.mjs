import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const bootstrapRoot = 'data/pipeline-bootstrap';
const formatRepairIds = ['default-name-card-theme', 'default-event-badge-theme'];
const reusableKinds = new Set(['texture', 'divider', 'icon', 'image', 'elementPreset', 'font']);
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Keep the native command's whole compare-and-set baseline; absence is not a default. */
function classificationSnapshot(item) {
  const stringList = (value) => Array.isArray(value) && value.every((entry) => typeof entry === 'string');
  const nullableString = (value) => value === null || typeof value === 'string';
  if (typeof item.contributor_submission_id !== 'string' || !item.contributor_submission_id
    || typeof item.lineage_id !== 'string' || !item.lineage_id
    || !Number.isInteger(item.registry_revision) || item.registry_revision < 0
    || !stringList(item.submission_specialty_tags) || !stringList(item.submission_use_case_tags)
    || typeof item.submission_semantic_role !== 'string' || !item.submission_semantic_role
    || !nullableString(item.submission_visual_family)
    || typeof item.submission_variant_kind !== 'string' || !item.submission_variant_kind
    || !nullableString(item.submission_variant_label)
    || !stringList(item.submission_compatibility_tags)) return null;
  return {
    expectedSubmissionId: item.contributor_submission_id,
    expectedLineageId: item.lineage_id,
    expectedRevision: item.registry_revision,
    expectedSpecialtyTags: item.submission_specialty_tags,
    expectedUseCaseTags: item.submission_use_case_tags,
    expectedSemanticRole: item.submission_semantic_role,
    expectedVisualFamily: item.submission_visual_family,
    expectedVariantKind: item.submission_variant_kind,
    expectedVariantLabel: item.submission_variant_label,
    expectedCompatibilityTags: item.submission_compatibility_tags,
  };
}

/** Read-only preparation. Never imports a provider client or runs the publishing sync. */
export function prepareCatalogModernization({ inventory, formatInputs, classifications, templates }) {
  const entries = inventory.map((item) => {
    const identity = { assetId: item.asset_id, submissionId: item.contributor_submission_id, lineageId: item.lineage_id };
    if (item.specialty_tags.length && item.use_case_tags.length) return { ...identity, action: 'preserve', reason: 'Already classified; do not overwrite contributor choices.' };
    if (reusableKinds.has(item.asset_type) && item.specialty_tags.length === 1 && item.specialty_tags[0] === 'general' && !item.use_case_tags.length) return { ...identity, action: 'preserve', reason: 'Already classified as a general reusable resource.' };
    if (item.specialty_tags.length || item.use_case_tags.length || item.submission_specialty_tags?.length || item.submission_use_case_tags?.length) return { ...identity, action: 'classification-review', reason: 'Preserve partially authored classification; review missing or inconsistent values before changing it.' };
    const explicit = classifications[item.asset_id];
    const repositoryOwned = typeof item.source_path === 'string' && /^(data\/|scripts\/sync-pipeline-defaults\.mjs#|public\/site-fallbacks\/)/.test(item.source_path);
    const classification = explicit ?? (repositoryOwned && reusableKinds.has(item.asset_type)
      ? { specialtyTags: ['general'], useCaseTags: [] }
      : null);
    const snapshot = classification && !classification.reviewReason ? classificationSnapshot(item) : null;
    const reviewReason = classification && !classification.reviewReason && !snapshot
      ? 'Read the complete current classification snapshot through the native Owner command before preparing a request; do not infer missing guard values.'
      : classification?.reviewReason;
    return {
      ...identity,
      action: classification && !reviewReason ? 'classify-discovery-metadata' : 'classification-review',
      current: { specialtyTags: item.specialty_tags, useCaseTags: item.use_case_tags },
      proposed: classification ? { specialtyTags: classification.specialtyTags, useCaseTags: classification.useCaseTags } : null,
      evidence: explicit ? `${bootstrapRoot}/classification.json#${item.asset_id}` : item.source_path,
      reason: reviewReason ?? (classification ? 'Reusable repository-owned resource: General does not invent a specific application.' : 'No repository classification supports changing this item.'),
      ...(classification && snapshot && !reviewReason ? {
        request: {
          method: 'POST', path: '/api/owner/pipeline/classification',
          body: {
            assetId: item.asset_id,
            ...snapshot,
            specialtyTags: classification.specialtyTags,
            useCaseTags: classification.useCaseTags,
            semanticRole: snapshot.expectedSemanticRole,
            visualFamily: snapshot.expectedVisualFamily,
            variantKind: snapshot.expectedVariantKind,
            variantLabel: snapshot.expectedVariantLabel,
            compatibilityTags: snapshot.expectedCompatibilityTags,
          },
        },
      } : {}),
      execution: 'Use the native Owner classification command. Only proposed discovery tags change; semantic role, family, variant, compatibility, authored payload, revisions, votes and lineage remain unchanged. Re-read the complete current classification before execution; abort on drift.',
    };
  });
  const formatRevisions = formatRepairIds.flatMap((assetId) => {
    const current = formatInputs.find((item) => item.asset_id === assetId);
    if (!current?.source_payload) throw new Error(`Missing exact live payload for ${assetId}.`);
    const source = templates[assetId];
    if (!source?.formatId || !source.trimWidthMm || !source.trimHeightMm) throw new Error(`Missing explicit repository format for ${assetId}.`);
    const patch = { formatId: source.formatId, trimWidthMm: source.trimWidthMm, trimHeightMm: source.trimHeightMm };
    if (Object.entries(patch).every(([key, value]) => current.source_payload[key] === value)) return [];
    if (Object.keys(patch).some((key) => current.source_payload[key] != null)) throw new Error(`Review the existing physical format before changing ${assetId}.`);
    const revision = Number(current.registry_revision ?? 0);
    if (!Number.isInteger(revision) || revision < 0) throw new Error(`Invalid revision for ${assetId}.`);
    return [{
      assetId,
      baselineSubmissionId: current.submission_id,
      baselineLineageId: current.lineage_id,
      baselinePayloadSha256: digest(current.source_payload),
      changedFields: patch,
      evidence: `${bootstrapRoot}/templates/${assetId}.json`,
      rpc: 'cardforge_publish_owner_template_revision',
      requiredOwnerArguments: ['p_contributor_id', 'p_contributor_email'],
      arguments: {
        p_asset_id: assetId,
        p_name: current.name,
        p_description: current.description,
        p_template_payload: { ...current.source_payload, ...patch },
        p_expected_revision: revision,
        p_submission_key: `catalog-explicit-format-${assetId}-${digest(current.source_payload).slice(0, 16)}`,
      },
    }];
  });
  return {
    schemaVersion: 1,
    mode: 'dry-run',
    guard: 'Re-read linked submission, lineage, revision and payload before execution. Abort on drift. Supply the authenticated owner identity through the native owner boundary. This file grants no publication permission.',
    counts: { inspected: entries.length, formatRevisions: formatRevisions.length },
    entries,
    formatRevisions,
  };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const [inventoryPath, formatInputsPath, outputPath] = process.argv.slice(2);
  if (!inventoryPath || !formatInputsPath || !outputPath) throw new Error('Usage: node scripts/prepare-pipeline-catalog-modernization.mjs <inventory.json> <format-inputs.json> <output.json>');
  const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
  const [inventory, formatInputs, classifications] = await Promise.all([readJson(inventoryPath), readJson(formatInputsPath), readJson(`${bootstrapRoot}/classification.json`)]);
  const templates = Object.fromEntries(await Promise.all(formatRepairIds.map(async (id) => [id, await readJson(`${bootstrapRoot}/templates/${id}.json`)])));
  const manifest = prepareCatalogModernization({ inventory, formatInputs, classifications, templates });
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify(manifest.counts));
}
