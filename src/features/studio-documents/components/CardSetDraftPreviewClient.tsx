"use client";

import { useEffect, useMemo, useState } from 'react';

import type { CardSet, StoredDisplayCard } from '@/domain/cards';
import type { DisplayCard } from '@/domain/rendering';
import {
  reconstructMinimalTemplateObject,
  type TCGCardTemplate,
} from '@/domain/templates';
import { renderCardToPngBlob } from '@/features/card-generator/client';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';
import type { StudioDocumentAssetDownload } from '../assetReferences';
import { hydrateStudioDocumentAssetValue } from '../client/studioDocumentAssetHydration';

const MAX_RENDERED_PREVIEW_CARDS = 12;

interface CardSetDraftPreviewPayload {
  title: string;
  revision: number;
  set: CardSet;
  cards: StoredDisplayCard[];
  templates: TCGCardTemplate[];
  assets: StudioDocumentAssetDownload[];
}

interface RenderedCardPreview {
  id: string;
  title: string;
  dataUrl: string;
}

const blobToDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === 'string'
    ? resolve(reader.result)
    : reject(new Error('CardForge could not prepare a Set preview image.'));
  reader.onerror = () => reject(new Error('CardForge could not prepare a Set preview image.'));
  reader.readAsDataURL(blob);
});

const getCardTitle = (card: StoredDisplayCard, index: number) => String(
  card.data.card_name
  ?? card.data.cardName
  ?? card.data.name
  ?? card.data.title
  ?? `Card ${index + 1}`,
);

export function CardSetDraftPreviewClient() {
  const [payload, setPayload] = useState<CardSetDraftPreviewPayload | null>(null);
  const [renderedCards, setRenderedCards] = useState<RenderedCardPreview[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('token');
    const setId = url.searchParams.get('setId');
    const requestedRevision = Number(url.searchParams.get('revision'));
    if (!token || !setId) {
      setErrorMessage('This CardForge Set preview link is invalid.');
      return;
    }

    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(
          `/api/studio-card-set-preview?token=${encodeURIComponent(token)}&setId=${encodeURIComponent(setId)}`,
          { cache: 'no-store', signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error(await readApiErrorMessage(response, 'Unable to load this CardForge Set preview.'));
        }
        const preview = await response.json() as CardSetDraftPreviewPayload;
        const hydrated = await hydrateStudioDocumentAssetValue({
          cards: preview.cards,
          templates: preview.templates,
        }, preview.assets ?? []);
        setPayload({
          ...preview,
          cards: hydrated.cards,
          templates: hydrated.templates.map((template) => reconstructMinimalTemplateObject(template)),
          assets: [],
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          const message = error instanceof Error ? error.message : 'Unable to load this CardForge Set preview.';
          setErrorMessage(message);
          window.parent.postMessage({
            type: 'cardforge-set-export-error',
            revision: Number.isInteger(requestedRevision) ? requestedRevision : 0,
            message,
          }, '*');
        }
      }
    })();
    return () => controller.abort();
  }, []);

  const displayCards = useMemo<DisplayCard[]>(() => {
    if (!payload) return [];
    const templates = new Map(payload.templates.map((template) => [template.id, template]));
    return payload.cards.slice(0, MAX_RENDERED_PREVIEW_CARDS).flatMap((card) => {
      const template = templates.get(card.templateId);
      if (!template) return [];
      const backingTemplate = card.backingTemplateId
        ? templates.get(card.backingTemplateId) ?? null
        : null;
      return [{
        uniqueId: card.uniqueId,
        template,
        backingTemplate,
        backingTemplateId: card.backingTemplateId ?? null,
        backingData: card.backingData,
        setId: card.setId,
        setName: card.setName,
        data: card.data,
      } satisfies DisplayCard];
    });
  }, [payload]);

  useEffect(() => {
    if (!payload) return;
    if (displayCards.length === 0 && payload.cards.length > 0) {
      const message = 'CardForge could not resolve the Template required to render this Set preview.';
      setErrorMessage(message);
      window.parent.postMessage({
        type: 'cardforge-set-export-error',
        revision: payload.revision,
        message,
      }, '*');
      return;
    }
    let cancelled = false;
    setRenderedCards([]);
    void (async () => {
      try {
        const previews: RenderedCardPreview[] = [];
        for (let index = 0; index < displayCards.length; index += 1) {
          const card = displayCards[index]!;
          const blob = await renderCardToPngBlob(card, 'virtual', 150);
          previews.push({
            id: card.uniqueId,
            title: getCardTitle(payload.cards[index]!, index),
            dataUrl: await blobToDataUrl(blob),
          });
        }
        if (cancelled) return;
        setRenderedCards(previews);
        window.parent.postMessage({
          type: 'cardforge-set-export',
          title: payload.set.name,
          revision: payload.revision,
          setId: payload.set.id,
          totalCardCount: payload.cards.length,
          renderedCardCount: previews.length,
          cards: previews,
        }, '*');
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Unable to export this CardForge Set preview.';
        setErrorMessage(message);
        window.parent.postMessage({
          type: 'cardforge-set-export-error',
          revision: payload.revision,
          message,
        }, '*');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [displayCards, payload]);

  if (errorMessage) {
    return (
      <main className="min-h-screen bg-[#090b0f] p-4 text-red-100">
        <div className="mx-auto max-w-xl rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm">{errorMessage}</div>
      </main>
    );
  }

  if (!payload || renderedCards.length !== displayCards.length) {
    return (
      <main className="min-h-screen bg-[#090b0f] p-4 text-[#aab1bd]">
        <div className="mx-auto max-w-xl rounded-lg border border-[#2b3039] bg-[#0d1117] px-4 py-3 text-sm">
          Exporting native CardForge Set preview…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#090b0f] p-3 text-[var(--cf-text)]">
      <section className="mx-auto max-w-5xl rounded-xl border border-[#2b3039] bg-[#0d1117] p-3 shadow-2xl">
        <div className="mb-3">
          <p className="text-sm font-semibold">{payload.set.name}</p>
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#8f95a3]">
            Revision {payload.revision} · {payload.cards.length} cards · showing {renderedCards.length}
          </p>
        </div>
        {renderedCards.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {renderedCards.map((card) => (
              <article key={card.id} className="min-w-0 rounded-lg border border-[#202630] bg-[#07090d] p-2">
                <img
                  src={card.dataUrl}
                  alt={card.title}
                  className="mx-auto block h-auto max-h-[48vh] max-w-full"
                  data-cardforge-render-artifact="card-preview"
                  data-card-id={card.id}
                />
                <p className="mt-2 truncate text-xs font-medium">{card.title}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-[#2b3039] p-5 text-center text-sm text-[#aab1bd]">This Set has no cards yet.</p>
        )}
      </section>
    </main>
  );
}
