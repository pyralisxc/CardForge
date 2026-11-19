import { expect, test } from '@playwright/test';
import { createProjectScaleFixture } from '../../fixtures/projectScale';
import { buildCardForgeProjectSnapshot, createCardForgeProjectPackageBlob } from '@/features/project/lib/projectPackageCodec';
import { seedGuestScaleWorkspace } from './helpers/projectScaleBrowser';

test.use({ trace: 'retain-on-failure' });

for (const surface of ['desk', 'library'] as const) {
  test(`@golden ${surface} restores remembered folder work and shows conflicts inside the compact inspector`, async ({ page }) => {
    test.setTimeout(120_000);
    page.on('pageerror', (error) => console.log(`local-folder-opening pageerror: ${error.message}`));
    page.on('crash', () => console.log(`local-folder-opening page crashed: ${surface} ${page.url()}`));
    page.on('close', () => console.log(`local-folder-opening page closed: ${surface} ${page.url()}`));
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) console.log(`local-folder-opening navigation: ${surface} ${frame.url()}`);
    });
    await page.addInitScript(() => {
      if (typeof Reflect.get(window, 'showDirectoryPicker') !== 'function') {
        Object.defineProperty(window, 'showDirectoryPicker', {
          configurable: true,
          value: () => Promise.reject(new DOMException('The native picker is not used by this fixture.', 'AbortError')),
        });
      }
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await seedGuestScaleWorkspace(page, 100, { cardLimit: 2 });
    const document = createProjectScaleFixture(100);
    document.cardSets[0]!.name = 'Saved folder Set';
    const snapshot = await buildCardForgeProjectSnapshot({ document, name: 'Saved folder Set' });
    const blob = await createCardForgeProjectPackageBlob(snapshot);
    const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
    const workId = 'folder-restored-set';
    // A genuine OPFS handle exercises browser persistence, not the native picker.
    await page.evaluate(async ({ bytes, workId }) => {
      const root = await navigator.storage.getDirectory();
      const handle = await root.getDirectoryHandle('folder-opening-fixture', { create: true });
      const file = await handle.getFileHandle('project.cardforge', { create: true });
      const writable = await file.createWritable();
      await writable.write(new Uint8Array(bytes));
      await writable.close();
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('cardforge-browser-storage');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction('key-value', 'readwrite');
        const store = transaction.objectStore('key-value');
        for (const scope of ['guest', 'local']) {
          store.put([workId], `project-assets:${scope}:local-work-folder-binding-index`);
          store.put({ handle, workId, folderName: 'Saved folder Set', sourceRevision: 'a'.repeat(64), lastSavedAt: null, packageScope: 'set' }, `project-assets:${scope}:local-work-folder-binding:${workId}`);
        }
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    }, { bytes, workId });
    const href = surface === 'desk' ? '/account' : '/account?section=library&scope=personal';
    const inspect = async () => {
      if (surface === 'desk') {
        await page.getByRole('button', { name: 'Actions for Saved folder Set', exact: true }).click();
        await page.getByRole('menuitem', { name: 'Details', exact: true }).click();
      } else await page.locator('[id^="library-object-"]').filter({ hasText: 'Saved folder Set' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
    };
    await page.goto(href, { waitUntil: 'domcontentloaded' });
    await inspect();
    const detail = page.getByRole('dialog');
    await expect(detail.getByText('Saved file · not loaded', { exact: true })).toBeVisible();
    expect(await detail.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await detail.getByRole('button', { name: 'Open saved Set', exact: true }).click();
    await expect(detail.getByRole('alert')).toContainText('folder has changed');
    await expect(detail).toBeVisible();
    await page.evaluate(async ({ workId, revision }) => {
      const database = await new Promise<IDBDatabase>((resolve) => {
        const request = indexedDB.open('cardforge-browser-storage');
        request.onsuccess = () => resolve(request.result);
      });
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction('key-value', 'readwrite');
        const store = transaction.objectStore('key-value');
        for (const scope of ['guest', 'local']) {
          const key = `project-assets:${scope}:local-work-folder-binding:${workId}`;
          const request = store.get(key);
          request.onsuccess = () => store.put({ ...request.result, sourceRevision: revision }, key);
        }
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    }, { workId, revision: snapshot.manifest.projectRevision });
    await page.goto(href, { waitUntil: 'domcontentloaded' });
    await inspect();
    await detail.getByRole('button', { name: 'Open saved Set', exact: true }).click();
    await expect(page.locator('[data-set-spatial-stage] button[data-artifact-id]')).toHaveCount(100);
    await expect(page.getByRole('region', { name: 'Locations & connections', exact: true })).toHaveCount(0);
    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /^Select 100 Card Scale Set\./ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Select Saved folder Set\./ })).toHaveCount(1);
  });
}
