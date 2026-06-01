"use client";

import type { ChangeEvent, RefObject } from 'react';
import { useCallback, useState } from 'react';

import type { AppearanceStylePreset, PaperSize, PdfDuplexLayout, StoredDisplayCard, TCGCardTemplate } from '@/types';
import type { ExportMode } from '@/lib/printValidation';
import {
  CUSTOM_DIVIDER_ASSETS_STORAGE_KEY,
  CUSTOM_ICON_ASSETS_STORAGE_KEY,
  CUSTOM_IMAGE_ASSETS_STORAGE_KEY,
  CUSTOM_TEXTURE_ASSETS_STORAGE_KEY,
  applyProjectDocumentToState,
  createProjectDocumentFromState,
  parseProjectDocumentFile,
} from '@/lib/projectDocument';
import type { ProjectDocumentStatePatch } from '@/lib/projectDocument';
import type { useToast } from '@/hooks/use-toast';
import {
  mergeProjectAssetListToStorage,
  readTypedProjectAssetListFromStorage,
  writeProjectAssetListToStorage,
} from '@/features/project/lib/projectLocalAssets';
import type { CardAssetOption } from '@/lib/cardAssets';
import { withNextStep } from '@/lib/userFacingErrors';

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
        projectFileGateMessage || 'Available now: edit templates and keep work in this browser. Unlock portable project files with Creator Pass or dev access.',
        'Upgrade your account to download this local project file or bring one back into Layout Studio.',
      ),
    });
  }, [projectFileGateMessage, toast]);

  const handleExportProject = useCallback(() => {
    if (!canUseProjectFiles) {
      showProjectFileGate();
      return;
    }

    const projectDocument = createProjectDocumentFromState({
      userTemplates,
      storedCards,
      appearanceStyles,
      selectedPaperSize,
      pdfMarginMm,
      pdfCardSpacingMm,
      pdfIncludeCutLines,
      pdfDuplexLayout,
      exportMode,
      exportDpi,
      customTextureAssets: readTypedProjectAssetListFromStorage<CardAssetOption>(localStorage, CUSTOM_TEXTURE_ASSETS_STORAGE_KEY),
      customDividerAssets: readTypedProjectAssetListFromStorage<CardAssetOption>(localStorage, CUSTOM_DIVIDER_ASSETS_STORAGE_KEY),
      customIconAssets: readTypedProjectAssetListFromStorage<CardAssetOption>(localStorage, CUSTOM_ICON_ASSETS_STORAGE_KEY),
      customImageAssets: readTypedProjectAssetListFromStorage<CardAssetOption>(localStorage, CUSTOM_IMAGE_ASSETS_STORAGE_KEY),
    });

    downloadJsonFile('cardforge-studio-project.json', JSON.stringify(projectDocument, null, 2));
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
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
          preview: buildProjectImportPreview({
            fileName: file.name,
            patch,
            currentUserTemplates: userTemplates,
          }),
        });
      } catch (error) {
        toast({ title: 'Import Error', description: `Failed to parse or process JSON: ${(error as Error).message}`, variant: 'destructive' });
        console.error('Error importing project:', error);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [canUseProjectFiles, fileInputRef, showProjectFileGate, toast, userTemplates]);

  const clearPendingProjectImport = useCallback(() => {
    setPendingProjectImport(null);
  }, []);

  const applyPendingProjectImport = useCallback((mode: ProjectImportMode) => {
    if (!pendingProjectImport) return;

    const { patch } = pendingProjectImport;
    const importedTemplateCount = mode === 'merge'
      ? mergeUserTemplatesFromFiles(patch.userTemplates)
      : setUserTemplatesFromFiles(patch.userTemplates);
    const firstImportedTemplateId = patch.userTemplates.find((template) => template.id && template.id.trim() !== '')?.id ?? null;
    if (firstImportedTemplateId) {
      setSelectedTemplateId(firstImportedTemplateId);
    }
    if (mode === 'merge') {
      setAppearanceStylesFromFiles(patch.appearanceStyles);
    } else {
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

    const writeAssets = mode === 'merge' ? mergeProjectAssetListToStorage : writeProjectAssetListToStorage;
    writeAssets(localStorage, CUSTOM_TEXTURE_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_TEXTURE_ASSETS_STORAGE_KEY]);
    writeAssets(localStorage, CUSTOM_DIVIDER_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_DIVIDER_ASSETS_STORAGE_KEY]);
    writeAssets(localStorage, CUSTOM_ICON_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_ICON_ASSETS_STORAGE_KEY]);
    writeAssets(localStorage, CUSTOM_IMAGE_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_IMAGE_ASSETS_STORAGE_KEY]);

    const { successCount, skippedCount } = mode === 'merge'
      ? mergeStoredCardsFromFile(patch.storedCards)
      : setStoredCardsFromFile(patch.storedCards);
    const toastMessage = buildProjectImportSummary({
      importedTemplateCount,
      successCount,
      skippedCount,
    });
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
