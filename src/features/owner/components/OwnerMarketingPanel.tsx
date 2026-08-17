"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  BarChart3,
  CalendarClock,
  Copy,
  ExternalLink,
  Megaphone,
  RefreshCw,
  Send,
  Target,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildOrganicCampaignUrl } from "@/features/analytics/model";
import {
  loadDeveloperCockpit,
  type DeveloperCockpitView,
} from "@/features/developer-cockpit/client/api";
import {
  DeveloperCampaignMediaLibrary,
  DeveloperCampaignPanel,
} from "@/features/developer-cockpit/client/owner";
import {
  loadMarketingCommandCenter,
  runMarketingCommand,
} from "@/features/marketing/client/api";
import {
  MARKETING_AUDIENCES,
  MARKETING_CONTENT_PILLARS,
  MARKETING_SERVICES,
  MARKETING_SERVICE_LABELS,
  type MarketingCampaign,
  type MarketingCommandCenterView,
  type MarketingDestination,
  type MarketingStrategyRecord,
} from "@/features/marketing/model";

const fieldClassName =
  "min-h-11 w-full border border-[#5f4526] bg-[#0c0b09] px-3 py-2 text-sm text-[#ffe7ad] placeholder:text-[#6f5b3a]";
const subtabClassName =
  "rounded-none border-b-2 border-transparent px-3 py-2 text-sm text-[#a98a75] data-[state=active]:border-[#d8b365] data-[state=active]:bg-[#1b140c] data-[state=active]:text-[#ffe7ad]";

