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
  normalizeStudioView,
  type StudioView,
  useProjectStore,
  writeProjectAssetListToStorage,
} from '@/features/project/client';
import {
  normalizeStudioDocumentPayload,
  type StudioDocumentAssetDownload,
  type StudioDocumentInstallSummary,
  type StudioDocumentSource,
} from '@/features/studio-documents/model';
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
  setStudioView: (view: StudioView) => void;
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

const handoffKey = (documentId: string, revision: number | null) => `${documentId}:${revision ?? 'latest'}`;

export function useStudioDocumentHandoff({
  isAccountLoading,
  isSignedIn,
  isStudioReady,
  mergeAppearanceStyles,
  setStudioView,
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
  const handledRevisionKeyRef = useRef<string | null>(null);
  const inFlightRevisionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (isAccountLoading || !isSignedIn || !isStudioReady) return;
    const url = new URL(window.location.href);
    const documentId = url.searchParams.get('document');
    const requestedRevision = parseRequestedRevision(url.searchParams.get('revision'));
    if (!documentId) return;
    const requestedKey = handoffKey(documentId, requestedRevision);
    if (
      handledRevisionKeyRef.current === requestedKey
      || inFlightRevisionKeyRef.current === requestedKey
    ) return;

    inFlightRevisionKeyRef.current = requestedKey;

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
          const beforeState = useProjectStore.getState();
          const existingTemplateIds = new Set(beforeState.userTemplates.map((template) => template.id).filter(Boolean));
          const existingCardIds = new Set(beforeState.storedCards.map((card) => card.uniqueId));
          const personalTemplates = patch.userTemplates.filter((template) => (
            template.templateSource !== 'default'
            && template.templateLibrarySource !== 'pipeline'
          ));

          await Promise.all([
            mergeProjectAssetListToStorage(assetStorage, CUSTOM_TEXTURE_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_TEXTURE_ASSETS_STORAGE_KEY]),
            mergeProjectAssetListToStorage(assetStorage, CUSTOM_DIVIDER_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_DIVIDER_ASSETS_STORAGE_KEY]),
            mergeProjectAssetListToStorage(assetStorage, CUSTOM_ICON_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_ICON_ASSETS_STORAGE_KEY]),
            mergeProjectAssetListToStorage(assetStorage, CUSTOM_IMAGE_ASSETS_STORAGE_KEY, patch.customAssets[CUSTOM_IMAGE_ASSETS_STORAGE_KEY]),
          ]);
          if (cancelled) return;

          if (personalTemplates.length > 0) {
            mergeUserTemplates(personalTemplates.map((template) => ({
              ...template,
              templateSource: 'user' as const,
              templateLibrarySource: 'personal' as const,
              templateRevision: actualRevision ?? template.templateRevision,
            })));
          }

          const shouldInstallSetState = patch.storedCards.length > 0
            || patch.cardSets.some((set) => set.id !== 'active-card-set' || set.name !== 'Untitled Set');
          if (shouldInstallSetState) {
            useProjectStore.getState().mergeCardSetsFromFiles(patch.cardSets, patch.activeCardSetId);
          }

          let cardResult = { successCount: 0, skippedCount: 0 };
          if (patch.storedCards.length > 0) {
            cardResult = mergeStoredCards(patch.storedCards);
            if (patch.activeCardSetId) useProjectStore.getState().setActiveCardSetId(patch.activeCardSetId);
          }

          const installedCards = patch.storedCards.slice(0, cardResult.successCount);
          const cardAddedCount = installedCards.filter((card) => !existingCardIds.has(card.uniqueId)).length;
          const cardUpdatedCount = Math.max(0, cardResult.successCount - cardAddedCount);
          const templateAddedCount = personalTemplates.filter((template) => template.id && !existingTemplateIds.has(template.id)).length;
          const templateUpdatedCount = Math.max(0, personalTemplates.length - templateAddedCount);
          const destination: StudioDocumentInstallSummary['destination'] = cardResult.successCount > 0 ? 'sets' : 'template-maker';
          const activeFrontTemplateId = patch.cardSets.find((set) => set.id === patch.activeCardSetId)?.frontTemplateId ?? null;
          const installedTemplateId = activeFrontTemplateId
            ?? personalTemplates.find((template) => template.id)?.id
            ?? patch.userTemplates.find((template) => template.id)?.id
            ?? null;
          setSelectedTemplateId(installedTemplateId);
          setTemplateEditorSelectedTemplateId(installedTemplateId);
          setStudioView(normalizeStudioView(destination));

          const installSummary: StudioDocumentInstallSummary = {
            templateCount: personalTemplates.length,
            templateAddedCount,
            templateUpdatedCount,
            setCount: shouldInstallSetState ? patch.cardSets.length : 0,
            cardCount: cardResult.successCount,
            cardAddedCount,
            cardUpdatedCount,
            cardSkippedCount: cardResult.skippedCount,
            activeSetId: patch.activeCardSetId ?? null,
            destination,
          };

          if (actualRevision) {
            void fetch(`/api/studio-documents/${encodeURIComponent(documentId)}/installation`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ revision: actualRevision, summary: installSummary }),
            }).catch((error) => {
              console.warn('Unable to acknowledge installed agent revision:', error);
            });
          }

          handledRevisionKeyRef.current = handoffKey(documentId, actualRevision ?? requestedRevision);
          url.searchParams.delete('document');
          url.searchParams.delete('revision');
          window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
          const revisionLabel = actualRevision ? ` revision ${actualRevision}` : '';
          if (cardResult.successCount > 0) {
            toast({
              title: 'Agent revision applied',
              description: `CardForge applied${revisionLabel}: ${cardAddedCount} card${cardAddedCount === 1 ? '' : 's'} added, ${cardUpdatedCount} updated${cardResult.skippedCount ? `, ${cardResult.skippedCount} skipped` : ''}. The working Set is open in Sets.`,
            });
          } else if (personalTemplates.length > 0) {
            toast({
              title: templateUpdatedCount > 0 ? 'Agent Template updated' : 'Agent Template installed',
              description: `CardForge applied${revisionLabel}: ${templateAddedCount} Template${templateAddedCount === 1 ? '' : 's'} added and ${templateUpdatedCount} updated in your personal library on this device.`,
            });
          } else {
            toast({
              title: 'Agent revision applied',
              description: `CardForge applied${revisionLabel} to this device.`,
            });
          }
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
        setStudioView('template');

        handledRevisionKeyRef.current = handoffKey(documentId, actualRevision ?? requestedRevision);
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
        if (inFlightRevisionKeyRef.current === requestedKey) {
          inFlightRevisionKeyRef.current = null;
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
    setStudioView,
    setExportDpi,
    setExportMode,
    setPdfOptions,
    setSelectedPaperSize,
    setSelectedTemplateId,
    setTemplateEditorSelectedTemplateId,
    toast,
  ]);
}
