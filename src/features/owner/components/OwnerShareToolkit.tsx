"use client";

import { useRef } from 'react';
import { Check, Copy, Download, Share2 } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { usePublicShareSettings } from '@/features/card-generator/client';

interface QrAssetCardProps {
  fileName: string;
  label: string;
  message: string;
  url: string;
}

const canvasBlob = (canvas: HTMLCanvasElement): Promise<Blob> => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error('Unable to create the QR code image.'));
  }, 'image/png');
});

const saveBlob = (blob: Blob, fileName: string) => {
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(downloadUrl);
};

function QrAssetCard({ fileName, label, message, url }: QrAssetCardProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const getFile = async () => {
    if (!canvasRef.current) throw new Error('The QR code is still loading.');
    return new File([await canvasBlob(canvasRef.current)], fileName, { type: 'image/png' });
  };

  const download = async () => {
    try {
      const file = await getFile();
      saveBlob(file, file.name);
      toast({ title: 'QR code downloaded', description: `${label} is ready to share.` });
    } catch (error) {
      toast({
        title: 'QR code not downloaded',
        description: error instanceof Error ? error.message : 'Unable to create the QR code image.',
        variant: 'destructive',
      });
    }
  };

  const share = async () => {
    try {
      const file = await getFile();
      if (navigator.share) {
        const shareData: ShareData = {
          title: label,
          text: message,
          url,
        };
        if (!navigator.canShare || navigator.canShare({ files: [file] })) {
          shareData.files = [file];
        }
        await navigator.share(shareData);
        toast({ title: 'QR code shared', description: `${label} was sent to your share sheet.` });
        return;
      }
      saveBlob(file, file.name);
      toast({ title: 'QR code downloaded', description: 'This browser does not expose a share sheet, so the PNG was downloaded.' });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast({
        title: 'QR code not shared',
        description: error instanceof Error ? error.message : 'Unable to share the QR code.',
        variant: 'destructive',
      });
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${message}\n\n${url}`);
      toast({ title: 'Share text copied', description: `${label} message and link copied.` });
    } catch {
      toast({ title: 'Share text not copied', description: 'Copy the visible link manually from this card.', variant: 'destructive' });
    }
  };

  return (
    <article className="grid gap-4 border border-[#4a3823] bg-[#100c08] p-4 sm:grid-cols-[12rem_1fr] sm:items-center">
      <div className="overflow-hidden rounded-md bg-[#fffaf0] p-2">
        <QRCodeCanvas
          ref={canvasRef}
          value={url}
          size={1024}
          level="M"
          marginSize={4}
          bgColor="#fffaf0"
          fgColor="#0c0b09"
          title={label}
          aria-label={label}
          className="h-auto w-full"
        />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[#ffe7ad]">
          <Check className="h-4 w-4 text-[#9cc987]" aria-hidden="true" />
          <h4 className="font-serif text-xl">{label}</h4>
        </div>
        <p className="mt-2 break-all text-sm leading-6 text-[#c7b288]">{url}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={download}>
            <Download className="mr-2 h-4 w-4" />Download PNG
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={share}>
            <Share2 className="mr-2 h-4 w-4" />Share QR code
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={copy}>
            <Copy className="mr-2 h-4 w-4" />Copy message &amp; link
          </Button>
        </div>
      </div>
    </article>
  );
}

export function OwnerShareToolkit({ message }: { message: string }) {
  const settings = usePublicShareSettings();

  return (
    <section className="border border-[#6d4f2b] bg-[#15100a] p-5" aria-labelledby="share-toolkit-heading">
      <h3 id="share-toolkit-heading" className="font-serif text-2xl text-[#fff1c7]">Reusable share kit</h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#c7b288]">
        These high-resolution PNGs always point to the live public pages. The share actions pair them with the message above; they stay separate from generated card images.
      </p>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <QrAssetCard
          fileName="cardforge-homepage-qr.png"
          label="Homepage QR code"
          message={message}
          url={settings.homepageUrl}
        />
        <QrAssetCard
          fileName="cardforge-cameron-qr.png"
          label="Cameron page QR code"
          message={message}
          url={settings.cameronUrl}
        />
      </div>
    </section>
  );
}
