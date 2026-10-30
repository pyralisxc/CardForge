import { buildSync } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
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

async function mountHistoryProof(page:import('@playwright/test').Page,query='',svgIcon=false,fillTexture=false) {
 await page.route('**/*',route=>{const url=new URL(route.request().url());
  if(url.pathname==='/__studio-history')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0"></body></html>'});
  if(url.pathname==='/api/catalog/studio-bootstrap')return route.fulfill({json:{fonts:{fonts:[]},templates:{templates:[]},styles:{styles:[]}}});
  if(url.pathname==='/api/catalog/studio-assets')return route.fulfill({json:{assets:{textures:fillTexture?[{id:'history-ink',name:'Synthetic history Ink',url:'/history-ink.svg',kind:'texture',tileMode:'repeat',seamless:true,allowedTargets:['shape']}]:[],dividers:[],icons:svgIcon?[{id:'asymmetric-icon',name:'Synthetic asymmetric SVG',url:'/asymmetric.svg',kind:'icon',tileMode:'contain',seamless:false,allowedTargets:['icon']}]:[],imageAssets:[]}}});
  if(fillTexture&&url.pathname==='/history-ink.svg')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#000"/></svg>'});
  if(svgIcon&&url.pathname==='/asymmetric.svg')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><path d="M0 0H50V100H0Z" fill="#ff0000"/><path d="M50 50H100V100H50Z" fill="#0000ff"/></svg>'});
  if(url.pathname==='/api/templates/submissions')return route.fulfill({json:{contributorId:'synthetic-actor'}});
  if(url.pathname.startsWith('/fonts/'))return route.fulfill({body:readFileSync(join('public',url.pathname))});
  return route.abort();
 });
 await page.goto('/__studio-history'+query);await page.addStyleTag({content:(await css).css});for(const file of bundle.outputFiles.filter(f=>f.path.endsWith('.css')))await page.addStyleTag({content:file.text});await page.addScriptTag({content:bundle.outputFiles.find(f=>f.path.endsWith('.js'))!.text});
 if(page.viewportSize()!.width<1024)await page.getByRole('button',{name:'Open editor menu',exact:true}).click();
 await page.getByRole('button',{name:'Elements',exact:true}).click();await page.getByRole('button',{name:'Text',exact:true}).and(page.locator('[draggable="true"]')).click();
 if(page.viewportSize()!.width<1024)await page.getByRole('button',{name:'Edit selected element',exact:true}).click();
}
for(const width of [390,1440])for(const interaction of ['keyboard','pointer'] as const)test(`@golden Fill texture strength ${interaction} completion preserves history at ${width}px`,async({page},info)=>{
 test.setTimeout(90000);await page.setViewportSize({width,height:960});await mountHistoryProof(page,'?historyContracts=1',false,true);
 const closeInspector=async()=>{if(width<1024)await page.getByRole('button',{name:'Close inspector',exact:true}).click();};
 const openInspector=async()=>{if(width<1024)await page.getByRole('button',{name:'Edit selected element',exact:true}).click();};
 await closeInspector();if(width<1024)await page.getByRole('button',{name:'Open editor menu',exact:true}).click();await page.getByRole('button',{name:'Elements',exact:true}).click();await page.getByRole('button',{name:'Shape',exact:true}).and(page.locator('[draggable="true"]')).click();await openInspector();
 await page.getByRole('button',{name:'Look',exact:true}).click();await page.getByRole('button',{name:'Choose from Library',exact:true}).click();await page.getByRole('option',{name:/Synthetic history Ink/}).click();await page.getByRole('button',{name:'Use selection',exact:true}).click();
 const strength=page.getByLabel('Fill texture strength',{exact:true}).getByRole('slider');
 await strength.press('Home');for(let step=0;step<25;step++)await strength.press('ArrowRight');
 const save=async()=>{await closeInspector();await page.getByRole('button',{name:width<1024?'Save Template in this browser':'Save',exact:true}).click();await expect(page.getByTestId('working-dirty')).toHaveText('saved');await openInspector();};
 await save();const baseline=JSON.parse(await page.getByTestId('saved').textContent()||'{}');const original=baseline.freeformCanvas.elements.find((element:{type:string})=>element.type==='shape');
 const reopen=async()=>{await page.reload();await page.addStyleTag({content:(await css).css});for(const file of bundle.outputFiles.filter(f=>f.path.endsWith('.css')))await page.addStyleTag({content:file.text});await page.addScriptTag({content:bundle.outputFiles.find(f=>f.path.endsWith('.js'))!.text});await page.locator(`[data-cardforge-editor-overlay="true"][data-freeform-element-id="${original.id}"]`).click();await openInspector();await page.getByRole('button',{name:'Look',exact:true}).click();};
 const expectValue=async(value:number)=>{await expect(strength).toHaveAttribute('aria-valuenow',String(value));};
 const undo=async()=>strength.press('ControlOrMeta+z');const redo=async()=>strength.press('ControlOrMeta+Shift+z');
 const drag=async(ratio:number,slow=false)=>{await strength.scrollIntoViewIfNeeded();await expect(strength).toBeInViewport();const thumb=(await strength.boundingBox())!;const root=(await page.getByLabel('Fill texture strength',{exact:true}).boundingBox())!;const y=thumb.y+thumb.height/2;await page.mouse.move(thumb.x+thumb.width/2,y);await page.mouse.down();await page.mouse.move(root.x+root.width*.45,y,{steps:4});if(slow)await page.waitForTimeout(900);await page.mouse.move(root.x+root.width*ratio,y,{steps:8});await page.mouse.up();return Number(await strength.getAttribute('aria-valuenow'));};
 await reopen();await expectValue(25);await expect(page.getByRole('button',{name:'Undo',exact:true}).first()).toBeDisabled();
 if(interaction==='keyboard'){
  await strength.press('End');await expectValue(100);await strength.press('End');await strength.press('Home');await expectValue(0);
  await undo();await expectValue(100);await redo();await expectValue(0);await undo();await undo();await expectValue(25);
 }else{
  const first=await drag(.65,true);expect(first).toBeGreaterThan(25);const second=await drag(.85);expect(second).toBeGreaterThan(first);
  await undo();await expectValue(first);await undo();await expectValue(25);
  const thumb=(await strength.boundingBox())!;await page.mouse.click(thumb.x+thumb.width/2,thumb.y+thumb.height/2);await expectValue(25);await expect(page.getByRole('button',{name:'Undo',exact:true}).first()).toBeDisabled();await expect(page.getByRole('button',{name:'Redo',exact:true}).first()).toBeEnabled();
 }
 await expect(page.getByTestId('working-dirty')).toHaveText('saved');
 let final:number;if(interaction==='keyboard'){await strength.press('End');final=100;}else final=await drag(.75);await expectValue(final);await save();await undo();await expectValue(25);await expect(page.getByTestId('working-dirty')).toHaveText('dirty');await redo();await expectValue(final);await expect(page.getByTestId('working-dirty')).toHaveText('saved');
 const saved=JSON.parse(await page.getByTestId('saved').textContent()||'{}');const expected={...original,appearance:{...original.appearance,material:{...original.appearance.material,texture:{...original.appearance.material.texture,intensity:final}}}};expect(saved.freeformCanvas.elements.find((element:{id:string})=>element.id===original.id)).toEqual(expected);expect(saved.freeformCanvas.elements.filter((element:{id:string})=>element.id!==original.id)).toEqual(baseline.freeformCanvas.elements.filter((element:{id:string})=>element.id!==original.id));expect(saved.fieldContracts).toEqual(baseline.fieldContracts);
 const stored=await page.evaluate(()=>localStorage.getItem('synthetic-saved-template'));await reopen();await expectValue(final);expect(await page.evaluate(()=>localStorage.getItem('synthetic-saved-template'))).toBe(stored);await page.screenshot({path:info.outputPath(`texture-history-${interaction}.png`)});
});
for(const width of [390,1440])test(`@golden completed typography spacing preserves grouped Undo and Save at ${width}px`, async ({page},info)=>{
 await page.setViewportSize({width,height:960});await mountHistoryProof(page,'?historyContracts=1');
 const closeInspector=async()=>{if(width<1024)await page.getByRole('button',{name:'Close inspector',exact:true}).click();};
 const openInspector=async()=>{if(width<1024)await page.getByRole('button',{name:'Edit selected element',exact:true}).click();};
 const save=async()=>{await closeInspector();await page.getByRole('button',{name:width<1024?'Save Template in this browser':'Save',exact:true}).click();await expect(page.getByTestId('working-dirty')).toHaveText('saved');await openInspector();};
 const history=async(action:'Undo'|'Redo')=>{await closeInspector();await page.getByRole('button',{name:action,exact:true}).first().click();await openInspector();};
 await save();const baseline=JSON.parse(await page.getByTestId('saved').textContent()||'{}');
 const original=baseline.freeformCanvas.elements.find((element:{id:string})=>element.id!=='neighbor');
 const reopen=async()=>{
  await page.reload();await page.addStyleTag({content:(await css).css});for(const file of bundle.outputFiles.filter(f=>f.path.endsWith('.css')))await page.addStyleTag({content:file.text});await page.addScriptTag({content:bundle.outputFiles.find(f=>f.path.endsWith('.js'))!.text});
  await page.locator(`[data-cardforge-editor-overlay="true"][data-freeform-element-id="${original.id}"]`).click();await openInspector();
  await page.getByRole('button',{name:'Text',exact:true}).and(page.locator(':not([draggable="true"])')).click();await page.getByText('Text Details',{exact:true}).click();
 };
 await reopen();const height=page.getByLabel('Line Height',{exact:true});const spacing=page.getByLabel('Letter Spacing',{exact:true});const originalHeight=await height.inputValue();const originalSpacing=await spacing.inputValue();
 await height.fill('2.25');await height.press('Tab');await expect(page.getByTestId('working-dirty')).toHaveText('dirty');
 await history('Undo');await expect(height).toHaveValue(originalHeight);await expect(page.getByTestId('working-dirty')).toHaveText('saved');
 await history('Redo');await expect(height).toHaveValue('2.25');await save();
 await history('Undo');await expect(height).toHaveValue(originalHeight);await expect(page.getByTestId('working-dirty')).toHaveText('dirty');
 await history('Redo');await expect(height).toHaveValue('2.25');await expect(page.getByTestId('working-dirty')).toHaveText('saved');
 await spacing.fill('');await spacing.pressSequentially('0.08em',{delay:25});await spacing.press('Tab');
 await history('Undo');await expect(spacing).toHaveValue(originalSpacing);await expect(height).toHaveValue('2.25');await expect(page.getByTestId('working-dirty')).toHaveText('saved');
 await history('Redo');await expect(spacing).toHaveValue('0.08em');
 await spacing.fill('0.16em');await spacing.press('Tab');await spacing.fill('0.24em');await spacing.press('Tab');
 await history('Undo');await expect(spacing).toHaveValue('0.16em');await history('Undo');await expect(spacing).toHaveValue('0.08em');await history('Redo');await expect(spacing).toHaveValue('0.16em');await history('Undo');await save();
 const saved=JSON.parse(await page.getByTestId('saved').textContent()||'{}');expect(saved.freeformCanvas.elements.find((element:{id:string})=>element.id===original.id)).toEqual({...original,lineHeight:'2.25',letterSpacing:'0.08em'});
 expect(saved.freeformCanvas.elements.find((element:{id:string})=>element.id==='neighbor')).toEqual(baseline.freeformCanvas.elements.find((element:{id:string})=>element.id==='neighbor'));expect(saved.fieldContracts).toEqual(baseline.fieldContracts);
 const stored=await page.evaluate(()=>localStorage.getItem('synthetic-saved-template'));await reopen();await expect(height).toHaveValue('2.25');await expect(spacing).toHaveValue('0.08em');expect(await page.evaluate(()=>localStorage.getItem('synthetic-saved-template'))).toBe(stored);
 await page.screenshot({path:info.outputPath('spacing-history-reopened.png')});
});
for(const width of [390,1440])test(`@golden Template variable transactions and Save share one undo history at ${width}px`,async({page},info)=>{
 test.setTimeout(90000);await page.setViewportSize({width,height:960});await mountHistoryProof(page,'?historyContracts=1');
 const undo=()=>page.getByRole('button',{name:'Undo',exact:true})[width<1024?'last':'first']();const redo=()=>page.getByRole('button',{name:'Redo',exact:true})[width<1024?'last':'first']();
 const editor=page.locator('.tiptap[contenteditable="true"]');await editor.fill('Field fallback');await editor.press('ControlOrMeta+A');
 await page.getByRole('button',{name:'Make variable',exact:true}).click();
 const variable=page.getByRole('textbox',{name:/Variable name for/});await expect(variable).toHaveCount(1);
 await undo().click();await expect(variable).toHaveCount(0);await expect(editor).toHaveText('Field fallback');
 await redo().click();await expect(variable).toHaveCount(1);
 await editor.focus();await editor.press('ControlOrMeta+z');await expect(variable).toHaveCount(0);await editor.press('ControlOrMeta+Shift+z');await expect(variable).toHaveCount(1);
 await variable.fill('title');await variable.press('Enter');await expect(variable).toHaveValue('title');
 await page.getByRole('button',{name:'Undo',exact:true}).last().click();await expect(variable).not.toHaveValue('title');await expect(editor).toHaveText('Field fallback');
 await page.getByRole('button',{name:'Redo',exact:true}).last().click();await expect(variable).toHaveValue('title');
 const size=page.getByLabel(/^Font size for /);await size.fill('48');await undo().click();await expect(size).toHaveValue('');await redo().click();await expect(size).toHaveValue('48');
 const italic=page.getByRole('switch',{name:/Italic text for/});await italic.click();await undo().click();await expect(italic).not.toBeChecked();await redo().click();await expect(italic).toBeChecked();
 const defaultValue=page.getByLabel(/^Preview default for /);await defaultValue.fill('Revised fallback');
 if(width<1024)await page.getByRole('button',{name:'Close inspector',exact:true}).click();
 await page.getByRole('button',{name:width<1024?'Save Template in this browser':'Save',exact:true}).click();await expect(page.getByTestId('working-dirty')).toHaveText('saved');
 if(width<1024)await page.getByRole('button',{name:'Edit selected element',exact:true}).click();
 const saved=JSON.parse(await page.getByTestId('saved').textContent()||'{}');expect(saved.fieldContracts.find((field:{key:string})=>field.key==='untouched')).toMatchObject({elementId:'neighbor',defaultValue:'Keep neighbor'});expect(saved.freeformCanvas.elements.find((element:{id:string})=>element.id==='neighbor').content).toBe('{{untouched:"Keep neighbor"}}');expect(saved.freeformCanvas.elements.find((element:{id:string})=>element.id!=='neighbor').content).toContain('{{title:');expect(saved.fieldContracts.find((field:{key:string})=>field.key==='title')).toMatchObject({defaultValue:'Revised fallback',fontSizePx:48,fontStyle:'italic'});
 await undo().click();await expect(defaultValue).toHaveValue('Field fallback');await expect(page.getByTestId('working-dirty')).toHaveText('dirty');
 await redo().click();await expect(defaultValue).toHaveValue('Revised fallback');await expect(page.getByTestId('working-dirty')).toHaveText('saved');
 await undo().click();await defaultValue.fill('Different fallback');await expect(redo()).toBeDisabled();
 await page.screenshot({path:info.outputPath('field-history.png')});await info.attach('Native field history',{path:info.outputPath('field-history.png'),contentType:'image/png'});
 if(width===1440){
  await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByTestId('working-dirty')).toHaveText('saved');
  const stored=JSON.parse(await page.getByTestId('saved').textContent()||'{}');const targetId=stored.freeformCanvas.elements.find((element:{id:string})=>element.id!=='neighbor').id;
  await page.reload();await page.addStyleTag({content:(await css).css});for(const file of bundle.outputFiles.filter(f=>f.path.endsWith('.css')))await page.addStyleTag({content:file.text});await page.addScriptTag({content:bundle.outputFiles.find(f=>f.path.endsWith('.js'))!.text});
  await page.locator(`[data-cardforge-editor-overlay="true"][data-freeform-element-id="${targetId}"]`).click();
  await expect(page.getByLabel(/^Preview default for /)).toHaveValue('Different fallback');await expect(page.getByLabel(/^Font size for /)).toHaveValue('48');await expect(page.getByRole('switch',{name:/Italic text for/})).toBeChecked();
  await page.getByRole('button',{name:'Render saved PNG',exact:true}).click();await expect(page.getByAltText('Saved Studio PNG')).toBeVisible();
  await page.getByAltText('Saved Studio PNG').screenshot({path:info.outputPath('reloaded-field-output.png')});await info.attach('Reloaded field output',{path:info.outputPath('reloaded-field-output.png'),contentType:'image/png'});
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('synthetic-saved-template')!))).toEqual(stored);
 }
});
test('@golden edits made while local Save is pending survive its earlier snapshot acknowledgment',async({page})=>{
 await page.setViewportSize({width:1440,height:960});await mountHistoryProof(page,'?delayedSave=1');
 const editor=page.locator('.tiptap[contenteditable="true"]');await editor.fill('Saved snapshot');await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.getByRole('button',{name:'Finish local Save'})).toBeVisible();await editor.fill('Newer unsaved text');await page.getByRole('button',{name:'Finish local Save'}).click();
 await expect(editor).toHaveText('Newer unsaved text');await expect(page.getByTestId('working-dirty')).toHaveText('dirty');
 const saved=JSON.parse(await page.getByTestId('saved').textContent()||'{}');expect(saved.freeformCanvas.elements.find((element:{type:string})=>element.type==='text').content).toBe('Saved snapshot');
});

