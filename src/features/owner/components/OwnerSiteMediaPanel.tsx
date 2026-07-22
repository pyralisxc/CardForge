"use client";

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ImageUp, Monitor, RotateCcw, Smartphone } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import type { OwnerConsolePayload } from '@/features/owner/lib/ownerConsole';
import { getOwnerApiErrorMessage } from '@/features/owner/model/ownerConsoleClient';
import {
  getSiteMediaDisplaySrc,
  getSiteMediaFrameAspectRatio,
  ResponsiveSiteMediaImage,
  type SiteMediaAsset,
  type SiteMediaFrame,
  type SiteMediaPresentation,
  type SiteMediaSize,
} from '@/features/public-site/client';

const UPLOAD_TIMEOUT_MS = 30_000;
const inputClassName = 'min-h-11 border border-[#5f4526] bg-[#0c0b09] px-3 py-2 text-sm leading-6 text-[#ffe7ad] outline-none focus:border-[#d8b365]';

type PreviewViewport = 'desktop' | 'mobile';
type FileDimensions = { width: number; height: number };

const formatDimensions = (dimensions: FileDimensions | null): string => (
  dimensions ? `${dimensions.width} × ${dimensions.height}` : 'Dimensions unavailable'
);

const getDimensionNote = (
  asset: SiteMediaAsset,
  dimensions: FileDimensions | null,
): { tone: 'neutral' | 'warning'; message: string } => {
  if (!dimensions) return { tone: 'neutral', message: asset.guidance };
  const ratio = dimensions.width / dimensions.height;
  if (asset.kind === 'hero' && ratio < 1.5) {
    return { tone: 'warning', message: 'This source is relatively tall for a cover. Check both focal points carefully or choose a wider image.' };
  }
  if (asset.kind === 'portrait' && (ratio < 0.65 || ratio > 0.95)) {
    return { tone: 'warning', message: 'This source differs noticeably from the 4:5 portrait frame. Reposition and zoom it before publishing.' };
  }
  return { tone: 'neutral', message: asset.guidance };
};

