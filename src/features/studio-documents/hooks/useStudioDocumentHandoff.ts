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
  useProjectStore,
  writeProjectAssetListToStorage,
} from '@/features/project/client';
import { normalizeStudioDocumentPayload, type StudioDocumentSource } from '@/features/studio-documents/model';
import { type StudioDocumentAssetDownload } from '../assetReferences';
import { hydrateStudioDocumentAssets } from '../client/studioDocumentAssetHydration';
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

const parseRequestedRevision = (value: string | null): number | null => {
  if (!value || !/^\d+$/u.test(value)) return null;
  const revision = Number(value);
  return Number.isSafeInteger(revision) && revision > 0 ? revision : null;
};

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
    const requestedRevision = parseRequestedRevision(url.searchParams.get('revision'));
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
          document?: {
            title?: unknown;
            creationSource?: StudioDocumentSource;
            revision?: unknown;
            document?: unknown;
          };
          assets?: StudioDocumentAssetDownload[];
          watermark?: { required?: unknown };
        };
        const actualRevision = Number.isInteger(payload.document?.revision)
          ? Number(payload.document?.revision)
          : null;
        if (requestedRevision !== null && actualRevision !== requestedRevision) {
          throw new Error(
            actualRevision
              ? `This agent draft is now revision ${actualRevision}. Reopen the latest CardForge preview before installing it.`
              : 'CardForge could not verify the requested agent draft revision.',
          );
        }

        const storedDocument = normalizeStudioDocumentPayload(payload.document?.document);
        if (!storedDocument) throw new Error('The account document is not a valid CardForge Studio project.');
        const document = await hydrateStudioDocumentAssets(storedDocument, payload.assets ?? []);
        const patch = applyProjectDocumentToState(document);
        const assetStorage = getProjectAssetStorage();

        if (payload.document?.creationSource === 'gpt') {
          if (patch.userTemplates.length !== 1 || !patch.userTemplates[0]?.id) {
            throw new Error('This agent draft does not contain exactly one installable CardForge Template.');
          }

          const incomingTemplate = patch.userTemplates[0];
          const existingTemplate = useProjectStore.getState().userTemplates.find(
            (candidate) => candidate.id === incomingTemplate.id,
          );
          const templateToInstall: TCGCardTemplate = {
            ...incomingTemplate,
            templateSource: 'user',
            templateLibrarySource: 'personal',
            templateRevision: actualRevision ?? incomingTemplate.templateRevision,
          };

          await Promise.all([
            mergeProjectAssetListToStorage(assetStorage, CUSTOM_TEXTURE_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_TEXTURE_ASSETS_STORAGE_KEY]),
            mergeProjectAssetListToStorage(assetStorage, CUSTOM_DIVIDER_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_DIVIDER_ASSETS_STORAGE_KEY]),
            mergeProjectAssetListToStorage(assetStorage, CUSTOM_ICON_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_ICON_ASSETS_STORAGE_KEY]),
            mergeProjectAssetListToStorage(assetStorage, CUSTOM_IMAGE_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_IMAGE_ASSETS_STORAGE_KEY]),
          ]);
          if (cancelled) return;

          mergeUserTemplates([templateToInstall]);
          const projectState = useProjectStore.getState();
          let installedCardCount = 0;
          if (patch.storedCards.length > 0) {
            projectState.mergeCardSetsFromFiles(patch.cardSets, patch.activeCardSetId);
            const cardResult = mergeStoredCards(patch.storedCards);
            installedCardCount = cardResult.successCount;
            if (patch.activeCardSetId) useProjectStore.getState().setActiveCardSetId(patch.activeCardSetId);
          }
          const installedTemplateId = templateToInstall.id!;
          setSelectedTemplateId(installedTemplateId);
          setTemplateEditorSelectedTemplateId(installedTemplateId);
          setActiveTab(installedCardCount > 0 ? 'generator' : 'template-maker');

          handledDocumentIdRef.current = documentId;
          url.searchParams.delete('document');
          url.searchParams.delete('revision');
          window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
          const revisionLabel = actualRevision ? ` revision ${actualRevision}` : '';
          const cardLabel = installedCardCount > 0
            ? ` ${installedCardCount} card${installedCardCount === 1 ? '' : 's'} in the agent set were also added or updated.`
            : '';
          toast({
            title: existingTemplate ? 'Agent Template updated' : 'Agent Template installed',
            description: existingTemplate
              ? `"${templateToInstall.name}"${revisionLabel} replaced the earlier agent revision in your personal Template library on this device.${cardLabel}`
              : `"${templateToInstall.name}"${revisionLabel} is now in your personal Template library on this device.${cardLabel}`,
          });
          return;
        }

        await Promise.all([
          writeProjectAssetListToStorage(assetStorage, CUSTOM_TEXTURE_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_TEXTURE_ASSETS_STORAGE_KEY]),
          writeProjectAssetListToStorage(assetStorage, CUSTOM_DIVIDER_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_DIVIDER_ASSETS_STORAGE_KEY]),
          writeProjectAssetListToStorage(assetStorage, CUSTOM_ICON_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_ICON_ASSETS_STORAGE_KEY]),
          writeProjectAssetListToStorage(assetStorage, CUSTOM_IMAGE_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_IMAGE_ASSETS_STORAGE_KEY]),
        ]);
        if (cancelled) return;

        // Non-agent Studio documents retain project-open semantics.
        useProjectStore.setState({
          userTemplates: [],
          appearanceStyles: [],
          storedCards: [],
        });
        mergeUserTemplates(patch.userTemplates);
        useProjectStore.getState().setCardSetsFromFiles(patch.cardSets, patch.activeCardSetId);
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

        const firstTemplateId = useProjectStore.getState().activeCardSet.frontTemplateId
          ?? patch.userTemplates.find((template) => template.id)?.id
          ?? null;
        setSelectedTemplateId(firstTemplateId);
        setTemplateEditorSelectedTemplateId(firstTemplateId);
        setActiveTab('template-maker');

        handledDocumentIdRef.current = documentId;
        url.searchParams.delete('document');
        url.searchParams.delete('revision');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
        toast({
          title: 'Editable project opened',
          description: payload.watermark?.required === true
            ? 'The project is ready in Studio. Your current tier keeps the CardForge watermark on previews and finished downloads.'
            : 'The project is ready in Studio with clean-output access from your current tier.',
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
