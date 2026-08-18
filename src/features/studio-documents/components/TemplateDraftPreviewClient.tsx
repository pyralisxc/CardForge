"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { toPng } from 'html-to-image';

import type { CardData } from '@/domain/cards';
import type { DisplayCard } from '@/domain/rendering';
import {
  reconstructMinimalTemplateObject,
  type TCGCardTemplate,
} from '@/domain/templates';
import { Button } from '@/components/ui/button';
import { CardPreview } from '@/features/card-rendering/client';

export const CARDFORGE_TEMPLATE_PREVIEW_MESSAGE = 'cardforge:template-draft-preview';

export interface TemplateDraftPreviewPayload {
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
  const [isExporting, setIsExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      const message = event.data as { type?: unknown; preview?: unknown } | null;
      if (!message || message.type !== CARDFORGE_TEMPLATE_PREVIEW_MESSAGE) return;
      const preview = message.preview as TemplateDraftPreviewPayload | null;
      if (!preview || typeof preview.title !== 'string' || !Number.isInteger(preview.revision)) return;
      if (!preview.template || typeof preview.template !== 'object') return;
      try {
        const template = reconstructMinimalTemplateObject(preview.template);
        if (!template.id || !template.freeformCanvas) return;
        setPayload({ title: preview.title, revision: preview.revision, template });
      } catch {
        // Ignore malformed cross-frame preview messages.
      }
    };
    window.addEventListener('message', handleMessage);
    window.parent.postMessage({ type: 'cardforge:template-preview-ready' }, '*');
    return () => window.removeEventListener('message', handleMessage);
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
        <div className="mt-8 rounded-lg border border-[#2b3039] bg-[#0d1117] px-4 py-3 text-sm text-[#aab1bd]">
          Preparing the CardForge draft preview…
        </div>
      )}
    </main>
  );
}
