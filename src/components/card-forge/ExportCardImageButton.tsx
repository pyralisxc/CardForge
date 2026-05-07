"use client";

import { useState, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { toCanvas } from 'html-to-image';
import type { DisplayCard } from '@/types';
import { Button } from '@/components/ui/button';
import { Loader2, ImageDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { TCG_ASPECT_RATIO } from '@/lib/constants';
import { CardPreview } from './CardPreview';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ExportCardImageButtonProps {
  card: DisplayCard;
  disabled?: boolean;
  className?: string;
}

const EXPORT_WIDTH_PX = 744; // ~300dpi at standard TCG 63mm width

async function renderCardToCanvas(card: DisplayCard): Promise<HTMLCanvasElement> {
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:-9999px;z-index:-1;';
  document.body.appendChild(container);

  const [aspectW, aspectH] = (card.template.aspectRatio || TCG_ASPECT_RATIO).split(':').map(Number);
  const exportHeight = Math.round((EXPORT_WIDTH_PX / (aspectW || 63)) * (aspectH || 88));

  const mountEl = createElement(CardPreview, {
    card,
    isPrintMode: true,
    targetWidthPx: EXPORT_WIDTH_PX,
  });

  const mountedRoots: Root[] = [];
  const root = createRoot(container);
  mountedRoots.push(root);
  root.render(mountEl);

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  const cardEl = container.firstChild as HTMLElement | null;
  if (!cardEl) {
    document.body.removeChild(container);
    throw new Error('Card element did not render.');
  }

  const canvas = await toCanvas(cardEl as HTMLElement, {
    pixelRatio: 3,
    width: EXPORT_WIDTH_PX,
    height: exportHeight,
    skipFonts: false,
    fetchRequestInit: { mode: 'cors' },
  });

  mountedRoots.forEach((r) => r.unmount());
  document.body.removeChild(container);
  return canvas;
}

export function ExportCardImageButton({ card, disabled = false, className }: ExportCardImageButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleExport = async (format: 'png' | 'webp') => {
    setIsLoading(true);
    try {
      const canvas = await renderCardToCanvas(card);
      const mimeType = format === 'webp' ? 'image/webp' : 'image/png';
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, 0.95));
      if (!blob) throw new Error('Failed to create image blob.');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const cardName = (card.data?.cardName || card.data?.title || card.data?.name || 'card') as string;
      link.href = url;
      link.download = `${String(cardName).replace(/\s+/g, '-').toLowerCase()}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Card exported', description: `Saved as ${format.toUpperCase()} at ~300 DPI.` });
    } catch (err) {
      toast({ title: 'Export failed', description: String(err), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled || isLoading} className={className}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />}
          Export Image
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('png')}>Export as PNG</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('webp')}>Export as WebP</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
