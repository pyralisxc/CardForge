"use client";

import type { ChangeEvent, RefObject } from 'react';
import { useCallback } from 'react';

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
import type { useToast } from '@/hooks/use-toast';
import {
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
  setUserTemplatesFromFiles: (templates: Partial<TCGCardTemplate>[]) => number;
  storedCards: StoredDisplayCard[];
  toast: ToastFn;
  userTemplates: TCGCardTemplate[];
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
    `${successCount} ${successCount === 1 ? 'output' : 'outputs'} processed`,
  ];
  if (skippedCount > 0) {
    parts.push(`${skippedCount} ${skippedCount === 1 ? 'output' : 'outputs'} skipped due to missing or invalid templates`);
  }
  return `${parts.join('. ')}.`;
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
  setUserTemplatesFromFiles,
  storedCards,
  toast,
  userTemplates,
}: UseProjectFileActionsInput) {
  const showProjectFileGate = useCallback(() => {
    toast({
      title: 'Upgrade to move projects',
      description: withNextStep(
        projectFileGateMessage || 'Project import and export require an active paid or dev account.',
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
        setUserTemplatesFromFiles(patch.userTemplates);
        const firstImportedTemplateId = patch.userTemplates.find((template) => template.id && template.id.trim() !== '')?.id ?? null;
        if (firstImportedTemplateId) {
          setSelectedTemplateId(firstImportedTemplateId);
        }
        setAppearanceStylesFromFiles(patch.appearanceStyles);
        if (patch.selectedPaperSize) setSelectedPaperSize(patch.selectedPaperSize);
        setPdfOptions({
          margin: patch.pdfMarginMm,
          spacing: patch.pdfCardSpacingMm,
          cutLines: patch.pdfIncludeCutLines,
          duplexLayout: patch.pdfDuplexLayout,
        });
        if (patch.exportMode) setExportMode(patch.exportMode);
        if (patch.exportDpi) setExportDpi(patch.exportDpi);
        writeProjectAssetListToStorage(localStorage, CUSTOM_TEXTURE_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_TEXTURE_ASSETS_STORAGE_KEY]);
        writeProjectAssetListToStorage(localStorage, CUSTOM_DIVIDER_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_DIVIDER_ASSETS_STORAGE_KEY]);
        writeProjectAssetListToStorage(localStorage, CUSTOM_ICON_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_ICON_ASSETS_STORAGE_KEY]);
        writeProjectAssetListToStorage(localStorage, CUSTOM_IMAGE_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_IMAGE_ASSETS_STORAGE_KEY]);
        const { successCount, skippedCount } = setStoredCardsFromFile(patch.storedCards);
        const toastMessage = buildProjectImportSummary({
          importedTemplateCount: patch.userTemplates.length,
          successCount,
          skippedCount,
        });
        toast({ title: parsedProject.isLegacy ? 'Legacy Set Imported' : 'Project Imported', description: toastMessage, duration: 7000 });
      } catch (error) {
        toast({ title: 'Import Error', description: `Failed to parse or process JSON: ${(error as Error).message}`, variant: 'destructive' });
        console.error('Error importing project:', error);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [canUseProjectFiles, fileInputRef, setAppearanceStylesFromFiles, setExportDpi, setExportMode, setPdfOptions, setSelectedPaperSize, setSelectedTemplateId, setStoredCardsFromFile, setUserTemplatesFromFiles, showProjectFileGate, toast]);

  return {
    handleChooseImportProject,
    handleExportProject,
    handleImportProject,
  };
}
