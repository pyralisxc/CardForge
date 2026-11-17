import { describe, expect, it } from 'vitest';
import { createProjectDocumentFromState } from '@/features/project/client/model';
import { interpretStudioDependencies } from '@/features/studio-documents/server/studioDependencyInterpretation';
import { isSourceContainedCssImage } from '@/domain/templates/sourceContainedCss';
const template = { id:'local',name:'Literal',aspectRatio:'2:3',freeformCanvas:{width:200,height:300,elements:[]} };
const document = { version:1,userTemplates:[template],storedCards:[],cardSets:[],appearanceStyles:[],customAssets:{},exportSettings:{} };
const reviewOnlyDocument = (updateReviews: unknown) => ({
 ...createProjectDocumentFromState({userTemplates:[],storedCards:[],appearanceStyles:[]}),
 cardSets:[{id:'review-only',name:'Review only',updateReviews}],
});
describe('source-owned Studio dependency interpretation', () => {
 it('keeps Set context opaque text while still inspecting typed brief asset locators', () => {
  const plan={version:1,context:'https://example.com is a note. {{Not a render binding}}',custom:{assetUrl:'https://example.com/not-an-asset'}};
  const project={...document,version:2,cardSets:[{id:'set',name:'Set',plan}]};
  expect(interpretStudioDependencies(project).complete).toBe(true);
  expect(interpretStudioDependencies(project).references.sources).toEqual([]);
  const brief={version:1,decisionMode:'confirmed',purpose:'Deck',deliverable:'Cards',outputSize:{width:63,height:88,unit:'mm'},visualDirection:{summary:'Minimal',palette:[],typography:[]},editableFieldKeys:[],assets:[{id:'art',name:'Art',kind:'image',role:'Face',source:'user-provided',quantity:1,status:'selected',assetId:'managed-art',assetUrl:'https://example.invalid/image.png'}]};
  const proof=interpretStudioDependencies({...project,cardSets:[{id:'set',name:'Set',plan:{...plan,brief}}]});
  expect(proof.references.identities).toContain('managed-art');
  expect(proof.references.sources).toContain('https://example.invalid/image.png');
  expect(proof.complete).toBe(false);
 });
 it('interprets a complete literal document without resolving catalog discovery', () => {
  const proof=interpretStudioDependencies(document);
  expect(proof.opaqueReasons).toEqual([]); expect(proof.complete).toBe(true); expect(proof.references.identities).toContain('local');
 });
 it('treats known v4 Set Update Review ledgers as opaque metadata', () => {
  const empty = interpretStudioDependencies(reviewOnlyDocument([]));
  expect(empty.opaqueReasons).toEqual([]); expect(empty.complete).toBe(true);
  const review = {version:1 as const,templateId:'historical-working-template',
   sourceLineageId:'https://example.invalid/source-lineage',sourceRevisionId:'https://example.invalid/source-revision',
   sourceFingerprint:'a'.repeat(64),outcome:'reviewed' as const,decisions:[{key:'historic-field',decision:'keep' as const}]};
  const proof = interpretStudioDependencies(reviewOnlyDocument([review]));
  expect(proof.complete).toBe(true); expect(proof.opaqueReasons).toEqual([]);
  expect(proof.references.identities).toEqual([]); expect(proof.references.sources).toEqual([]);
 });
 it('keeps unknown or future Set Update Review ledgers incomplete without throwing', () => {
  const review = {version:1,templateId:'historical-working-template',sourceLineageId:'source-lineage',
   sourceRevisionId:'source-revision',sourceFingerprint:'b'.repeat(64),outcome:'reviewed',
   decisions:[{key:'historic-field',decision:'keep'}]};
  for (const invalid of [
   {...review,unknownHistory:{value:'discarded'}},
   {...review,version:2},
   {...review,decisions:'malformed'},
  ]) {
   const payload = reviewOnlyDocument([invalid]);
   expect(() => interpretStudioDependencies(payload)).not.toThrow();
   expect(interpretStudioDependencies(payload).complete).toBe(false);
  }
 });
 it('retains identities and sources even when an external dependency makes it opaque', () => {
  const proof=interpretStudioDependencies({...document,userTemplates:[{...template,cardBackgroundImageUrl:'https://example.invalid/target.svg'}]});
  expect(proof.complete).toBe(false); expect(proof.references.sources).toContain('https://example.invalid/target.svg');
 });
 it('includes canonical defaults introduced by normalization instead of certifying sparse input', () => {
  const proof=interpretStudioDependencies({...document,userTemplates:[{id:'sparse',name:'Sparse',aspectRatio:'2:3'}]});
  expect(proof.complete).toBe(false); expect(proof.opaqueReasons).toContain('dynamic_binding');
 });
 it('blocks missing template resolution and unknown extensions', () => {
  expect(interpretStudioDependencies({...document,storedCards:[{uniqueId:'card',templateId:'published',data:{}}]}).opaqueReasons).toContain('mutable_catalog_template_resolution');
  expect(interpretStudioDependencies({...document,newDependencies:[]}).complete).toBe(false);
 });
 it('accepts literal cards using included exact templates and retains card identities', () => {
  const proof=interpretStudioDependencies({...document,storedCards:[{uniqueId:'card',templateId:'local',data:{title:'Literal'}}]});
  expect(proof.opaqueReasons).toEqual([]);expect(proof.references.identities).toContain('local');
 });
 it('rejects a relative dependency injected through a structured gradient color', () => {
  const appearance={material:{gradient:{type:'linear',stops:[{id:'a',position:0,color:"red), image-set('relative.png' 1x), linear-gradient(red"}]}}};
  expect(interpretStudioDependencies({...document,userTemplates:[{...template,appearance}]}).opaqueReasons).toContain('unsupported_css_color');
 });
 it('inspects implicit image overrides on both card faces and preview data', () => {
  const image={id:'img',name:'Image',type:'image',x:0,y:0,width:100,height:100,zIndex:0,content:'',imageSource:'cardforge-studio-asset://'+'a'.repeat(64)};
  const imageTemplate={...template,freeformCanvas:{...template.freeformCanvas,elements:[image]}};
  for (const card of [
    {uniqueId:'card',templateId:'local',data:{image_image_img:'/relative-target.svg'}},
    {uniqueId:'card',templateId:'local',data:{},backingTemplateId:'local',backingData:{image_image_img:'/relative-target.svg'}},
  ]) expect(interpretStudioDependencies({...document,userTemplates:[imageTemplate],storedCards:[card]}).opaqueReasons).toContain('external_or_unbound_source');
  expect(interpretStudioDependencies({...document,userTemplates:[{...imageTemplate,templatePreviewData:{image_image_img:'/relative-target.svg'}}]}).complete).toBe(false);
 });
 it('categorizes identities and source aliases without treating prose as identity', () => {
  const proof=interpretStudioDependencies({...document,userTemplates:[{...template,name:'target-id'}]});
  expect(proof.references.identities).toContain('local');
  expect(proof.references.identities).not.toContain('target-id');
  expect(proof.references.sources).not.toContain('target-id');
 });
 it('keeps unsupported Style vocabulary and malformed auxiliary shapes opaque', () => {
  for (const delta of [
    {appearanceStyles:[{id:'s',name:'Style',kind:'future-kind',targets:['future-target'],appearance:{}}]},
    {exportSettings:[]},{productionPlan:0},
  ]) expect(interpretStudioDependencies({...document,...delta}).complete).toBe(false);
 });
 it('interprets canonical project operation receipts without discarding unknown receipts', () => {
  const receipt={operationId:'op-a',requestHash:'hash',revision:2,changedTemplateIds:['local'],
    changedElementIds:[],changedCardIds:[],changedAssetRequirementIds:[],
    warnings:['No effect'],canonicalRenderingRecommended:false};
  expect(interpretStudioDependencies({...document,mcpOperationReceipts:[receipt]}).opaqueReasons).toEqual([]);
  for (const malformed of [{...receipt,newDependency:'unknown'}, {...receipt,changedCardIds:[42]}, {...receipt,canonicalRenderingRecommended:'false'}]) {
    expect(interpretStudioDependencies({...document,mcpOperationReceipts:[malformed]}).opaqueReasons).toContain('unsupported_operation_receipts');
  }
 });
 it('understands canonical production asset binding provenance but retains unbound sources', () => {
  const plan={version:1,decisionMode:'confirmed',purpose:'Deck',deliverable:'Cards',
    outputSize:{width:63,height:88,unit:'mm'},visualDirection:{summary:'Minimal',palette:[],typography:[]},
    editableFieldKeys:[],assets:[{id:'asset',name:'Card face',kind:'image',role:'Face',source:'placeholder',
      quantity:1,status:'placeholder',binding:'element.image',embeddedAssetId:'embedded-local'}]};
  const proof=interpretStudioDependencies({...document,productionPlan:plan});
  expect(proof.opaqueReasons).toEqual([]);
  expect(interpretStudioDependencies({...document,productionPlan:{...plan,assets:[{...plan.assets[0],assetUrl:'https://example.invalid/image.png'}]}}).opaqueReasons).toContain('external_or_unbound_source');
  expect(interpretStudioDependencies({...document,productionPlan:{...plan,assets:[{...plan.assets[0],unknownSource:'secret'}]}}).opaqueReasons).toContain('unsupported_raw_production_plan');
 });
 it('does not certify custom inventories discarded by normalization', () => {
  expect(interpretStudioDependencies({...document,customAssets:{futureDependencies:[{sourceId:'future-id'}]}}).complete).toBe(false);
  expect(interpretStudioDependencies({...document,customFonts:[{brokenFont:'future-id'}]}).complete).toBe(false);
 });
 it('blocks fields discarded by normalization rather than certifying their absence', () => {
  expect(interpretStudioDependencies({...document,userTemplates:[{...template,newDependency:'target'}]}).opaqueReasons).toContain('unsupported_raw_userTemplates');
 });
 it('retains relative image content as an opaque source', () => {
  const image={id:'image',name:'Image',type:'image',x:0,y:0,width:100,height:100,zIndex:0,content:'relative.png'};
  const proof=interpretStudioDependencies({...document,userTemplates:[{...template,freeformCanvas:{...template.freeformCanvas,elements:[image]}}]});
  expect(proof.references.sources).toContain('relative.png');expect(proof.opaqueReasons).toContain('external_or_unbound_source');
 });
 it('does not mistake typed source none for absence', () => {
  const proof=interpretStudioDependencies({...document,userTemplates:[{...template,appearance:{assetSource:'none'}}]});
  expect(proof.opaqueReasons).toContain('external_or_unbound_source');
 });
});
describe('source-contained CSS generators', () => {
 it('accepts literal layered gradients and colors',()=>{
  for(const css of ['none','linear-gradient(90deg, #fff 0%, rgba(0,0,0,0.2) 100%)','repeating-linear-gradient(45deg, transparent 0px, #000 2px), radial-gradient(circle at center, #fff, #000)']) expect(isSourceContainedCssImage(css),css).toBe(true);
 });
 it('rejects URL, escaped, malformed, indirect and unsupported function syntax',()=>{
  for(const css of ['url(target)','linear-gradient(var(--image),red)','linear-gradient(red,blue),url(target)','linear-gradient(red,blue','linear-gradient(red,blue))','linear-gradient(red,blue);background:url(target)','linear-gradient(red,blue),image-set("target")','linear-gradient(red,\\75rl(target))']) expect(isSourceContainedCssImage(css),css).toBe(false);
 });
});
