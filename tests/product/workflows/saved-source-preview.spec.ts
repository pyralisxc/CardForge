import { buildSync } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, test } from '@playwright/test';
const bundle=buildSync({entryPoints:['tests/product/fixtures/savedSourcePreview.tsx'],bundle:true,platform:'browser',format:'iife',write:false,outfile:join(tmpdir(),'saved-source-preview.js'),define:{'process.env.NODE_ENV':'"production"','process.env':'{}'}});
const template={id:'exact-template',name:'Exact synthetic saved source',templateSource:'user',aspectRatio:'1:1',freeformCanvas:{width:400,height:400,elements:[{id:'shape',type:'shape',name:'Exact panel',fillColor:'#102040',backgroundColor:'#102040',rotation:0,opacity:1,zIndex:1,shapeKind:'rectangle',x:0,y:0,width:400,height:400,appearance:{material:{baseColor:'#102040'}}},{id:'printable',type:'text',name:'Printable source text',content:'https://example.com/rules C:\\cards',textColor:'#ffffff',fontSizePx:14,fontFamily:'font-sans',x:12,y:12,width:376,height:42,zIndex:2}]}};
for(const width of [390,1440]) test(`@golden exact source renders branded and clean native PNGs at ${width}px`,async({page},info)=>{
 test.setTimeout(90_000); await page.setViewportSize({width,height:800});
 let branded=true; const errors:string[]=[];
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/__saved-source')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body></body></html>'});
  if(url.pathname==='/api/saved-source-preview')return route.fulfill({json:{title:'Exact synthetic saved source',sourceVersion:'a'.repeat(64),identity:{submissionId:'selected-historical-revision'},branded,content:{kind:'template',template}}});
  if(url.pathname==='/brand/cardforge-studio/watermark.svg')return route.fulfill({contentType:'image/svg+xml',body:readFileSync('public/brand/cardforge-studio/watermark.svg')});
  if(url.pathname.startsWith('/fonts/'))return route.fulfill({body:readFileSync(join('public',url.pathname))});
  errors.push(url.pathname);return route.abort();
 });
 const boot=async()=>{await page.goto('/__saved-source');for(const f of bundle.outputFiles.filter(f=>f.path.endsWith('.css')))await page.addStyleTag({content:f.text});await page.addScriptTag({content:bundle.outputFiles.find(f=>f.path.endsWith('.js'))!.text});};
 const image=page.locator('img[data-cardforge-render-artifact="saved-source"]');
 await boot(); await expect(image).toBeVisible();
 const read=()=>image.evaluate(async(node:HTMLImageElement)=>{await node.decode();const c=document.createElement('canvas');c.width=node.naturalWidth;c.height=node.naturalHeight;const ctx=c.getContext('2d')!;ctx.drawImage(node,0,0);return {width:c.width,height:c.height,pixels:Array.from(ctx.getImageData(0,0,c.width,c.height).data)};});
 const marked=await read(); expect(marked.width).toBeGreaterThan(300);
 await image.screenshot({path:info.outputPath('branded-native.png')});await info.attach('Branded exact native PNG',{path:info.outputPath('branded-native.png'),contentType:'image/png'});
 await expect(page.getByText(/selected-historical-revision/)).toBeVisible();
 branded=false;await boot();await expect(image).toBeVisible();const clean=await read();
 const center=(Math.floor(clean.height/2)*clean.width+Math.floor(clean.width/2))*4;expect(clean.pixels.slice(center,center+4)).toEqual([16,32,64,255]);
 expect(clean.width).toBe(marked.width);expect(clean.height).toBe(marked.height);
 expect(marked.pixels.filter((v,i)=>Math.abs(v-clean.pixels[i])>2).length).toBeGreaterThan(1000);
 await image.screenshot({path:info.outputPath('clean-native.png')});await info.attach('Entitled clean native PNG',{path:info.outputPath('clean-native.png'),contentType:'image/png'});
 expect(errors).toEqual([]);
});

