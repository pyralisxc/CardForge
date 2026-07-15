import Image from 'next/image';

import {
  CARD_WATERMARK_URL,
  GENERATED_PREVIEW_WATERMARK_OPACITY,
  GENERATED_PREVIEW_WATERMARK_WIDTH_PERCENT,
} from '@/features/card-generator/lib/cardWatermarkPolicy';

export function CardWatermarkOverlay({
  testId = 'generated-card-watermark',
}: {
  testId?: string;
}) {
  return (
    <Image
      src={CARD_WATERMARK_URL}
      alt=""
      aria-hidden="true"
      data-testid={testId}
      draggable={false}
      width={1000}
      height={260}
      unoptimized
      className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-auto -translate-x-1/2 -translate-y-1/2 select-none"
      style={{
        opacity: GENERATED_PREVIEW_WATERMARK_OPACITY,
        width: `${GENERATED_PREVIEW_WATERMARK_WIDTH_PERCENT}%`,
      }}
    />
  );
}
