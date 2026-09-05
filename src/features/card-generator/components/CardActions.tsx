"use client";

import type { DisplayCard } from '@/domain/rendering';
import { useProjectStore } from '@/features/project/client/workspace';
import { ExportCardImageButton } from './ExportCardImageButton';
import { ExportCardTransferButton } from './ExportCardTransferButton';
import { ShareCardButton } from './ShareCardButton';

/** Actions for one authored card, using the same export settings as Set output. */
export function CardActions({ card, canExportClean, canUseProjectFiles }: { card: DisplayCard; canExportClean: boolean; canUseProjectFiles: boolean }) {
  const exportMode = useProjectStore((state) => state.exportMode);
  const exportDpi = useProjectStore((state) => state.exportDpi);
  const richTextHighlightColor = useProjectStore((state) => state.richTextHighlightColor);
  const settings = { card, exportMode, exportDpi, richTextHighlightColor };

  return <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Card downloads and sharing">
    <ExportCardImageButton {...settings} canExportClean={canExportClean} />
    <ShareCardButton {...settings} />
    <ExportCardTransferButton cardUniqueId={card.uniqueId} canUseProjectFiles={canUseProjectFiles} />
  </div>;
}
