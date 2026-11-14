"use client";

import type { ChangeEvent, RefObject } from 'react';
import { useCallback, useState } from 'react';

import type { StoredDisplayCard } from '@/domain/cards';
import type { AppearanceStylePreset, TCGCardTemplate } from '@/domain/templates';
import type { ExportMode, PaperSize, PdfDuplexLayout } from '@/domain/rendering';
import type { useToast } from '@/components/ui/use-toast';
import { trackExportCompleted, trackExportStarted } from '@/features/analytics/client/tracking';
import { withNextStep } from '@/shared/userFacingErrors';
import { buildBrowserCardForgeProjectSnapshot, decodeBrowserProjectFile } from '../client/browserProjectPackage';
import { saveCardForgeProjectPackageToDevice } from '../client/projectPackageDeviceSave';
import { CARDFORGE_PROJECT_FILE_EXTENSION, normalizeProjectFileName } from '../model/projectPackage';
import { applyProjectDocumentToState, type ProjectDocumentStatePatch, type ProjectDocumentV1 } from '../model/projectDocument';
import { applyProjectDocumentToWorkspace, captureCardSetProjectDocument } from '../client/projectWorkspaceDocument';
import { useProjectStore } from '../store/workspaceStore';

type ToastFn = ReturnType<typeof useToast>['toast'];

interface UseProjectFileActionsInput {
  appearanceStyles: AppearanceStylePreset[];
  canUseProjectFiles: boolean;
  exportDpi: number;
  projectFileGateMessage?: string | null;
  exportMode: ExportMode;
  fileInputRef: RefObject<HTMLInputElement>;
  pdfCardSpacingMm: number;
  pdfDuplexLayout: PdfDuplexLayout;
  pdfIncludeCutLines: boolean;
  pdfMarginMm: number;
  selectedPaperSize: PaperSize;
  setAppearanceStylesFromFiles: (styles: AppearanceStylePreset[]) => void;
  setExportDpi: (dpi: number) => void;
  setExportMode: (mode: ExportMode) => void;
  setPdfOptions: (options: { margin?: number; spacing?: number; cutLines?: boolean; duplexLayout?: PdfDuplexLayout }) => void;
  setSelectedTemplateId: (id: string | null) => void;
  setSelectedPaperSize: (size: PaperSize) => void;
  setStoredCardsFromFile: (loadedCards: StoredDisplayCard[]) => { successCount: number; skippedCount: number };
  mergeStoredCardsFromFile: (loadedCards: StoredDisplayCard[]) => { successCount: number; skippedCount: number };
  setUserTemplatesFromFiles: (templates: Partial<TCGCardTemplate>[]) => number;
  mergeUserTemplatesFromFiles: (templates: Partial<TCGCardTemplate>[]) => number;
  replaceAppearanceStylesFromFiles: (styles: AppearanceStylePreset[]) => void;
  storedCards: StoredDisplayCard[];
  toast: ToastFn;
  userTemplates: TCGCardTemplate[];
}

export type ProjectImportMode = 'replace' | 'merge' | 'copy';

export interface ProjectImportPreview {
  fileName: string;
  templateCount: number;
  setCount: number;
  outputCount: number;
  appearanceStyleCount: number;
  customAssetCount: number;
  exportSettingCount: number;
  templateIdConflicts: string[];
  templateNameConflicts: string[];
  copyBlockReason?: string | null;
}

interface PendingProjectImport {
  fileName: string;
  document: ProjectDocumentV1;
  patch: ProjectDocumentStatePatch;
  preview: ProjectImportPreview;
}

export const getProjectCopyBlockReason = (document: ProjectDocumentV1): string | null => {
  if (Object.values(document.customAssets).some((assets) => assets.length) || document.appearanceStyles.length || document.productionPlan) {
    return 'This file contains resources that cannot yet be copied independently without risking their references. Your current work remains unchanged.';
  }
  const templateIds = new Set(document.userTemplates.map((template) => template.id));
  const referenced = [
    ...document.cardSets.flatMap((set) => set.templateIds ?? []),
    ...document.storedCards.flatMap((card) => [card.templateId, card.backingTemplateId]),
  ];
  if (referenced.some((id) => id && !templateIds.has(id))) {
    return 'A Template required by this file is missing. Your current work remains unchanged.';
  }
  return null;
};