test('@golden a saved fork adopts its returned identity without overwriting edits made after commit',async({page})=>{
 await page.setViewportSize({width:1440,height:960});await mountHistoryProof(page,'?forkSave=1&postCommitDelay=1');
 const editor=page.locator('.tiptap[contenteditable="true"]');await editor.fill('Saved fork snapshot');await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.getByRole('button',{name:'Finish local Save'})).toBeVisible();await expect(editor).toHaveText('Saved fork snapshot');await editor.fill('Newer fork draft');
 await page.getByRole('button',{name:'Finish local Save'}).click();await expect(editor).toHaveText('Newer fork draft');await expect(page.getByTestId('working-dirty')).toHaveText('dirty');
 const saved=JSON.parse(await page.getByTestId('saved').textContent()||'{}');expect(saved.id).toBe('synthetic-fork');expect(saved.freeformCanvas.elements.find((element:{type:string})=>element.type==='text').content).toBe('Saved fork snapshot');
});

test('@golden structured-row creation and multi-field mode changes are atomic Template history operations',async({page})=>{
 await page.setViewportSize({width:1440,height:960});await mountHistoryProof(page);const editor=page.locator('.tiptap[contenteditable="true"]');
 await editor.fill('Rule');await editor.press('ControlOrMeta+A');await page.getByRole('button',{name:'Make variable',exact:true}).click();
 await page.getByRole('radio',{name:/Repeating Text/}).click();await page.getByRole('button',{name:'Add Label + Value',exact:true}).click();
 await expect(page.getByRole('textbox',{name:/Variable name for/})).toHaveCount(3);await page.getByRole('button',{name:'Undo',exact:true}).first().click();await expect(page.getByRole('textbox',{name:/Variable name for/})).toHaveCount(1);
 await page.getByRole('button',{name:'Redo',exact:true}).first().click();await expect(page.getByRole('textbox',{name:/Variable name for/})).toHaveCount(3);
 await page.getByRole('radio',{name:/^Text One editable/}).click();await page.getByRole('button',{name:'Save',exact:true}).click();
 const text=JSON.parse(await page.getByTestId('saved').textContent()||'{}');expect(text.fieldContracts).toHaveLength(3);expect(text.fieldContracts.every((field:{type:string})=>field.type==='text')).toBe(true);
 await page.getByRole('button',{name:'Undo',exact:true}).first().click();await page.getByRole('button',{name:'Save',exact:true}).click();
 const rows=JSON.parse(await page.getByTestId('saved').textContent()||'{}');expect(rows.fieldContracts).toHaveLength(3);expect(rows.fieldContracts.every((field:{type:string})=>field.type==='structuredRows')).toBe(true);
});

