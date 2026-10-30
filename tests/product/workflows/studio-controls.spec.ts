import { buildSync } from 'esbuild';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import tailwindConfig from '../../../tailwind.config';
import { expect, test } from '@playwright/test';
const bundle = buildSync({ entryPoints:['tests/product/fixtures/studioControls.tsx'],bundle:true,platform:'browser',format:'iife',write:false,outfile:join(tmpdir(),'studio-controls.js'),define:{'process.env.NODE_ENV':'"production"','process.env':'{}'} });
const css=postcss([tailwindcss(tailwindConfig)]).process((readFileSync('src/app/cardforgePresentation.css','utf8')+readFileSync('src/app/globals.css','utf8')).replace(/@import ['"]([^'"]+)['"];?/g,(_,path:string)=>readFileSync(join('src/app',path),'utf8')),{from:'src/app/globals.css'});
for(const width of [390,1440]) test(`@golden Studio controls preserve selected geometry and texture-only strength at ${width}px`,async({page},info)=>{
  test.setTimeout(90_000);
  await page.setViewportSize({width,height:960});
  const unexpected:string[]=[];
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/__studio-controls')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body style="margin:0"></body></html>'});
    if(url.pathname==='/api/catalog/studio-bootstrap')return route.fulfill({json:{fonts:{fonts:[]},templates:{templates:[]},styles:{styles:[]}}});
    if(url.pathname==='/api/catalog/studio-assets')return route.fulfill({json:{assets:{textures:[{id:'ink',name:'Synthetic Ink',url:'/ink.svg',kind:'texture',tileMode:'repeat',seamless:true,allowedTargets:['shape'],defaultBlendMode:'multiply'}],dividers:[{id:'vellum',name:'Synthetic Vellum',url:'/vellum.svg',kind:'divider',tileMode:'stretch',seamless:false,allowedTargets:['divider'],defaultWidth:450,defaultHeight:230}],icons:[],imageAssets:[]}}});
    if(url.pathname==='/overlay.svg')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><path d="M0 0H200L0 200Z" fill="#0088ff" fill-opacity=".6"/></svg>'});
    if(url.pathname==='/transparent.svg')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"></svg>'});
    if(url.pathname==='/ink.svg')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#000"/></svg>'});
    if(url.pathname==='/vellum.svg')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="450" height="230"><rect width="450" height="230" fill="#dda040"/></svg>'});
    if(url.pathname==='/api/templates/submissions' && route.request().method()==='GET')return route.fulfill({json:{contributorId:'synthetic-actor'}});
    if(url.pathname.startsWith('/fonts/'))return route.fulfill({body:readFileSync(join('public',url.pathname))});
    unexpected.push(`${route.request().method()} ${url.pathname}`);return route.abort();
  });
  const boot=async()=>{await page.addStyleTag({content:(await css).css});for(const file of bundle.outputFiles.filter(f=>f.path.endsWith('.css')))await page.addStyleTag({content:file.text});await page.addScriptTag({content:bundle.outputFiles.find(f=>f.path.endsWith('.js'))!.text});};
  await page.goto('/__studio-controls');await boot();
  await page.getByRole('button',{name:'Render strength proof',exact:true}).click();
  for(const [value,expected] of [[100,[0,0,0,255]],[25,[0,153,77,255]],[0,[0,204,102,255]]] as const){
    const image=page.getByAltText(`Strength proof ${value}`);await expect(image).toBeVisible();
    const pixels=await image.evaluate(async(node:HTMLImageElement)=>{await node.decode();const c=document.createElement('canvas');c.width=node.naturalWidth;c.height=node.naturalHeight;const ctx=c.getContext('2d')!;ctx.drawImage(node,0,0);return {center:[...ctx.getImageData(Math.floor(c.width*.5),Math.floor(c.height*.5),1,1).data],border:[...ctx.getImageData(Math.floor(c.width*.02),Math.floor(c.height*.5),1,1).data]};});
    for(let i=0;i<4;i++)expect(Math.abs(pixels.center[i]-expected[i])).toBeLessThanOrEqual(1);
    expect(pixels.border).toEqual([255,0,0,255]);
    await image.screenshot({path:info.outputPath(`canonical-strength-${value}.png`)});await info.attach(`canonical-strength-${value}`,{path:info.outputPath(`canonical-strength-${value}.png`),contentType:'image/png'});
  }
  await page.getByRole('button',{name:'Render stroke proof',exact:true}).click();
  const strokePixels:Record<string,number[][]>={};
  for(const name of ['solid-0','solid-60','solid-120','double-0','none-0']){
    const image=page.getByAltText(`Stroke proof ${name}`);await expect(image).toBeVisible();
    strokePixels[name]=await image.evaluate(async(node:HTMLImageElement)=>{await node.decode();const c=document.createElement('canvas');c.width=node.naturalWidth;c.height=node.naturalHeight;const ctx=c.getContext('2d')!;ctx.drawImage(node,0,0);return [[.045,.06],[.10,.10],[.01,.5],[.0225,.5],[.0325,.5]].map(([x,y])=>[...ctx.getImageData(Math.floor(c.width*x),Math.floor(c.height*y),1,1).data]);});
    await image.screenshot({path:info.outputPath(`canonical-stroke-${name}.png`)});await info.attach(`canonical-stroke-${name}`,{path:info.outputPath(`canonical-stroke-${name}.png`),contentType:'image/png'});
  }
  expect(strokePixels['solid-0'][0]).toEqual([0,204,102,255]);
  expect(strokePixels['solid-60'][0]).toEqual([255,255,255,255]);
  expect(strokePixels['solid-60'][1]).toEqual([0,204,102,255]);
  expect(strokePixels['solid-120'][1]).toEqual([255,255,255,255]);
  expect(strokePixels['double-0'].slice(2)).toEqual([[255,0,0,255],[0,204,102,255],[255,0,0,255]]);
  expect(strokePixels['none-0'].slice(2)).toEqual([[255,255,255,255],[0,204,102,255],[0,204,102,255]]);
  await page.getByRole('button',{name:'Render rounded proof',exact:true}).click();
  const roundedPixels:number[][]=[];
  for(const value of [100,25,0]){
    const image=page.getByAltText(`Rounded proof ${value}`);await expect(image).toBeVisible();
    roundedPixels.push(await image.evaluate(async(node:HTMLImageElement)=>{await node.decode();const c=document.createElement('canvas');c.width=node.naturalWidth;c.height=node.naturalHeight;const ctx=c.getContext('2d')!;ctx.drawImage(node,0,0);return [...ctx.getImageData(0,0,c.width,c.height).data];}));
    await image.screenshot({path:info.outputPath(`rounded-${value}.png`)});await info.attach(`rounded-${value}`,{path:info.outputPath(`rounded-${value}.png`),contentType:'image/png'});
  }
  // A transparent texture isolates preservation of the gradient, text, rounded border and highlight.
  for(const pixels of roundedPixels.slice(1))expect(pixels.filter((v,i)=>Math.abs(v-roundedPixels[0][i])>1).length).toBeLessThan(20);
  await page.getByRole('button',{name:'Close output proofs',exact:true}).click();
  const insert=async(name:string)=>{if(width<1024)await page.getByRole('button',{name:'Open editor menu',exact:true}).click();await page.getByRole('button',{name:'Elements',exact:true}).click();await page.getByRole('button',{name,exact:true}).click();if(width<1024)await page.getByRole('button',{name:'Edit selected element',exact:true}).click();};
  await insert('Divider / Rule');
  await page.getByRole('button',{name:'Choose from Library',exact:true}).click();await page.getByRole('option',{name:/Synthetic Vellum/}).click();await page.getByRole('button',{name:'Use selection',exact:true}).click();
  await expect(page.getByLabel('Height',{exact:true})).toHaveValue('230');
  if(width<1024)await page.getByRole('button',{name:'Close inspector',exact:true}).click();
  await insert('Shape');
  await page.getByRole('button',{name:'Look',exact:true}).click();
  await page.getByRole('button',{name:'Choose from Library',exact:true}).click();await page.getByRole('option',{name:/Synthetic Ink/}).click();await page.getByRole('button',{name:'Use selection',exact:true}).click();
  const strength=page.getByLabel('Fill texture strength').getByRole('slider');
  for(const value of [100,25,0]){
    await strength.focus();await strength.press('Home');for(let i=0;i<value;i++)await strength.press('ArrowRight');
    await expect(strength).toHaveAttribute('aria-valuenow',String(value));
    await expect(page.locator('.tcg-card-preview [data-freeform-element-id] [data-appearance-layer="0"]')).toHaveCSS('opacity',String(value/100));
    await page.screenshot({path:info.outputPath(`strength-${value}.png`)});await info.attach(`texture-strength-${value}`,{path:info.outputPath(`strength-${value}.png`),contentType:'image/png'});
  }
  await page.getByRole('button',{name:'Border',exact:true}).click();
  await page.getByLabel('Corner radius',{exact:true}).fill('60');
  await page.getByLabel('Stroke style',{exact:true}).click();await page.getByRole('option',{name:'Double',exact:true}).click();
  await page.getByLabel('Stroke width',{exact:true}).fill('16');
  if(width<1024)await page.getByRole('button',{name:'Close inspector',exact:true}).click();
  await page.getByRole('button',{name:width<1024?'Save Template in this browser':'Save',exact:true}).click();
  await expect(page.getByTestId('saved')).not.toBeEmpty();
  await expect(page.getByTestId('saved-preview').locator('[data-appearance-layer="0"]')).toHaveCSS('opacity','0');
  const saved=JSON.parse(await page.getByTestId('saved').textContent()||'{}');
  expect(saved.freeformCanvas.elements[0]).toMatchObject({width:450,height:230});expect(saved.freeformCanvas.elements[1].appearance).toMatchObject({material:{texture:{intensity:0}},border:{kind:'double',radius:60,width:16}});
  await page.getByRole('button',{name:'Render saved PNG',exact:true}).click();await expect(page.getByAltText('Saved Studio PNG')).toBeVisible();
  await info.attach('saved-output',{body:await page.getByAltText('Saved Studio PNG').screenshot(),contentType:'image/png'});
  await page.reload();await boot();
  await page.getByRole('button',{name:'Render saved PNG',exact:true}).click();await expect(page.getByAltText('Saved Studio PNG')).toBeVisible();
  await info.attach('reopened-output',{body:await page.getByAltText('Saved Studio PNG').screenshot(),contentType:'image/png'});
  expect(unexpected).toEqual([]);
});
