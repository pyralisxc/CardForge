"use client";

import type { ChangeEvent, RefObject } from 'react';
import { useCallback, useState } from 'react';

import type { StoredDisplayCard } from '@/domain/cards';
import type { AppearanceStylePreset, CardAssetOption, TCGCardTemplate } from '@/domain/templates';
import type { ExportMode, PaperSize, PdfDuplexLayout } from '@/domain/rendering';
import {
  CUSTOM_DIVIDER_ASSETS_STORAGE_KEY,
  CUSTOM_ICON_ASSETS_STORAGE_KEY,
  CUSTOM_IMAGE_ASSETS_STORAGE_KEY,
  CUSTOM_TEXTURE_ASSETS_STORAGE_KEY,
  applyProjectDocumentToState,
  createProjectDocumentFromState,
  parseProjectDocumentFile,
} from '../model/projectDocument';
import type { ProjectDocumentStatePatch } from '../model/projectDocument';
import type { useToast } from '@/components/ui/use-toast';
import {
  mergeProjectAssetListToStorage,
  getProjectAssetStorage,
  readTypedProjectAssetListFromStorage,
  writeProjectAssetListToStorage,
} from '../persistence/projectAssets';
import { useProjectStore } from '../store/workspaceStore';
import { withNextStep } from '@/shared/userFacingErrors';
import { trackExportCompleted, trackExportStarted } from '@/features/analytics/client/tracking';

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

export type ProjectImportMode = 'replace' | 'merge';

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
}

interface PendingProjectImport {
  fileName: string;
  patch: ProjectDocumentStatePatch;
  preview: ProjectImportPreview;
}