test('@golden a stale Save acknowledgment cannot retarget a different current Template',async({page})=>{
 await page.setViewportSize({width:1440,height:960});await mountHistoryProof(page,'?delayedSave=1');const editor=page.locator('.tiptap[contenteditable="true"]');
 await editor.fill('Earlier snapshot');await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('button',{name:'Switch local Template during Save'}).click();await expect(editor).toHaveText('Other document');
 await page.getByRole('button',{name:'Finish local Save'}).click();await expect(editor).toHaveText('Other document');await expect(page.getByTestId('working-dirty')).toHaveText('saved');await expect(page.getByRole('button',{name:'Undo',exact:true}).first()).toBeDisabled();
 const saved=JSON.parse(await page.getByTestId('saved').textContent()||'{}');expect(saved.freeformCanvas.elements.find((element:{type:string})=>element.type==='text').content).toBe('Earlier snapshot');
});
test('@golden a rejected local Save retains authored work and its undo history',async({page})=>{
 await page.setViewportSize({width:1440,height:960});await mountHistoryProof(page,'?rejectSave=1');const editor=page.locator('.tiptap[contenteditable="true"]');
 await editor.fill('Unsaved edits');await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByText('Template not saved',{exact:true})).toBeVisible();await expect(editor).toHaveText('Unsaved edits');await expect(page.getByTestId('working-dirty')).toHaveText('dirty');
 await page.getByRole('button',{name:'Undo',exact:true}).first().click();await expect(editor).not.toHaveText('Unsaved edits');expect(await page.getByTestId('saved').textContent()).toBe('');
});

