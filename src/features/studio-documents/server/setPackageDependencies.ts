import { createHash } from 'node:crypto';
import { decodeCardForgeProjectPackage, hydrateCardForgeProjectSnapshot } from '@/features/project/client/package-core';
import { interpretStudioDependencies } from './studioDependencyInterpretation';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Interpret the actual verified ZIP bytes, never a caller-provided hash or negative scan. */
export async function interpretPipelineSetPackage(bytes: Uint8Array) {
  let source: unknown;
  const snapshot = await decodeCardForgeProjectPackage(bytes, value => { source = value; });
  if (!record(source) || !record(source.project)) throw new Error('Set source manifest unavailable.');
  const sourceManifest = source;
  const project = source.project;
  const reasons = new Set<string>();
  if (!Array.isArray(source.assets)) reasons.add('unsupported_package_assets');
  if (Object.keys(source).some(key => !['cardforgeProject','name','projectRevision','savedAt','project','assets'].includes(key))) reasons.add('unsupported_package_manifest_field');
  // Portable artifact envelopes are not present in the v1 runtime document.
  // Inspect them before projecting the canonical card payloads for the existing interpreter.
  let rawRuntime: unknown = project;
  if (source.cardforgeProject === 2) {
    // v2 owns artifacts, not v1 storedCards. The codec currently drops this
    // extra raw field; do not certify an uninspected future source shape.
    if (Object.prototype.hasOwnProperty.call(project, 'storedCards')) reasons.add('unsupported_package_project_field');
    if (!Array.isArray(project.artifacts) || project.artifacts.some(artifact => !record(artifact)
      || Object.keys(artifact).some(key => !['artifactId','artifactType','setId','card'].includes(key))
      || artifact.artifactType !== 'card' || !record(artifact.card))) reasons.add('unsupported_package_artifact');
    const { artifacts, ...fields } = project;
    rawRuntime = { ...fields, version: 1, storedCards: Array.isArray(artifacts) ? artifacts.map(artifact => record(artifact) ? artifact.card : null) : null };
  }
  const raw = interpretStudioDependencies(rawRuntime);
  const runtime = interpretStudioDependencies(hydrateCardForgeProjectSnapshot(snapshot));
  for (const reason of [...raw.opaqueReasons, ...runtime.opaqueReasons]) reasons.add(reason);
  // Embedded assets are integrity checked by the package codec, but a complete
  // nested asset/font dependency interpretation is not established here.
  if (snapshot.assets.size) reasons.add('embedded_package_asset_inventory');
  return {
    contractVersion: 1,
    packageSha256: createHash('sha256').update(bytes).digest('hex'),
    fileSizeBytes: bytes.byteLength,
    projectRevision: snapshot.manifest.projectRevision,
    sourceManifest,
    complete: reasons.size === 0,
    references: {
      identities: [...new Set([...raw.references.identities, ...runtime.references.identities])].sort(),
      sources: [...new Set([...raw.references.sources, ...runtime.references.sources])].sort(),
    },
    opaqueReasons: [...reasons].sort(),
  };
}
