import { BarChart3, Send, Target } from "lucide-react";

import type { MarketingContentWorkspaceView } from "@/features/marketing-content/client";
import type { MarketingCommandCenterView } from "@/features/marketing/client";

import { OwnerMarketingMetric } from "./OwnerMarketingFields";

export function OwnerMarketingResultsWorkspace({
  marketing,
  workspace,
}: {
  marketing: MarketingCommandCenterView;
  workspace: MarketingContentWorkspaceView;
}) {
  const published = workspace.publishJobs.filter(
    (job) => job.status === "published",
  );

  return (
    <article className="border border-[var(--cf-border)] bg-[var(--cf-surface)] p-5">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-5 w-5 text-[var(--cf-accent-strong)]" />
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--cf-accent-strong)]">
            Measurement
          </p>
          <h3 className="font-serif text-2xl text-[var(--cf-text-strong)]">
            Campaign-linked results
          </h3>
        </div>
      </div>
      <p className="mt-3 max-w-4xl text-sm leading-6 text-[var(--cf-text-muted)]">
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
          value={workspace.campaigns.filter((item) => item.utmContent).length}
        />
      </div>
    </article>
  );
}