for (const delayed of [false,true]) test(`@golden same-ID normalized Save keeps canonical revision metadata and authored history${delayed?' across delayed acknowledgment':''}`,async({page})=>{
 await page.setViewportSize({width:1440,height:960});await mountHistoryProof(page,'?historyContracts=1&normalizedSave=1'+(delayed?'&postCommitDelay=1':''));
 const editor=page.locator('.tiptap[contenteditable="true"]');await editor.fill('Captured authored snapshot');
 await page.getByRole('button',{name:'Save',exact:true}).click();
 if(delayed){await expect(page.getByRole('button',{name:'Finish local Save'})).toBeVisible();await editor.fill('Later authored text');await page.getByRole('button',{name:'Finish local Save'}).click();await expect(editor).toHaveText('Later authored text');await expect(page.getByTestId('working-dirty')).toHaveText('dirty');await page.getByRole('button',{name:'Undo',exact:true}).first().click();}
 await expect(editor).toHaveText('Captured authored snapshot');await expect(page.getByTestId('working-dirty')).toHaveText('saved');
 const first=JSON.parse(await page.getByTestId('saved').textContent()||'{}');expect(first).toMatchObject({id:'synthetic-local',templateSource:'user',templateLibrarySource:'personal',templateRegistryStatus:'localOnly'});expect(first.templateRevisionId).toBeTruthy();expect(first.templateRevision).toBeGreaterThan(0);
 // Selection and authored history survive; redo returns to the authoritative saved baseline.
 await page.getByRole('button',{name:'Undo',exact:true}).first().click();await expect(editor).not.toHaveText('Captured authored snapshot');await expect(page.getByTestId('working-dirty')).toHaveText('dirty');
 await page.getByRole('button',{name:'Redo',exact:true}).first().click();await expect(editor).toHaveText('Captured authored snapshot');await expect(page.getByTestId('working-dirty')).toHaveText('saved');
 await editor.fill('Next authored snapshot');await page.getByRole('button',{name:'Save',exact:true}).click();if(delayed)await page.getByRole('button',{name:'Finish local Save'}).click();await expect(page.getByTestId('working-dirty')).toHaveText('saved');
 const second=JSON.parse(await page.getByTestId('saved').textContent()||'{}');expect(second.templateParentRevisionId).toBe(first.templateRevisionId);expect(second.templateRevision).toBe(first.templateRevision+1);expect(second.freeformCanvas.elements.find((e:{id:string})=>e.id==='neighbor').content).toBe(first.freeformCanvas.elements.find((e:{id:string})=>e.id==='neighbor').content);
});


