"use client";

import { useState } from 'react';
import type { CardFace } from '@/domain/cards';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  getRasterExportDimensionsPx,
  getRasterExportQualityOption,
  validateCardExportQuality,
  type ExportMode,
} from '@/features/card-generator/lib/printValidation';
import { extractErrorMessage, withNextStep } from '@/shared/userFacingErrors';
import { ERROR_COPY } from '@/features/card-generator/lib/errorCopy';
import { renderCardToCanvas, resolveCardExportWatermark } from '@/features/card-generator/lib/cardPreviewExport';
import { hasCardBacking } from '@/domain/rendering';
import type { DisplayCard } from '@/domain/rendering';
import { trackExportCompleted, trackExportFailed, trackExportStarted } from '@/features/analytics/client/tracking';
import { useBrandPresentation } from '@/features/brand-presentation/client';

interface ExportCardImageButtonProps {
  card: DisplayCard;
  exportMode: ExportMode;
  exportDpi: number;
  richTextHighlightColor: string;
  canExportClean: boolean;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  iconOnly?: boolean;
}

export function ExportCardImageButton({ card, exportMode, exportDpi, richTextHighlightColor, canExportClean, disabled = false, className, ariaLabel, iconOnly = false }: ExportCardImageButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const brand = useBrandPresentation();

  const hasBackFace = hasCardBacking(card);

  const handleExport = async (format: 'png' | 'webp' | 'jpeg', face: CardFace = 'front') => {
    setIsLoading(true);
    trackExportStarted('image', 1);
    try {
      const validation = validateCardExportQuality(card, exportMode, exportDpi);
      if (validation.critical.length > 0) {
        throw new Error(validation.critical.slice(0, 2).join(' '));
      }
      if (validation.warnings.length > 0) {
        toast({
          title: ERROR_COPY.exportWarnings.title,
          description: withNextStep(validation.warnings.slice(0, 2).join(' '), 'Review the card preview for quality issues before sharing or printing.'),
          duration: 7000,
        });
      }

      const canvas = await renderCardToCanvas(
        card,
        exportMode,
        exportDpi,
        face,
        richTextHighlightColor,
        resolveCardExportWatermark(canExportClean, brand),
      );
      const mimeType = format === 'webp'
        ? 'image/webp'
        : format === 'jpeg'
          ? 'image/jpeg'
          : 'image/png';
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, 0.95));
      if (!blob) throw new Error('Failed to create image blob.');
      if (blob.type !== mimeType) {
        throw new Error(`${format.toUpperCase()} export is not supported by this browser. Choose PNG instead.`);
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const cardName = (card.data?.cardName || card.data?.title || card.data?.name || 'card') as string;
      link.href = url;
      link.download = `${String(cardName).replace(/\s+/g, '-').toLowerCase()}-${face}.${format === 'jpeg' ? 'jpg' : format}`;
      link.click();
      URL.revokeObjectURL(url);
      trackExportCompleted('image', 1);
      const dimensions = getRasterExportDimensionsPx(card, exportMode, exportDpi);
      const quality = getRasterExportQualityOption(exportDpi);
      toast({
        title: 'Card downloaded',
        description: `Saved as ${format.toUpperCase()} at ${dimensions.widthPx} × ${dimensions.heightPx}px using ${quality.label.toLowerCase()} raster quality${canExportClean ? '' : ' with the CardForge watermark'}. Enlarging beyond these pixels will soften the image.`,
      });
    } catch (err) {
      trackExportFailed('image', 'render_or_download', 1);
      toast({
        title: ERROR_COPY.exportFailed.title,
        description: withNextStep(extractErrorMessage(err), 'Check quality warnings, then retry with PNG if the selected browser format is not supported.'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={iconOnly ? 'icon' : undefined}
          disabled={disabled || isLoading}
          className={className}
          aria-label={ariaLabel ?? 'Download individual card'}
          title="Download individual card"
          data-testid="single-card-export-trigger"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {iconOnly ? <span className="sr-only">Download individual card</span> : 'Download image'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem data-testid="single-card-export-png-front" onClick={() => handleExport('png', 'front')}>Download front as PNG</DropdownMenuItem>
        {hasBackFace ? <DropdownMenuItem onClick={() => handleExport('png', 'back')}>Download back as PNG</DropdownMenuItem> : null}
        <DropdownMenuItem onClick={() => handleExport('jpeg', 'front')}>Download front as JPEG</DropdownMenuItem>
        {hasBackFace ? <DropdownMenuItem onClick={() => handleExport('jpeg', 'back')}>Download back as JPEG</DropdownMenuItem> : null}
        <DropdownMenuItem onClick={() => handleExport('webp', 'front')}>Download front as WebP</DropdownMenuItem>
        {hasBackFace ? <DropdownMenuItem onClick={() => handleExport('webp', 'back')}>Download back as WebP</DropdownMenuItem> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
