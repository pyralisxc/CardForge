"use client";

import { useCallback, useEffect, useRef } from 'react';
import { assertOutputContentUnchanged, outputIntentSchema, validateOutputIntentDocument, type OutputIntent } from '../outputIntent';

import { applyProjectDocumentToState } from '@/features/project/client/package-document';
import { applyProjectDocumentToWorkspace, hasProjectDocumentStateChanged, normalizeStudioView, type StudioView, useProjectStore } from '@/features/project/client/workspace';
import {
  normalizeStudioDocumentPayload,
  type StudioDocumentAssetDownload,
  type StudioDocumentInstallSummary,
  type StudioDocumentSource,
} from '@/features/studio-documents/model';
import { hydrateStudioDocumentAssets } from '../client/studioDocumentAssetHydration';
import {
  acknowledgeStudioDocumentInstallation,
} from '../client/studioDocumentInstallation';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

interface ToastInput {
  title: string;
  description: string;
  variant?: 'destructive';
}

interface StudioDocumentHandoffOptions {
  onOutputPrepared?: (intent: OutputIntent, reference: string) => void;
  navigationKey?: string;
  isAccountLoading: boolean;
  isSignedIn: boolean;
  isStudioReady: boolean;
  setStudioView: (view: StudioView) => void;
  setSelectedTemplateId: (id: string | null) => void;
  setTemplateEditorSelectedTemplateId: (id: string | null) => void;
  toast: (input: ToastInput) => void;
  onInstalled?: (result: { activeSetId: string | null; destination: 'sets' | 'generator' | 'template-maker' }) => void;
}

const parseRequestedRevision = (value: string | null): number | null => {
  if (!value || !/^\d+$/u.test(value)) return null;
  const revision = Number(value);
  return Number.isSafeInteger(revision) && revision > 0 ? revision : null;
};

const handoffKey = (documentId: string, revision: number | null) => `${documentId}:${revision ?? 'latest'}`;