test('local personal Library PNG JPEG WebP committed bindings render intended pixels', async ({ page }, info) => {
 test.setTimeout(90_000);
 test.skip(!process.env.CARDFORGE_PERSONAL_RENDER_PROOF, 'Local synthetic handoff only; not a hosted-source test.');
 const packets = JSON.parse(readFileSync(process.env.CARDFORGE_PERSONAL_RENDER_PROOF!, 'utf8')) as Array<{ format: string; originalSha256: string; storedAssetSha256: string; committedRevision: number; beforeTemplate: object; template: object }>;
 const receipts: object[] = []; const unexpected: string[] = []; let selected: object;
 await page.route('**/*', route => {
  const url = new URL(route.request().url());
  if (url.pathname === '/__saved-source') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' });
  if (url.pathname === '/api/saved-source-preview') return route.fulfill({ json: { title: 'Synthetic personal Library attachment', sourceVersion: 'a'.repeat(64), identity: { submissionId: 'synthetic-personal-copy' }, branded: false, content: { kind: 'template', template: selected } } });
  if (url.pathname.startsWith('/fonts/')) return route.fulfill({ body: readFileSync(join('public', url.pathname)) });
  unexpected.push(url.pathname); return route.abort();
 });
 const render = async (template: object) => {
  selected = template;
  await page.goto('/__saved-source');
  for (const file of bundle.outputFiles.filter(file => file.path.endsWith('.css'))) await page.addStyleTag({ content: file.text });
  await page.addScriptTag({ content: bundle.outputFiles.find(file => file.path.endsWith('.js'))!.text });
  const image = page.locator('img[data-cardforge-render-artifact="saved-source"]');
  await expect(image).toBeVisible();
  const result = await image.evaluate(async (node: HTMLImageElement) => { await node.decode(); const canvas = document.createElement('canvas'); canvas.width = node.naturalWidth; canvas.height = node.naturalHeight; const context = canvas.getContext('2d')!; context.drawImage(node, 0, 0); return { width: canvas.width, height: canvas.height, pixels: Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data), bytes: Array.from(new Uint8Array(await (await fetch(node.src)).arrayBuffer())) }; });
  return result;
 };
 const before = await render(packets[0].beforeTemplate);
 for (const packet of packets) {
  expect(packet.beforeTemplate).toEqual(packets[0].beforeTemplate);
  const after = await render(packet.template);
  expect(after.width).toBe(before.width); expect(after.height).toBe(before.height);
  const sample = (x: number, y: number) => { const offset = (Math.floor(after.height * y / 880) * after.width + Math.floor(after.width * x / 630)) * 4; return after.pixels.slice(offset, offset + 4); };
  const center = sample(160, 255);
  for (const [index, expected] of [34, 197, 94, 255].entries()) expect(Math.abs(center[index] - expected)).toBeLessThanOrEqual(6);
  let changed = 0, outside = 0;
  for (let y = 0; y < after.height; y++) for (let x = 0; x < after.width; x++) {
   const offset = (y * after.width + x) * 4;
   if (after.pixels.slice(offset, offset + 4).some((value, index) => value !== before.pixels[offset + index])) {
    changed++;
    if (x < Math.floor(after.width * 60 / 630) - 2 || x > Math.ceil(after.width * 260 / 630) + 2 || y < Math.floor(after.height * 130 / 880) - 2 || y > Math.ceil(after.height * 380 / 880) + 2) outside++;
   }
  }
  expect(changed).toBeGreaterThan(1000); expect(outside).toBe(0);
  const path = info.outputPath(`personal-${packet.format}-native.png`); writeFileSync(path, Buffer.from(after.bytes)); await info.attach(`Personal ${packet.format} native output`, { path, contentType: 'image/png' });
  receipts.push({ format: packet.format, sourceSha256: packet.originalSha256, storedSha256: packet.storedAssetSha256, committedRevision: packet.committedRevision, width: after.width, height: after.height, targetCenter: center, changedPixels: changed, changedPixelsOutsideTarget: outside, outputPath: path });
 }
 expect(unexpected).toEqual([]);
 const path = info.outputPath('personal-render-receipts.json'); writeFileSync(path, JSON.stringify(receipts, null, 2)); await info.attach('Personal attachment native render receipts', { path, contentType: 'application/json' });
});
