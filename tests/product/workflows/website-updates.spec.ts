import { buildSync } from 'esbuild';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import tailwindConfig from '../../../tailwind.config';
import {expect,test} from '@playwright/test';
const bundle=buildSync({entryPoints:['tests/product/fixtures/websiteUpdates.tsx'],bundle:true,platform:'browser',format:'iife',write:false,outfile:join(tmpdir(),'website-updates.js'),define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_RUNTIME':'"browser"','process.env':'{}'}});
const css=postcss([tailwindcss(tailwindConfig)]).process((readFileSync('src/app/cardforgePresentation.css','utf8')+readFileSync('src/app/globals.css','utf8')).replace(/@import ['"]([^'"]+)['"];?/g,(_,path:string)=>readFileSync(join('src/app',path),'utf8')),{from:'src/app/globals.css'});
async function boot(page:import('@playwright/test').Page){await page.addStyleTag({content:(await css).css});await page.addScriptTag({content:bundle.outputFiles.find(f=>f.path.endsWith('.js'))!.text});}
async function mount(page:import('@playwright/test').Page,query=''){await page.route('**/*',route=>route.request().url().includes('/__updates-proof')?route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}):route.abort());await page.goto('/__updates-proof'+query);await boot(page);}
for(const width of [390,1440])test(`@golden website working notes preserve exact retry at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:900});await mount(page,'?uncertain=1');await expect(page.getByRole('heading',{name:'0.0.1 — working/upcoming'})).toBeVisible();await expect(page.getByText('Preview working notes. Unreleased; no release date.')).toBeVisible();await expect(page.getByRole('button',{name:'Publish verified release'})).toHaveCount(0);
 await page.getByText('Owner: manage website update notes',{exact:true}).click();await page.getByLabel('fixes',{exact:true}).fill('Recovered native editor behavior');await expect(page.getByText('Unpublished notes retained',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Save working notes',exact:true}).click();await expect(page.getByText('Unresolved exact attempt retained.',{exact:false})).toBeVisible();await expect(page.getByLabel('Version',{exact:true})).toBeDisabled();await page.getByRole('button',{name:'Confirm same saved attempt',exact:true}).click();await expect(page.getByText('Working notes saved; no release published.')).toBeVisible();const requests=await page.evaluate(()=>(window as typeof window & {releaseRequests:string[]}).releaseRequests);expect(requests).toHaveLength(2);expect(requests[0]).toBe(requests[1]);expect(JSON.parse(requests[0]).websiteRelease.publish).toBe(false);await page.screenshot({path:info.outputPath('website-working-notes.png'),fullPage:true});
});
test('@golden Production empty history and unavailable state stay distinct',async({page})=>{await mount(page,'?production=1');await expect(page.getByText('No numbered website releases have been published.')).toBeVisible();await expect(page.getByLabel('Working website version')).toHaveCount(0);await mount(page,'?unavailable=1');await expect(page.getByRole('alert')).toContainText('temporarily unavailable');await expect(page.getByText('No numbered website releases have been published.')).toHaveCount(0);});

for(const failure of ['networkThenConflict','parseThenConflict'])test(`@golden release ${failure} keeps the uncertain snapshot after a later conflict`,async({page})=>{
 await mount(page,'?'+failure+'=1');await page.getByText('Owner: manage website update notes',{exact:true}).click();await page.getByLabel('fixes',{exact:true}).fill('Retained local correction');await page.getByRole('button',{name:'Save working notes',exact:true}).click();await expect(page.getByRole('button',{name:'Confirm same saved attempt'})).toBeVisible();await expect(page.getByLabel('Version',{exact:true})).toBeDisabled();await page.getByRole('button',{name:'Confirm same saved attempt'}).click();await expect(page.getByText('A later conflict does not resolve the first outcome.')).toBeVisible();await expect(page.getByLabel('Version',{exact:true})).toBeDisabled();const requests=await page.evaluate(()=>(window as typeof window & {releaseRequests:string[]}).releaseRequests);expect(requests).toHaveLength(2);expect(requests[0]).toBe(requests[1]);
});

test('@golden confirmed release rejection keeps local notes editable and refresh preserves them',async({page})=>{
 await mount(page,'?rejected=1');await page.getByText('Owner: manage website update notes',{exact:true}).click();const notes=page.getByLabel('fixes',{exact:true});await notes.fill('Unsaved correction');await page.getByRole('button',{name:'Save working notes',exact:true}).click();await expect(page.getByText('Review the exact saved revision.')).toBeVisible();await expect(page.getByLabel('Version',{exact:true})).toBeEnabled();await expect(notes).toHaveValue('Unsaved correction');await page.getByRole('button',{name:'Read current saved records'}).click();await expect(notes).toHaveValue('Unsaved correction');await expect(page.getByText('Current saved records refreshed.',{exact:false})).toBeVisible();
});
test('@golden exact committed release attempt resolves by readback without another write',async({page})=>{
 await mount(page,'?uncertain=1&committedReadback=1');await page.getByText('Owner: manage website update notes',{exact:true}).click();await page.getByLabel('fixes',{exact:true}).fill('Committed correction');await page.getByRole('button',{name:'Save working notes',exact:true}).click();await expect(page.getByRole('button',{name:'Confirm same saved attempt'})).toBeVisible();await page.getByRole('button',{name:'Read current saved records'}).click();await expect(page.getByText('The exact saved attempt is confirmed committed.',{exact:false})).toBeVisible();await expect(page.getByLabel('Version',{exact:true})).toBeEnabled();expect(await page.evaluate(()=>(window as typeof window & {releaseRequests:string[]}).releaseRequests.length)).toBe(1);
});
test('@golden successful working advance refreshes the previous published record',async({page})=>{
 await mount(page);await page.getByText('Owner: manage website update notes',{exact:true}).click();await page.getByLabel('Version',{exact:true}).fill('0.0.2');await page.getByRole('button',{name:'Begin next working version after Production release'}).click();await expect(page.getByLabel('Version',{exact:true})).toHaveValue('0.0.2');await expect(page.getByRole('button',{name:'Save working notes',exact:true})).toBeVisible();await page.getByLabel('Existing record').selectOption('0.0.1');await expect(page.getByRole('button',{name:'Save narrative correction'})).toBeVisible();await expect(page.getByRole('button',{name:'Save working notes',exact:true})).toHaveCount(0);
});

test('@golden Owner with only released history opens the latest saved narrative without an empty draft',async({page})=>{
 await mount(page,'?releasedOwner=1');await page.getByText('Owner: manage website update notes',{exact:true}).click();
 await expect(page.getByLabel('Version',{exact:true})).toHaveValue('0.0.2');
 await expect(page.getByLabel('improvements',{exact:true})).toHaveValue('Retained released notes');
 await expect(page.getByLabel('fixes',{exact:true})).toHaveValue('Original correction');
 expect(await page.evaluate(()=>(window as typeof window & {releaseRequests:string[]}).releaseRequests)).toEqual([]);
});


const noteSections={improvements:'Improvements',fixes:'Fixes',knownLimits:'Known limits'} as const;
async function typeTwoNotes(page:import('@playwright/test').Page,key:keyof typeof noteSections){
 const field=page.getByLabel(key,{exact:true});await field.fill('');await field.pressSequentially(`  First ${key} note  `);await field.press('Enter');
 await expect(field).toHaveValue(`  First ${key} note  \n`);
 await field.press('Enter');await field.pressSequentially(`Second ${key} note`);await field.press('Enter');
 await expect(field).toHaveValue(`  First ${key} note  \n\nSecond ${key} note\n`);
}
for(const width of [390,1440])test(`@golden Owner keyboard release notes save and reopen as ordered public bullets at ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:900});await mount(page,'?persistNotes=1');await page.getByText('Owner: manage website update notes',{exact:true}).click();
 for(const key of Object.keys(noteSections) as (keyof typeof noteSections)[])await typeTwoNotes(page,key);
 await page.getByRole('button',{name:'Save working notes',exact:true}).click();await expect(page.getByText('Working notes saved; no release published.')).toBeVisible();
 const requests=await page.evaluate(()=>(window as typeof window & {releaseRequests:string[]}).releaseRequests);expect(requests).toHaveLength(1);const command=JSON.parse(requests[0]).websiteRelease;
 for(const key of Object.keys(noteSections) as (keyof typeof noteSections)[]){expect(command.notes[key]).toEqual([`  First ${key} note  `,`Second ${key} note`]);await expect(page.getByLabel(key,{exact:true})).toHaveValue(`First ${key} note\nSecond ${key} note`);}
 expect(command).toMatchObject({version:'0.0.1',publish:false,sourceSha:null,candidateSha:null});
 await page.reload();await boot(page);await page.getByText('Owner: manage website update notes',{exact:true}).click();
 const working=page.getByLabel('Working website version');
 for(const key of Object.keys(noteSections) as (keyof typeof noteSections)[]){await expect(page.getByLabel(key,{exact:true})).toHaveValue(`First ${key} note\nSecond ${key} note`);await expect(working.locator('section').filter({has:page.getByRole('heading',{name:noteSections[key],exact:true})}).getByRole('listitem')).toHaveText([`First ${key} note`,`Second ${key} note`]);}
 await expect(page.getByText('Preview working notes. Unreleased; no release date.')).toBeVisible();await expect(page.getByText('No numbered website releases have been published.')).toBeVisible();expect(await page.evaluate(()=>(window as typeof window & {releaseRequests:string[]}).releaseRequests)).toEqual([]);
 await page.screenshot({path:info.outputPath('keyboard-saved-public-bullets.png'),fullPage:true});
});


