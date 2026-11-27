import path from 'node:path';
import { build } from 'esbuild';
import { expect, test } from '@playwright/test';
import { createProjectScaleFixture } from '../../fixtures/projectScale';
import type { prepareAccountProjectWorkspace } from '@/features/project/client/accountProjectWorkspace';
import type { useProjectStore, persistProjectWorkspaceNow } from '@/features/project/store/workspaceStore';
import type { adoptGuestWorkspaceForAccount } from '@/features/project/persistence/guestWorkspaceAdoption';
import type { hydrateProjectWorkspaceForScope } from '@/features/project/store/workspaceStore';

test('@golden @preview native owner → guest startup → same owner resumes saved authored work', async ({ page }, testInfo) => {
  // Bundle the real startup owner into a disposable browser page. No auth mock,
  // injected storage implementation, production test route, or provider session.
  const bundle = await build({
    stdin: { contents: `export { prepareAccountProjectWorkspace as prepare } from './src/features/project/client/accountProjectWorkspace';
      import { useProjectStore } from './src/features/project/store/workspaceStore';
      export { persistProjectWorkspaceNow as persist } from './src/features/project/store/workspaceStore';
      export { hydrateProjectWorkspaceForScope as hydrate } from './src/features/project/store/workspaceStore';
      export { adoptGuestWorkspaceForAccount as adopt } from './src/features/project/persistence/guestWorkspaceAdoption';
      export const state = useProjectStore.getState;
      export const update = useProjectStore.setState;`, resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, write: false, format: 'iife', globalName: 'workspaceHarness', platform: 'browser',
    tsconfig: path.resolve('tsconfig.json'), define: { 'process.env.NODE_ENV': '"test"' }, logLevel: 'silent',
  });
  await page.route('**/robots.txt', route => route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));
  await page.goto('/robots.txt');
  const fixture = createProjectScaleFixture(100);
  fixture.storedCards = fixture.storedCards.slice(0, 2);
  await page.evaluate(async (project) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('cardforge-browser-storage', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('key-value');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('key-value', 'readwrite');
      transaction.objectStore('key-value').put(JSON.stringify({ state: { ...project, activeCardSet: project.cardSets[0] }, version: 4 }), 'project-workspace:account:native-owner:workspace');
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  }, fixture);
  await page.addScriptTag({ content: bundle.outputFiles[0]!.text });
  const result = await page.evaluate(async (defaultTemplate) => {
    const harness = (window as typeof window & { workspaceHarness: {
      prepare: typeof prepareAccountProjectWorkspace;
      state: typeof useProjectStore.getState;
      update: typeof useProjectStore.setState;
      persist: typeof persistProjectWorkspaceNow;
      adopt: typeof adoptGuestWorkspaceForAccount;
      hydrate: typeof hydrateProjectWorkspaceForScope;
    } }).workspaceHarness;
    await harness.prepare('account:native-owner');
    await harness.persist();
    const before = harness.state().storedCards.map((card) => card.uniqueId);
    await harness.prepare('guest');
    // Real guest catalog startup updates the store even without authored Sets.
    harness.update({ defaultTemplates: [defaultTemplate] });
    await harness.persist();
    const guestCards = harness.state().storedCards.length;
    await harness.prepare('account:native-owner');
    const after = harness.state().storedCards.map((card) => card.uniqueId);
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    const controller = new AbortController();
    const stale = harness.prepare('account:stale-startup', {
      adopt: async (scope, signal) => { await blocked; return harness.adopt(scope, signal); },
      hydrate: harness.hydrate,
    }, controller.signal).then(() => 'completed', (error: DOMException) => error.name);
    controller.abort();
    await harness.prepare('account:native-owner');
    release();
    const staleResult = await stale;
    return { before, guestCards, after, afterStale: harness.state().storedCards.map((card) => card.uniqueId), staleResult, setIds: harness.state().cardSets.map((set) => set.id) };
  }, fixture.userTemplates[0]!);
  expect(result.guestCards).toBe(0);
  expect(result.after).toEqual(result.before);
  expect(result.afterStale).toEqual(result.before);
  expect(result.staleResult).toBe('AbortError');
  expect(result.setIds).toEqual(['scale-set-100']);
  await testInfo.attach('native-account-lifecycle', { body: JSON.stringify(result), contentType: 'application/json' });
});

