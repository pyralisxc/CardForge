"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  MARKETING_AUDIENCES,
  runMarketingCommand,
  type MarketingCampaign,
  type MarketingStrategyRecord,
} from "@/features/marketing/client";

import {
  OwnerMarketingSelectField,
  OwnerMarketingTextArea,
  OwnerMarketingTextField,
} from "./OwnerMarketingFields";

type CampaignDraft = Omit<
  MarketingCampaign,
  "id" | "createdBy" | "version" | "createdAt" | "updatedAt"
>;

const emptyCampaign = (strategy: MarketingStrategyRecord): CampaignDraft => ({
  name: "",
  objective: "",
  audienceKey: strategy.primaryAudience,
  offer: strategy.offer,
  status: "planning",
  startsOn: null,
  endsOn: null,
  successMetric: "",
  utmCampaign: "",
});

export function OwnerMarketingCampaignsWorkspace({
  campaigns,
  strategy,
  onSaved,
  onError,
}: {
  campaigns: MarketingCampaign[];
  strategy: MarketingStrategyRecord;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [editing, setEditing] = useState<MarketingCampaign | null>(null);
  const [draft, setDraft] = useState<CampaignDraft>(() =>
    emptyCampaign(strategy),
  );
  const [busy, setBusy] = useState(false);

  const choose = (campaign: MarketingCampaign) => {
    setEditing(campaign);
    setDraft(campaign);
  };

  const save = async () => {
    setBusy(true);
    onError("");
    try {
      await runMarketingCommand({
        action: "save_campaign",
        campaignId: editing?.id,
        expectedVersion: editing?.version,
        campaign: draft,
      });
      setEditing(null);
      setDraft(emptyCampaign(strategy));
      onSaved();
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Unable to save campaign.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.75fr)]">
      <section className="space-y-3">
        {campaigns.map((campaign) => (
          <button
            type="button"
            key={campaign.id}
            onClick={() => choose(campaign)}
            className="block w-full border border-[#5f4526] bg-[#15100a] p-4 text-left"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-serif text-xl text-[#fff1c7]">
                {campaign.name}
              </h3>
              <span className="border border-[#6d4f2b] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[#e2aa4a]">
                {campaign.status}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#c7b288]">
              {campaign.objective}
            </p>
            <p className="mt-2 text-xs text-[#a98a75]">
              utm_campaign={campaign.utmCampaign}
            </p>
          </button>
        ))}
      </section>
      <article className="border border-[#5f4526] bg-[#15100a] p-5">
        <h3 className="font-serif text-2xl text-[#fff1c7]">
          {editing ? "Edit campaign" : "Create campaign"}
        </h3>
        <div className="mt-4 space-y-3">
          <OwnerMarketingTextField
            label="Campaign name"
            value={draft.name}
            onChange={(name) => setDraft({ ...draft, name })}
          />
          <OwnerMarketingTextArea
            label="Objective"
            value={draft.objective}
            onChange={(objective) => setDraft({ ...draft, objective })}
          />
          <OwnerMarketingSelectField
            label="Market"
            value={draft.audienceKey}
            onChange={(audienceKey) =>
              setDraft({
                ...draft,
                audienceKey: audienceKey as CampaignDraft["audienceKey"],
              })
            }
            options={MARKETING_AUDIENCES.map((item) => [item.id, item.label])}
          />
          <OwnerMarketingTextArea
            label="Offer"
            value={draft.offer}
            onChange={(offer) => setDraft({ ...draft, offer })}
          />
          <OwnerMarketingSelectField
            label="Status"
            value={draft.status}
            onChange={(status) =>
              setDraft({ ...draft, status: status as CampaignDraft["status"] })
            }
            options={[
              "planning",
              "active",
              "paused",
              "completed",
              "cancelled",
            ].map((value) => [value, value])}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <OwnerMarketingTextField
              label="Starts on"
              type="date"
              value={draft.startsOn ?? ""}
              onChange={(startsOn) =>
                setDraft({ ...draft, startsOn: startsOn || null })
              }
            />
            <OwnerMarketingTextField
              label="Ends on"
              type="date"
              value={draft.endsOn ?? ""}
              onChange={(endsOn) =>
                setDraft({ ...draft, endsOn: endsOn || null })
              }
            />
          </div>
          <OwnerMarketingTextArea
            label="Success metric"
            value={draft.successMetric}
            onChange={(successMetric) => setDraft({ ...draft, successMetric })}
          />
          <OwnerMarketingTextField
            label="Campaign tracking key"
            value={draft.utmCampaign}
            onChange={(utmCampaign) => setDraft({ ...draft, utmCampaign })}
          />
        </div>
        <div className="mt-4 flex gap-3">
          <Button disabled={busy} onClick={() => void save()}>
            {busy ? "Saving..." : "Save campaign"}
          </Button>
          {editing ? (
            <Button
              variant="outline"
              onClick={() => {
                setEditing(null);
                setDraft(emptyCampaign(strategy));
              }}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </article>
    </div>
  );
}