export function useStudioDocumentHandoff({
  onOutputPrepared,
  navigationKey,
  isAccountLoading,
  isSignedIn,
  isStudioReady,
  setStudioView,
  setSelectedTemplateId,
  setTemplateEditorSelectedTemplateId,
  toast,
  onInstalled,
}: StudioDocumentHandoffOptions) {
  const handledRevisionKeyRef = useRef<string | null>(null);
  const inFlightRevisionKeyRef = useRef<{ key: string; controller: AbortController } | null>(null);

  useEffect(() => {
    if (isAccountLoading || !isSignedIn || !isStudioReady) return;
    const url = new URL(window.location.href);
    const documentId = url.searchParams.get('document');
    const requestedRevision = parseRequestedRevision(url.searchParams.get('revision'));
    const outputRef = url.searchParams.get('outputRef');
    if (outputRef !== null && (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(outputRef) || !documentId || !requestedRevision)) {
      toast({ title: 'Output not opened', description: 'A valid Output reference and exact document revision are required.', variant: 'destructive' }); return;
    }
    if (!documentId) return;
    const requestedKey = `${handoffKey(documentId, requestedRevision)}:${outputRef ?? ''}`;
    if (handledRevisionKeyRef.current === requestedKey || inFlightRevisionKeyRef.current?.key === requestedKey) return;
    if (outputRef) {
      try {
        if (sessionStorage.getItem(`cardforge:output:${outputRef}`) !== null) {
          toast({ title: 'Output needs preparation', description: 'This handoff was already opened on this tab. Prepare a new handoff to avoid replacing current work.', variant: 'destructive' }); return;
        }
        sessionStorage.setItem(`cardforge:output-probe:${outputRef}`, 'ok');
        sessionStorage.removeItem(`cardforge:output-probe:${outputRef}`);
      } catch { toast({ title: 'Output not opened', description: 'This browser cannot safely retain the handoff state.', variant: 'destructive' }); return; }
    }

    if (outputRef && !window.confirm('Opening this exact Output source may replace or update work on this device. Save any unsaved work first. Continue?')) {
      handledRevisionKeyRef.current = requestedKey;
      return;
    }
    const controller = new AbortController();
    const attempt = { key: requestedKey, controller };
    inFlightRevisionKeyRef.current = attempt;

    let cancelled = false;
    const initiatingState = useProjectStore.getState();
    void (async () => {
      let localAgentRevisionApplied = false;
      try {
        const params = new URLSearchParams();
        if (requestedRevision !== null) params.set('revision', String(requestedRevision));
        if (outputRef) params.set('outputRef', outputRef);
        const revisionQuery = params.size ? `?${params}` : '';
        const response = await fetch(`/api/studio-documents/${encodeURIComponent(documentId)}${revisionQuery}`, {
          cache: 'no-store',
          credentials: 'same-origin',
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(await readApiErrorMessage(response, 'Unable to open the Studio draft.'));
        }
        const payload = await response.json() as {
          document?: {
            id?: unknown;
            title?: unknown;
            creationSource?: StudioDocumentSource;
            revision?: unknown;
            document?: unknown;
          };
          assets?: StudioDocumentAssetDownload[];
          watermark?: { required?: unknown; canExportClean?: unknown };
          outputIntent?: unknown;
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

        let outputIntent: OutputIntent | undefined;
        if (outputRef) {
          const parsed = outputIntentSchema.safeParse(payload.outputIntent);
          if (!parsed.success || payload.document?.id !== documentId || actualRevision !== requestedRevision || parsed.data.documentId !== documentId || parsed.data.revision !== requestedRevision || !['studio', 'gpt', 'import'].includes(String(payload.document?.creationSource)) || typeof payload.watermark?.required !== 'boolean' || typeof payload.watermark?.canExportClean !== 'boolean' || payload.watermark.required === payload.watermark.canExportClean || !Array.isArray(payload.assets)) throw new Error('The exact Output source response is invalid.');
          outputIntent = parsed.data;
          validateOutputIntentDocument(outputIntent, payload.document?.document);
        }
        const storedDocument = normalizeStudioDocumentPayload(payload.document?.document);
        if (!storedDocument) throw new Error('The account document is not a valid CardForge project.');
        const document = await hydrateStudioDocumentAssets(storedDocument, payload.assets ?? [], controller.signal, Boolean(outputIntent));
        controller.signal.throwIfAborted();
        const patch = applyProjectDocumentToState(document);
        // Desk camera/selection updates may replace the Zustand object while
        // the exact source is loading. Reuse the canonical authored-document
        // comparison, then retain the native transaction's final strict CAS.
        const expectedState = outputIntent ? useProjectStore.getState() : initiatingState;
        if (outputIntent && hasProjectDocumentStateChanged(initiatingState, expectedState)) {
          throw new Error('The workspace changed while the project was opening. Your edits were left unchanged.');
        }

        // Persist the attempt before any workspace transaction. A lost or failed
        // receipt cannot authorize a later reload to overwrite local work again.
        if (outputIntent && outputRef) sessionStorage.setItem(`cardforge:output:${outputRef}`, 'installation-attempted');

        if (payload.document?.creationSource === 'gpt') {
          const beforeState = expectedState;
          const existingTemplateIds = new Set(beforeState.userTemplates.map((template) => template.id).filter(Boolean));
          const existingCardIds = new Set(beforeState.storedCards.map((card) => card.uniqueId));
          const personalTemplates = patch.userTemplates.filter((template) => (
            template.templateSource !== 'default'
            && template.templateLibrarySource !== 'pipeline'
          ));

          const adoptionDocument = {
            ...document,
            userTemplates: document.userTemplates.map((template) => (
              template.templateSource !== 'default' && template.templateLibrarySource !== 'pipeline'
                ? {
                    ...template,
                    templateSource: 'user' as const,
                    templateLibrarySource: 'personal' as const,
                    templateRevision: actualRevision ?? template.templateRevision,
                  }
                : template
            )),
          };
          const adopted = await applyProjectDocumentToWorkspace(adoptionDocument, 'adopt', { expectedState: beforeState, signal: controller.signal, ...(outputIntent ? { validatePreparedDocument: (prepared) => assertOutputContentUnchanged(outputIntent!, adoptionDocument, prepared) } : {}) });
          if (cancelled) return;

          const cardResult = {
            successCount: adopted.successCount,
            skippedCount: adopted.skippedCount,
          };

          const installedCards = patch.storedCards.slice(0, cardResult.successCount);
          const cardAddedCount = installedCards.filter((card) => !existingCardIds.has(card.uniqueId)).length;
          const cardUpdatedCount = Math.max(0, cardResult.successCount - cardAddedCount);
          const templateAddedCount = personalTemplates.filter((template) => template.id && !existingTemplateIds.has(template.id)).length;
          const templateUpdatedCount = Math.max(0, personalTemplates.length - templateAddedCount);
          const destination: StudioDocumentInstallSummary['destination'] = cardResult.successCount > 0 ? 'sets' : 'template-maker';
          const activeFrontTemplateId = patch.storedCards.find((card) => card.setId === patch.activeCardSetId)?.templateId ?? null;
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
            setCount: patch.cardSets.length,
            cardCount: cardResult.successCount,
            cardAddedCount,
            cardUpdatedCount,
            cardSkippedCount: cardResult.skippedCount,
            activeSetId: patch.activeCardSetId ?? null,
            destination,
          };

          handledRevisionKeyRef.current = requestedKey;
          localAgentRevisionApplied = true;
          onInstalled?.({ activeSetId: installSummary.activeSetId, destination: installSummary.destination });
          if (actualRevision) {
            await acknowledgeStudioDocumentInstallation({
              documentId,
              revision: actualRevision,
              summary: installSummary,
            });
          }
          if (cancelled) return;

          if (outputIntent && outputRef) { sessionStorage.setItem(`cardforge:output:${outputRef}`, 'applied'); onOutputPrepared?.(outputIntent, outputRef); }
          else {
            url.searchParams.delete('document');
            url.searchParams.delete('revision');
            window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
          }
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

        // Ordinary Studio open uses the same native durable Project transaction as
        // every other project import. Replace semantics intentionally include the
        // complete document (workspace settings, fonts, assets, Templates, Sets,
        // cards, and styles) before the resulting live state is exposed.
        const opened = await applyProjectDocumentToWorkspace(document, 'replace', {
          expectedState,
          signal: controller.signal,
          ...(outputIntent ? { validatePreparedDocument: (prepared) => assertOutputContentUnchanged(outputIntent!, document, prepared) } : {}),
        });
        if (cancelled) return;
        localAgentRevisionApplied = true;
        setStudioView('template');

        handledRevisionKeyRef.current = requestedKey;
        if (outputIntent && outputRef) { sessionStorage.setItem(`cardforge:output:${outputRef}`, 'applied'); onOutputPrepared?.(outputIntent, outputRef); }
        else {
          url.searchParams.delete('document');
          url.searchParams.delete('revision');
          window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
        }
        toast({
          title: 'Editable project opened',
          description: payload.watermark?.required === true
            ? 'The project is ready in Studio. Your current tier keeps the CardForge watermark on previews and finished downloads.'
            : 'The project is ready in Studio with clean-output access from your current tier.',
        });
        onInstalled?.({ activeSetId: opened.activeSetId, destination: 'template-maker' });
      } catch (error) {
        if (!cancelled) {
          toast({
            title: localAgentRevisionApplied ? 'Revision applied locally' : 'Draft not opened',
            description: localAgentRevisionApplied
              ? `${error instanceof Error ? error.message : 'CardForge could not complete the handoff.'} The source was applied locally; review the revision link before retrying.`
              : error instanceof Error ? error.message : 'Unable to open the Studio draft.',
            variant: 'destructive',
          });
        }
      } finally {
        if (inFlightRevisionKeyRef.current === attempt) {
          inFlightRevisionKeyRef.current = null;
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      if (inFlightRevisionKeyRef.current === attempt) inFlightRevisionKeyRef.current = null;
    };
  }, [
    isAccountLoading,
    isSignedIn,
    isStudioReady,
    onInstalled,
    onOutputPrepared,
    navigationKey,
    setStudioView,
    setSelectedTemplateId,
    setTemplateEditorSelectedTemplateId,
    toast,
  ]);
  return useCallback(() => {
    inFlightRevisionKeyRef.current?.controller.abort();
    inFlightRevisionKeyRef.current = null;
  }, []);
}