test('@golden @preview untouched tabs do not write catalog no-ops and dismissed conflicts retain native CAS protection', async ({ context }, testInfo) => {
  const bundle = await build({
    stdin: { contents: `
      import React from 'react'; import {createRoot} from 'react-dom/client';
      import {AccountProjectWorkspaceBoundary} from './src/features/project/components/AccountProjectWorkspaceBoundary';
      import {useProjectStore,persistProjectWorkspaceNow} from './src/features/project/store/workspaceStore';
      import {getBrowserWorkspaceSaveStatus} from './src/features/project/persistence/indexedDbStorage';
      const events=[];
      for(const name of ['cardforge:workspace-conflict','cardforge:workspace-remote-change'])window.addEventListener(name,event=>events.push({name,detail:event.detail}));
      Object.assign(window,{workspaceProof:{
        setup:async()=>{useProjectStore.getState().createCardSet('Disposable empty Set');await persistProjectWorkspaceNow();},
        background:()=>useProjectStore.getState().setAppearanceStylesFromFiles([]),
        sameView:()=>useProjectStore.getState().setStudioView(useProjectStore.getState().studioView),
        rename:name=>useProjectStore.getState().renameCardSet(useProjectStore.getState().cardSets[0].id,name),
        explicit:()=>persistProjectWorkspaceNow().then(()=>null,error=>({expected:error.expectedRevision,actual:error.actualRevision})),
        state:()=>({events,status:getBrowserWorkspaceSaveStatus(),sets:useProjectStore.getState().cardSets,cards:useProjectStore.getState().storedCards})
      }});
      createRoot(document.body.appendChild(document.createElement('div'))).render(<AccountProjectWorkspaceBoundary persistenceScope="account:disposable-conflict" canUseProjectFiles={false}><p id="ready">Workspace ready</p></AccountProjectWorkspaceBoundary>);
    `, resolveDir: process.cwd(), loader: 'tsx' }, bundle:true,write:false,format:'iife',platform:'browser',
    define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},logLevel:'silent',
  });
  const unexpected:string[]=[];
  await context.route('**/*',route=>{
    if(new URL(route.request().url()).pathname==='/__workspace-conflict')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'});
    unexpected.push(route.request().url());return route.abort();
  });
  type Proof = {setup:()=>Promise<void>;background:()=>void;sameView:()=>void;rename:(name:string)=>void;explicit:()=>Promise<null|{expected:number;actual:number}>;state:()=>{events:unknown[];status:string;sets:{name:string}[];cards:unknown[]}};
  const boot=async()=>{const page=await context.newPage();await page.goto('/__workspace-conflict');await page.addScriptTag({content:bundle.outputFiles[0]!.text});await expect(page.locator('#ready')).toBeVisible();return page;};
  const a=await boot();
  await a.evaluate(()=> (window as typeof window & {workspaceProof:Proof}).workspaceProof.setup());
  const b=await boot();
  const read=()=>a.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const q=indexedDB.open('cardforge-browser-storage');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
    const value=await new Promise<string>((resolve,reject)=>{const q=db.transaction('key-value').objectStore('key-value').get('project-workspace:account:disposable-conflict:workspace');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});db.close();return JSON.parse(value) as {revision:number;value:string};
  });
  const baseline=await read();
  await a.evaluate(()=> (window as typeof window & {workspaceProof:Proof}).workspaceProof.background());
  await b.evaluate(()=> {const p=(window as typeof window & {workspaceProof:Proof}).workspaceProof;p.background();p.sameView();});
  // Allow the native queued IDB transactions and BroadcastChannel delivery to settle.
  await b.waitForTimeout(300);
  expect(await read()).toEqual(baseline);
  await expect(b.getByRole('alertdialog')).toHaveCount(0);
  expect((await b.evaluate(()=> (window as typeof window & {workspaceProof:Proof}).workspaceProof.state())).status).toBe('saved');
  await a.evaluate(()=> (window as typeof window & {workspaceProof:Proof}).workspaceProof.rename('Remote authored rename'));
  await expect(b.getByRole('alertdialog')).toContainText('A newer workspace is available');
  await b.getByRole('button',{name:'Keep this tab open',exact:true}).click();
  const firstConflict=await b.evaluate(()=> (window as typeof window & {workspaceProof:Proof}).workspaceProof.explicit());
  expect(firstConflict).toEqual({expected:baseline.revision,actual:baseline.revision+1});
  await expect(b.getByRole('alertdialog')).toContainText('This workspace was not saved');
  await b.getByRole('button',{name:'Keep this tab open',exact:true}).click();
  expect(await b.evaluate(()=> (window as typeof window & {workspaceProof:Proof}).workspaceProof.explicit())).toEqual(firstConflict);
  await b.evaluate(()=> (window as typeof window & {workspaceProof:Proof}).workspaceProof.sameView());
  await b.waitForTimeout(300);
  await expect(b.getByRole('alertdialog')).toHaveCount(0);
  await expect(b.locator('[data-account-workspace-issue="conflict"]')).toBeVisible();
  await b.getByRole('button',{name:'Review',exact:true}).click();await expect(b.getByRole('alertdialog')).toBeVisible();
  await b.getByRole('button',{name:'Keep this tab open',exact:true}).click();
  await a.evaluate(()=> (window as typeof window & {workspaceProof:Proof}).workspaceProof.rename('Materially newer remote rename'));
  await expect(b.getByRole('alertdialog')).toBeVisible();
  const after=await read();const local=await b.evaluate(()=> (window as typeof window & {workspaceProof:Proof}).workspaceProof.state());
  expect(JSON.parse(after.value).state.cardSets[0].name).toBe('Materially newer remote rename');
  expect(local.sets[0].name).toBe('Disposable empty Set');expect(local.cards).toHaveLength(0);expect(local.status).toBe('failed');
  expect(unexpected).toEqual([]);
  await b.screenshot({path:testInfo.outputPath('cross-tab-preservation.png')});
  await testInfo.attach('native-cross-tab-evidence',{body:JSON.stringify({baselineRevision:baseline.revision,firstConflict,finalRevision:after.revision,noOpDidNotWrite:true,local,explicitSaveStillRejects:true}),contentType:'application/json'});
  await testInfo.attach('cross-tab-preservation',{path:testInfo.outputPath('cross-tab-preservation.png'),contentType:'image/png'});
});

