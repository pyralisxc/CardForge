import Image from 'next/image';
import { Globe2, Heart, ImageOff, MessageCircle, Share2, ThumbsUp } from 'lucide-react';

import {
  MARKETING_CHANNEL_LABELS,
  type MarketingChannelVariant,
} from '@/features/marketing-content/model';
import type { CampaignMediaExpectation } from '@/features/marketing-content/client/campaignWorkflow';

const getDestinationLabel = (destinationUrl: string) => {
  if (!destinationUrl) return 'cardforges.com';
  try {
    return new URL(destinationUrl).hostname.replace(/^www\./u, '');
  } catch {
    return 'cardforges.com';
  }
};

export function CampaignProviderPreview({
  variant,
  destinationUrl,
  callToAction,
  mediaExpectation,
  compact = false,
}: {
  variant: MarketingChannelVariant;
  destinationUrl: string;
  callToAction?: string;
  mediaExpectation: CampaignMediaExpectation;
  compact?: boolean;
}) {
  const attachment = variant.attachments[0];
  const isInstagram = variant.service === 'instagram';
  const serviceLabel = MARKETING_CHANNEL_LABELS[variant.service];

  return (
    <section aria-label={`${serviceLabel} provider preview`} className="overflow-hidden border border-[#4a3823] bg-[#0c0b09]">
      <div className="flex items-center justify-between gap-3 border-b border-[#4a3823] px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#e2aa4a]">
          {serviceLabel} preview
        </p>
        <p className="text-[11px] text-[#a98a55]">Preview only · nothing published</p>
      </div>

      <div className={isInstagram ? 'bg-black text-white' : 'bg-white text-[#1c1e21]'}>
        <header className="flex items-center gap-3 px-4 py-3">
          <Image
            src="/brand/cardforge-studio/brand-mark.svg"
            alt=""
            aria-hidden="true"
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 rounded-full bg-[#20150b] object-contain p-1"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">CardForge</p>
            <p className={`flex items-center gap-1 text-xs ${isInstagram ? 'text-[#a8a8a8]' : 'text-[#65676b]'}`}>
              Just now <span aria-hidden="true">·</span> <Globe2 className="h-3 w-3" />
            </p>
          </div>
        </header>

        <p className={`${compact ? 'line-clamp-5' : ''} whitespace-pre-wrap px-4 pb-3 text-sm leading-5`}>
          {variant.text || 'Channel copy will appear here as it is written.'}
        </p>

        {attachment ? (
          <div className="relative bg-[#111]">
            <Image
              src={attachment.media.previewUrl}
              alt={attachment.altText}
              width={1080}
              height={1350}
              unoptimized
              className="aspect-[4/5] w-full object-cover"
            />
            {variant.attachments.length > 1 ? (
              <span className="absolute right-3 top-3 rounded-full bg-black/75 px-2 py-1 text-xs text-white">
                1 / {variant.attachments.length}
              </span>
            ) : null}
          </div>
        ) : (
          <div className={`grid min-h-44 place-items-center border-y border-dashed px-6 py-8 text-center ${isInstagram ? 'border-[#3a3a3a] bg-[#111]' : 'border-[#d8dade] bg-[#f5f6f7]'}`}>
            <div>
              <ImageOff className={`mx-auto h-6 w-6 ${isInstagram ? 'text-[#8a8a8a]' : 'text-[#65676b]'}`} />
              <p className="mt-2 text-sm font-semibold">{mediaExpectation.label}</p>
              <p className={`mt-1 text-xs ${isInstagram ? 'text-[#a8a8a8]' : 'text-[#65676b]'}`}>
                {mediaExpectation.guidance}
              </p>
            </div>
          </div>
        )}

        {destinationUrl ? (
          <div className={`border-b px-4 py-3 ${isInstagram ? 'border-[#262626] bg-[#0d0d0d]' : 'border-[#dddfe2] bg-[#f0f2f5]'}`}>
            <p className={`text-[11px] uppercase ${isInstagram ? 'text-[#a8a8a8]' : 'text-[#65676b]'}`}>{getDestinationLabel(destinationUrl)}</p>
            <p className="mt-0.5 text-sm font-semibold">{callToAction || 'Learn more'}</p>
          </div>
        ) : null}

        <footer className={`grid grid-cols-3 border-t px-2 py-1 text-xs font-semibold ${isInstagram ? 'border-[#262626] text-[#d6d6d6]' : 'border-[#dddfe2] text-[#65676b]'}`}>
          <span className="flex min-h-9 items-center justify-center gap-1.5">{isInstagram ? <Heart className="h-4 w-4" /> : <ThumbsUp className="h-4 w-4" />} Like</span>
          <span className="flex min-h-9 items-center justify-center gap-1.5"><MessageCircle className="h-4 w-4" /> Comment</span>
          <span className="flex min-h-9 items-center justify-center gap-1.5"><Share2 className="h-4 w-4" /> Share</span>
        </footer>
      </div>
    </section>
  );
}
