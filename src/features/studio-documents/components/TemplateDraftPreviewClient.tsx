"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';

import type { CardData } from '@/domain/cards';
import type { DisplayCard } from '@/domain/rendering';
import {
  reconstructMinimalTemplateObject,
  type TCGCardTemplate,
} from '@/domain/templates';
import { Button } from '@/components/ui/button';
import { CardPreview } from '@/features/card-rendering/client';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

interface TemplateDraftPreviewPayload {
  title: string;
  revision: number;
  template: TCGCardTemplate;
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

export function TemplateDraftPreviewClient() {
  const [payload, setPayload] = useState<TemplateDraftPreviewPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const token = new URL(window.location.href).searchParams.get('token');
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
          setErrorMessage(error instanceof Error ? error.message : 'Unable to load this CardForge draft preview.');
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

  const handleSavePng = useCallback(async () => {
    if (!cardRef.current || !payload) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        skipFonts: false,
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${payload.title.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'cardforge-template'}-r${payload.revision}.png`;
      link.click();
    } finally {
      setIsExporting(false);
    }
  }, [payload]);

  return (
    <main className="flex min-h-screen items-start justify-center bg-[#090b0f] p-3 text-[#f7ead0]">
      {card && payload ? (
        <section className="w-full max-w-[620px] rounded-xl border border-[#2b3039] bg-[#0d1117] p-3 shadow-2xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{payload.title}</p>
              <p className="text-[11px] uppercase tracking-[0.14em] text-[#8f95a3]">CardForge draft · revision {payload.revision}</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleSavePng} disabled={isExporting}>
              {isExporting ? 'Rendering…' : 'Save PNG'}
            </Button>
          </div>
          <div className="flex justify-center overflow-auto rounded-lg border border-[#202630] bg-[#07090d] p-4">
            <div ref={cardRef} className="inline-block">
              <CardPreview
                card={card}
                isEditorPreview
                isPrintMode
                targetWidthPx={520}
                className="shadow-none"
              />
            </div>
          </div>
        </section>
      ) : (
        <div className={`mt-8 max-w-lg rounded-lg border px-4 py-3 text-sm ${errorMessage ? 'border-red-500/40 bg-red-500/10 text-red-100' : 'border-[#2b3039] bg-[#0d1117] text-[#aab1bd]'}`}>
          {errorMessage ?? 'Preparing the CardForge draft preview…'}
        </div>
      )}
    </main>
  );
}