test('@golden multiline notes remain editable after confirmed validation rejection without truncation',async({page})=>{
 await mount(page);await page.getByText('Owner: manage website update notes',{exact:true}).click();const notes=page.getByLabel('fixes',{exact:true});
 for(const raw of ['  \n','x'.repeat(1001)]){
  await notes.fill(raw);await page.getByRole('button',{name:'Save working notes',exact:true}).click();await expect(page.getByText('Notes must be nonblank, at most 1000 characters each, and at most 40 per section.')).toBeVisible();await expect(notes).toBeEnabled();await expect(notes).toHaveValue(raw);await expect(page.getByText('Unpublished notes retained',{exact:true})).toBeVisible();
 }
 await typeTwoNotes(page,'fixes');await page.getByRole('button',{name:'Save working notes',exact:true}).click();await expect(page.getByText('Working notes saved; no release published.')).toBeVisible();
 const bodies=await page.evaluate(()=>(window as typeof window & {releaseRequests:string[]}).releaseRequests);const commands=bodies.map(body=>JSON.parse(body).websiteRelease);expect(commands[0].notes.fixes).toEqual(['  ']);expect(commands[1].notes.fixes).toEqual(['x'.repeat(1001)]);expect(commands[2].notes.fixes).toEqual(['  First fixes note  ','Second fixes note']);expect(new Set(commands.map(command=>command.operationId)).size).toBe(3);
});

