'use client';

import { nanoid } from 'nanoid';
import type { CardData, CardFace } from '@/domain/cards';
import { compatibleDuplexTemplateTrim } from '@/domain/rendering';
import { createPersonalTemplateFork, type TCGCardTemplate } from '@/domain/templates';
import { buildBrowserCardForgeProjectSnapshot, materializeBrowserProjectSnapshot } from './browserProjectPackage';
import { applyProjectDocumentToWorkspace } from './projectWorkspaceDocument';
import { requireCompleteSingleSet } from './validateSingleSet';
import { createProjectDocumentFromState } from '../model/projectDocument';
import { getProjectPersistenceScope } from '../persistence/projectPersistenceScope';
import { useProjectStore } from '../store/workspaceStore';

/** Create an explicitly requested, independent browser-local test Set. */
export async function openTemplateTestSet({ template, data, face, front, name, signal, assertCurrent }: {
  template: TCGCardTemplate;
  data: CardData;
  face: CardFace;
  front?: TCGCardTemplate;
  name: string;
  signal?: AbortSignal;
  assertCurrent?: () => void;
}): Promise<string> {
  signal?.throwIfAborted();
  const scope = getProjectPersistenceScope();
  if (scope === 'unscoped-disabled') throw new Error('Wait for the browser workspace to finish opening, then try again.');
  if (face === 'back' && (!front || front.templateUsage === 'back-preset')) {
    throw new Error('Choose a front Template for this back before opening its test Set.');
  }
  if (face === 'back' && front && !compatibleDuplexTemplateTrim(front, template)) {
    throw new Error('Choose a front Template matching the size of this back.');
  }
  const expectedState = useProjectStore.getState();
  const selected = { ...createPersonalTemplateFork(structuredClone(template)), templateContributorName: template.templateContributorName,
    ...(face === 'back' ? { templateUsage: 'back-preset' as const } : {}) };
  const primary = face === 'back' ? { ...createPersonalTemplateFork(structuredClone(front!)), templateContributorName: front!.templateContributorName } : selected;
  const setId = `set-${nanoid()}`;
  const setName = name.trim() || 'Template test copy';
  const templates = face === 'back' ? [primary, selected] : [primary];
  const document = createProjectDocumentFromState({
    userTemplates: templates,
    cardSets: [{ id: setId, name: setName, templateIds: templates.map(item => item.id!) }],
    activeCardSetId: setId,
    storedCards: [{ uniqueId: `card-${nanoid()}`, setId, setName, templateId: primary.id!,
      data: face === 'back' ? structuredClone(front!.templatePreviewData ?? {}) : structuredClone(data),
      ...(face === 'back' ? { backingTemplateId: selected.id!, backingData: structuredClone(data) } : {}) }],
    appearanceStyles: [],
    selectedPaperSize: expectedState.selectedPaperSize,
    pdfMarginMm: expectedState.pdfMarginMm,
    pdfCardSpacingMm: expectedState.pdfCardSpacingMm,
    pdfIncludeCutLines: expectedState.pdfIncludeCutLines,
    pdfDuplexLayout: expectedState.pdfDuplexLayout,
    exportMode: expectedState.exportMode,
    exportDpi: expectedState.exportDpi,
  });
  const snapshot = await buildBrowserCardForgeProjectSnapshot({ document, name: setName });
  signal?.throwIfAborted();
  if (scope !== getProjectPersistenceScope()) throw new Error('The workspace account changed. Open the test copy again in the intended account.');
  const prepared = await materializeBrowserProjectSnapshot(snapshot, requireCompleteSingleSet);
  signal?.throwIfAborted();
  if (scope !== getProjectPersistenceScope()) throw new Error('The workspace account changed. Open the test copy again in the intended account.');
  const result = await applyProjectDocumentToWorkspace(prepared, 'copy', { expectedState, signal, assertCurrent, validatePreparedDocument: requireCompleteSingleSet });
  if (!result.activeSetId) throw new Error('The test Set could not be opened.');
  return result.activeSetId;
}