export const buildProjectImportSummary = ({
  importedTemplateCount,
  successCount,
  skippedCount,
}: {
  importedTemplateCount: number;
  successCount: number;
  skippedCount: number;
}) => {
  const parts = [
    `${importedTemplateCount} ${importedTemplateCount === 1 ? 'template' : 'templates'} imported`,
  ];
  if (successCount > 0 || skippedCount > 0) {
    parts.push(`${successCount} ${successCount === 1 ? 'output' : 'outputs'} processed`);
  } else {
    parts.push('No generated outputs were included in this file');
  }
  if (skippedCount > 0) {
    parts.push(`${skippedCount} ${skippedCount === 1 ? 'output' : 'outputs'} skipped due to missing or invalid templates`);
  }
  return `${parts.join('. ')}.`;
};

const countDefinedExportSettings = (patch: ProjectDocumentStatePatch) => [
  patch.selectedPaperSize,
  patch.pdfMarginMm,
  patch.pdfCardSpacingMm,
  patch.pdfIncludeCutLines,
  patch.pdfDuplexLayout,
  patch.exportMode,
  patch.exportDpi,
].filter((value) => value !== undefined).length;

const countCustomAssets = (patch: ProjectDocumentStatePatch) => (
  Object.values(patch.customAssets).reduce((count, assets) => count + assets.length, 0)
);

export const buildProjectImportPreview = ({
  fileName,
  patch,
  currentUserTemplates,
}: {
  fileName: string;
  patch: ProjectDocumentStatePatch;
  currentUserTemplates: TCGCardTemplate[];
}): ProjectImportPreview => {
  const currentTemplateIds = new Set(currentUserTemplates.map((template) => template.id).filter(Boolean));
  const currentTemplateNames = new Set(
    currentUserTemplates
      .map((template) => template.name?.trim().toLowerCase())
      .filter((name): name is string => Boolean(name)),
  );
  const templateIdConflicts = patch.userTemplates
    .filter((template) => template.id && currentTemplateIds.has(template.id))
    .map((template) => template.name || template.id || 'Unnamed template');
  const templateNameConflicts = patch.userTemplates
    .filter((template) => {
      const normalizedName = template.name?.trim().toLowerCase();
      return normalizedName ? currentTemplateNames.has(normalizedName) : false;
    })
    .map((template) => template.name || template.id || 'Unnamed template');

  return {
    fileName,
    templateCount: patch.userTemplates.length,
    setCount: patch.cardSets.length,
    outputCount: patch.storedCards.length,
    appearanceStyleCount: patch.appearanceStyles.length,
    customAssetCount: countCustomAssets(patch),
    exportSettingCount: countDefinedExportSettings(patch),
    templateIdConflicts: Array.from(new Set(templateIdConflicts)),
    templateNameConflicts: Array.from(new Set(templateNameConflicts)),
  };
};

