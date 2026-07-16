import { Sparkles } from 'lucide-react';

import type { FounderBetaCampaign } from '@/features/account/model/founderBeta';

export function AccountFounderBetaSection({ campaign, slotsRemaining, statusCopy }: {
  campaign: FounderBetaCampaign;
  slotsRemaining: number;
  statusCopy: string | null;
}) {
  return (
    <div className="border border-[#5f4526] bg-[#15100a] p-4">
      <div className="flex items-center gap-3 text-[#e2aa4a]">
        <Sparkles className="h-5 w-5" />
        <h2 className="font-serif text-xl text-[#fff1c7]">{campaign.campaignTitle}</h2>
      </div>
      <p className="mt-3 text-sm leading-5 text-[#c7b288]">{campaign.landingMessage}</p>
      {statusCopy ? <p className="mt-2 text-sm leading-5 text-[#d8c49a]">{statusCopy}</p> : null}
      <div className="mt-3 border border-[#5f4526] bg-[#100c08] p-3 text-sm text-[#ffe7ad]">
        {slotsRemaining} of {campaign.releaseSlotCap} current wave slots remain. Public cap: {campaign.publicSlotCap}. Access lasts {campaign.accessDays} days.
      </div>
    </div>
  );
}