test('@golden multiline unknown-outcome retry keeps the exact normalized request snapshot',async({page})=>{
 await mount(page,'?uncertain=1');await page.getByText('Owner: manage website update notes',{exact:true}).click();await typeTwoNotes(page,'knownLimits');const raw=await page.getByLabel('knownLimits',{exact:true}).inputValue();await page.getByRole('button',{name:'Save working notes',exact:true}).click();await expect(page.getByRole('button',{name:'Confirm same saved attempt',exact:true})).toBeVisible();await expect(page.getByLabel('knownLimits',{exact:true})).toBeDisabled();await expect(page.getByLabel('knownLimits',{exact:true})).toHaveValue(raw);
 await page.getByRole('button',{name:'Confirm same saved attempt',exact:true}).click();await expect(page.getByText('Working notes saved; no release published.')).toBeVisible();const bodies=await page.evaluate(()=>(window as typeof window & {releaseRequests:string[]}).releaseRequests);expect(bodies).toHaveLength(2);expect(bodies[0]).toBe(bodies[1]);expect(JSON.parse(bodies[0]).websiteRelease.notes.knownLimits).toEqual(['  First knownLimits note  ','Second knownLimits note']);await expect(page.getByLabel('knownLimits',{exact:true})).toHaveValue('First knownLimits note\nSecond knownLimits note');
});

test('@golden multiline released narrative correction retains version date source and candidate identity',async({page})=>{
 await mount(page,'?releasedOwner=1&persistNotes=1');await page.getByText('Owner: manage website update notes',{exact:true}).click();await typeTwoNotes(page,'improvements');await page.getByRole('button',{name:'Save narrative correction',exact:true}).click();await expect(page.getByText('Notes saved',{exact:true})).toBeVisible();const bodies=await page.evaluate(()=>(window as typeof window & {releaseRequests:string[]}).releaseRequests);expect(bodies).toHaveLength(1);expect(JSON.parse(bodies[0]).websiteRelease).toMatchObject({version:'0.0.2',publish:true,sourceSha:'a'.repeat(40),candidateSha:'b'.repeat(40),expectedUpdatedAt:'2026-10-30T00:00:00Z'});
 const records=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('synthetic-website-release-records')!));expect(records).toHaveLength(2);expect(records.find((row:{version:string})=>row.version==='0.0.2')).toMatchObject({id:'20000000-0000-4000-8000-000000000002',version:'0.0.2',shippedAt:'2026-10-30T00:00:00Z',sourceSha:'a'.repeat(40),candidateSha:'b'.repeat(40),notes:{improvements:['First improvements note','Second improvements note'],fixes:['Original correction'],knownLimits:[]}});
 await page.reload();await boot(page);await expect(page.getByRole('heading',{name:'0.0.2 — Latest release',exact:true})).toBeVisible();await expect(page.locator('time').first()).toHaveAttribute('datetime','2026-10-30T00:00:00Z');await expect(page.getByText('Source '+'a'.repeat(40),{exact:true})).toBeVisible();await expect(page.getByRole('listitem').filter({hasText:/First improvements note|Second improvements note/})).toHaveText(['First improvements note','Second improvements note']);await page.getByText('Owner: manage website update notes',{exact:true}).click();await expect(page.getByLabel('Version',{exact:true})).toHaveValue('0.0.2');await expect(page.getByLabel('improvements',{exact:true})).toHaveValue('First improvements note\nSecond improvements note');expect(await page.evaluate(()=>(window as typeof window & {releaseRequests:string[]}).releaseRequests)).toEqual([]);
});
