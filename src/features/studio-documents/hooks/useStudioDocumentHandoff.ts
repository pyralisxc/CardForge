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
  useProjectStore,
  writeProjectAssetListToStorage,
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
  const inFlightDocumentIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (isAccountLoading || !isSignedIn || !isStudioReady) return;
    const url = new URL(window.location.href);
    const documentId = url.searchParams.get('document');
    if (
      !documentId
      || handledDocumentIdRef.current === documentId
      || inFlightDocumentIdRef.current === documentId
    ) return;

    inFlightDocumentIdRef.current = documentId;

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
          writeProjectAssetListToStorage(assetStorage, CUSTOM_TEXTURE_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_TEXTURE_ASSETS_STORAGE_KEY]),
          writeProjectAssetListToStorage(assetStorage, CUSTOM_DIVIDER_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_DIVIDER_ASSETS_STORAGE_KEY]),
          writeProjectAssetListToStorage(assetStorage, CUSTOM_ICON_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_ICON_ASSETS_STORAGE_KEY]),
          writeProjectAssetListToStorage(assetStorage, CUSTOM_IMAGE_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_IMAGE_ASSETS_STORAGE_KEY]),
        ]);
        if (cancelled) return;

        // Opening an external Studio document is a project-open operation, not an
        // accumulating import. Clear persisted project collections first, then reuse
        // the same validated store actions used by ordinary project ingestion.
        useProjectStore.setState({
          userTemplates: [],
          appearanceStyles: [],
          storedCards: [],
        });
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

        handledDocumentIdRef.current = documentId;
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
      } finally {
        if (inFlightDocumentIdRef.current === documentId) {
          inFlightDocumentIdRef.current = null;
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
