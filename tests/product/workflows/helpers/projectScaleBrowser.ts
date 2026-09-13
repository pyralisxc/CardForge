import { expect, type Page } from '@playwright/test';

import { createProjectScaleFixture } from '../../../fixtures/projectScale';

export type ProjectScale = 100 | 500 | 1000;

const BROWSER_DATABASE = 'cardforge-browser-storage';
const BROWSER_STORE = 'key-value';
const LOCAL_WORKSPACE_SCOPES = ['guest', 'local'] as const;

const workspaceStateFor = (
  cardCount: ProjectScale,
  additionalSets = 0,
  staleToolTemplate = false,
  catalogToolTemplates = false,
  templateContent = false,
  mixedTemplates = false,
  needsWorkFixture = false,
) => {
  const fixture = createProjectScaleFixture(cardCount);
  if (needsWorkFixture) {
    fixture.userTemplates[0]!.fieldContracts = [
      ...(fixture.userTemplates[0]!.fieldContracts ?? []),
      { key: 'requiredFixture', elementId: 'required-fixture', label: 'Required Fixture', type: 'text', required: true },
    ];
  }
  const staleTemplate = { ...fixture.userTemplates[0]!, id: 'unrelated-template', name: 'Unrelated Template' };
  const backingTemplate = { ...fixture.userTemplates[0]!, id: 'scale-back', name: 'Scale Fixture Back', templateUsage: 'back-preset' as const };
  const mixedTemplate = { ...fixture.userTemplates[0]!, id: 'scale-template-variant', name: 'Scale Fixture Variant Template' };
  if (templateContent) {
    for (const template of [fixture.userTemplates[0]!, backingTemplate]) {
      template.freeformCanvas = { ...template.freeformCanvas!, elements: [{
        id: `${template.id}-heading`, name: 'Template heading', type: 'text',
        x: 30, y: 40, width: 570, height: 150, zIndex: 1,
        content: template.name, fontSizePx: 50, textColor: '#234567',
      }] };
    }
  }
  const initialTemplateId = staleToolTemplate ? staleTemplate.id : fixture.userTemplates[0]?.id ?? null;
  const storedCards: typeof fixture.storedCards = fixture.storedCards.map((card, index) => ({
    ...card,
    ...(staleToolTemplate ? { backingTemplateId: backingTemplate.id } : {}),
    ...(mixedTemplates && index === 1 ? { templateId: mixedTemplate.id } : {}),
    data: {
      ...card.data,
      artwork: `cardforge-browser-asset://${(index + 1).toString(16).padStart(64, '0')}`,
    },
  }));
  const cardSets = [
    ...fixture.cardSets,
    ...Array.from({ length: additionalSets }, (_, index) => ({
      id: `touch-companion-${index + 1}`,
      name: `Touch Companion Set ${index + 1}`,
      organization: { arrangement: 'manual' as const, groupBy: 'none' as const, sort: 'manual' as const, tags: [], positions: {} },
    })),
  ];
  const userTemplates = catalogToolTemplates
    ? [staleTemplate]
    : [
        ...fixture.userTemplates,
        ...(mixedTemplates ? [mixedTemplate] : []),
        ...(staleToolTemplate ? [staleTemplate, backingTemplate] : []),
      ];
  return {
    userTemplates,
    appearanceStyles: fixture.appearanceStyles,
    storedCards,
    cardSets,
    activeCardSet: cardSets[0] ?? null,
    studioView: 'template',
    generatorSelectedTemplateId: initialTemplateId,
    generatorSelectedBackingTemplateId: null,
    templateEditorSelectedTemplateId: initialTemplateId,
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

export const seedGuestScaleWorkspace = async (page: Page, cardCount: ProjectScale, options: {
  additionalSets?: number;
  staleToolTemplate?: boolean;
  catalogToolTemplates?: boolean;
  templateContent?: boolean;
  cardLimit?: number;
  exportSample?: boolean;
  mixedTemplates?: boolean;
  needsWorkFixture?: boolean;
} = {}) => {
  const previewShareUrl = process.env.CARDFORGE_E2E_PREVIEW_SHARE_URL;
  if (previewShareUrl) await page.goto(previewShareUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.goto('/robots.txt', { waitUntil: 'domcontentloaded' });
  const state = workspaceStateFor(
    cardCount,
    options.additionalSets,
    options.staleToolTemplate,
    options.catalogToolTemplates,
    options.templateContent,
    options.mixedTemplates,
    options.needsWorkFixture,
  );
  if (options.cardLimit !== undefined) state.storedCards = state.storedCards.slice(0, options.cardLimit);
  if (options.exportSample) {
    for (const template of state.userTemplates) {
      template.freeformCanvas!.elements.push({
        id: `${template.id}-title`, name: 'Card title', type: 'text',
        x: 25, y: 550, width: 580, height: 100, zIndex: 2,
        content: '{{cardName}}', fontSizePx: 40, textColor: '#234567',
      });
    }
    state.storedCards = state.storedCards.map((card) => ({ ...card, backingData: { ...card.data, cardName: `Back · ${card.data.cardName}` } }));
  }
  await page.evaluate(async ({ databaseName, objectStoreName, scopes, stateValue }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(objectStoreName)) request.result.createObjectStore(objectStoreName);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const persistedValue = JSON.stringify({ state: stateValue, version: 4 });
    const record = JSON.stringify({
      cardforgeWorkspaceRecord: 1,
      revision: 1,
      writerId: `playwright-scale-${stateValue.storedCards.length}`,
      value: persistedValue,
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(objectStoreName, 'readwrite');
      const store = transaction.objectStore(objectStoreName);
      scopes.forEach((scope) => store.put(record, `project-workspace:${scope}:workspace`));
      stateValue.storedCards.forEach((card, index) => {
        const reference = typeof card.data.artwork === 'string' ? card.data.artwork : '';
        const assetId = reference.replace('cardforge-browser-asset://', '');
        const marks = Array.from({ length: 36 }, (_, mark) => `<circle cx="${(mark * 83 + index * 17) % 512}" cy="${(mark * 137 + index * 29) % 720}" r="${12 + (mark % 22)}" fill="#4f7dc8" fill-opacity="0.42"/>`).join('');
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="720"><rect width="512" height="720" fill="#101723"/>${marks}<text x="24" y="680" fill="white" font-size="42">Artifact ${index + 1}</text></svg>`;
        scopes.forEach((scope) => {
          store.put(new Blob([svg], { type: 'image/svg+xml' }), `project-content-asset:${scope}:${assetId}`);
        });
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  }, {
    databaseName: BROWSER_DATABASE,
    objectStoreName: BROWSER_STORE,
    scopes: LOCAL_WORKSPACE_SCOPES,
    stateValue: state,
  });
};

export const openScaleSet = async (page: Page, cardCount: ProjectScale, options: { expectOpeningMotion?: boolean } = {}) => {
  const startedAt = Date.now();
  const setButton = page.getByRole('button', { name: new RegExp(`^(Select|Selected) ${cardCount} Card Scale Set`) });
  const persistentPreview = page.locator('[data-scene-artifact="scale-card-1"]');
  await setButton.click();
  await expect(setButton).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-desk="overview"]')).toBeVisible();
  await setButton.press('Enter');
  if (options.expectOpeningMotion) {
    await expect(persistentPreview).toHaveAttribute('data-scene-depth', 'board');
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
