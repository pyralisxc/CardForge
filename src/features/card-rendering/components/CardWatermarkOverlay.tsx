import Image from 'next/image';
import { useBrandPresentation } from '@/features/brand-presentation/client';

export function CardWatermarkOverlay({
  testId = 'generated-card-watermark',
}: {
  testId?: string;
}) {
  const brand = useBrandPresentation();
  return (
    <Image
      src={brand.watermarkUrl}
      alt=""
      aria-hidden="true"
      data-testid={testId}
      draggable={false}
      width={brand.watermarkWidth}
      height={brand.watermarkHeight}
      unoptimized
      className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-auto -translate-x-1/2 -translate-y-1/2 select-none"
      style={{
        opacity: brand.watermarkPreviewOpacity,
        width: `${brand.watermarkWidthPercent}%`,
      }}
    />
  );
}