export function OwnerMarketingPanel({
  initialNotice,
}: {
  initialNotice?: { kind: "success" | "error"; message: string };
}) {
  const [marketing, setMarketing] = useState<MarketingCommandCenterView | null>(
    null,
  );
  const [cockpit, setCockpit] = useState<DeveloperCockpitView | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice] = useState(initialNotice);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextMarketing, nextCockpit] = await Promise.all([
        loadMarketingCommandCenter(),
        loadDeveloperCockpit(),
      ]);
      setMarketing(nextMarketing);
      setCockpit(nextCockpit);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load marketing.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (!marketing || !cockpit) {
    return (
      <section
        className={`border p-5 ${error ? "border-[#7d3d32] bg-[#1b0d09] text-[#ffd0c6]" : "border-[#5f4526] bg-[#15100a] text-[#c7b288]"}`}
      >
        <h2 className="font-serif text-2xl text-[#fff1c7]">
          {error
            ? "Marketing workspace unavailable"
            : "Loading marketing workspace..."}
        </h2>
        {error ? (
          <>
            <p className="mt-3 text-sm">{error}</p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => void load()}
            >
              Retry
            </Button>
          </>
        ) : null}
      </section>
    );
  }

  const reviewCount = cockpit.campaigns.filter(
    (item) => item.status === "submitted",
  ).length;
  const approvedCount = cockpit.campaigns.filter((item) =>
    ["approved", "provider_draft", "scheduled"].includes(item.status),
  ).length;
  const deliveryCount = cockpit.publishJobs.filter((item) =>
    ["ready", "scheduled", "provider_draft", "publishing"].includes(
      item.status,
    ),
  ).length;

  return (
    <section className="space-y-4">
      <header className="border border-[#5f4526] bg-[#15100a] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[#e2aa4a]">
              Marketing command center
            </p>
            <h2 className="mt-1 font-serif text-2xl text-[#fff1c7]">
              Strategy to publication, owned by CardForge
            </h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-[#c7b288]">
              Developers submit content into a real campaign. You approve the
              claim, destination, timing, and final publication. Owned accounts
              can become automatic; communities always remain guided manual
              outreach.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => void load()}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            icon={Target}
            label="Active campaigns"
            value={
              marketing.campaigns.filter((item) => item.status === "active")
                .length
            }
          />
          <Metric
            icon={Megaphone}
            label="Awaiting review"
            value={reviewCount}
          />
          <Metric icon={Send} label="Approved content" value={approvedCount} />
          <Metric
            icon={CalendarClock}
            label="Open deliveries"
            value={deliveryCount}
          />
        </div>
        {notice ? (
          <p
            role={notice.kind === "error" ? "alert" : "status"}
            className={`mt-4 border p-3 text-sm ${notice.kind === "error" ? "border-[#7d3d32] bg-[#1b0d09] text-[#ffd0c6]" : "border-[#497352] bg-[#0e170f] text-[#a8e7b8]"}`}
          >
            {notice.message}
          </p>
        ) : null}
        {message ? (
          <p
            role="status"
            className="mt-4 border border-[#497352] bg-[#0e170f] p-3 text-sm text-[#a8e7b8]"
          >
            {message}
          </p>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="mt-4 border border-[#7d3d32] bg-[#1b0d09] p-3 text-sm text-[#ffd0c6]"
          >
            {error}
          </p>
        ) : null}
      </header>
      <Tabs defaultValue="strategy" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start rounded-none border border-[#3c2c1b] bg-[#100c08] p-1">
          <TabsTrigger value="strategy" className={subtabClassName}>
            Strategy
          </TabsTrigger>
          <TabsTrigger value="campaigns" className={subtabClassName}>
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="content" className={subtabClassName}>
            Content &amp; Review
          </TabsTrigger>
          <TabsTrigger value="distribution" className={subtabClassName}>
            Distribution
          </TabsTrigger>
          <TabsTrigger value="media" className={subtabClassName}>
            Media
          </TabsTrigger>
          <TabsTrigger value="results" className={subtabClassName}>
            Results
          </TabsTrigger>
        </TabsList>
        <TabsContent value="strategy" className="mt-0">
          <StrategyEditor
            strategy={marketing.strategy}
            onSaved={(strategy) => {
              setMarketing({ ...marketing, strategy });
              setMessage("Marketing strategy saved.");
            }}
            onError={setError}
          />
        </TabsContent>
        <TabsContent value="campaigns" className="mt-0">
          <CampaignEditor
            campaigns={marketing.campaigns}
            strategy={marketing.strategy}
            onSaved={() => {
              setMessage("Marketing campaign saved.");
              void load();
            }}
            onError={setError}
          />
        </TabsContent>
        <TabsContent value="content" className="mt-0">
          <DeveloperCampaignPanel cockpit={cockpit} onChange={setCockpit} />
        </TabsContent>
        <TabsContent value="distribution" className="mt-0">
          <DistributionEditor
            marketing={marketing}
            cockpit={cockpit}
            onSaved={() => {
              setMessage("Distribution workspace updated.");
              void load();
            }}
            onError={setError}
          />
        </TabsContent>
        <TabsContent value="media" className="mt-0">
          <DeveloperCampaignMediaLibrary
            media={cockpit.campaignMedia}
            pageInfo={cockpit.campaignMediaPage}
            summary={cockpit.campaignMediaSummary}
            onChange={setCockpit}
          />
        </TabsContent>
        <TabsContent value="results" className="mt-0">
          <ResultsPanel marketing={marketing} cockpit={cockpit} />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function StrategyEditor({
  strategy,
  onSaved,
  onError,
}: {
  strategy: MarketingStrategyRecord;
  onSaved: (strategy: MarketingStrategyRecord) => void;
  onError: (message: string) => void;
}) {
  const [draft, setDraft] = useState(strategy);
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(strategy), [strategy]);
  const save = async () => {
    setBusy(true);
    onError("");
    try {
      const result = await runMarketingCommand<{
        strategy: MarketingStrategyRecord;
      }>({
        action: "update_strategy",
        expectedVersion: strategy.version,
        strategy: draft,
      });
      onSaved(result.strategy);
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "Unable to save strategy.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="border border-[#5f4526] bg-[#15100a] p-5">
      <p className="text-xs uppercase tracking-[0.16em] text-[#e2aa4a]">
        Shared brief
      </p>
      <h3 className="mt-1 font-serif text-2xl text-[#fff1c7]">
        The source of truth every contributor writes from
      </h3>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <SelectField
          label="Primary market"
          value={draft.primaryAudience}
          onChange={(value) =>
            setDraft({
              ...draft,
              primaryAudience:
                value as MarketingStrategyRecord["primaryAudience"],
            })
          }
          options={MARKETING_AUDIENCES.map((item) => [item.id, item.label])}
        />
        <SelectField
          label="Validation market"
          value={draft.validationAudience}
          onChange={(value) =>
            setDraft({
              ...draft,
              validationAudience:
                value as MarketingStrategyRecord["validationAudience"],
            })
          }
          options={MARKETING_AUDIENCES.map((item) => [item.id, item.label])}
        />
        <TextArea
          label="Positioning"
          value={draft.positioning}
          onChange={(positioning) => setDraft({ ...draft, positioning })}
        />
        <TextArea
          label="Current offer"
          value={draft.offer}
          onChange={(offer) => setDraft({ ...draft, offer })}
        />
        <TextField
          label="Default call to action"
          value={draft.defaultCallToAction}
          onChange={(defaultCallToAction) =>
            setDraft({ ...draft, defaultCallToAction })
          }
        />
        <div className="border border-[#4a3823] bg-[#100c08] p-3">
          <p className="text-xs text-[#c7b288]">Enabled content pillars</p>
          <div className="mt-2 space-y-2">
            {MARKETING_CONTENT_PILLARS.map((pillar) => (
              <label
                key={pillar.id}
                className="flex gap-2 text-sm text-[#ffe7ad]"
              >
                <input
                  type="checkbox"
                  checked={draft.enabledPillars.includes(pillar.id)}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      enabledPillars: event.target.checked
                        ? [...draft.enabledPillars, pillar.id]
                        : draft.enabledPillars.filter((id) => id !== pillar.id),
                    })
                  }
                />
                {pillar.label}
              </label>
            ))}
          </div>
        </div>
        <TextArea
          label="Approved claims — one per line"
          value={draft.approvedClaims.join("\n")}
          onChange={(value) =>
            setDraft({ ...draft, approvedClaims: value.split("\n") })
          }
        />
        <TextArea
          label="Claims we must not make — one per line"
          value={draft.prohibitedClaims.join("\n")}
          onChange={(value) =>
            setDraft({ ...draft, prohibitedClaims: value.split("\n") })
          }
        />
      </div>
      <Button className="mt-4" disabled={busy} onClick={() => void save()}>
        {busy ? "Saving..." : "Save strategy"}
      </Button>
    </article>
  );
}

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

