"use client";

import { useState } from 'react';
import type { CardFace, DisplayCard } from '@/types';
import { Button } from '@/components/ui/button';
import { Loader2, ImageDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getExportProfile, validateCardExportQuality, type ExportMode } from '@/lib/printValidation';
import { extractErrorMessage, withNextStep } from '@/lib/userFacingErrors';
import { ERROR_COPY } from '@/lib/errorCopy';
import { renderCardToCanvas } from '@/lib/cardPreviewExport';

interface ExportCardImageButtonProps {
  card: DisplayCard;
  exportMode: ExportMode;
  exportDpi: number;
  disabled?: boolean;
  gateMessage?: string | null;
  className?: string;
  ariaLabel?: string;
}

export function ExportCardImageButton({ card, exportMode, exportDpi, disabled = false, gateMessage, className, ariaLabel }: ExportCardImageButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const hasBackFace = Boolean(card.template.backCanvas);

  const handleExport = async (format: 'png' | 'webp' | 'jpeg' | 'tiff', face: CardFace = 'front') => {
    if (gateMessage) {
      toast({
        title: 'Clean export locked',
        description: withNextStep(gateMessage, 'Use Creator Pass or dev access when auth is enabled, or use dev mode for local validation.'),
        variant: 'default',
      });
      return;
    }

    setIsLoading(true);
    try {
      const validation = validateCardExportQuality(card, exportMode, exportDpi);
      if (validation.critical.length > 0) {
        throw new Error(validation.critical.slice(0, 2).join(' '));
      }
      if (validation.warnings.length > 0) {
        toast({
          title: ERROR_COPY.exportWarnings.title,
          description: withNextStep(validation.warnings.slice(0, 2).join(' '), 'Review the output preview for quality issues before sharing or printing.'),
          duration: 7000,
        });
      }

      const canvas = await renderCardToCanvas(card, exportMode, exportDpi, face);
      const mimeType = format === 'webp'
        ? 'image/webp'
        : format === 'jpeg'
          ? 'image/jpeg'
          : format === 'tiff'
            ? 'image/tiff'
            : 'image/png';
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, 0.95));
      if (!blob && format === 'tiff') {
        throw new Error('TIFF export is not supported by this browser. Use PNG for print-vendor workflows or convert externally.');
      }
      if (!blob) throw new Error('Failed to create image blob.');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const cardName = (card.data?.cardName || card.data?.title || card.data?.name || 'output') as string;
      link.href = url;
      link.download = `${String(cardName).replace(/\s+/g, '-').toLowerCase()}-${face}.${format === 'jpeg' ? 'jpg' : format}`;
      link.click();
      URL.revokeObjectURL(url);
      const exportProfile = getExportProfile(exportMode, exportDpi);
      toast({
        title: 'Output exported',
        description: `Saved as ${format.toUpperCase()} using ${exportProfile.label} (${exportProfile.dpi} DPI). Next step: review output quality before final delivery.`,
      });
    } catch (err) {
      toast({
        title: ERROR_COPY.exportFailed.title,
        description: withNextStep(extractErrorMessage(err), 'Check quality warnings, then retry with PNG if the selected format is not supported.'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled || isLoading} className={className} aria-label={ariaLabel}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />}
          Export Image
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('png', 'front')}>Export front as PNG</DropdownMenuItem>
        {hasBackFace ? <DropdownMenuItem onClick={() => handleExport('png', 'back')}>Export back as PNG</DropdownMenuItem> : null}
        <DropdownMenuItem onClick={() => handleExport('jpeg', 'front')}>Export front as JPEG</DropdownMenuItem>
        {hasBackFace ? <DropdownMenuItem onClick={() => handleExport('jpeg', 'back')}>Export back as JPEG</DropdownMenuItem> : null}
        <DropdownMenuItem onClick={() => handleExport('webp', 'front')}>Export front as WebP</DropdownMenuItem>
        {hasBackFace ? <DropdownMenuItem onClick={() => handleExport('webp', 'back')}>Export back as WebP</DropdownMenuItem> : null}
        <DropdownMenuItem onClick={() => handleExport('tiff', 'front')}>Export front as TIFF (beta)</DropdownMenuItem>
        {hasBackFace ? <DropdownMenuItem onClick={() => handleExport('tiff', 'back')}>Export back as TIFF (beta)</DropdownMenuItem> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
