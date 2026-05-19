"use client";

import type { TCGCardTemplate } from '@/types';
import { TCG_ASPECT_RATIO } from '@/lib/constants';
import { CardPreview } from '@/components/card-forge/CardPreview';

export function TemplateThumbnail({ template }: { template: TCGCardTemplate }) {
  const previewWidth = 220;
  const frameWidth = 52;
  const frameHeight = 68;
  const [ratioW, ratioH] = (template.aspectRatio || TCG_ASPECT_RATIO).split(':').map(Number);
  const previewHeight = ratioW > 0 && ratioH > 0 ? (previewWidth / ratioW) * ratioH : 308;
  const scale = Math.min(frameWidth / previewWidth, frameHeight / previewHeight);

  return (
    <span className="relative flex h-[72px] w-[58px] shrink-0 items-center justify-center overflow-hidden rounded-[5px] border border-[#3a4252] bg-[#06080d] shadow-inner">
      <span
        className="absolute left-1/2 top-1/2 block"
        style={{
          width: previewWidth,
          height: previewHeight,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: 'center',
        }}
      >
        <CardPreview
          card={{ template, data: template.templatePreviewData || {}, uniqueId: `${template.id}-sidebar-preview` }}
          targetWidthPx={previewWidth}
        />
      </span>
    </span>
  );
}
