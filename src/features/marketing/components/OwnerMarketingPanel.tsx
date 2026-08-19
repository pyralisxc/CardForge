"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock,
  Megaphone,
  RefreshCw,
  Send,
  Target,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DeveloperCampaignMediaLibrary,
  DeveloperCampaignPanel,
  loadMarketingContentWorkspace,
  type MarketingContentWorkspaceView,
} from "@/features/marketing-content/client";
import {
  loadMarketingCommandCenter,
  type MarketingCommandCenterView,
} from "@/features/marketing/client";

import { OwnerMarketingCampaignsWorkspace } from "./OwnerMarketingCampaignsWorkspace";
import { OwnerMarketingDistributionWorkspace } from "./OwnerMarketingDistributionWorkspace";
import { OwnerMarketingMetric } from "./OwnerMarketingFields";
import { OwnerMarketingResultsWorkspace } from "./OwnerMarketingResultsWorkspace";
import { OwnerMarketingStrategyWorkspace } from "./OwnerMarketingStrategyWorkspace";

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
  const [cockpit, setCockpit] = useState<MarketingContentWorkspaceView | null>(null);
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
        loadMarketingContentWorkspace(),
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
          <OwnerMarketingMetric
            icon={Target}
            label="Active campaigns"
            value={
              marketing.campaigns.filter((item) => item.status === "active")
                .length
            }
          />
          <OwnerMarketingMetric
            icon={Megaphone}
            label="Awaiting review"
            value={reviewCount}
          />
          <OwnerMarketingMetric icon={Send} label="Approved content" value={approvedCount} />
          <OwnerMarketingMetric
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
          <OwnerMarketingStrategyWorkspace
            strategy={marketing.strategy}
            onSaved={(strategy) => {
              setMarketing({ ...marketing, strategy });
              setMessage("Marketing strategy saved.");
            }}
            onError={setError}
          />
        </TabsContent>
        <TabsContent value="campaigns" className="mt-0">
          <OwnerMarketingCampaignsWorkspace
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
          <DeveloperCampaignPanel cockpit={cockpit} onRefresh={load} />
        </TabsContent>
        <TabsContent value="distribution" className="mt-0">
          <OwnerMarketingDistributionWorkspace
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
            onRefresh={load}
          />
        </TabsContent>
        <TabsContent value="results" className="mt-0">
          <OwnerMarketingResultsWorkspace marketing={marketing} cockpit={cockpit} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
