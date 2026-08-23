"use client";

import type { ChangeEvent, RefObject } from 'react';
import { useCallback, useState } from 'react';

import type { StoredDisplayCard } from '@/domain/cards';
import type { AppearanceStylePreset, TCGCardTemplate } from '@/domain/templates';
import type { ExportMode, PaperSize, PdfDuplexLayout } from '@/domain/rendering';
import type { useToast } from '@/components/ui/use-toast';
import { trackExportCompleted, trackExportStarted } from '@/features/analytics/client/tracking';
import { withNextStep } from '@/shared/userFacingErrors';
import {
  buildCardForgeProjectSnapshot,
  decodeProjectFile,
  encodeCardForgeProjectPackage,
} from '../lib/projectPackageCodec';
import { CARDFORGE_PROJECT_FILE_EXTENSION, normalizeProjectFileName } from '../model/projectPackage';
import { applyProjectDocumentToState, type ProjectDocumentStatePatch, type ProjectDocumentV1 } from '../model/projectDocument';
import { applyProjectDocumentToWorkspace, captureCurrentProjectDocument } from '../client/projectWorkspaceDocument';

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
  document: ProjectDocumentV1;
  patch: ProjectDocumentStatePatch;
  preview: ProjectImportPreview;
}

const downloadProjectFile = (fileName: string, bytes: Uint8Array) => {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: 'application/vnd.cardforge.project+zip' });
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

export function useProjectFileActions(input: UseProjectFileActionsInput) {
  const {
    canUseProjectFiles,
    fileInputRef,
    projectFileGateMessage,
    storedCards,
    toast,
    userTemplates,
  } = input;
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

    try {
      const document = await captureCurrentProjectDocument();
      const activeSetName = document.cardSets.find((set) => set.id === document.activeCardSetId)?.name
        ?? document.cardSets[0]?.name
        ?? 'CardForge Project';
      const projectName = normalizeProjectFileName(activeSetName);
      const snapshot = await buildCardForgeProjectSnapshot({ document, name: projectName });
      const bytes = await encodeCardForgeProjectPackage(snapshot);
      trackExportStarted('project', storedCards.length);
      downloadProjectFile(`${projectName}${CARDFORGE_PROJECT_FILE_EXTENSION}`, bytes);
      trackExportCompleted('project', storedCards.length);
      toast({
        title: 'Project exported',
        description: `${projectName}${CARDFORGE_PROJECT_FILE_EXTENSION} contains the project document and its embedded artwork as one portable CardForge package.`,
      });
    } catch (error) {
      toast({
        title: 'Project not exported',
        description: error instanceof Error
          ? `CardForge did not create an incomplete project file. ${error.message}`
          : 'CardForge did not create an incomplete project file.',
        variant: 'destructive',
      });
    }
  }, [canUseProjectFiles, showProjectFileGate, storedCards.length, toast]);

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

    void decodeProjectFile(file)
      .then((decoded) => {
        const patch = applyProjectDocumentToState(decoded.document);
        setPendingProjectImport({
          fileName: file.name,
          document: decoded.document,
          patch,
          preview: buildProjectImportPreview({ fileName: file.name, patch, currentUserTemplates: userTemplates }),
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
      const result = await applyProjectDocumentToWorkspace(pendingProjectImport.document, mode);
      setPendingProjectImport(null);
      toast({
        title: mode === 'merge' ? 'Project merged' : 'Project imported',
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
