"use client";

import { useEffect, useRef, useState } from 'react';
import { ImageUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import type { OwnerConsolePayload } from '@/features/owner/lib/ownerConsole';
import { getOwnerApiErrorMessage } from '@/features/owner/model/ownerConsoleClient';
import { getSiteMediaDisplaySrc, type SiteMediaAsset } from '@/features/public-site/client';

const UPLOAD_TIMEOUT_MS = 30_000;
const inputClassName = 'border border-[#5f4526] bg-[#0c0b09] p-3 text-sm leading-6 text-[#ffe7ad] outline-none focus:border-[#d8b365]';

export function OwnerHomepageMediaPanel({
  consolePayload,
  onConsoleChange,
}: {
  consolePayload: OwnerConsolePayload;
  onConsoleChange: (payload: OwnerConsolePayload) => void;
}) {
  const { toast } = useToast();
  const [media, setMedia] = useState(consolePayload.siteMedia);
  const [files, setFiles] = useState<Partial<Record<SiteMediaAsset['slot'], File>>>({});
  const [uploadingSlot, setUploadingSlot] = useState<SiteMediaAsset['slot'] | null>(null);
  const inputs = useRef<Partial<Record<SiteMediaAsset['slot'], HTMLInputElement | null>>>({});

  useEffect(() => setMedia(consolePayload.siteMedia), [consolePayload.siteMedia]);

  const updateAlt = (slot: SiteMediaAsset['slot'], alt: string) => {
    setMedia((current) => current.map((asset) => asset.slot === slot ? { ...asset, alt } : asset));
  };

  const upload = async (asset: SiteMediaAsset) => {
    const image = files[asset.slot];
    if (!image) {
      toast({ title: 'Choose an image', description: `Select a replacement for ${asset.label.toLowerCase()} first.`, variant: 'destructive' });
      return;
    }
    setUploadingSlot(asset.slot);
    try {
      const body = new FormData();
      body.set('image', image);
      body.set('alt', asset.alt);
      const response = await fetch(`/api/owner/site-media/${asset.slot}`, {
        method: 'POST',
        body,
        signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(await getOwnerApiErrorMessage(response, 'Unable to upload the homepage image.'));
      const result = await response.json() as { console: OwnerConsolePayload };
      onConsoleChange(result.console);
      setFiles((current) => ({ ...current, [asset.slot]: undefined }));
      const input = inputs.current[asset.slot];
      if (input) input.value = '';
      toast({ title: 'Homepage image published', description: `${asset.label} is live without a deploy.` });
    } catch (error) {
      const message = error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError')
        ? 'This upload took too long. The current homepage image is unchanged; try a smaller image or try again.'
        : error instanceof Error
          ? error.message
          : 'Unable to upload the homepage image.';
      toast({ title: 'Homepage image not uploaded', description: message, variant: 'destructive' });
    } finally {
      setUploadingSlot(null);
    }
  };

  return (
    <section className="border border-[#4a3823] bg-[#100c08] p-4">
      <div>
        <h3 className="font-serif text-xl text-[#ffe7ad]">Homepage images</h3>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-[#a98a7a]">Replace the cover or Studio walkthrough images here. CardForge keeps the current image live until the new one has finished processing and publishing.</p>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {media.map((asset) => (
          <article key={asset.slot} className="grid gap-3 border border-[#3a2d1d] bg-[#0c0b09] p-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <img
              src={getSiteMediaDisplaySrc(asset)}
              alt=""
              className="aspect-[4/5] h-full max-h-52 w-full border border-[#5f4526] bg-[#21170d] object-cover"
            />
            <div className="grid content-start gap-3">
              <div>
                <h4 className="font-semibold text-[#ffe7ad]">{asset.label}</h4>
                <p className="mt-1 text-xs leading-5 text-[#8f7b57]">JPEG, PNG, or WebP up to 12 MB. CardForge auto-rotates, scales down when needed, and publishes an optimized WebP.</p>
              </div>
              <label className="grid gap-2 text-sm text-[#c7b288]">
                Image description
                <input className={inputClassName} maxLength={300} value={asset.alt} onChange={(event) => updateAlt(asset.slot, event.target.value)} />
              </label>
              <label className="grid gap-2 text-sm text-[#c7b288]">
                New image file
                <input
                  ref={(node) => { inputs.current[asset.slot] = node; }}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className={`${inputClassName} file:mr-3 file:border-0 file:bg-[#e4aa43] file:px-3 file:py-2 file:font-semibold file:text-[#140f0a]`}
                  onChange={(event) => setFiles((current) => ({ ...current, [asset.slot]: event.target.files?.[0] }))}
                />
              </label>
              <Button className="w-fit" variant="outline" disabled={uploadingSlot !== null} onClick={() => upload(asset)}>
                <ImageUp className="mr-2 h-4 w-4" aria-hidden="true" />
                {uploadingSlot === asset.slot ? 'Publishing image...' : 'Upload and publish'}
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
