import { BarChart3, Send, Target } from "lucide-react";

import type { MarketingContentWorkspaceView } from "@/features/marketing-content/client";
import type { MarketingCommandCenterView } from "@/features/marketing/client";

import { OwnerMarketingMetric } from "./OwnerMarketingFields";

export function OwnerMarketingResultsWorkspace({
  marketing,
  cockpit,
}: {
  marketing: MarketingCommandCenterView;
  cockpit: MarketingContentWorkspaceView;
}) {
  const published = cockpit.publishJobs.filter(
    (job) => job.status === "published",
  );

  return (
    <article className="border border-[#5f4526] bg-[#15100a] p-5">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-5 w-5 text-[#e2aa4a]" />
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[#e2aa4a]">
            Measurement
          </p>
          <h3 className="font-serif text-2xl text-[#fff1c7]">
            Campaign-linked results
          </h3>
        </div>
      </div>
      <p className="mt-3 max-w-4xl text-sm leading-6 text-[#c7b288]">
        Every campaign owns a utm_campaign key and every content package owns
        utm_content. Use those values in the existing analytics workspace to
        connect visits and Studio actions back to the work that caused them.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <OwnerMarketingMetric
          icon={Target}
          label="Campaigns"
          value={marketing.campaigns.length}
        />
        <OwnerMarketingMetric
          icon={Send}
          label="Published deliveries"
          value={published.length}
        />
        <OwnerMarketingMetric
          icon={BarChart3}
          label="Tracked links"
          value={cockpit.campaigns.filter((item) => item.utmContent).length}
        />
      </div>
    </article>
  );
}
