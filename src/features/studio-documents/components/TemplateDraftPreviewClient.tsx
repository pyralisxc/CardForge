"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { CardData } from '@/domain/cards';
import type { DisplayCard } from '@/domain/rendering';
import {
  reconstructMinimalTemplateObject,
  type TCGCardTemplate,
} from '@/domain/templates';
import { Button } from '@/components/ui/button';
import { renderCardToPngBlob } from '@/features/card-generator/client';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

interface TemplateDraftPreviewPayload {
  title: string;
  revision: number;
  template: TCGCardTemplate;
}

interface ExportedTemplatePreview {
  dataUrl: string;
  fileName: string;
}

const buildPreviewData = (template: TCGCardTemplate): CardData => {
  const data: CardData = { ...(template.templatePreviewData ?? {}) };
  for (const field of template.fieldContracts ?? []) {
    if (field.defaultValue !== undefined && data[field.key] === undefined) {
      data[field.key] = field.defaultValue;
    }
  }
  return data;
};

const blobToDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === 'string'
    ? resolve(reader.result)
    : reject(new Error('CardForge could not prepare the exported Template image.'));
  reader.onerror = () => reject(new Error('CardForge could not prepare the exported Template image.'));
  reader.readAsDataURL(blob);
});

const templateExportFileName = (title: string, revision: number): string => (
  `${title.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'cardforge-template'}-r${revision}.png`
);

export function TemplateDraftPreviewClient() {
  const [payload, setPayload] = useState<TemplateDraftPreviewPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [exportedPreview, setExportedPreview] = useState<ExportedTemplatePreview | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('token');
    const requestedRevision = Number(url.searchParams.get('revision'));
    if (!token) {
      setErrorMessage('This CardForge draft preview link is invalid.');
      return;
    }

    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/studio-document-preview?token=${encodeURIComponent(token)}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(await readApiErrorMessage(response, 'Unable to load this CardForge draft preview.'));
        }
        const preview = await response.json() as TemplateDraftPreviewPayload;
        const template = reconstructMinimalTemplateObject(preview.template);
        if (!template.id || !template.freeformCanvas) {
          throw new Error('This CardForge draft does not contain a renderable Template.');
        }
        setPayload({ title: preview.title, revision: preview.revision, template });
      } catch (error) {
        if (!controller.signal.aborted) {
          const message = error instanceof Error ? error.message : 'Unable to load this CardForge draft preview.';
          setErrorMessage(message);
          window.parent.postMessage({
            type: 'cardforge-template-export-error',
            revision: Number.isInteger(requestedRevision) ? requestedRevision : 0,
            message,
          }, '*');
        }
      }
    })();
    return () => controller.abort();
  }, []);

  const card = useMemo<DisplayCard | null>(() => {
    if (!payload) return null;
    return {
      template: payload.template,
      data: buildPreviewData(payload.template),
      uniqueId: `draft-preview-${payload.template.id}`,
    };
  }, [payload]);

  useEffect(() => {
    if (!card || !payload) return;
    let cancelled = false;
    setExportedPreview(null);

    void (async () => {
      try {
        const blob = await renderCardToPngBlob(card, 'virtual', 150);
        const dataUrl = await blobToDataUrl(blob);
        if (cancelled) return;
        const fileName = templateExportFileName(payload.title, payload.revision);
        setExportedPreview({ dataUrl, fileName });
        window.parent.postMessage({
          type: 'cardforge-template-export',
          title: payload.title,
          revision: payload.revision,
          mimeType: 'image/png',
          imageDataUrl: dataUrl,
          fileName,
        }, '*');
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error
          ? error.message
          : 'Unable to export this CardForge draft preview.';
        setErrorMessage(message);
        window.parent.postMessage({
          type: 'cardforge-template-export-error',
          revision: payload.revision,
          message,
        }, '*');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [card, payload]);

  const handleSavePng = useCallback(() => {
    if (!exportedPreview) return;
    const link = document.createElement('a');
    link.href = exportedPreview.dataUrl;
    link.download = exportedPreview.fileName;
    link.click();
  }, [exportedPreview]);

  return (
    <main className="flex min-h-screen items-start justify-center bg-[#090b0f] p-3 text-[#f7ead0]">
      {exportedPreview && payload ? (
        <section className="w-full max-w-[620px] rounded-xl border border-[#2b3039] bg-[#0d1117] p-3 shadow-2xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{payload.title}</p>
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#8f95a3]">CardForge draft · revision {payload.revision}</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleSavePng}>
              Save PNG
            </Button>
          </div>
          <div className="flex justify-center overflow-auto rounded-lg border border-[#202630] bg-[#07090d] p-4">
            <img
              src={exportedPreview.dataUrl}
              alt={`${payload.title}, revision ${payload.revision}`}
              className="block h-auto max-h-[78vh] max-w-full"
            />
          </div>
        </section>
      ) : (
        <div className={`mt-8 max-w-lg rounded-lg border px-4 py-3 text-sm ${errorMessage ? 'border-red-500/40 bg-red-500/10 text-red-100' : 'border-[#2b3039] bg-[#0d1117] text-[#aab1bd]'}`}>
          {errorMessage ?? 'Exporting the CardForge Template preview…'}
        </div>
      )}
    </main>
  );
}
