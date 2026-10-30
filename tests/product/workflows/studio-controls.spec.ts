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

async function mountHistoryProof(page:import('@playwright/test').Page,query='') {
 await page.route('**/*',route=>{const url=new URL(route.request().url());
  if(url.pathname==='/__studio-history')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0"></body></html>'});
  if(url.pathname==='/api/catalog/studio-bootstrap')return route.fulfill({json:{fonts:{fonts:[]},templates:{templates:[]},styles:{styles:[]}}});
  if(url.pathname==='/api/catalog/studio-assets')return route.fulfill({json:{assets:{textures:[],dividers:[],icons:[],imageAssets:[]}}});
  if(url.pathname==='/api/templates/submissions')return route.fulfill({json:{contributorId:'synthetic-actor'}});
  if(url.pathname.startsWith('/fonts/'))return route.fulfill({body:readFileSync(join('public',url.pathname))});
  return route.abort();
 });
 await page.goto('/__studio-history'+query);await page.addStyleTag({content:(await css).css});for(const file of bundle.outputFiles.filter(f=>f.path.endsWith('.css')))await page.addStyleTag({content:file.text});await page.addScriptTag({content:bundle.outputFiles.find(f=>f.path.endsWith('.js'))!.text});
 if(page.viewportSize()!.width<1024)await page.getByRole('button',{name:'Open editor menu',exact:true}).click();
 await page.getByRole('button',{name:'Elements',exact:true}).click();await page.getByRole('button',{name:'Text',exact:true}).and(page.locator('[draggable="true"]')).click();
 if(page.viewportSize()!.width<1024)await page.getByRole('button',{name:'Edit selected element',exact:true}).click();
}
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
