'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toCanvas } from 'html-to-image';
import { renderCardToPngBlob } from '@/features/card-generator/client';
import { applyCardExportWatermark, resolveCardExportWatermark } from '@/features/card-generator/client';
import { useBrandPresentation } from '@/features/brand-presentation/client';
import { PipelineRecipePreview, MediaPresentationPreview } from '@/features/pipeline/client';
import { createPipelineFontFaceCss } from '@/domain/rendering';
import { mapProjectFontsToCardFontOptions, normalizeProjectFontAssets } from '@/features/project/client/assets';
import { reconstructMinimalTemplateObject } from '@/domain/templates';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';
import type { NativeSourceSnapshot } from '../sourcePreview';

const dataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob);
});
export function SavedSourcePreviewClient() {
  const [snapshot, setSnapshot] = useState<(NativeSourceSnapshot & { branded: boolean }) | null>(null);
  const [images, setImages] = useState<Array<{ id: string; url: string }>>([]);
  const [error, setError] = useState(''); const specimen = useRef<HTMLDivElement>(null);
  const brand = useBrandPresentation();
  const fontCss = useMemo(() => snapshot?.content.kind === 'cards' ? createPipelineFontFaceCss(mapProjectFontsToCardFontOptions(normalizeProjectFontAssets(snapshot.content.document.customFonts))) : '', [snapshot]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/saved-source-preview${window.location.search}`, { cache: 'no-store', signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Exact source is unavailable.')); return response.json(); })
      .then(setSnapshot).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!snapshot) return;
    let cancelled = false;
    void (async () => {
      const content = snapshot.content;
      if (content.kind === 'unsupported') throw new Error(content.reason);
      const watermark = resolveCardExportWatermark(!snapshot.branded, brand);
      const rendered: Array<{ id: string; url: string }> = [];
      if (content.kind === 'template') {
        const template = reconstructMinimalTemplateObject(content.template);
        const blob = await renderCardToPngBlob({ uniqueId: 'template', template, data: template.templatePreviewData ?? {} }, 'virtual', 150, 'front', undefined, watermark);
        rendered.push({ id: 'template', url: await dataUrl(blob) });
      } else if (content.kind === 'cards') {
        for (const id of content.cardIds) {
          const card = content.document.storedCards.find(c => c.uniqueId === id && c.setId === content.setId);
          const template = content.document.userTemplates.find(t => t.id === card?.templateId);
          if (!card || !template) throw new Error('Exact card Template is unavailable; no fallback was substituted.');
          const blob = await renderCardToPngBlob({ ...card, template: reconstructMinimalTemplateObject(template) }, 'virtual', 150, 'front', undefined, watermark);
          rendered.push({ id, url: await dataUrl(blob) });
        }
      } else {
        await document.fonts.ready;
        const node = specimen.current;
        if (!node) throw new Error('Native specimen is unavailable.');
        await Promise.all(Array.from(node.querySelectorAll('img')).map(image => image.decode()));
        const canvas = await toCanvas(node, { pixelRatio: 2 });
        await applyCardExportWatermark(canvas, watermark);
        rendered.push({ id: 'specimen', url: canvas.toDataURL('image/png') });
      }
      if (!cancelled) setImages(rendered);
    })().catch(error => { if (!cancelled) setError(error.message); });
    return () => { cancelled = true; };
  }, [snapshot, brand]);
  const content = snapshot?.content;
  return <main className="min-h-screen bg-[#10151f] p-4 text-white">
    {fontCss && <style>{fontCss}</style>}
    <h1>{snapshot?.title ?? 'Exact CardForge source'}</h1>
    {snapshot && <p className="break-all text-xs">{Object.entries(snapshot.identity).map(([key,value]) => `${key}: ${value ?? 'unassigned'}`).join(' · ')}</p>}
    {error ? <p role="alert">{error}</p> : <p>{images.length ? 'Exact native render' : 'Rendering exact source…'}</p>}
    {content && ['media', 'font', 'recipe'].includes(content.kind) && <div style={{ position: 'absolute', left: -10000, top: 0 }}>
      <div ref={specimen} style={{ width: 480, minHeight: 320, padding: 20, background: '#f5f0e8', color: '#20170f' }}>
        {content.kind === 'recipe' && <PipelineRecipePreview recipe={content.recipe} expanded />}
        {content.kind === 'media' && content.presentation && <MediaPresentationPreview sourceUrl={content.dataUrl} presentation={content.presentation} />}
        {content.kind === 'media' && !content.presentation && <img src={content.dataUrl} alt={snapshot?.title} style={{ width: '100%', height: 300, objectFit: 'contain' }} />}
        {content.kind === 'font' && <><style>{`@font-face{font-family:CardForgeExactSpecimen;src:url("${content.dataUrl}")}`}</style><p style={{ fontFamily: 'CardForgeExactSpecimen', fontSize: 40 }}>Aa Bb Cc<br />The quick brown fox<br />0123456789</p></>}
      </div>
    </div>}
    <div className="flex flex-wrap gap-4">{images.map(image => <img key={image.id} data-cardforge-render-artifact="saved-source" data-card-id={image.id} src={image.url} alt={`${snapshot?.title} · ${image.id}`} style={{ maxWidth: 440, width: '100%', objectFit: 'contain' }} />)}</div>
  </main>;
}
