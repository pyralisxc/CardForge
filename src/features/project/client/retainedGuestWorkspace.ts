"use client";

import {
  CUSTOM_DIVIDER_ASSETS_STORAGE_KEY,
  CUSTOM_FONT_ASSETS_STORAGE_KEY,
  CUSTOM_ICON_ASSETS_STORAGE_KEY,
  CUSTOM_IMAGE_ASSETS_STORAGE_KEY,
  CUSTOM_TEXTURE_ASSETS_STORAGE_KEY,
  parseProjectDocumentValue,
} from '../model/projectDocument';
import {
  consumeRetainedGuestWorkspaceForAccount,
  prepareRetainedGuestWorkspaceAssetsForAccount,
  readRetainedGuestWorkspaceForAccount,
  type RetainedGuestWorkspace,
} from '../persistence/guestWorkspaceAdoption';
import { getProjectPersistenceScope } from '../persistence/projectPersistenceScope';
import { useProjectStore } from '../store/workspaceStore';
import { applyProjectDocumentToWorkspace } from './projectWorkspaceDocument';

export interface RetainedGuestWorkSummary {
  setCount: number;
  cardCount: number;
  templateCount: number;
}

const currentAccountScope = (): `account:${string}` | null => {
  const scope = getProjectPersistenceScope();
  return scope.startsWith('account:') ? scope as `account:${string}` : null;
};

export const getRetainedGuestWorkSummary = async (): Promise<RetainedGuestWorkSummary | null> => {
  const scope = currentAccountScope();
  if (!scope) return null;
  const retained = await readRetainedGuestWorkspaceForAccount(scope);
  return retained ? {
    setCount: retained.setCount,
    cardCount: retained.cardCount,
    templateCount: retained.templateCount,
  } : null;
};

const buildDocument = (retained: RetainedGuestWorkspace) => {
  const state = retained.state;
  const activeCardSetId = state.activeCardSet && typeof state.activeCardSet === 'object' && 'id' in state.activeCardSet
    && typeof state.activeCardSet.id === 'string' ? state.activeCardSet.id : undefined;
  const candidate = {
    version: 1,
    userTemplates: Array.isArray(state.userTemplates) ? state.userTemplates : [],
    cardSets: Array.isArray(state.cardSets) ? state.cardSets : [],
    ...(activeCardSetId ? { activeCardSetId } : {}),
    storedCards: Array.isArray(state.storedCards) ? state.storedCards : [],
    appearanceStyles: Array.isArray(state.appearanceStyles) ? state.appearanceStyles : [],
    exportSettings: {
      selectedPaperSize: state.selectedPaperSize,
      pdfMarginMm: state.pdfMarginMm,
      pdfCardSpacingMm: state.pdfCardSpacingMm,
      pdfIncludeCutLines: state.pdfIncludeCutLines,
      pdfDuplexLayout: state.pdfDuplexLayout,
      exportMode: state.exportMode,
      exportDpi: state.exportDpi,
    },
    customAssets: {
      [CUSTOM_TEXTURE_ASSETS_STORAGE_KEY]: retained.catalogs[CUSTOM_TEXTURE_ASSETS_STORAGE_KEY]?.values ?? [],
      [CUSTOM_DIVIDER_ASSETS_STORAGE_KEY]: retained.catalogs[CUSTOM_DIVIDER_ASSETS_STORAGE_KEY]?.values ?? [],
      [CUSTOM_ICON_ASSETS_STORAGE_KEY]: retained.catalogs[CUSTOM_ICON_ASSETS_STORAGE_KEY]?.values ?? [],
      [CUSTOM_IMAGE_ASSETS_STORAGE_KEY]: retained.catalogs[CUSTOM_IMAGE_ASSETS_STORAGE_KEY]?.values ?? [],
    },
    customFonts: retained.catalogs[CUSTOM_FONT_ASSETS_STORAGE_KEY]?.values ?? [],
  };
  const parsed = parseProjectDocumentValue(candidate);
  if (!parsed.success) throw new Error(`Signed-out work could not be opened safely. ${parsed.error}`);
  return parsed.document;
};

/**
 * Import retained signed-out work as independent copies beside a returning
 * account. The account workspace is never replaced. Guest bytes are consumed
 * only after the copy commits; if newer signed-out work arrives concurrently,
 * it remains available for a later review.
 */
export const importRetainedGuestWorkspaceAsCopy = async (): Promise<{
  summary: RetainedGuestWorkSummary;
  importedSetId: string | null;
  consumed: boolean;
}> => {
  const scope = currentAccountScope();
  if (!scope) throw new Error('Sign in to an account before importing signed-out work.');
  const retained = await readRetainedGuestWorkspaceForAccount(scope);
  if (!retained) throw new Error('No retained signed-out work is available for this account.');
  const expectedState = useProjectStore.getState();
  const document = buildDocument(retained);
  await prepareRetainedGuestWorkspaceAssetsForAccount(retained);
  if (getProjectPersistenceScope() !== scope || useProjectStore.getState() !== expectedState) {
    throw new Error('The account workspace changed while signed-out work was preparing. Nothing was imported; retry from the current Desk.');
  }
  const imported = await applyProjectDocumentToWorkspace(document, 'copy', { expectedState });
  const consumed = await consumeRetainedGuestWorkspaceForAccount(retained).catch(() => false);
  return {
    summary: { setCount: retained.setCount, cardCount: retained.cardCount, templateCount: retained.templateCount },
    importedSetId: imported.activeSetId,
    consumed,
  };
};
