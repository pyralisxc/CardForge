import { expect, type Page } from '@playwright/test';

import { createProjectScaleFixture } from '../../../fixtures/projectScale';

export type ProjectScale = 100 | 500 | 1000;

const BROWSER_DATABASE = 'cardforge-browser-storage';
const BROWSER_STORE = 'key-value';
const GUEST_WORKSPACE_KEY = 'project-workspace:guest:workspace';

const workspaceStateFor = (cardCount: ProjectScale) => {
  const fixture = createProjectScaleFixture(cardCount);
  const storedCards = fixture.storedCards.map((card, index) => ({
    ...card,
    data: {
      ...card.data,
      artwork: `cardforge-browser-asset://${(index + 1).toString(16).padStart(64, '0')}`,
    },
  }));
  return {
    userTemplates: fixture.userTemplates,
    appearanceStyles: fixture.appearanceStyles,
    storedCards,
    cardSets: fixture.cardSets,
    activeCardSet: fixture.cardSets[0] ?? null,
    studioView: 'template',
    singleCardGeneratorSelectedTemplateId: fixture.userTemplates[0]?.id ?? null,
    singleCardGeneratorSelectedBackingTemplateId: null,
    templateEditorSelectedTemplateId: fixture.userTemplates[0]?.id ?? null,
    ...fixture.exportSettings,
  };
};

export const installBrowserPerformanceObservers = async (page: Page) => {
  await page.addInitScript(() => {
    const target = window as typeof window & {
      __cardforgeLongTasks?: number[];
      __cardforgeObjectUrls?: { active: number; created: number; revoked: number };
    };
    target.__cardforgeLongTasks = [];
    target.__cardforgeObjectUrls = { active: 0, created: 0, revoked: 0 };
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((entries) => {
          for (const entry of entries.getEntries()) target.__cardforgeLongTasks?.push(entry.duration);
        });
        observer.observe({ type: 'longtask', buffered: true });
      } catch {
        // Older browsers still provide the latency and DOM/heap evidence below.
      }
    }
    const createObjectURL = URL.createObjectURL.bind(URL);
    const revokeObjectURL = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (object) => {
      const url = createObjectURL(object);
      if (target.__cardforgeObjectUrls) {
        target.__cardforgeObjectUrls.created += 1;
        target.__cardforgeObjectUrls.active += 1;
      }
      return url;
    };
    URL.revokeObjectURL = (url) => {
      if (target.__cardforgeObjectUrls) {
        target.__cardforgeObjectUrls.revoked += 1;
        target.__cardforgeObjectUrls.active = Math.max(0, target.__cardforgeObjectUrls.active - 1);
      }
      revokeObjectURL(url);
    };
  });
};

export const seedGuestScaleWorkspace = async (page: Page, cardCount: ProjectScale) => {
  await page.goto('/robots.txt', { waitUntil: 'domcontentloaded' });
  const state = workspaceStateFor(cardCount);
  await page.evaluate(async ({ databaseName, objectStoreName, storageKey, stateValue }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(objectStoreName)) request.result.createObjectStore(objectStoreName);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const persistedValue = JSON.stringify({ state: stateValue, version: 3 });
    const record = JSON.stringify({
      cardforgeWorkspaceRecord: 1,
      revision: 1,
      writerId: `playwright-scale-${stateValue.storedCards.length}`,
      value: persistedValue,
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(objectStoreName, 'readwrite');
      const store = transaction.objectStore(objectStoreName);
      store.put(record, storageKey);
      stateValue.storedCards.forEach((card, index) => {
        const reference = typeof card.data.artwork === 'string' ? card.data.artwork : '';
        const assetId = reference.replace('cardforge-browser-asset://', '');
        const marks = Array.from({ length: 36 }, (_, mark) => `<circle cx="${(mark * 83 + index * 17) % 512}" cy="${(mark * 137 + index * 29) % 720}" r="${12 + (mark % 22)}" fill="#4f7dc8" fill-opacity="0.42"/>`).join('');
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="720"><rect width="512" height="720" fill="#101723"/>${marks}<text x="24" y="680" fill="white" font-size="42">Artifact ${index + 1}</text></svg>`;
        store.put(new Blob([svg], { type: 'image/svg+xml' }), `project-content-asset:guest:${assetId}`);
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  }, {
    databaseName: BROWSER_DATABASE,
    objectStoreName: BROWSER_STORE,
    storageKey: GUEST_WORKSPACE_KEY,
    stateValue: state,
  });
};

export const openScaleSet = async (page: Page, cardCount: ProjectScale, options: { expectOpeningMotion?: boolean } = {}) => {
  const startedAt = Date.now();
  const setButton = page.getByRole('button', { name: new RegExp(`^(Select|Selected) ${cardCount} Card Scale Set`) });
  await setButton.click();
  await expect(setButton).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-desk="overview"]')).toBeVisible();
  await setButton.press('Enter');
  if (options.expectOpeningMotion) {
    await expect(page.locator('[data-set-object][data-opening-motion="true"]')).toBeVisible();
  }
  await expect(page.locator('[data-focus-transition="set-to-artifacts"]')).toBeVisible();
  await expect(page.locator('[data-desk-artifact-stage]')).toBeVisible();
  return Date.now() - startedAt;
};

export const closeScaleSet = async (page: Page) => {
  const startedAt = Date.now();
  await page.getByRole('button', { name: 'Back to Desk' }).click();
  await expect(page.locator('[data-desk="overview"]')).toBeVisible();
  return Date.now() - startedAt;
};

export const resetLongTasks = async (page: Page) => page.evaluate(() => {
  const target = window as typeof window & { __cardforgeLongTasks?: number[] };
  target.__cardforgeLongTasks = [];
});

export const readBrowserPerformanceEvidence = async (page: Page) => page.evaluate(() => {
  const target = window as typeof window & {
    __cardforgeLongTasks?: number[];
    __cardforgeObjectUrls?: { active: number; created: number; revoked: number };
  };
  const longTasks = target.__cardforgeLongTasks ?? [];
  return {
    longTaskCount: longTasks.length,
    maxLongTaskMs: Math.max(0, ...longTasks),
    totalLongTaskMs: longTasks.reduce((total, duration) => total + duration, 0),
    objectUrls: target.__cardforgeObjectUrls ?? { active: 0, created: 0, revoked: 0 },
    domNodes: document.getElementsByTagName('*').length,
  };
});
