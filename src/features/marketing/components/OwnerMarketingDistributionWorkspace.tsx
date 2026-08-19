"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MarketingContentWorkspaceView } from "@/features/marketing-content/client";
import {
  MARKETING_SERVICES,
  MARKETING_SERVICE_LABELS,
  runMarketingCommand,
  type MarketingCommandCenterView,
  type MarketingDestination,
} from "@/features/marketing/client";

import {
  OwnerMarketingSelectField,
  OwnerMarketingTextArea,
  OwnerMarketingTextField,
} from "./OwnerMarketingFields";
import { OwnerMarketingManualDeliveryRow } from "./OwnerMarketingManualDeliveryRow";

type DestinationDraft = Omit<
  MarketingDestination,
  "id" | "rulesCheckedAt" | "createdAt" | "updatedAt"
>;

const emptyDestination = (): DestinationDraft => ({
  name: "",
  service: "facebook",
  kind: "owned",
  provider: "manual",
  publishingMode: "manual",
  externalAccountId: "",
  url: "",
  rulesUrl: "",
  rulesSummary: "",
  postingGuidance: "",
  audienceKeys: ["tabletop-designers"],
  active: true,
});

export function OwnerMarketingDistributionWorkspace({
  marketing,
  cockpit,
  onSaved,
  onError,
}: {
  marketing: MarketingCommandCenterView;
  cockpit: MarketingContentWorkspaceView;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [editing, setEditing] = useState<MarketingDestination | null>(null);
  const [draft, setDraft] = useState<DestinationDraft>(emptyDestination);
  const [contentId, setContentId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [busy, setBusy] = useState(false);
  const approved = cockpit.campaigns.filter((item) =>
    ["approved", "provider_draft", "scheduled", "failed"].includes(
      item.status,
    ),
  );

  const saveDestination = async () => {
    setBusy(true);
    onError("");
    try {
      await runMarketingCommand({
        action: "save_destination",
        destinationId: editing?.id,
        destination: draft,
      });
      setEditing(null);
      setDraft(emptyDestination());
      onSaved();
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Unable to save destination.",
      );
    } finally {
      setBusy(false);
    }
  };

  const queue = async () => {
    setBusy(true);
    onError("");
    try {
      await runMarketingCommand({
        action: "queue_delivery",
        contentId,
        destinationId,
        scheduledFor: scheduledFor || null,
      });
      setContentId("");
      setDestinationId("");
      setScheduledFor("");
      onSaved();
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Unable to prepare delivery.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className={marketing.meta.configured ? "border border-[#497352] bg-[#0e170f] p-5" : "border border-[#8c6436] bg-[#1b1209] p-5"}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[#e2aa4a]">Owned social accounts</p>
            <h3 className="mt-1 font-serif text-2xl text-[#fff1c7]">Facebook and Instagram through CardForge</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#c7b288]">
              {marketing.connections.length ? `${marketing.connections.length} Meta connection(s) are stored with encrypted tokens.` : "Connect the Facebook account that manages the CardForge Page. A linked Instagram professional account will be discovered automatically."}
              {" "}Publishing is {marketing.meta.publishingEnabled ? "enabled" : "safely disabled until setup is verified"}.
            </p>
            {!marketing.meta.configured ? <p className="mt-2 text-xs text-[#f0bd75]">Server setup still needs: {marketing.meta.missing.join(", ")}</p> : null}
          </div>
          {marketing.meta.configured ? <Button asChild><a href="/api/owner/marketing/meta/connect">{marketing.connections.length ? "Reconnect Meta" : "Connect Meta"}</a></Button> : null}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="border border-[#5f4526] bg-[#15100a] p-5">
          <h3 className="font-serif text-2xl text-[#fff1c7]">
            Prepare approved content
          </h3>
          <p className="mt-2 text-sm leading-6 text-[#c7b288]">
            Choose the approved package and where it belongs. Community
            destinations create a manual task; connected owned channels can use
            automatic delivery.
          </p>
          <div className="mt-4 space-y-3">
            <OwnerMarketingSelectField
              label="Approved content"
              value={contentId}
              onChange={setContentId}
              options={approved.map((item) => [item.id, item.title])}
              placeholder="Choose content"
            />
            <OwnerMarketingSelectField
              label="Destination"
              value={destinationId}
              onChange={setDestinationId}
              options={marketing.destinations
                .filter((item) => item.active)
                .map((item) => [
                  item.id,
                  `${item.name} · ${item.publishingMode}`,
                ])}
              placeholder="Choose destination"
            />
            <OwnerMarketingTextField
              label="Publish or reminder time (optional)"
              type="datetime-local"
              value={scheduledFor}
              onChange={setScheduledFor}
            />
          </div>
          <Button
            className="mt-4"
            disabled={busy || !contentId || !destinationId}
            onClick={() => void queue()}
          >
            Prepare delivery
          </Button>
        </article>

        <article className="border border-[#5f4526] bg-[#15100a] p-5">
          <h3 className="font-serif text-2xl text-[#fff1c7]">
            {editing ? "Edit destination" : "Add a destination"}
          </h3>
          <div className="mt-4 grid gap-3">
            <OwnerMarketingTextField
              label="Name"
              value={draft.name}
              onChange={(name) => setDraft({ ...draft, name })}
            />
            <OwnerMarketingSelectField
              label="Channel"
              value={draft.service}
              onChange={(service) =>
                setDraft({
                  ...draft,
                  service: service as DestinationDraft["service"],
                })
              }
              options={MARKETING_SERVICES.map((service) => [
                service,
                MARKETING_SERVICE_LABELS[service],
              ])}
            />
            <OwnerMarketingSelectField
              label="Ownership"
              value={draft.kind}
              onChange={(kind) =>
                setDraft({
                  ...draft,
                  kind: kind as DestinationDraft["kind"],
                  provider: "manual",
                  publishingMode: "manual",
                })
              }
              options={[
                ["owned", "Owned account"],
                ["community", "Community / group"],
              ]}
            />
            <OwnerMarketingTextField
              label="Destination link"
              type="url"
              value={draft.url}
              onChange={(url) => setDraft({ ...draft, url })}
            />
            <OwnerMarketingTextField
              label="Rules link"
              type="url"
              value={draft.rulesUrl}
              onChange={(rulesUrl) => setDraft({ ...draft, rulesUrl })}
            />
            <OwnerMarketingTextArea
              label="Rules summary"
              value={draft.rulesSummary}
              onChange={(rulesSummary) => setDraft({ ...draft, rulesSummary })}
            />
            <OwnerMarketingTextArea
              label="Posting guidance"
              value={draft.postingGuidance}
              onChange={(postingGuidance) =>
                setDraft({ ...draft, postingGuidance })
              }
            />
          </div>
          <div className="mt-4 flex gap-3">
            <Button disabled={busy} onClick={() => void saveDestination()}>
              {busy ? "Saving..." : "Save destination"}
            </Button>
            {editing ? (
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(null);
                  setDraft(emptyDestination());
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </article>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {marketing.destinations.map((destination) => (
          <button
            type="button"
            key={destination.id}
            disabled={destination.publishingMode === "automatic"}
            title={destination.publishingMode === "automatic" ? "Connected destinations are managed through Connect Meta." : "Edit destination"}
            onClick={() => {
              if (destination.publishingMode === "automatic") return;
              setEditing(destination);
              setDraft(destination);
            }}
            className="border border-[#5f4526] bg-[#15100a] p-4 text-left disabled:cursor-default"
          >
            <div className="flex justify-between gap-2">
              <h4 className="font-medium text-[#ffe7ad]">{destination.name}</h4>
              <span className="text-[10px] uppercase tracking-[0.12em] text-[#e2aa4a]">
                {destination.publishingMode}
              </span>
            </div>
            <p className="mt-2 text-sm text-[#c7b288]">
              {MARKETING_SERVICE_LABELS[destination.service]} · {destination.kind}
            </p>
            {destination.rulesSummary ? (
              <p className="mt-2 text-xs leading-5 text-[#a98a75]">
                {destination.rulesSummary}
              </p>
            ) : null}
          </button>
        ))}
      </section>

      <section className="space-y-3">
        {cockpit.publishJobs
          .filter(
            (job) =>
              job.deliveryMode === "manual" && job.status !== "published",
          )
          .map((job) => (
            <OwnerMarketingManualDeliveryRow
              key={job.id}
              job={job}
              content={cockpit.campaigns.find(
                (item) => item.id === job.campaignId,
              )}
              destination={marketing.destinations.find(
                (item) => item.id === job.destinationId,
              )}
              campaign={marketing.campaigns.find(
                (item) =>
                  item.id ===
                  cockpit.campaigns.find(
                    (content) => content.id === job.campaignId,
                  )?.marketingCampaignId,
              )}
              onSaved={onSaved}
              onError={onError}
            />
          ))}
      </section>

      {cockpit.publishJobs.length ? (
        <section className="border border-[#5f4526] bg-[#15100a] p-5">
          <h3 className="font-serif text-2xl text-[#fff1c7]">Delivery history</h3>
          <div className="mt-4 grid gap-2">
            {cockpit.publishJobs.map((job) => {
              const content = cockpit.campaigns.find(
                (item) => item.id === job.campaignId,
              );
              const destination = marketing.destinations.find(
                (item) => item.id === job.destinationId,
              );
              return (
                <div
                  key={job.id}
                  className="flex flex-wrap items-center justify-between gap-3 border border-[#3c2c1b] bg-[#100c08] p-3"
                >
                  <div>
                    <p className="text-sm text-[#ffe7ad]">
                      {content?.title ?? "Content"} → {destination?.name ?? job.service}
                    </p>
                    <p className="mt-1 text-xs text-[#a98a75]">
                      {job.deliveryMode} · {job.status}
                      {job.scheduledFor
                        ? ` · ${new Date(job.scheduledFor).toLocaleString()}`
                        : ""}
                    </p>
                    {job.errorMessage ? (
                      <p className="mt-1 text-xs text-[#f0a58f]">
                        {job.errorMessage}
                      </p>
                    ) : null}
                  </div>
                  {job.publicationUrl ? (
                    <Button asChild variant="outline">
                      <a
                        href={job.publicationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View post <ExternalLink className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