export function useProjectFileActions(input: UseProjectFileActionsInput) {
  const {
    canUseProjectFiles,
    fileInputRef,
    projectFileGateMessage,
    toast,
    userTemplates,
  } = input;
  const [pendingProjectImport, setPendingProjectImport] = useState<PendingProjectImport | null>(null);

  const showProjectFileGate = useCallback(() => {
    toast({
      title: 'Upgrade to move projects',
      description: withNextStep(
        projectFileGateMessage || 'Portable project files are temporarily unavailable for this account.',
        'Refresh the account page and try again. Your current work remains unchanged.',
      ),
    });
  }, [projectFileGateMessage, toast]);

  const handleExportProject = useCallback(async () => {
    if (!canUseProjectFiles) {
      showProjectFileGate();
      return;
    }

    try {
      const activeSetId = useProjectStore.getState().activeCardSet?.id;
      if (!activeSetId) {
        toast({ title: 'Set not downloaded', description: 'Choose a Set before downloading it. Your work is unchanged.' });
        return;
      }
      const document = await captureCardSetProjectDocument(activeSetId);
      const availableTemplateIds = new Set(document.userTemplates.map((template) => template.id));
      const referencedTemplateIds = [
        ...(document.cardSets[0].templateIds ?? []),
        ...document.storedCards.flatMap((card) => [card.templateId, card.backingTemplateId]),
      ];
      if (referencedTemplateIds.some((id) => id && !availableTemplateIds.has(id))) {
        throw new Error('A Template used or prepared by this Set is unavailable. Restore it before downloading; your work remains unchanged.');
      }
      const projectName = normalizeProjectFileName(document.cardSets[0].name);
      const snapshot = await buildBrowserCardForgeProjectSnapshot({ document, name: projectName });
      trackExportStarted('project', document.storedCards.length);
      await saveCardForgeProjectPackageToDevice({
        fileName: `${projectName}${CARDFORGE_PROJECT_FILE_EXTENSION}`,
        snapshot,
        // Download creates a portable copy, not a file-system write grant.
        pickerWindow: {},
      });
      trackExportCompleted('project', document.storedCards.length);
      toast({
        title: 'Set downloaded',
        description: `${projectName}${CARDFORGE_PROJECT_FILE_EXTENSION} contains the selected Set and its portable artwork.`,
      });
    } catch (error) {
      toast({
        title: 'Set not downloaded',
        description: error instanceof Error
          ? `CardForge did not create an incomplete Set file. ${error.message}`
          : 'CardForge did not create an incomplete Set file.',
        variant: 'destructive',
      });
    }
  }, [canUseProjectFiles, showProjectFileGate, toast]);

  const handleChooseImportProject = useCallback(() => {
    if (!canUseProjectFiles) {
      showProjectFileGate();
      return;
    }
    fileInputRef.current?.click();
  }, [canUseProjectFiles, fileInputRef, showProjectFileGate]);

  const handleImportProject = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    if (!canUseProjectFiles) {
      showProjectFileGate();
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;

    void decodeBrowserProjectFile(file)
      .then((decoded) => {
        const patch = applyProjectDocumentToState(decoded.document);
        setPendingProjectImport({
          fileName: file.name,
          document: decoded.document,
          patch,
          preview: {
            ...buildProjectImportPreview({ fileName: file.name, patch, currentUserTemplates: userTemplates }),
            copyBlockReason: getProjectCopyBlockReason(decoded.document),
          },
        });
      })
      .catch((error) => {
        toast({
          title: 'Import error',
          description: error instanceof Error ? error.message : 'CardForge could not open this project file.',
          variant: 'destructive',
        });
      });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [canUseProjectFiles, fileInputRef, showProjectFileGate, toast, userTemplates]);

  const clearPendingProjectImport = useCallback(() => setPendingProjectImport(null), []);

  const applyPendingProjectImport = useCallback(async (mode: ProjectImportMode) => {
    if (!pendingProjectImport) return;
    try {
      if (mode === 'copy') {
        const reason = getProjectCopyBlockReason(pendingProjectImport.document);
        if (reason) throw new Error(reason);
      }
      const result = await applyProjectDocumentToWorkspace(pendingProjectImport.document, mode);
      setPendingProjectImport(null);
      toast({
        title: mode === 'copy' ? 'Independent copy opened' : mode === 'merge' ? 'Project merged' : 'Project imported',
        description: buildProjectImportSummary(result),
        duration: 7000,
      });
    } catch (error) {
      console.error('Unable to apply imported CardForge project:', error);
      toast({
        title: 'Project import not saved',
        description: error instanceof Error
          ? `CardForge could not safely apply every project asset. ${error.message}`
          : 'CardForge could not safely apply every project asset.',
        variant: 'destructive',
      });
    }
  }, [pendingProjectImport, toast]);

  return {
    applyPendingProjectImport,
    clearPendingProjectImport,
    handleChooseImportProject,
    handleExportProject,
    handleImportProject,
    pendingProjectImport,
  };
}