function CampaignEditor({
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
          <TextField
            label="Campaign name"
            value={draft.name}
            onChange={(name) => setDraft({ ...draft, name })}
          />
          <TextArea
            label="Objective"
            value={draft.objective}
            onChange={(objective) => setDraft({ ...draft, objective })}
          />
          <SelectField
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
          <TextArea
            label="Offer"
            value={draft.offer}
            onChange={(offer) => setDraft({ ...draft, offer })}
          />
          <SelectField
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
            <TextField
              label="Starts on"
              type="date"
              value={draft.startsOn ?? ""}
              onChange={(startsOn) =>
                setDraft({ ...draft, startsOn: startsOn || null })
              }
            />
            <TextField
              label="Ends on"
              type="date"
              value={draft.endsOn ?? ""}
              onChange={(endsOn) =>
                setDraft({ ...draft, endsOn: endsOn || null })
              }
            />
          </div>
          <TextArea
            label="Success metric"
            value={draft.successMetric}
            onChange={(successMetric) => setDraft({ ...draft, successMetric })}
          />
          <TextField
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

function DistributionEditor({
  marketing,
  cockpit,
  onSaved,
  onError,
}: {
  marketing: MarketingCommandCenterView;
  cockpit: DeveloperCockpitView;
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
    ["approved", "provider_draft", "scheduled", "published", "failed"].includes(
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
            <SelectField
              label="Approved content"
              value={contentId}
              onChange={setContentId}
              options={approved.map((item) => [item.id, item.title])}
              placeholder="Choose content"
            />
            <SelectField
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
            <TextField
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
            <TextField
              label="Name"
              value={draft.name}
              onChange={(name) => setDraft({ ...draft, name })}
            />
            <SelectField
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
            <SelectField
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
            <TextField
              label="Destination link"
              type="url"
              value={draft.url}
              onChange={(url) => setDraft({ ...draft, url })}
            />
            <TextField
              label="Rules link"
              type="url"
              value={draft.rulesUrl}
              onChange={(rulesUrl) => setDraft({ ...draft, rulesUrl })}
            />
            <TextArea
              label="Rules summary"
              value={draft.rulesSummary}
              onChange={(rulesSummary) => setDraft({ ...draft, rulesSummary })}
            />
            <TextArea
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
            onClick={() => {
              setEditing(destination);
              setDraft(destination);
            }}
            className="border border-[#5f4526] bg-[#15100a] p-4 text-left"
          >
            <div className="flex justify-between gap-2">
              <h4 className="font-medium text-[#ffe7ad]">{destination.name}</h4>
              <span className="text-[10px] uppercase tracking-[0.12em] text-[#e2aa4a]">
                {destination.publishingMode}
              </span>
            </div>
            <p className="mt-2 text-sm text-[#c7b288]">
              {MARKETING_SERVICE_LABELS[destination.service]} ·{" "}
              {destination.kind}
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
            <ManualDeliveryRow
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

function ManualDeliveryRow({
  job,
  content,
  destination,
  campaign,
  onSaved,
  onError,
}: {
  job: DeveloperCockpitView["publishJobs"][number];
  content: DeveloperCockpitView["campaigns"][number] | undefined;
  destination: MarketingDestination | undefined;
  campaign: MarketingCampaign | undefined;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [publicationUrl, setPublicationUrl] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const variant = content?.variants.find((item) => item.service === job.service);
  const deliveryMedia = variant?.attachments.map((attachment) => ({
    id: attachment.id,
    url:
      attachment.media.derivatives.find(
        (derivative) => derivative.id === attachment.derivativeId,
      )?.previewUrl ?? attachment.media.previewUrl,
    altText: attachment.altText,
  })) ?? [];
  let trackedUrl = content?.destinationUrl ?? "";
  if (trackedUrl && campaign) {
    try {
      trackedUrl = buildOrganicCampaignUrl({
        destinationUrl: trackedUrl,
        source: job.service,
        campaign: campaign.utmCampaign,
        content: content?.utmContent,
      });
    } catch {
      trackedUrl = content?.destinationUrl ?? "";
    }
  }
  const finalCopy = [variant?.text.trim(), trackedUrl].filter(Boolean).join("\n\n");
  const copyPost = async () => {
    try {
      await navigator.clipboard.writeText(finalCopy);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      onError("Your browser blocked clipboard access. Select and copy the post text directly.");
    }
  };
  const complete = async () => {
    setBusy(true);
    onError("");
    try {
      await runMarketingCommand({
        action: "complete_manual_delivery",
        deliveryId: job.id,
        publicationUrl,
        manualNote,
      });
      onSaved();
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Unable to record publication.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="border border-[#5f4526] bg-[#15100a] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-[#e2aa4a]">
            Manual publication · {job.status}
          </p>
          <h4 className="mt-1 font-medium text-[#ffe7ad]">
            {content?.title ?? "Content"} → {destination?.name ?? job.service}
          </h4>
          {job.scheduledFor ? (
            <p className="mt-1 text-xs text-[#a98a75]">
              Due {new Date(job.scheduledFor).toLocaleString()}
            </p>
          ) : null}
        </div>
        <div className="grid max-w-2xl gap-3">
          <div className="whitespace-pre-wrap border border-[#3c2c1b] bg-[#0c0b09] p-3 text-sm leading-6 text-[#e4d2aa]">
            {finalCopy || "No channel copy is available."}
          </div>
          {deliveryMedia.length ? (
            <div className="flex flex-wrap gap-3">
              {deliveryMedia.map((media) => (
                <a
                  key={media.id}
                  href={media.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block border border-[#4a3823] bg-[#0c0b09] p-2"
                  title="Open approved image"
                >
                  <Image
                    src={media.url}
                    alt={media.altText}
                    width={120}
                    height={150}
                    unoptimized
                    className="h-28 w-24 object-contain transition group-hover:opacity-80"
                  />
                  <span className="mt-1 block text-center text-[10px] uppercase tracking-[0.1em] text-[#c7b288]">
                    Open image
                  </span>
                </a>
              ))}
            </div>
          ) : null}
          {destination?.postingGuidance || destination?.rulesSummary ? (
            <p className="text-xs leading-5 text-[#a98a75]">
              {[destination.rulesSummary, destination.postingGuidance]
                .filter(Boolean)
                .join(" ")}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!finalCopy}
              onClick={() => void copyPost()}
            >
              <Copy className="mr-2 h-4 w-4" />
              {copied ? "Copied" : "Copy final post"}
            </Button>
            {destination?.url ? (
              <Button asChild variant="outline">
                <a
                  href={destination.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open destination <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            ) : null}
            {destination?.rulesUrl ? (
              <Button asChild variant="outline">
                <a
                  href={destination.rulesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Check rules <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            ) : null}
          </div>
        </div>
        <div className="grid min-w-72 gap-2">
          <input
            className={fieldClassName}
            type="url"
            placeholder="Published post link (optional)"
            value={publicationUrl}
            onChange={(event) => setPublicationUrl(event.target.value)}
          />
          <input
            className={fieldClassName}
            placeholder="Outcome or engagement note"
            value={manualNote}
            onChange={(event) => setManualNote(event.target.value)}
          />
          <Button disabled={busy} onClick={() => void complete()}>
            {busy ? "Saving..." : "Mark published"}
          </Button>
        </div>
      </div>
    </article>
  );
}

function ResultsPanel({
  marketing,
  cockpit,
}: {
  marketing: MarketingCommandCenterView;
  cockpit: DeveloperCockpitView;
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
        <Metric
          icon={Target}
          label="Campaigns"
          value={marketing.campaigns.length}
        />
        <Metric
          icon={Send}
          label="Published deliveries"
          value={published.length}
        />
        <Metric
          icon={BarChart3}
          label="Tracked links"
          value={cockpit.campaigns.filter((item) => item.utmContent).length}
        />
      </div>
    </article>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Target;
  label: string;
  value: number;
}) {
  return (
    <div className="border border-[#4a3823] bg-[#100c08] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.14em] text-[#a98a55]">
          {label}
        </span>
        <Icon className="h-4 w-4 text-[#e2aa4a]" />
      </div>
      <strong className="mt-2 block font-serif text-2xl text-[#fff1c7]">
        {value}
      </strong>
    </div>
  );
}
function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="grid gap-1 text-xs text-[#c7b288]">
      {label}
      <input
        className={fieldClassName}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs text-[#c7b288]">
      {label}
      <textarea
        className={`${fieldClassName} min-h-24`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1 text-xs text-[#c7b288]">
      {label}
      <select
        className={fieldClassName}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
