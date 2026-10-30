import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { getFreshDefaultTemplateObject } from '@/domain/templates';
import { embedExactCandidateAssets } from '@/features/pipeline/server/exactCandidateAssets';
const bytes = Buffer.from('synthetic content-addressed bytes');
const hash = createHash('sha256').update(bytes).digest('hex');
const template = () => ({ ...getFreshDefaultTemplateObject('candidate'), freeformCanvas: { width:630, height:880, elements:[{id:'image',type:'image' as const,name:'Artwork',x:0,y:0,width:630,height:880,zIndex:1,imageSource:'artworkUrl'}] }, templatePreviewData: { artworkUrl: `cardforge-pipeline-asset://${hash}` } });
describe('exact candidate asset hydration', () => {
  it('binds only hash-verified managed bytes without consulting published content', async () => {
    const download = vi.fn().mockResolvedValue(bytes);
    const result = await embedExactCandidateAssets(template(), download);
    expect(result.templatePreviewData?.artworkUrl).toBe(`data:image/webp;base64,${bytes.toString('base64')}`);
    expect(download).toHaveBeenCalledExactlyOnceWith(hash);
  });
  it('rejects missing and altered managed bytes', async () => {
    await expect(embedExactCandidateAssets(template(), async () => { throw new Error('missing'); })).rejects.toThrow('missing');
    await expect(embedExactCandidateAssets(template(), async () => Buffer.from('altered'))).rejects.toThrow('candidate_asset_changed');
  });
  it.each(['https://example.invalid/a.png','art/frame.png','data:image/svg+xml,<svg/>','url(https://example.invalid/a)'])('rejects unsupported unbound dependency %s', async artworkUrl => {
    await expect(embedExactCandidateAssets({ ...template(), templatePreviewData: { artworkUrl } }, vi.fn())).rejects.toThrow('candidate_dependency_unsupported');
  });
  it('rejects unsupported native content before rendering', async () => {
    await expect(embedExactCandidateAssets({ ...template(), freeformCanvas: undefined }, vi.fn())).rejects.toThrow('candidate_content_unsupported');
  });
});
it('rejects malformed canvas rather than reconstructing default elements', async () => {
  await expect(embedExactCandidateAssets({ ...template(), freeformCanvas: {} } as ReturnType<typeof template>, vi.fn())).rejects.toThrow('candidate_content_unsupported');
});
it('rejects extensionless appearance resources', async () => {
  await expect(embedExactCandidateAssets({ ...template(), appearance: { assetSource: 'art/frame' } } as ReturnType<typeof template>, vi.fn())).rejects.toThrow('candidate_dependency_unsupported');
});

it('does not interpret a texture source as an image-element field alias', async () => {
  const t = { ...template(), templatePreviewData: { 'art/frame': 'data:image/png;base64,YQ==' }, appearance: { material: { texture: { kind:'uploaded', imageSource:'art/frame' } } } };
  await expect(embedExactCandidateAssets(t as unknown as Parameters<typeof embedExactCandidateAssets>[0], vi.fn())).rejects.toThrow('candidate_dependency_unsupported');
});

it.each(['linear-gradient(135deg, rgba(255,248,222,0.96), rgba(214,174,92,0.25))', 'radial-gradient(circle, #fff, transparent)'])('preserves source-contained native background %s', async backgroundImageUrl => {
  const t = { ...getFreshDefaultTemplateObject('candidate'), templatePreviewData: {} };
  t.freeformCanvas!.elements = t.freeformCanvas!.elements.filter(e => e.type === 'text').slice(0,1);
  t.freeformCanvas!.elements[0].backgroundImageUrl = backgroundImageUrl;
  const download = vi.fn();
  expect((await embedExactCandidateAssets(t, download)).freeformCanvas!.elements[0].backgroundImageUrl).toBe(backgroundImageUrl);
  expect(download).not.toHaveBeenCalled();
});
it.each(['linear-gradient(red, blue), url(https://example.invalid/a)', 'linear-gradient(red, blue), image-set("art/frame" 1x)', 'linear-gradient(https://example.invalid/a, blue)'])('rejects gradient-associated dependencies %s', async backgroundImageUrl => {
  const t = getFreshDefaultTemplateObject('candidate');
  t.freeformCanvas!.elements = t.freeformCanvas!.elements.filter(e => e.type === 'text').slice(0,1);
  t.freeformCanvas!.elements[0].backgroundImageUrl = backgroundImageUrl;
  await expect(embedExactCandidateAssets(t, vi.fn())).rejects.toThrow('candidate_dependency_unsupported');
});

it('preserves printable URLs and managed-looking prose without downloading it',async()=>{
 const t=template();const text='cardforge-pipeline-asset://'+'f'.repeat(64);
 t.name='https://example.com/cards';
 t.freeformCanvas.elements=[];t.templatePreviewData={artworkUrl:text};
 const read=vi.fn();const result=await embedExactCandidateAssets(t,read);
 expect(result.name).toBe(t.name);expect(result.templatePreviewData).toEqual(t.templatePreviewData);expect(read).not.toHaveBeenCalled();
});

it('hydrates a canonical image placeholder data slot without changing its authored binding',async()=>{
 const t=template();t.freeformCanvas.elements[0].imageSource='{{artworkUrl}}';
 const result=await embedExactCandidateAssets(t,async()=>bytes);
 expect(result.freeformCanvas!.elements[0].imageSource).toBe('{{artworkUrl}}');
 expect(result.templatePreviewData?.artworkUrl).toBe('data:image/webp;base64,'+bytes.toString('base64'));
});
it('fails closed rather than rewriting printable text that shares a managed artwork binding',async()=>{
 const t=template();t.freeformCanvas.elements.push({...t.freeformCanvas.elements[0],id:'text',type:'text' as never,content:'{{artworkUrl}}'} as typeof t.freeformCanvas.elements[number]);
 const read=vi.fn();await expect(embedExactCandidateAssets(t,read)).rejects.toThrow('candidate_dependency_unsupported');expect(read).not.toHaveBeenCalled();
});

it('rejects canonical http-prefixed relative fallback before any download',async()=>{
 const t=template();t.freeformCanvas.elements[0]={...t.freeformCanvas.elements[0],imageSource:'',content:'http-logo.png'} as typeof t.freeformCanvas.elements[number];
 const read=vi.fn();await expect(embedExactCandidateAssets(t,read)).rejects.toThrow('candidate_dependency_unsupported');expect(read).not.toHaveBeenCalled();
});