const downloadJsonFile = (fileName: string, contents: string) => {
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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

export function useProjectFileActions({
  appearanceStyles,
  canUseProjectFiles,
  exportDpi,
  projectFileGateMessage,
  exportMode,
  fileInputRef,
  pdfCardSpacingMm,
  pdfDuplexLayout,
  pdfIncludeCutLines,
  pdfMarginMm,
  selectedPaperSize,
  setAppearanceStylesFromFiles,
  setExportDpi,
  setExportMode,
  setPdfOptions,
  setSelectedTemplateId,
  setSelectedPaperSize,
  setStoredCardsFromFile,
  mergeStoredCardsFromFile,
  setUserTemplatesFromFiles,
  mergeUserTemplatesFromFiles,
  replaceAppearanceStylesFromFiles,
  storedCards,
  toast,
  userTemplates,
}: UseProjectFileActionsInput) {
  const [pendingProjectImport, setPendingProjectImport] = useState<PendingProjectImport | null>(null);

  const showProjectFileGate = useCallback(() => {
    toast({
      title: 'Upgrade to move projects',
      description: withNextStep(
        projectFileGateMessage || 'Buy Creator Pass to unlock portable project-file exports and imports.',
        'Open your account page and buy Creator Pass to download or import local project files.',
      ),
    });
  }, [projectFileGateMessage, toast]);

  const handleExportProject = useCallback(async () => {
    if (!canUseProjectFiles) {
      showProjectFileGate();
      return;
    }

    const assetStorage = getProjectAssetStorage();
    const [customTextureAssets, customDividerAssets, customIconAssets, customImageAssets] = await Promise.all([
      readTypedProjectAssetListFromStorage<CardAssetOption>(assetStorage, CUSTOM_TEXTURE_ASSETS_STORAGE_KEY),
      readTypedProjectAssetListFromStorage<CardAssetOption>(assetStorage, CUSTOM_DIVIDER_ASSETS_STORAGE_KEY),
      readTypedProjectAssetListFromStorage<CardAssetOption>(assetStorage, CUSTOM_ICON_ASSETS_STORAGE_KEY),
      readTypedProjectAssetListFromStorage<CardAssetOption>(assetStorage, CUSTOM_IMAGE_ASSETS_STORAGE_KEY),
    ]);
    const workspaceState = useProjectStore.getState();
    const projectDocument = createProjectDocumentFromState({
      userTemplates,
      cardSets: workspaceState.cardSets,
      activeCardSetId: workspaceState.activeCardSet.id,
      storedCards,
      appearanceStyles,
      selectedPaperSize,
      pdfMarginMm,
      pdfCardSpacingMm,
      pdfIncludeCutLines,
      pdfDuplexLayout,
      exportMode,
      exportDpi,
      customTextureAssets,
      customDividerAssets,
      customIconAssets,
      customImageAssets,
    });

    trackExportStarted('project', storedCards.length);
    downloadJsonFile('cardforge-studio-project.json', JSON.stringify(projectDocument, null, 2));
    trackExportCompleted('project', storedCards.length);
    toast({ title: 'Project Exported', description: 'Local project downloaded as cardforge-studio-project.json.' });
  }, [appearanceStyles, canUseProjectFiles, exportDpi, exportMode, pdfCardSpacingMm, pdfDuplexLayout, pdfIncludeCutLines, pdfMarginMm, selectedPaperSize, showProjectFileGate, storedCards, toast, userTemplates]);

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

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const jsonString = loadEvent.target?.result as string;
        const parsedProject = parseProjectDocumentFile(jsonString);

        if (!parsedProject.success) {
          toast({ title: 'Import Error', description: parsedProject.error, variant: 'destructive' });
          return;
        }

        const patch = applyProjectDocumentToState(parsedProject.document);
        setPendingProjectImport({
          fileName: file.name,
          patch,
          preview: buildProjectImportPreview({ fileName: file.name, patch, currentUserTemplates: userTemplates }),
        });
      } catch (error) {
        toast({ title: 'Import Error', description: `Failed to parse or process JSON: ${(error as Error).message}`, variant: 'destructive' });
        console.error('Error importing project:', error);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [canUseProjectFiles, fileInputRef, showProjectFileGate, toast, userTemplates]);

  const clearPendingProjectImport = useCallback(() => setPendingProjectImport(null), []);

  const applyPendingProjectImport = useCallback(async (mode: ProjectImportMode) => {
    if (!pendingProjectImport) return;

    const { patch } = pendingProjectImport;
    const writeAssets = mode === 'merge' ? mergeProjectAssetListToStorage : writeProjectAssetListToStorage;
    const assetStorage = getProjectAssetStorage();
    try {
      await Promise.all([
        writeAssets(assetStorage, CUSTOM_TEXTURE_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_TEXTURE_ASSETS_STORAGE_KEY]),
        writeAssets(assetStorage, CUSTOM_DIVIDER_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_DIVIDER_ASSETS_STORAGE_KEY]),
        writeAssets(assetStorage, CUSTOM_ICON_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_ICON_ASSETS_STORAGE_KEY]),
        writeAssets(assetStorage, CUSTOM_IMAGE_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_IMAGE_ASSETS_STORAGE_KEY]),
      ]);
    } catch (error) {
      console.error('Unable to persist imported project assets:', error);
      toast({
        title: 'Project Import Not Saved',
        description: 'Browser storage could not save the imported artwork. Free browser storage or download a backup, then try again.',
        variant: 'destructive',
      });
      return;
    }
    const importedTemplateCount = mode === 'merge'
      ? mergeUserTemplatesFromFiles(patch.userTemplates)
      : setUserTemplatesFromFiles(patch.userTemplates);
    const workspaceState = useProjectStore.getState();
    if (mode === 'merge') {
      workspaceState.mergeCardSetsFromFiles(patch.cardSets, patch.activeCardSetId);
      setAppearanceStylesFromFiles(patch.appearanceStyles);
    } else {
      workspaceState.setCardSetsFromFiles(patch.cardSets, patch.activeCardSetId);
      replaceAppearanceStylesFromFiles(patch.appearanceStyles);
    }
    if (patch.selectedPaperSize) setSelectedPaperSize(patch.selectedPaperSize);
    setPdfOptions({
      margin: patch.pdfMarginMm,
      spacing: patch.pdfCardSpacingMm,
      cutLines: patch.pdfIncludeCutLines,
      duplexLayout: patch.pdfDuplexLayout,
    });
    if (patch.exportMode) setExportMode(patch.exportMode);
    if (patch.exportDpi) setExportDpi(patch.exportDpi);

    const { successCount, skippedCount } = mode === 'merge'
      ? mergeStoredCardsFromFile(patch.storedCards)
      : setStoredCardsFromFile(patch.storedCards);
    const activeSet = useProjectStore.getState().activeCardSet;
    setSelectedTemplateId(activeSet.frontTemplateId);
    const toastMessage = buildProjectImportSummary({ importedTemplateCount, successCount, skippedCount });
    setPendingProjectImport(null);
    toast({ title: mode === 'merge' ? 'Project Merged' : 'Project Imported', description: toastMessage, duration: 7000 });
  }, [mergeStoredCardsFromFile, mergeUserTemplatesFromFiles, pendingProjectImport, replaceAppearanceStylesFromFiles, setAppearanceStylesFromFiles, setExportDpi, setExportMode, setPdfOptions, setSelectedPaperSize, setSelectedTemplateId, setStoredCardsFromFile, setUserTemplatesFromFiles, toast]);

  return {
    applyPendingProjectImport,
    clearPendingProjectImport,
    handleChooseImportProject,
    handleExportProject,
    handleImportProject,
    pendingProjectImport,
  };
}
