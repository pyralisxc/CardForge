"use client";

import { useState } from 'react';
import { Copy, Download, Share2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  downloadSocialShareImage,
  renderSocialShareImage,
  SOCIAL_SHARE_PRESETS,
  type SocialSharePreset,
} from '@/features/card-generator/lib/socialShareExport';
import type { ExportMode } from '@/features/card-generator/lib/printValidation';
import { useToast } from '@/components/ui/use-toast';
import type { DisplayCard } from '@/domain/rendering';
import { usePublicShareSettings } from './PublicShareSettingsContext';
import { useBrandPresentation } from '@/features/brand-presentation/client';
import { trackExportCompleted, trackExportFailed, trackExportStarted } from '@/features/analytics/client/tracking';


const safeFileName = (card: DisplayCard, preset: SocialSharePreset) => {
  const name = String(card.data.cardName || card.data.name || card.template.name || 'card')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'card';
  return `cardforge-${name}-${preset}.png`;
};

export function ShareCardButton({
  card,
  exportMode,
  exportDpi,
  richTextHighlightColor,
  ariaLabel,
}: {
  card: DisplayCard;
  exportMode: ExportMode;
  exportDpi: number;
  richTextHighlightColor: string;
  ariaLabel?: string;
}) {
  const { toast } = useToast();
  const shareSettings = usePublicShareSettings();
  const brand = useBrandPresentation();
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<SocialSharePreset>('square');
  const [working, setWorking] = useState(false);

  const createImage = async () => renderSocialShareImage({
    card,
    preset,
    exportMode,
    exportDpi,
    richTextHighlightColor,
    watermark: {
      url: brand.watermarkUrl,
      width: brand.watermarkWidth,
      height: brand.watermarkHeight,
      widthPercent: brand.watermarkWidthPercent,
      opacity: brand.watermarkShareOpacity,
    },
  });

  const share = async () => {
    setWorking(true);
    trackExportStarted('social_image', 1);
    try {
      const blob = await createImage();
      const file = new File([blob], safeFileName(card, preset), { type: 'image/png' });
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({
          files: [file],
          title: brand.brandName,
          text: shareSettings.message,
          url: shareSettings.homepageUrl,
        });
        toast({ title: 'Share ready', description: 'Your watermarked CardForge image was sent to the share sheet.' });
      } else {
        downloadSocialShareImage(blob, file.name);
        toast({ title: 'Social image downloaded', description: 'This browser does not expose a share sheet, so the watermarked image was downloaded.' });
      }
      trackExportCompleted('social_image', 1);
      setOpen(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      trackExportFailed('social_image', 'share', 1);
      toast({
        title: 'Unable to share card',
        description: error instanceof Error ? error.message : 'The social image could not be created.',
        variant: 'destructive',
      });
    } finally {
      setWorking(false);
    }
  };

  const download = async () => {
    setWorking(true);
    trackExportStarted('social_image', 1);
    try {
      const blob = await createImage();
      downloadSocialShareImage(blob, safeFileName(card, preset));
      trackExportCompleted('social_image', 1);
      toast({ title: 'Social image downloaded', description: `${SOCIAL_SHARE_PRESETS[preset].label} image saved with a centered CardForge watermark.` });
      setOpen(false);
    } catch (error) {
      trackExportFailed('social_image', 'render_or_download', 1);
      toast({ title: 'Unable to create image', description: error instanceof Error ? error.message : 'The social image could not be created.', variant: 'destructive' });
    } finally {
      setWorking(false);
    }
  };

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(`${shareSettings.message}\n\n${shareSettings.homepageUrl}`);
      toast({ title: 'Caption copied', description: 'The owner-approved message and CardForge link are ready to paste.' });
    } catch {
      toast({ title: 'Caption not copied', description: 'Your browser blocked clipboard access. The message remains visible in this window.', variant: 'destructive' });
    }
  };

  return (
    <>
      <Button type="button" size="icon" variant="secondary" onClick={() => setOpen(true)} aria-label={ariaLabel ?? 'Share card'} title="Share card">
        <Share2 className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Card</DialogTitle>
            <DialogDescription>Create a social-ready image with a translucent CardForge watermark centered over the card. Normal entitled exports remain clean.</DialogDescription>
          </DialogHeader>
          <Select value={preset} onValueChange={(value) => setPreset(value as SocialSharePreset)}>
            <SelectTrigger aria-label="Social image size"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(SOCIAL_SHARE_PRESETS).map(([value, option]) => (
                <SelectItem key={value} value={value}>{option.label} — {option.width}×{option.height}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="rounded-md border border-border bg-muted/40 p-3">
            <p className="text-sm leading-6">{shareSettings.message}</p>
            <p className="mt-1 break-all text-sm text-muted-foreground">{shareSettings.homepageUrl}</p>
            <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={copyCaption}>
              <Copy className="mr-2 h-4 w-4" />Copy caption &amp; link
            </Button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={download} disabled={working}>
              <Download className="mr-2 h-4 w-4" />Download
            </Button>
            <Button type="button" onClick={share} disabled={working}>
              <Share2 className="mr-2 h-4 w-4" />{working ? 'Creating...' : 'Share'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