test('@golden retained signed-out work remains recoverable after dismissal', async ({ page }) => {
  await page.setViewportSize({width:320,height:700});
  const bundle = await build({stdin:{contents:`import React from 'react'; import {createRoot} from 'react-dom/client'; import {AccountProjectWorkspaceBoundary} from './src/features/project/components/AccountProjectWorkspaceBoundary'; import {LibraryStorageConnectionsTool} from './src/features/storage-management/components/AccountStorageWorkspace'; import {EnvironmentToolLayer} from './src/features/app-shell/environment/components/EnvironmentToolLayer'; import {useProjectStore} from './src/features/project/store/workspaceStore'; window.workspaceProof={state:useProjectStore.getState}; const account=new URL(location.href).searchParams.get('account')||'one'; function App(){const [open,setOpen]=React.useState(false);return <AccountProjectWorkspaceBoundary persistenceScope={'account:'+account} canUseProjectFiles={false}><p>Account ready</p><button onClick={()=>setOpen(true)}>Locations &amp; connections</button>{open&&<EnvironmentToolLayer id="storage-title" eyebrow="Library tool" title="Locations &amp; connections" summary="Storage" closeLabel="Close locations and connections" onClose={()=>setOpen(false)} manageHistory={false}><LibraryStorageConnectionsTool workspaceStorage={<p>Device contents</p>} connectedAssets={null} googleDriveProjects={null} localProjectFolder={null}/></EnvironmentToolLayer>}</AccountProjectWorkspaceBoundary>}; createRoot(document.getElementById('root')).render(<App/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',outdir:'/tmp/cf-guest-proof-assets',define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},logLevel:'silent'});
  await page.route('**/guest-proof*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body><div id="root"></div></body></html>'}));
  await page.goto('/guest-proof');
  const fixture = createProjectScaleFixture(100); fixture.storedCards = fixture.storedCards.slice(0, 2);
  await page.evaluate(async (project)=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('cardforge-browser-storage',1);r.onupgradeneeded=()=>r.result.createObjectStore('key-value');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise<void>((resolve,reject)=>{const tx=db.transaction('key-value','readwrite');const store=tx.objectStore('key-value');const value=JSON.stringify({state:{...project,activeCardSet:project.cardSets[0]},version:4});for(const key of ['project-workspace:account:one:workspace','project-workspace:account:two:workspace','project-workspace:guest:workspace'])store.put(value,key);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();},fixture);
  const readGuest = () => page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('cardforge-browser-storage');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const value=await new Promise<string | undefined>((resolve,reject)=>{const r=db.transaction('key-value').objectStore('key-value').get('project-workspace:guest:workspace');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();return value;});
  const originalGuest = await readGuest();
  const mount = async (account:string) => {await page.goto(`/guest-proof?account=${account}`);const css=bundle.outputFiles.find(file=>file.path.endsWith('.css'));if(css)await page.addStyleTag({content:css.text});await page.addScriptTag({content:bundle.outputFiles.find(file=>file.path.endsWith('.js'))!.text});await expect(page.getByText('Account ready')).toBeVisible();};
  await mount('one');
  await expect(page.getByText('Signed-out work is still available')).toBeVisible();
  await page.getByRole('button',{name:'Keep separate'}).click();
  await mount('one');
  await expect(page.getByText('Signed-out work is still available')).toHaveCount(0);
  expect(await readGuest()).toBe(originalGuest);
  await page.getByRole('button',{name:'Locations & connections'}).click();
  await page.locator('#environment-object-browser-workspace').click();
  await page.getByRole('button',{name:'Review signed-out work'}).click();
  await expect(page.getByText('Signed-out work is still available')).toBeVisible();
  await expect(page.getByText('Signed-out work is still available')).toBeFocused();
  await expect(page.locator('[data-desk-tool-surface]').getByRole('button',{name:'Add to this account'})).toBeVisible();
  await page.getByRole('button',{name:'Keep separate'}).click();
  await mount('two');
  await expect(page.getByText('Signed-out work is still available')).toBeVisible();
  await page.getByRole('button',{name:'Keep separate'}).click();
  await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('cardforge-browser-storage');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise<void>((resolve,reject)=>{const tx=db.transaction('key-value','readwrite');const store=tx.objectStore('key-value');const request=store.get('project-workspace:guest:workspace');request.onsuccess=()=>{const payload=JSON.parse(request.result);payload.state.cardSets[0].name='A different signed-out snapshot';store.put(JSON.stringify(payload),'project-workspace:guest:workspace');};tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();});
  await mount('two');
  await expect(page.getByText('Signed-out work is still available')).toBeVisible();
  await page.getByRole('button',{name:'Keep separate'}).click();
  await expect(page.getByText('Signed-out work is still available')).toHaveCount(0);
  await page.getByRole('button',{name:'Locations & connections'}).click();
  await page.locator('#environment-object-browser-workspace').click();
  await page.getByRole('button',{name:'Review signed-out work'}).click();
  await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('cardforge-browser-storage');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise<void>((resolve,reject)=>{const tx=db.transaction('key-value','readwrite');const store=tx.objectStore('key-value');const request=store.get('project-workspace:guest:workspace');request.onsuccess=()=>{const payload=JSON.parse(request.result);payload.state.cardSets[0].name='Latest signed-out snapshot';store.put(JSON.stringify(payload),'project-workspace:guest:workspace');};tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();});
  await page.locator('[data-desk-tool-surface]').getByRole('button',{name:'Add to this account'}).click();
  await expect(page.locator('[data-desk-tool-surface]').getByRole('alert')).toContainText('Signed-out work changed. Review the updated work');
  await expect(page.locator('[data-desk-tool-surface]')).toContainText('Latest signed-out snapshot');
  expect(await page.evaluate(() => (window as unknown as {workspaceProof:{state:()=>{cardSets:unknown[]}}}).workspaceProof.state().cardSets.length)).toBe(1);
  await page.locator('[data-desk-tool-surface]').getByRole('button',{name:'Add to this account'}).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as {workspaceProof:{state:()=>{cardSets:unknown[]}}}).workspaceProof.state().cardSets.length)).toBe(2);
  await expect(page.getByText('Signed-out work is still available')).toHaveCount(0);
  const state=await page.evaluate(()=> (window as unknown as {workspaceProof:{state:()=>{cardSets:{id:string;name:string}[];storedCards:{uniqueId:string}[]}}}).workspaceProof.state());
  expect(state.cardSets).toHaveLength(2);
  expect(state.cardSets.some(set=>set.name==='Latest signed-out snapshot' && set.id!=='scale-set-100')).toBe(true);
  expect(new Set(state.storedCards.map(card=>card.uniqueId)).size).toBe(4);
  expect(await readGuest()).toBeUndefined();
  await mount('two');
  const reopened=await page.evaluate(()=> (window as unknown as {workspaceProof:{state:()=>{cardSets:{name:string}[]}}}).workspaceProof.state());
  expect(reopened.cardSets.map(set=>set.name)).toContain('Latest signed-out snapshot');
  await expect(page.getByText('Signed-out work is still available')).toHaveCount(0);
});