export function OwnerSiteMediaPanel({
  consolePayload,
  onConsoleChange,
}: {
  consolePayload: OwnerConsolePayload;
  onConsoleChange: (payload: OwnerConsolePayload) => void;
}) {
  const { toast } = useToast();
  const [drafts, setDrafts] = useState(consolePayload.siteMedia);
  const [files, setFiles] = useState<Partial<Record<SiteMediaAsset['slot'], File>>>({});
  const [busySlot, setBusySlot] = useState<SiteMediaAsset['slot'] | null>(null);
  const [inputVersion, setInputVersion] = useState(0);

  useEffect(() => {
    setDrafts(consolePayload.siteMedia);
  }, [consolePayload.siteMedia]);

  const updateDraft = (next: SiteMediaAsset) => {
    setDrafts((current) => current.map((asset) => asset.slot === next.slot ? next : asset));
  };

  const publish = async (asset: SiteMediaAsset) => {
    const image = files[asset.slot];
    setBusySlot(asset.slot);
    try {
      const body = new FormData();
      if (image) body.set('image', image);
      body.set('alt', asset.alt);
      body.set('presentation', JSON.stringify(asset.presentation));
      const response = await fetch(`/api/owner/site-media/${asset.slot}`, {
        method: 'POST',
        body,
        signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(await getOwnerApiErrorMessage(response, 'Unable to publish the public image.'));
      const result = await response.json() as { console: OwnerConsolePayload };
      onConsoleChange(result.console);
      setFiles((current) => ({ ...current, [asset.slot]: undefined }));
      setInputVersion((current) => current + 1);
      toast({ title: 'Site media published', description: `${asset.label} and its responsive presentation are now live.` });
    } catch (error) {
      const message = error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError')
        ? 'This publish took too long. The current live image is unchanged; try a smaller image or try again.'
        : error instanceof Error
          ? error.message
          : 'Unable to publish the public image.';
      toast({ title: 'Site media not published', description: message, variant: 'destructive' });
    } finally {
      setBusySlot(null);
    }
  };

  const restore = async (asset: SiteMediaAsset) => {
    setBusySlot(asset.slot);
    try {
      const response = await fetch(`/api/owner/site-media/${asset.slot}/restore`, {
        method: 'POST',
        signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(await getOwnerApiErrorMessage(response, 'Unable to restore the previous image.'));
      const result = await response.json() as { console: OwnerConsolePayload };
      onConsoleChange(result.console);
      setFiles((current) => ({ ...current, [asset.slot]: undefined }));
      setInputVersion((current) => current + 1);
      toast({ title: 'Previous image restored', description: `${asset.label} has been rolled back. The version you replaced is still available.` });
    } catch (error) {
      toast({ title: 'Image not restored', description: error instanceof Error ? error.message : 'Unable to restore the previous image.', variant: 'destructive' });
    } finally {
      setBusySlot(null);
    }
  };

  return (
    <section className="border border-[#6d4f2b] bg-[#15100a] p-4 sm:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a98a55]">Visual publishing</p>
        <h2 className="mt-1 font-serif text-2xl text-[#fff1c7]">Site media</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-[#a98a7a]">
          Replace, frame, and size every public image from one place. JPEG, PNG, and WebP files up to 12 MB are supported. Changes stay in these previews until you publish them, and the previous version remains available for a one-step restore.
        </p>
      </div>
      <div className="mt-6 grid gap-6">
        {drafts.map((draft) => {
          const published = consolePayload.siteMedia.find((asset) => asset.slot === draft.slot) ?? draft;
          return (
            <OwnerMediaEditor
              key={draft.slot}
              asset={draft}
              published={published}
              file={files[draft.slot]}
              inputVersion={inputVersion}
              busy={busySlot === draft.slot}
              locked={busySlot !== null}
              onAssetChange={updateDraft}
              onFileChange={(file) => setFiles((current) => ({ ...current, [draft.slot]: file }))}
              onPublish={() => publish(draft)}
              onRestore={() => restore(draft)}
            />
          );
        })}
      </div>
    </section>
  );
}

function OwnerMediaEditor({
  asset,
  published,
  file,
  inputVersion,
  busy,
  locked,
  onAssetChange,
  onFileChange,
  onPublish,
  onRestore,
}: {
  asset: SiteMediaAsset;
  published: SiteMediaAsset;
  file?: File;
  inputVersion: number;
  busy: boolean;
  locked: boolean;
  onAssetChange: (asset: SiteMediaAsset) => void;
  onFileChange: (file?: File) => void;
  onPublish: () => void;
  onRestore: () => void;
}) {
  const [viewport, setViewport] = useState<PreviewViewport>('desktop');
  const [detectedDimensions, setDetectedDimensions] = useState<FileDimensions | null>(null);
  const previewUrl = useMemo(() => file ? URL.createObjectURL(file) : null, [file]);

  useEffect(() => {
    setDetectedDimensions(null);
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const currentDimensions = file
    ? detectedDimensions
    : asset.width && asset.height
      ? { width: asset.width, height: asset.height }
      : detectedDimensions;
  const dimensionNote = getDimensionNote(asset, currentDimensions);
  const hasChanges = Boolean(file)
    || asset.alt !== published.alt
    || JSON.stringify(asset.presentation) !== JSON.stringify(published.presentation);
  const frameAspectRatio = getPreviewAspectRatio(asset, viewport, currentDimensions);
  const canReframe = asset.kind === 'showcase';
  const canPosition = asset.kind !== 'showcase' || asset.presentation.frame !== 'natural';
  const source = previewUrl ?? getSiteMediaDisplaySrc(asset);

  const setPresentation = <K extends keyof SiteMediaPresentation>(
    key: K,
    value: SiteMediaPresentation[K],
  ) => onAssetChange({
    ...asset,
    presentation: { ...asset.presentation, [key]: value },
  });

  const setFrame = (frame: SiteMediaFrame) => onAssetChange({
    ...asset,
    presentation: {
      ...asset.presentation,
      frame,
      fit: frame === 'natural' ? 'contain' : asset.presentation.fit,
    },
  });

  const previewWidth = getPreviewWidthClass(asset, viewport);

  return (
    <article className="border border-[#4a3823] bg-[#100c08] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-xl text-[#ffe7ad]">{asset.label}</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#a98a7a]">{asset.guidance}</p>
        </div>
        <div className="flex border border-[#5f4526] bg-[#0c0b09] p-1" role="group" aria-label={`${asset.label} preview size`}>
          <PreviewButton active={viewport === 'desktop'} onClick={() => setViewport('desktop')}><Monitor className="h-4 w-4" aria-hidden="true" />Desktop</PreviewButton>
          <PreviewButton active={viewport === 'mobile'} onClick={() => setViewport('mobile')}><Smartphone className="h-4 w-4" aria-hidden="true" />Mobile</PreviewButton>
        </div>
      </div>

      <div className="mt-4 rounded border border-[#3a2d1d] bg-[#090806] p-3 sm:p-5">
        <div
          className={`relative mx-auto grid w-full place-items-center overflow-hidden border border-[#5f4526] bg-[#21170d] font-serif text-4xl text-[#ffe7ad] transition-[max-width] ${previewWidth}`}
          style={{ aspectRatio: frameAspectRatio }}
        >
          {source ? (
            <ResponsiveSiteMediaImage
              media={asset}
              srcOverride={source}
              previewViewport={viewport}
              fill
              unoptimized={Boolean(previewUrl)}
              sizes={viewport === 'mobile' ? '352px' : '1024px'}
              onLoad={(event) => {
                if (!file && asset.width && asset.height) return;
                setDetectedDimensions({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                });
              }}
            />
          ) : 'CL'}
          {asset.kind === 'hero' ? (
            <div
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(7,6,5,0.97)_0%,rgba(9,8,6,0.88)_30%,rgba(9,8,6,0.42)_58%,rgba(7,6,5,0.16)_100%),linear-gradient(0deg,rgba(7,6,5,0.82)_0%,transparent_45%)]"
              style={{ opacity: asset.presentation.overlayStrength / 100 }}
              aria-hidden="true"
            />
          ) : null}
          {asset.kind === 'hero' ? <span className="relative max-w-[55%] justify-self-start p-5 text-xl font-semibold text-[#fff1c7]">Homepage headline preview</span> : null}
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.9fr)]">
        <div className="grid content-start gap-4">
          <label className="grid gap-2 text-sm text-[#c7b288]">
            Image description
            <input className={inputClassName} maxLength={300} value={asset.alt} onChange={(event) => onAssetChange({ ...asset, alt: event.target.value })} />
          </label>
          <label className="grid gap-2 text-sm text-[#c7b288]">
            Replacement image
            <input
              key={`${asset.slot}-${inputVersion}`}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className={`${inputClassName} file:mr-3 file:border-0 file:bg-[#e4aa43] file:px-3 file:py-2 file:font-semibold file:text-[#140f0a]`}
              onChange={(event) => onFileChange(event.target.files?.[0])}
            />
          </label>
          <p className={`border-l-2 px-3 text-xs leading-5 ${dimensionNote.tone === 'warning' ? 'border-[#d78943] text-[#f0bd75]' : 'border-[#5f4526] text-[#8f7b57]'}`}>
            {file ? `Selected image: ${formatDimensions(detectedDimensions)}. ` : `Current image: ${formatDimensions(currentDimensions)}. `}{dimensionNote.message}
          </p>
        </div>

        <div className="grid content-start gap-4 border border-[#3a2d1d] bg-[#0c0b09] p-4">
          <h4 className="font-semibold text-[#ffe7ad]">Responsive presentation</h4>
          {canReframe ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField label="Frame" value={asset.presentation.frame} onChange={(value) => setFrame(value as SiteMediaFrame)} options={[
                ['natural', 'Natural image'],
                ['wide', 'Landscape 16:9'],
                ['portrait', 'Portrait 4:5'],
              ]} />
              {asset.presentation.frame !== 'natural' ? (
                <SelectField label="Fit" value={asset.presentation.fit} onChange={(value) => setPresentation('fit', value as 'contain' | 'cover')} options={[
                  ['contain', 'Show full image'],
                  ['cover', 'Fill frame'],
                ]} />
              ) : null}
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="Desktop size" value={asset.presentation.desktopSize} onChange={(value) => setPresentation('desktopSize', value as SiteMediaSize)} options={sizeOptions(asset.kind)} />
            <SelectField label="Mobile size" value={asset.presentation.mobileSize} onChange={(value) => setPresentation('mobileSize', value as SiteMediaSize)} options={sizeOptions(asset.kind)} />
          </div>
          {canPosition ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a98a55]">{viewport} crop</p>
              <RangeField label="Horizontal focus" value={viewport === 'desktop' ? asset.presentation.desktopFocalX : asset.presentation.mobileFocalX} min={0} max={100} suffix="%" onChange={(value) => setPresentation(viewport === 'desktop' ? 'desktopFocalX' : 'mobileFocalX', value)} />
              <RangeField label="Vertical focus" value={viewport === 'desktop' ? asset.presentation.desktopFocalY : asset.presentation.mobileFocalY} min={0} max={100} suffix="%" onChange={(value) => setPresentation(viewport === 'desktop' ? 'desktopFocalY' : 'mobileFocalY', value)} />
              <RangeField label="Zoom" value={viewport === 'desktop' ? asset.presentation.desktopZoom : asset.presentation.mobileZoom} min={1} max={2} step={0.05} suffix="×" onChange={(value) => setPresentation(viewport === 'desktop' ? 'desktopZoom' : 'mobileZoom', value)} />
            </>
          ) : null}
          {asset.kind === 'hero' ? (
            <RangeField label="Text overlay" value={asset.presentation.overlayStrength} min={0} max={100} suffix="%" onChange={(value) => setPresentation('overlayStrength', value)} />
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#3a2d1d] pt-4">
        <p className="text-xs text-[#8f7b57]">{hasChanges ? 'Previewing unpublished changes.' : asset.updatedAt ? `Live version published ${new Date(asset.updatedAt).toLocaleString()}.` : 'Using the bundled default.'}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={locked || !asset.previousVersion} onClick={onRestore}>
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />Restore previous
          </Button>
          <Button type="button" className="bg-[#e4aa43] text-[#140f0a] hover:bg-[#f4c66b]" disabled={locked || !hasChanges || !asset.alt.trim()} onClick={onPublish}>
            <ImageUp className="mr-2 h-4 w-4" aria-hidden="true" />{busy ? 'Publishing...' : 'Publish changes'}
          </Button>
        </div>
      </div>
    </article>
  );
}

function PreviewButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`inline-flex min-h-10 items-center gap-2 px-3 text-sm font-semibold ${active ? 'bg-[#e4aa43] text-[#140f0a]' : 'text-[#c7b288] hover:bg-[#21170d]'}`}>{children}</button>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-2 text-sm text-[#c7b288]">
      {label}
      <select className={inputClassName} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

function RangeField({ label, value, min, max, step = 1, suffix, onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix: string; onChange: (value: number) => void }) {
  return (
    <label className="grid gap-2 text-sm text-[#c7b288]">
      <span className="flex justify-between gap-3"><span>{label}</span><output>{Number.isInteger(value) ? value : value.toFixed(2)}{suffix}</output></span>
      <input className="min-h-11 accent-[#e4aa43]" type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

const sizeOptions = (kind: SiteMediaAsset['kind']): Array<[SiteMediaSize, string]> => {
  if (kind === 'hero') return [['compact', 'Compact height'], ['standard', 'Standard height'], ['large', 'Tall height']];
  if (kind === 'portrait') return [['compact', 'Small portrait'], ['standard', 'Standard portrait'], ['large', 'Large portrait']];
  return [['compact', 'Compact width'], ['standard', 'Standard width'], ['large', 'Full width']];
};

const getPreviewAspectRatio = (
  asset: SiteMediaAsset,
  viewport: PreviewViewport,
  dimensions: FileDimensions | null,
): string => {
  if (asset.kind === 'hero') {
    const desktop = { compact: '21 / 9', standard: '2 / 1', large: '5 / 3' } as const;
    const mobile = { compact: '7 / 8', standard: '18 / 25', large: '5 / 8' } as const;
    return viewport === 'desktop'
      ? desktop[asset.presentation.desktopSize]
      : mobile[asset.presentation.mobileSize];
  }
  if (asset.presentation.frame === 'natural' && dimensions) {
    return `${dimensions.width} / ${dimensions.height}`;
  }
  return getSiteMediaFrameAspectRatio(asset.presentation) ?? '16 / 9';
};

const getPreviewWidthClass = (asset: SiteMediaAsset, viewport: PreviewViewport): string => {
  const size = viewport === 'desktop' ? asset.presentation.desktopSize : asset.presentation.mobileSize;
  if (viewport === 'mobile') {
    return { compact: 'max-w-56', standard: 'max-w-72', large: 'max-w-[22rem]' }[size];
  }
  if (asset.kind === 'portrait') {
    return { compact: 'max-w-48', standard: 'max-w-64', large: 'max-w-80' }[size];
  }
  return { compact: 'max-w-2xl', standard: 'max-w-4xl', large: 'max-w-5xl' }[size];
};
