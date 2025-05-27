"use client";

import type { SimplifiedCardTemplate, CardData } from '@/types';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface CardPreviewProps {
  template: SimplifiedCardTemplate;
  data: CardData;
  previewSize?: { width: number; height?: number; aspectRatio?: string }; // width in px, height or aspectRatio
  className?: string;
  isPrintMode?: boolean;
}

function replacePlaceholders(text: string | undefined, data: CardData): string {
  if (!text) return '';
  let result = text;
  for (const key in data) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(data[key]));
  }
  // Remove any unreplaced placeholders
  result = result.replace(/{{\w+}}/g, '');
  return result;
}

export function CardPreview({ template, data, previewSize = { width: 250 }, className, isPrintMode = false }: CardPreviewProps) {
  const [aspectWidth, aspectHeight] = template.aspectRatio.split(':').map(Number);
  
  const containerStyle: React.CSSProperties = {
    backgroundColor: template.backgroundColor || '#FFFFFF',
    color: template.textColor || '#000000',
    aspectRatio: `${aspectWidth} / ${aspectHeight}`,
    width: isPrintMode ? '100%' : `${previewSize.width}px`,
    height: isPrintMode ? '100%' : (previewSize.height ? `${previewSize.height}px` : 'auto'),
    overflow: 'hidden',
  };

  const title = replacePlaceholders(template.titlePlaceholder, data);
  const body = replacePlaceholders(template.bodyPlaceholder, data);

  return (
    <div
      className={cn(
        "card-preview border border-muted shadow-lg rounded-md flex flex-col p-4 relative",
        isPrintMode ? "card-preview-print" : "",
        className
      )}
      style={containerStyle}
      data-ai-hint="card design"
    >
      {title && <h3 className="text-xl font-semibold mb-2 break-words line-clamp-2">{title}</h3>}
      
      {template.imageSlot && template.imageSrc && (
        <div className="my-2 flex-grow flex items-center justify-center">
          <Image
            src={data.imageSrc as string || template.imageSrc}
            alt={title || "Card image"}
            width={isPrintMode ? aspectWidth * 20 : aspectWidth * 40} // Adjust multiplier for desired relative size
            height={isPrintMode ? aspectHeight * 20 : aspectHeight * 40}
            className="object-contain max-h-[150px] rounded"
            data-ai-hint="greeting illustration"
          />
        </div>
      )}
      
      {body && <p className="text-sm mt-auto break-words line-clamp-4">{body}</p>}
    </div>
  );
}
