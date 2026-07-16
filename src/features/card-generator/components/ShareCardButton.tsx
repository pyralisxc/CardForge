"use client";

import { useState } from 'react';
import { Download, Share2 } from 'lucide-react';

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
import { useToast } from '@/hooks/use-toast';
import type { DisplayCard } from '@/domain/rendering';


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
  ariaLabel,
}: {
  card: DisplayCard;
  exportMode: ExportMode;
  exportDpi: number;
  ariaLabel?: string;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<SocialSharePreset>('square');
  const [working, setWorking] = useState(false);

  const createImage = async () => renderSocialShareImage({ card, preset, exportMode, exportDpi });

  const share = async () => {
    setWorking(true);
    try {
      const blob = await createImage();
      const file = new File([blob], safeFileName(card, preset), { type: 'image/png' });
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({
          files: [file],
          title: 'Made with CardForge',
          text: 'Built with CardForge Studio',
          url: 'https://cardforges.com/studio',
        });
        toast({ title: 'Share ready', description: 'Your watermarked CardForge image was sent to the share sheet.' });
      } else {
        downloadSocialShareImage(blob, file.name);
        toast({ title: 'Social image downloaded', description: 'This browser does not expose a share sheet, so the watermarked image was downloaded.' });
      }
      setOpen(false);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
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
    try {
      const blob = await createImage();
      downloadSocialShareImage(blob, safeFileName(card, preset));
      toast({ title: 'Social image downloaded', description: `${SOCIAL_SHARE_PRESETS[preset].label} image saved with a centered CardForge watermark.` });
      setOpen(false);
    } catch (error) {
      toast({ title: 'Unable to create image', description: error instanceof Error ? error.message : 'The social image could not be created.', variant: 'destructive' });
    } finally {
      setWorking(false);
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
