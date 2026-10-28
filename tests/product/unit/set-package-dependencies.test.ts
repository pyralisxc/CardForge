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
  it('does not erase unknown raw fields when the runtime parser normalizes', async () => {
    const proof=await interpretPipelineSetPackage(await make({futureDependency:'unknown'}));
    expect(proof.complete).toBe(false); expect(proof.opaqueReasons).toContain('unsupported_project_field');
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
