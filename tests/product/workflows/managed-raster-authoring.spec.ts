import { buildSync } from 'esbuild';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import tailwindConfig from '../../../tailwind.config';
import { expect, test } from '@playwright/test';
const bundle = buildSync({entryPoints:['tests/product/fixtures/managedRasterAuthoring.tsx'],bundle:true,platform:'browser',format:'iife',write:false,outfile:join(tmpdir(),'managed-raster-authoring.js'),define:{'process.env.NODE_ENV':'"production"','process.env':'{}'}});
const css = postcss([tailwindcss(tailwindConfig)]).process((readFileSync('src/app/cardforgePresentation.css','utf8')+readFileSync('src/app/globals.css','utf8')).replace(/@import ['"]([^'"]+)['"];?/g,(_,path:string)=>readFileSync(join('src/app',path),'utf8')),{from:'src/app/globals.css'});
const selection = { registryAssetId:'managed-raster',publishedSubmissionId:'11111111-1111-4111-8111-111111111111',elementId:'art' };
for(const width of [390,1440]) for(const contract of [false,true]) test(`@golden explicit managed raster picker and recoverable submission at ${width}px contract=${contract}`,async({page},info)=>{
  await page.setViewportSize({width,height:960});
  const requests: {body:Record<string,unknown>; key:string}[]=[]; const lookups: {body:Record<string,unknown>; key:string}[]=[]; const unexpected:string[]=[]; let committed=false; let delayLookup=false; let releaseLookup: (()=>void) | null=null;
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/__raster-authoring')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body style="margin:0"></body></html>'});
    if(url.pathname==='/api/catalog/studio-bootstrap')return route.fulfill({json:{fonts:{fonts:[]},templates:{templates:[]},styles:{styles:[]}}});
    if(url.pathname==='/api/catalog/studio-assets')return route.fulfill({json:{assets:{textures:[],dividers:[],icons:[],imageAssets:[{id:'managed-raster',name:'Synthetic managed raster',url:'/raster.svg',kind:'image',publishedSubmissionId:selection.publishedSubmissionId,registryStatus:'published',librarySource:'contributor',accessTier:'free',tileMode:'contain',seamless:false,allowedTargets:['image']},{id:'legacy',publishedSubmissionId:'22222222-2222-4222-8222-222222222222',name:'Legacy ordinary picture',url:'/raster.svg',kind:'image',tileMode:'contain',seamless:false,allowedTargets:['image']}]}}});
    if(url.pathname==='/api/assets' && url.searchParams.get('registryAssetId')==='legacy')return route.fulfill({status:409,json:{error:{code:'managed_raster_ineligible',message:'This published picture has no verified original upload digest. Use it as an ordinary independent picture; it is not eligible for managed adoption.',kind:'conflict',retryable:false}}});
    if(url.pathname==='/api/assets')return route.fulfill({json:{state:'ready',selection:Object.fromEntries(url.searchParams)}});
    if(url.pathname==='/raster.svg'||url.pathname==='/600x400.png'||url.pathname==='/independent.svg')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#00cc66"/></svg>'});
    if(url.pathname.startsWith('/fonts/'))return route.fulfill({body:readFileSync(join('public',url.pathname))});
    if(url.pathname==='/account')return route.fulfill({contentType:'text/html',body:'Synthetic Pipeline handoff received'});
    if(url.pathname==='/api/templates/submissions'){
      if(route.request().method()==='GET')return route.fulfill({json:{contributorId:'synthetic-actor'}});
      const request={body:route.request().postDataJSON(),key:route.request().headers()['idempotency-key']};
      if(url.searchParams.get('lookup')==='1'){
        lookups.push(request);
        const finish=()=>route.fulfill({json:{openInPipelineUrl:committed?'/account?section=library&scope=pipeline&tool=contribute&submission=synthetic':null}});
        if(delayLookup)return new Promise<void>(resolve=>{releaseLookup=()=>{delayLookup=false;void finish().then(resolve);};});
        return finish();
      }
      requests.push(request);
      if(width===1440||requests.length===2)committed=true;
      return route.fulfill({status:503,json:{error:{code:'pipeline_unavailable',message:'Synthetic lost response. Check the saved attempt.',kind:'unavailable',retryable:true}}});
    }
    unexpected.push(`${route.request().method()} ${url.pathname}`);return route.abort();
  });
  const boot = async () => {
    await page.addStyleTag({content:(await css).css});
    for(const file of bundle.outputFiles.filter(f=>f.path.endsWith('.css')))await page.addStyleTag({content:file.text});
    await page.addScriptTag({content:bundle.outputFiles.find(f=>f.path.endsWith('.js'))!.text});
  };
  await page.goto('/__raster-authoring'+(contract?'?contract=1':'')); await boot();
  if(width<1024)await page.getByRole('button',{name:'Open editor menu',exact:true}).click();
  await page.getByRole('button',{name:'Elements',exact:true}).click();
  await page.getByRole('button',{name:'Picture',exact:true}).click();
  const elementId = await page.locator('[data-cardforge-editor-overlay][data-freeform-element-id]').first().getAttribute('data-freeform-element-id');
  const actualSelection={...selection,elementId};
  if(width<1024)await page.getByRole('button',{name:'Edit selected element',exact:true}).click();
  const managed=page.getByRole('checkbox',{name:'Adopt managed picture on Pipeline submission'});
  await expect(managed).toBeVisible();await expect(managed).toBeDisabled();
  await expect(page.getByLabel('Picture URL, card field, or uploaded file')).toHaveValue('artworkUrl');
  if(contract){
    await expect(page.getByRole('button',{name:'Use as fixed picture',exact:true})).toHaveCount(0);
    await expect(page.getByText('Managed adoption needs a static image slot without content, image fields or preview overrides. Your existing content is unchanged.',{exact:true})).toBeVisible();
    expect(requests).toHaveLength(0);expect(unexpected).toEqual([]);return;
  }
  await page.screenshot({path:info.outputPath('fixed-picture-action.png')});
  await info.attach('Explicit fixed picture action',{path:info.outputPath('fixed-picture-action.png'),contentType:'image/png'});
  await page.getByRole('button',{name:'Use as fixed picture',exact:true}).click();
  await expect(managed).toBeEnabled(); await managed.check();
  await page.getByRole('button',{name:'Choose from Library',exact:true}).click();
  await page.getByRole('option',{name:/Legacy ordinary picture/}).click();await page.getByRole('button',{name:'Use selection',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('ordinary independent picture');
  await page.getByRole('option',{name:/Synthetic managed raster/}).click();await page.getByRole('button',{name:'Use selection',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Pending managed adoption:'})).toContainText('Synthetic managed raster');
  await expect(page.getByLabel('Picture URL, card field, or uploaded file')).toHaveValue('');
  const picker=await managed.boundingBox();expect(picker!.x).toBeGreaterThanOrEqual(0);expect(picker!.x+picker!.width).toBeLessThanOrEqual(width);
  await page.screenshot({path:info.outputPath('pending-adoption.png')});await info.attach('Pending managed adoption',{path:info.outputPath('pending-adoption.png'),contentType:'image/png'});
  if(width<1024)await page.getByRole('button',{name:'Close inspector',exact:true}).click();
  await page.getByRole('button',{name:'Continue in Pipeline',exact:true}).click();
  await expect.poll(()=>requests.length).toBe(1);
  expect(requests[0].body.managedRasterSelection).toEqual(actualSelection);
  const saved=JSON.parse(await page.getByTestId('saved').textContent()||'{}');expect(saved).not.toHaveProperty('managedRasterSelection');
  expect(saved.freeformCanvas.elements.find((e:{id:string})=>e.id===elementId).imageSource).toBe('');
  await expect(page.getByRole('button',{name:'Continue selected adoption',exact:true})).toBeVisible();
  // A real reload discards all React refs and transient selection; IndexedDB owns the attempt.
  await page.reload(); await boot();
  await expect(page.getByRole('region',{name:'Saved Pipeline attempts'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Continue current work as a separate submission',exact:true})).toBeVisible();
  if(committed){
    delayLookup=true;
    await page.getByRole('button',{name:'Check submission outcome',exact:true}).click();
    await expect.poll(()=>typeof releaseLookup).toBe('function');
    await page.getByRole('button',{name:'Hide editor',exact:true}).click();
    const settledLookup=page.waitForResponse(response=>response.url().includes('lookup=1'));
    releaseLookup!();
    // Flush the delayed response before mounting a new editor instance.
    await expect(page.getByRole('button',{name:'Show editor',exact:true})).toBeVisible();
    await settledLookup;
    await page.getByRole('button',{name:'Show editor',exact:true}).click();
    await expect(page).toHaveURL(/__raster-authoring/);
    delayLookup=true; releaseLookup=null;
    await page.getByRole('button',{name:'Check submission outcome',exact:true}).click();
    await expect.poll(()=>typeof releaseLookup).toBe('function');
  }
  await page.locator(`[data-cardforge-editor-overlay][data-freeform-element-id="${elementId}"]`).click();
  if(width<1024)await page.getByRole('button',{name:'Edit selected element',exact:true}).click();
  await page.getByLabel('Picture URL, card field, or uploaded file').fill('/independent.svg');
  if(width<1024)await page.getByRole('button',{name:'Close inspector',exact:true}).click();
  if(committed){
    releaseLookup!();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button',{name:'Keep editing',exact:true}).click();
    await expect(page).toHaveURL(/__raster-authoring/);
    expect(requests).toHaveLength(1);
  }
  // Persist newer independent local work before resolving the historical submission.
  await page.keyboard.press('Control+s');
  await expect.poll(async()=>JSON.parse(await page.evaluate(()=>localStorage.getItem('synthetic-saved-template'))||'{}').freeformCanvas?.elements[0]?.imageSource).toBe('/independent.svg');
  await page.getByRole('button',{name:'Export local proof'}).click();
  expect(await page.getByTestId('exported').textContent()).not.toContain('managedRasterSelection');
  expect(await page.getByTestId('exported').textContent()).toContain('/independent.svg');
  if(!committed){
    await page.getByRole('button',{name:'Check submission outcome',exact:true}).click();
    await expect(page.getByText('No committed draft was found.',{exact:false})).toBeVisible();
    await page.getByRole('button',{name:'Retry original snapshot',exact:true}).click();
    await expect.poll(()=>requests.length).toBe(2);
    expect(requests[1]).toEqual(requests[0]);
    await page.reload(); await boot();
  }
  await page.screenshot({path:info.outputPath('saved-attempt-recovery.png')});
  await info.attach('Saved historical attempt after reload',{path:info.outputPath('saved-attempt-recovery.png'),contentType:'image/png'});
  await page.getByRole('button',{name:'Check submission outcome',exact:true}).click();
  await expect(page).toHaveURL(/submission=synthetic/);
  expect(requests).toHaveLength(width===1440?1:2);
  for(const lookup of lookups)expect(lookup).toEqual(requests[0]);
  expect(JSON.parse(await page.evaluate(()=>localStorage.getItem('synthetic-saved-template'))||'{}').freeformCanvas.elements[0].imageSource).toBe('/independent.svg');
  expect(unexpected).toEqual([]);
});
