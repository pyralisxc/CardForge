import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildDeterministicStarterSetPackage } from '../../../scripts/sync-pipeline-defaults.mjs';
import { interpretPipelineSetPackage } from '@/features/studio-documents/server/setPackageDependencies';
const make = async (extra = {}, root = {}) => {
  const project = { version:2, userTemplates:[], artifacts:[], cardSets:[], appearanceStyles:[], activeCardSetId:null, exportSettings:{}, ...extra };
  return buildDeterministicStarterSetPackage({cardforgeProject:2,name:'Synthetic Set',savedAt:'2026-10-28T00:00:00.000Z',
    projectRevision:createHash('sha256').update(JSON.stringify({project,assets:[]})).digest('hex'),project,assets:[],...root});
};
describe('canonical Set package dependency interpretation', () => {
  it('binds a source-contained document to exact ZIP bytes and raw manifest', async () => {
    const bytes=await make(); const proof=await interpretPipelineSetPackage(bytes);
    expect(proof.complete).toBe(true); expect(proof.packageSha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    expect(proof.fileSizeBytes).toBe(bytes.length); expect(proof.sourceManifest.project).toEqual(expect.objectContaining({version:2}));
  });
  it('interprets the current v3 artifact envelope without resolving literal Set context', async () => {
    const context = { version: 1, context: 'data:image/png;base64,not artwork', future: { sample: 'cardforge-project-asset://literal' } };
    const proof = await interpretPipelineSetPackage(await make({ cardSets: [{ id: 'local', name: 'Native Set', plan: context }] }, { cardforgeProject: 3 }));
    expect(proof.complete).toBe(true);
    expect(proof.opaqueReasons).toEqual([]);
    expect(proof.references.sources).toEqual([]);
    expect(proof.sourceManifest.project).toEqual(expect.objectContaining({ cardSets: [expect.objectContaining({ plan: context })] }));
  });
  it('still refuses uninspected fields in a v3 artifact envelope', async () => {
    await expect(interpretPipelineSetPackage(await make({ storedCards: [], artifacts: [{ artifactId: 'a', artifactType: 'card', setId: 'local', card: { uniqueId: 'a', templateId: 'external', data: {} }, future: 'unknown' }] }, { cardforgeProject: 3 })))
      .rejects.toThrow(/artifact document|unsupported creative fields/i);
  });
  it('does not erase unknown raw fields when the runtime parser normalizes', async () => {
    const proof=await interpretPipelineSetPackage(await make({futureDependency:'unknown'}));
    expect(proof.complete).toBe(false); expect(proof.opaqueReasons).toContain('unsupported_project_field');
  });
  it('rejects raw v2 storedCards even if the codec projects only artifacts', async () => {
    const rawCards = [{templateId:'target-template',uniqueId:'x',data:{}}];
    const proof = await interpretPipelineSetPackage(await make({storedCards:rawCards,artifacts:[]}));
    expect(proof.complete).toBe(false);
    expect(proof.opaqueReasons).toContain('unsupported_package_project_field');
    expect(proof.sourceManifest.project).toEqual(expect.objectContaining({storedCards:rawCards,artifacts:[]}));
  });
  it('blocks unknown manifest extensions', async () => {
    const proof=await interpretPipelineSetPackage(await make({}, {futureDependency:'unknown'}));
    expect(proof.complete).toBe(false); expect(proof.opaqueReasons).toContain('unsupported_package_manifest_field');
  });
  it('rejects corrupt package identity through the existing codec', async () => {
    await expect(interpretPipelineSetPackage(await make({}, {projectRevision:'0'.repeat(64)}))).rejects.toThrow(/revision/);
  });
  it('does not treat display names as canonical identities', async () => {
    const proof=await interpretPipelineSetPackage(await make({cardSets:[{id:'local-set',name:'target-asset'}]}));
    expect(proof.references.identities).not.toContain('target-asset');
  });
  it.each(['https://example.invalid/target.svg','relative-artwork.svg','data:image/svg+xml,<svg/>'])('retains and blocks unbound image source %s', async source => {
    const proof=await interpretPipelineSetPackage(await make({userTemplates:[{id:'local',name:'Local',aspectRatio:'2:3',cardBackgroundImageUrl:source,
      freeformCanvas:{width:300,height:450,elements:[]}}]}));
    expect(proof.complete).toBe(false); expect(proof.references.sources).toContain(source);
  });
  it('retains typed catalog identities and refuses mutable external Template resolution', async () => {
    const proof=await interpretPipelineSetPackage(await make({cardSets:[{id:'local',name:'Local',templateIds:['target-template']}]}));
    expect(proof.references.identities).toContain('target-template');
    expect(proof.complete).toBe(false); expect(proof.opaqueReasons).toContain('mutable_catalog_template_resolution');
  });

});
