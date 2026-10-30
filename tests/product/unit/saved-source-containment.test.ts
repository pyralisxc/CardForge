import { describe, expect, it } from 'vitest';
import type { TCGCardTemplate } from '@/domain/templates';
import { assertContainedSource, assertContainedTemplate } from '@/features/studio-documents/server/savedSourceContainment';
const pixel = 'data:image/png;base64,aGVsbG8=';
const template = (extra: object = {}) => ({ id:'t', name:'Exact', templateSource:'user', freeformCanvas:{width:400,height:400,elements:[{id:'image',type:'image',imageSource:'portrait',x:0,y:0,width:100,height:100}]}, ...extra }) as TCGCardTemplate;
describe('exact source-contained native rendering', () => {
  it.each(['texture.png', 'none', '/mutable.png', '  https://example.com/image.png', '../texture.png'])('refuses typed Style source %s', source => {
    expect(() => assertContainedSource({appearance:{assetSource:source}})).toThrow(/source-contained/);
    expect(() => assertContainedSource({appearance:{material:{texture:{kind:'uploaded',imageSource:source}}}})).toThrow(/source-contained/);
  });
  it('preserves pure native gradients and embedded image bytes', () => {
    expect(() => assertContainedSource({backgroundImageUrl:'linear-gradient(90deg, #fff, #000)',appearance:{assetSource:pixel}})).not.toThrow();
  });
  it.each(['/mutable.png',' https://example.com/image.png','../relative.png'])('refuses effective preview binding %s', value => {
    expect(() => assertContainedTemplate(template({templatePreviewData:{portrait:value}}))).toThrow(/source-contained/);
  });
  it('refuses image contract defaults and effective card overrides', () => {
    const source=template({fieldContracts:[{key:'portrait',type:'image',defaultValue:'/mutable.png'}]});
    expect(() => assertContainedTemplate(source)).toThrow(/source-contained/);
    expect(() => assertContainedTemplate(template({templatePreviewData:{portrait:pixel}}),{portrait:'/mutable.png'})).toThrow(/source-contained/);
  });
  it('keeps embedded dynamic bindings and local bytes unchanged', () => {
    const source=template({templatePreviewData:{portrait:pixel}});const before=JSON.stringify(source);
    expect(() => assertContainedTemplate(source)).not.toThrow();expect(JSON.stringify(source)).toBe(before);
  });
});

it.each(['font/woff2','application/x-font-opentype'])('allows canonical embedded project font %s without allowing font image sources', mimeType => {
 const dataUrl=`data:${mimeType};base64,AAECAwQ=`;
 const font={id:'custom-font-1',name:'Embedded',value:'font-personal-custom-font-1',mimeType,dataUrl,fileSizeBytes:5};
 expect(()=>assertContainedSource({fonts:[font]})).not.toThrow();
 expect(()=>assertContainedSource({imageSource:dataUrl})).toThrow(/source-contained/);
 expect(()=>assertContainedSource({dataUrl})).toThrow(/source-contained/);
});