// An L-shaped alpha mask makes X, Y and XY distinguishable even with one tint color.
// Reopen is read-only: do not conflate renderer fidelity with another normalized Save.
for(const width of [390,1440])test(`@golden native SVG tint and asymmetric flips survive local Save, reopen and PNG output at ${width}px`,async({page},info)=>{
 test.setTimeout(120000);page.setDefaultTimeout(10000);await page.setViewportSize({width,height:960});await mountHistoryProof(page,'',true);
 await page.locator('.tiptap[contenteditable="true"]').fill('Unchanged neighboring text');
 if(width<1024){await page.getByRole('button',{name:'Close inspector',exact:true}).click();await page.getByRole('button',{name:'Open editor menu',exact:true}).click();}
 await page.getByRole('button',{name:'Elements',exact:true}).click();await page.getByRole('button',{name:'Icon',exact:true}).and(page.locator('[draggable="true"]')).click();
 if(width<1024)await page.getByRole('button',{name:'Edit selected element',exact:true}).click();
 await page.getByRole('button',{name:'Choose from Library',exact:true}).click();await page.getByRole('option',{name:/Synthetic asymmetric SVG/}).click();await page.getByRole('button',{name:'Use selection',exact:true}).click();
 await expect(page.getByLabel('Vector color',{exact:true})).toContainText('Original');
 await page.getByRole('button',{name:'Layout',exact:true}).click();
 for(const [label,value] of [['x','180'],['y','250'],['width','200'],['height','200']])await page.getByLabel(label,{exact:true}).fill(value);
 let neighbor:unknown;let appearance:unknown;let iconId='';let lastImageSource='';
 const saveAndProve=async(name:string,mode:'original'|'tint',flipX:boolean,flipY:boolean,persist=true)=>{
  if(width<1024)await page.getByRole('button',{name:'Close inspector',exact:true}).click();
  if(persist)await page.getByRole('button',{name:width<1024?'Save Template in this browser':'Save',exact:true}).click();await expect(page.getByTestId('working-dirty')).toHaveText('saved');
  const saved=JSON.parse(await page.evaluate(()=>localStorage.getItem('synthetic-saved-template'))||'{}');const icon=saved.freeformCanvas.elements.find((e:{type:string})=>e.type==='icon');const text=saved.freeformCanvas.elements.find((e:{type:string})=>e.type==='text');
  expect(text).toMatchObject({content:'Unchanged neighboring text'});if(!neighbor){neighbor=text;appearance=icon.appearance;}else expect(text).toEqual(neighbor);expect(icon.appearance).toEqual(appearance);
  iconId=icon.id;expect(icon).toMatchObject({iconImageSource:'/asymmetric.svg',iconRenderMode:mode,x:180,y:250,width:200,height:200,rotation:0,opacity:1});expect(!!icon.flipX).toBe(flipX);expect(!!icon.flipY).toBe(flipY);if(mode==='tint')expect(icon.fillColor).toBe('#00ff00');
  const canvas=page.getByRole('region',{name:'Template canvas',exact:true});const transform=`matrix(${flipX?-1:1}, 0, 0, ${flipY?-1:1}, 0, 0)`;await expect(canvas.locator(`.tcg-card-preview [data-freeform-element-id="${iconId}"]:not([data-cardforge-editor-overlay])`)).toHaveCSS('transform',transform);await expect(canvas.locator(`[data-cardforge-editor-overlay="true"][data-freeform-element-id="${iconId}"]`)).toHaveCSS('transform',transform);
  await page.getByRole('button',{name:'Render saved PNG',exact:true}).click();const image=page.getByAltText('Saved Studio PNG');await expect(image).toBeVisible();await expect(image).not.toHaveAttribute('src',lastImageSource);lastImageSource=await image.getAttribute('src')||'';
  const pixels=await image.evaluate(async(node:HTMLImageElement)=>{await node.decode();const c=document.createElement('canvas');c.width=node.naturalWidth;c.height=node.naturalHeight;const ctx=c.getContext('2d')!;ctx.drawImage(node,0,0);const pixel=(x:number,y:number)=>[...ctx.getImageData(Math.floor(c.width*x/630),Math.floor(c.height*y/880),1,1).data];return {quadrants:[[230,300],[330,300],[230,400],[330,400]].map(([x,y])=>pixel(x,y)),background:pixel(160,230)};});
  const expected=[[255,0,0,255],pixels.background,[255,0,0,255],[0,0,255,255]];if(mode==='tint'){expected[0]=[0,255,0,255];expected[2]=[0,255,0,255];expected[3]=[0,255,0,255];}if(flipX){[expected[0],expected[1]]=[expected[1],expected[0]];[expected[2],expected[3]]=[expected[3],expected[2]];}if(flipY){[expected[0],expected[2]]=[expected[2],expected[0]];[expected[1],expected[3]]=[expected[3],expected[1]];}
  expect(pixels.quadrants).toEqual(expected);
  const output=info.outputPath(`${name}.png`);writeFileSync(output,Buffer.from(await image.evaluate(async(node:HTMLImageElement)=>[...new Uint8Array(await (await fetch(node.src)).arrayBuffer())])));await info.attach(name,{path:output,contentType:'image/png'});
  if(width<1024)await page.getByRole('button',{name:'Edit selected element',exact:true}).click();
 };
 await saveAndProve('original', 'original',false,false);
 await page.getByRole('button',{name:'Symbol',exact:true}).click();await page.getByLabel('Vector color',{exact:true}).click();await page.getByRole('option',{name:'Single-color tint',exact:true}).click();await page.locator('#element-icon-vector-tint').click();await page.getByTitle('Hex color value',{exact:true}).fill('#00ff00');await page.getByTitle('Hex color value',{exact:true}).press('Enter');await page.getByTitle('Hex color value',{exact:true}).press('Escape');
 await saveAndProve('tint', 'tint',false,false);
 await page.getByRole('button',{name:'Layout',exact:true}).click();await page.getByRole('button',{name:'Flip layer horizontally',exact:true}).click();await saveAndProve('tint-flip-x','tint',true,false);
 await page.getByRole('button',{name:'Flip layer horizontally',exact:true}).click();await page.getByRole('button',{name:'Flip layer vertically',exact:true}).click();await saveAndProve('tint-flip-y','tint',false,true);
 await page.getByRole('button',{name:'Flip layer horizontally',exact:true}).click();await saveAndProve('tint-flip-xy','tint',true,true);
 await page.getByRole('button',{name:'Symbol',exact:true}).click();await page.getByLabel('Vector color',{exact:true}).click();await page.getByRole('option',{name:'Original',exact:true}).click();await saveAndProve('restored-original-flip-xy','original',true,true);
 if(width<1024)await page.getByRole('button',{name:'Close inspector',exact:true}).click();await page.getByRole('button',{name:'Export local proof',exact:true}).click();const stored=await page.getByTestId('saved').textContent();expect(await page.getByTestId('exported').textContent()).toBe(stored);
 await page.reload();await page.addStyleTag({content:(await css).css});for(const file of bundle.outputFiles.filter(f=>f.path.endsWith('.css')))await page.addStyleTag({content:file.text});await page.addScriptTag({content:bundle.outputFiles.find(f=>f.path.endsWith('.js'))!.text});
 await page.locator(`[data-cardforge-editor-overlay="true"][data-freeform-element-id="${iconId}"]`).click();if(width<1024)await page.getByRole('button',{name:'Edit selected element',exact:true}).click();
 await page.getByRole('button',{name:'Symbol',exact:true}).click();await expect(page.getByLabel('Vector color',{exact:true})).toContainText('Original');await saveAndProve('reopened-original-flip-xy','original',true,true,false);
 expect(await page.evaluate(()=>localStorage.getItem('synthetic-saved-template'))).toBe(stored);
});
