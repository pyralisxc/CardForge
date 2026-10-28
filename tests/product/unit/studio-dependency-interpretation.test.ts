import { describe, expect, it } from 'vitest';
import { interpretStudioDependencies } from '@/features/studio-documents/server/studioDependencyInterpretation';
import { isSourceContainedCssImage } from '@/domain/templates/sourceContainedCss';
const template = { id:'local',name:'Literal',aspectRatio:'2:3',freeformCanvas:{width:200,height:300,elements:[]} };
const document = { version:1,userTemplates:[template],storedCards:[],cardSets:[],appearanceStyles:[],customAssets:{},exportSettings:{} };
describe('source-owned Studio dependency interpretation', () => {
 it('interprets a complete literal document without resolving catalog discovery', () => {
  const proof=interpretStudioDependencies(document);
  expect(proof.opaqueReasons).toEqual([]); expect(proof.complete).toBe(true); expect(proof.references).toContain('local');
 });
 it('retains identities and sources even when an external dependency makes it opaque', () => {
  const proof=interpretStudioDependencies({...document,userTemplates:[{...template,cardBackgroundImageUrl:'https://example.invalid/target.svg'}]});
  expect(proof.complete).toBe(false); expect(proof.references).toContain('https://example.invalid/target.svg');
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
  expect(proof.opaqueReasons).toEqual([]);expect(proof.references).toContain('card');
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
  expect(proof.references).toContain('relative.png');expect(proof.opaqueReasons).toContain('external_or_unbound_source');
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
