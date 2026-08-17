"use client";

import { useEffect, useRef } from 'react';

import type { TCGCardTemplate, AppearanceStylePreset } from '@/domain/templates';
import type { StoredDisplayCard } from '@/domain/cards';
import type { ExportMode, PaperSize, PdfDuplexLayout } from '@/domain/rendering';
import {
  applyProjectDocumentToState,
  CUSTOM_DIVIDER_ASSETS_STORAGE_KEY,
  CUSTOM_ICON_ASSETS_STORAGE_KEY,
  CUSTOM_IMAGE_ASSETS_STORAGE_KEY,
  CUSTOM_TEXTURE_ASSETS_STORAGE_KEY,
  getProjectAssetStorage,
  mergeProjectAssetListToStorage,
} from '@/features/project/client';
import { normalizeStudioDocumentPayload } from '@/features/studio-documents/model';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

interface ToastInput {
  title: string;
  description: string;
  variant?: 'destructive';
}

interface StudioDocumentHandoffOptions {
  isAccountLoading: boolean;
  isSignedIn: boolean;
  isStudioReady: boolean;
  mergeAppearanceStyles: (styles: AppearanceStylePreset[]) => void;
  setActiveTab: (tab: string) => void;
  setExportDpi: (dpi: number) => void;
  setExportMode: (mode: ExportMode) => void;
  setPdfOptions: (options: { margin?: number; spacing?: number; cutLines?: boolean; duplexLayout?: PdfDuplexLayout }) => void;
  setSelectedPaperSize: (size: PaperSize) => void;
  setSelectedTemplateId: (id: string | null) => void;
  mergeStoredCards: (cards: StoredDisplayCard[]) => { successCount: number; skippedCount: number };
  setTemplateEditorSelectedTemplateId: (id: string | null) => void;
  mergeUserTemplates: (templates: Partial<TCGCardTemplate>[]) => number;
  toast: (input: ToastInput) => void;
}

export function useStudioDocumentHandoff({
  isAccountLoading,
  isSignedIn,
  isStudioReady,
  mergeAppearanceStyles,
  setActiveTab,
  setExportDpi,
  setExportMode,
  setPdfOptions,
  setSelectedPaperSize,
  setSelectedTemplateId,
  mergeStoredCards,
  setTemplateEditorSelectedTemplateId,
  mergeUserTemplates,
  toast,
}: StudioDocumentHandoffOptions) {
  const handledDocumentIdRef = useRef<string | null>(null);
  const signInPromptedDocumentIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (isAccountLoading || !isStudioReady) return;
    const url = new URL(window.location.href);
    const documentId = url.searchParams.get('document');
    if (!documentId || handledDocumentIdRef.current === documentId) return;

    if (!isSignedIn) {
      if (signInPromptedDocumentIdRef.current !== documentId) {
        signInPromptedDocumentIdRef.current = documentId;
        toast({
          title: 'Sign in to open this draft',
          description: 'Use the Studio Sign in button above. This private draft will stay pending and open automatically after your CardForge account connects.',
        });
      }
      return;
    }
    signInPromptedDocumentIdRef.current = null;
    handledDocumentIdRef.current = documentId;

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/studio-documents/${encodeURIComponent(documentId)}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        if (!response.ok) {
          throw new Error(await readApiErrorMessage(response, 'Unable to open the Studio draft.'));
        }
        const payload = await response.json() as {
          document?: { title?: unknown; document?: unknown };
          watermark?: { required?: unknown };
        };
        const document = normalizeStudioDocumentPayload(payload.document?.document);
        if (!document) throw new Error('The account document is not a valid CardForge Studio project.');
        const patch = applyProjectDocumentToState(document);
        const assetStorage = getProjectAssetStorage();
        await Promise.all([
          mergeProjectAssetListToStorage(assetStorage, CUSTOM_TEXTURE_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_TEXTURE_ASSETS_STORAGE_KEY]),
          mergeProjectAssetListToStorage(assetStorage, CUSTOM_DIVIDER_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_DIVIDER_ASSETS_STORAGE_KEY]),
          mergeProjectAssetListToStorage(assetStorage, CUSTOM_ICON_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_ICON_ASSETS_STORAGE_KEY]),
          mergeProjectAssetListToStorage(assetStorage, CUSTOM_IMAGE_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_IMAGE_ASSETS_STORAGE_KEY]),
        ]);
        if (cancelled) return;

        mergeUserTemplates(patch.userTemplates);
        mergeAppearanceStyles(patch.appearanceStyles);
        if (patch.selectedPaperSize) setSelectedPaperSize(patch.selectedPaperSize);
        setPdfOptions({
          margin: patch.pdfMarginMm,
          spacing: patch.pdfCardSpacingMm,
          cutLines: patch.pdfIncludeCutLines,
          duplexLayout: patch.pdfDuplexLayout,
        });
        if (patch.exportMode) setExportMode(patch.exportMode);
        if (patch.exportDpi) setExportDpi(patch.exportDpi);
        mergeStoredCards(patch.storedCards);

        const firstTemplateId = patch.userTemplates.find((template) => template.id)?.id ?? null;
        setSelectedTemplateId(firstTemplateId);
        setTemplateEditorSelectedTemplateId(firstTemplateId);
        setActiveTab('template-maker');

        url.searchParams.delete('document');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
        toast({
          title: 'Editable draft opened',
          description: payload.watermark?.required === true
            ? 'The draft is ready in Studio. Your current tier keeps the CardForge watermark on previews and finished downloads.'
            : 'The draft is ready in Studio with clean-output access from your current tier.',
        });
      } catch (error) {
        if (!cancelled) {
          toast({
            title: 'Draft not opened',
            description: error instanceof Error ? error.message : 'Unable to open the Studio draft.',
            variant: 'destructive',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isAccountLoading,
    isSignedIn,
    isStudioReady,
    mergeAppearanceStyles,
    mergeStoredCards,
    mergeUserTemplates,
    setActiveTab,
    setExportDpi,
    setExportMode,
    setPdfOptions,
    setSelectedPaperSize,
    setSelectedTemplateId,
    setTemplateEditorSelectedTemplateId,
    toast,
  ]);
}
