import { expect, test } from '@playwright/test';
import { createProjectScaleFixture } from '../../fixtures/projectScale';
import { buildCardForgeProjectSnapshot, createCardForgeProjectPackageBlob, decodeCardForgeProjectPackage, hydrateCardForgeProjectSnapshot } from '@/features/project/lib/projectPackageCodec';
import { seedGuestScaleWorkspace } from './helpers/projectScaleBrowser';
import { mapProjectDocumentIdentity } from '@/features/project/model/projectDocumentIdentity';

// Exercise persisted native handles in Chrome Stable, not the bundled Chromium build.
test.use({ channel: 'chrome', trace: 'retain-on-failure' });

for (const surface of ['desk', 'library', 'library-edit'] as const) {
  test(`@golden ${surface} restores remembered folder work and shows conflicts inside the compact inspector`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await seedGuestScaleWorkspace(page, 100, { cardLimit: 2 });
    const href = surface === 'desk' ? '/account' : '/account?section=library&scope=personal';
    await page.goto(href, { waitUntil: 'domcontentloaded' });
    // The collection is already mounted before the folder link changes.
    // Source invalidation must update it in place, without a hard reload.
    if (surface === 'desk') {
      await expect(page.getByRole('button', { name: /^Select 100 Card Scale Set\./ })).toBeVisible();
    } else {
      await expect(page.locator('[id^="library-object-"]').filter({ hasText: '100 Card Scale Set' })).toBeVisible();
    }
    const document = createProjectScaleFixture(100);
    document.storedCards = document.storedCards.slice(0, 2);
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
          store.put({ handle, workId, folderName: 'Saved folder Set', sourceRevision: 'a'.repeat(64), lastSavedAt: null, packageScope: 'set', verifiedSetScope: true }, `project-assets:${scope}:local-work-folder-binding:${workId}`);
        }
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
      // Native owner emits this same invalidation after confirmed save/open/
      // reconnect/detach; this fixture exercises the already-mounted consumer.
      window.dispatchEvent(new Event('cardforge:local-folder-changed'));
    }, { bytes, workId });
    const restoreExpectedRevision = async () => {
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
    };
    if (surface === 'desk') {
      // Folder-only work is discoverable in the picker, not yet a Desk tile.
      await page.getByRole('button', { name: 'Add from Library', exact: true }).first().click();
      const picker = page.getByRole('dialog', { name: 'Add from Library' });
      const addSavedSet = () => picker.getByText('Saved folder Set', { exact: true }).locator('../..').getByRole('button', { name: 'Add to Desk', exact: true });
      await addSavedSet().click();
      await expect(picker.getByRole('alert')).toContainText('folder has changed');
      await restoreExpectedRevision();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Add from Library', exact: true }).first().click();
      await addSavedSet().click();
      await expect(picker.getByRole('button', { name: 'Remove Saved folder Set from Desk', exact: true })).toBeEnabled();
      await picker.getByRole('button', { name: 'Done', exact: true }).click();
      const savedSet = page.getByRole('button', { name: /^(Select|Selected) Saved folder Set\./ });
      await savedSet.click();
      await savedSet.press('Enter');
      await expect(page.locator('[data-set-spatial-stage] button[data-artifact-id]')).toHaveCount(2);
      await page.goto('/account', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('button', { name: /^Select 100 Card Scale Set\./ })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Select Saved folder Set\./ })).toHaveCount(1);
      return;
    }
    const inspect = async () => {
      await page.locator('[id^="library-object-"]').filter({ hasText: 'Saved folder Set' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
    };
    await inspect();
    const detail = page.getByRole('dialog');
    await expect(detail.getByText('Saved file · not loaded', { exact: true })).toBeVisible();
    expect(await detail.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    await detail.getByRole('button', { name: 'Open saved Set', exact: true }).click();
    await expect(detail.getByRole('alert')).toContainText('folder has changed');
    await expect(detail).toBeVisible();
    await restoreExpectedRevision();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await inspect();
    await expect(detail).toBeVisible();
    await expect(detail.getByRole('heading', { name: 'Saved folder Set', exact: true })).toBeVisible();
    if (surface === 'library-edit') {
      await detail.getByRole('button', { name: 'Open Set in Library', exact: true }).click();
      await expect(page).toHaveURL(/section=library/);
      await expect(page.getByRole('button', { name: 'Edit Scale Card 0001', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Edit Scale Card 0002', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Save to folder Saved folder Set', exact: true }).click();
      await expect(page.getByText('Saved to folder-opening-fixture.', { exact: true })).toBeVisible();
      const original = await page.evaluate(async () => {
        const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('folder-opening-fixture');
        const file = await (await dir.getFileHandle('project.cardforge')).getFile();
        return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())));
      });
      await page.getByRole('button', { name: 'Save as new copy', exact: true }).click();
      await expect(page.getByText('New folder copy saved', { exact: true })).toBeVisible();
      const evidence = await page.evaluate(async ({ workId }) => {
        const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('folder-opening-fixture');
        const originalFile = await (await dir.getFileHandle('project.cardforge')).getFile();
        const originalHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await originalFile.arrayBuffer())));
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('cardforge-browser-storage');
          request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
        });
        const bindings = await Promise.all(['guest', 'local'].map((scope) => new Promise<{ fileName?: string; portableWorkId?: string } | undefined>((resolve, reject) => {
          const request = database.transaction('key-value').objectStore('key-value').get(`project-assets:${scope}:local-work-folder-binding:${workId}`);
          request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
        })));
        database.close();
        const binding = bindings.find((item) => item?.fileName);
        const fileName = binding?.fileName;
        const newFile = fileName ? await (await dir.getFileHandle(fileName)).getFile() : null;
        return { originalHash, fileName, portableWorkId: binding?.portableWorkId, newBytes: newFile?.size ?? 0 };
      }, { workId });
      expect(evidence.originalHash).toEqual(original);
      expect(evidence.fileName).toMatch(/^project-.*\.cardforge$/);
      expect(evidence.newBytes).toBeGreaterThan(0);
      const changed = mapProjectDocumentIdentity(document, { set: { [document.cardSets[0]!.id]: evidence.portableWorkId! } }, 'open');
      changed.cardSets[0]!.name = 'Newer folder copy';
      const changedSnapshot = await buildCardForgeProjectSnapshot({ document: changed, name: 'Newer folder copy' });
      const changedBytes = Array.from(new Uint8Array(await (await createCardForgeProjectPackageBlob(changedSnapshot)).arrayBuffer()));
      await page.evaluate(async ({ fileName, changedBytes }) => {
        const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('folder-opening-fixture');
        const writable = await (await dir.getFileHandle(fileName!)).createWritable();
        await writable.write(new Uint8Array(changedBytes)); await writable.close();
      }, { fileName: evidence.fileName, changedBytes });
      await page.getByRole('button', { name: 'Save to folder folder-opening-fixture', exact: true }).click();
      const conflict = page.getByRole('alert').filter({ hasText: 'folder file has changed' });
      await expect(conflict).toBeVisible();
      await expect(conflict.getByRole('button', { name: 'Update existing copy', exact: true })).toHaveCount(0);
      await conflict.getByRole('button', { name: 'Save as new copy', exact: true }).click();
      await expect(conflict).toHaveCount(0);
      const preservedChanged = await page.evaluate(async ({ fileName }) => {
        const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('folder-opening-fixture');
        return Array.from(new Uint8Array(await (await (await dir.getFileHandle(fileName!)).getFile()).arrayBuffer()));
      }, { fileName: evidence.fileName });
      expect(preservedChanged).toEqual(changedBytes);
      await expect(page.getByRole('button', { name: 'Edit Scale Card 0001', exact: true })).toBeVisible();
      await expect(page).toHaveURL(/section=library/);
    } else {
      await detail.getByRole('button', { name: 'Open saved Set', exact: true }).click();
      await expect(page.locator('[data-set-spatial-stage] button[data-artifact-id]')).toHaveCount(2);
      if (surface === 'library') {
        // The first handoff must leave the loaded Set ready to edit, not just
        // add a new row that needs another trip through Library.
        await page.getByRole('button', { name: 'Scale Card 0001. Scale Fixture Template', exact: true }).click();
        await page.getByRole('button', { name: 'Edit selected', exact: true }).click();
        await expect(page.getByRole('textbox', { name: 'Artwork (Image URL or Upload)', exact: true })).toBeEditable();
      }
    }
    await expect(page.getByRole('region', { name: 'Locations & connections', exact: true })).toHaveCount(0);
    await page.goto('/account', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /^Select 100 Card Scale Set\./ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Select Saved folder Set\./ })).toHaveCount(1);
    if (surface === 'library-edit') {
      const savedSet = page.getByRole('button', { name: /^(Select|Selected) Saved folder Set\./ });
      await savedSet.click();
      await savedSet.press('Enter');
      await expect(page.getByText('Saved to folder-opening-fixture.', { exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Save to folder folder-opening-fixture', exact: true }).click();
      await expect(page.getByText('Saved to folder-opening-fixture.', { exact: true })).toBeVisible();
      await expect(page.locator('[data-set-spatial-stage]')).toBeVisible();
      await page.getByTitle('Open Locations & connections').click();
      const locations = page.getByRole('region', { name: 'Locations & connections', exact: true });
      await locations.getByRole('button', { name: /This device/ }).click();
      await locations.getByRole('button', { name: 'Move Saved folder Set', exact: true }).click();
      const move = page.getByRole('dialog', { name: 'Move Saved folder Set' });
      await move.getByRole('button', { name: 'Move here', exact: true }).click();
      await expect(page.getByText('Set moved', { exact: true })).toBeVisible();
      const readLinkedFile = async () => await page.evaluate(async ({ workId }) => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('cardforge-browser-storage');
          request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
        });
        const records = await Promise.all(['guest', 'local'].map((scope) => new Promise<{ fileName?: string } | undefined>((resolve, reject) => {
          const request = database.transaction('key-value').objectStore('key-value').get(`project-assets:${scope}:local-work-folder-binding:${workId}`);
          request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
        })));
        database.close();
        const name = records.find((item) => item?.fileName)?.fileName;
        if (!name) throw new Error('The saved folder copy has no file binding.');
        const directory = await (await navigator.storage.getDirectory()).getDirectoryHandle('folder-opening-fixture');
        return Array.from(new Uint8Array(await (await (await directory.getFileHandle(name)).getFile()).arrayBuffer()));
      }, { workId });
      const movedBytes = await readLinkedFile();
      const movedDocument = hydrateCardForgeProjectSnapshot(await decodeCardForgeProjectPackage(new Uint8Array(movedBytes)));
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Add from Library', exact: true }).first().click();
      const picker = page.getByRole('dialog', { name: 'Add from Library' });
      await picker.getByText('Saved folder Set', { exact: true }).locator('../..').getByRole('button', { name: 'Add to Desk', exact: true }).click();
      await expect(picker.getByRole('button', { name: 'Remove Saved folder Set from Desk', exact: true })).toBeEnabled();
      await picker.getByRole('button', { name: 'Done', exact: true }).click();
      const restored = page.getByRole('button', { name: /^(Select|Selected) Saved folder Set\./ });
      await restored.click(); await restored.press('Enter');
      await page.getByRole('button', { name: 'Save to folder folder-opening-fixture', exact: true }).click();
      await expect(page.getByText('Saved to folder-opening-fixture.', { exact: true })).toBeVisible();
      const resavedDocument = hydrateCardForgeProjectSnapshot(await decodeCardForgeProjectPackage(new Uint8Array(await readLinkedFile())));
      expect(resavedDocument.cardSets.map((set) => set.id)).toEqual(movedDocument.cardSets.map((set) => set.id));
      expect(resavedDocument.storedCards.map((card) => [card.uniqueId, card.templateId, card.backingTemplateId])).toEqual(movedDocument.storedCards.map((card) => [card.uniqueId, card.templateId, card.backingTemplateId]));
      expect(resavedDocument.userTemplates.map((template) => template.id)).toEqual(movedDocument.userTemplates.map((template) => template.id));
    }
  });
}
