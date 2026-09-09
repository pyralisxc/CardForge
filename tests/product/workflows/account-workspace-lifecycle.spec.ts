import path from 'node:path';
import { build } from 'esbuild';
import { expect, test } from '@playwright/test';
import { createProjectScaleFixture } from '../../fixtures/projectScale';
import type { prepareAccountProjectWorkspace } from '@/features/project/client/accountProjectWorkspace';
import type { useProjectStore, persistProjectWorkspaceNow } from '@/features/project/store/workspaceStore';
import type { adoptGuestWorkspaceForAccount } from '@/features/project/persistence/guestWorkspaceAdoption';
import type { hydrateProjectWorkspaceForScope } from '@/features/project/store/workspaceStore';

test('@golden native owner → guest startup → same owner resumes saved authored work', async ({ page }, testInfo) => {
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
