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
  CampaignMediaLibrary,
  CampaignWorkspace,
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
  "rounded-none border-b-2 border-transparent px-3 py-2 text-sm text-[var(--cf-text-subtle)] data-[state=active]:border-[var(--cf-accent)] data-[state=active]:bg-[#1b140c] data-[state=active]:text-[var(--cf-accent-text)]";

export function OwnerMarketingPanel({
  initialNotice,
}: {
  initialNotice?: { kind: "success" | "error"; message: string };
}) {
  const [marketing, setMarketing] = useState<MarketingCommandCenterView | null>(
    null,
  );
  const [workspace, setWorkspace] = useState<MarketingContentWorkspaceView | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice] = useState(initialNotice);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextMarketing, nextWorkspace] = await Promise.all([
        loadMarketingCommandCenter(),
        loadMarketingContentWorkspace(),
      ]);
      setMarketing(nextMarketing);
      setWorkspace(nextWorkspace);
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

  if (!marketing || !workspace) {
    return (
      <section
        className={`border p-5 ${error ? "border-[var(--cf-danger-border)] bg-[var(--cf-danger-surface-muted)] text-[var(--cf-danger)]" : "border-[var(--cf-border)] bg-[var(--cf-surface)] text-[var(--cf-text-muted)]"}`}
      >
        <h2 className="font-serif text-2xl text-[var(--cf-text-strong)]">
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

  const reviewCount = workspace.campaigns.filter(
    (item) => item.status === "submitted",
  ).length;
  const approvedCount = workspace.campaigns.filter((item) =>
    ["approved", "provider_draft", "scheduled"].includes(item.status),
  ).length;
  const deliveryCount = workspace.publishJobs.filter((item) =>
    ["ready", "scheduled", "provider_draft", "publishing"].includes(
      item.status,
    ),
  ).length;

  return (
    <section className="space-y-4">
      <header className="border border-[var(--cf-border)] bg-[var(--cf-surface)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--cf-accent-strong)]">
              Marketing command center
            </p>
            <h2 className="mt-1 font-serif text-2xl text-[var(--cf-text-strong)]">
              Strategy to publication, owned by CardForge
            </h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--cf-text-muted)]">
              Contributors submit content into a real campaign. You approve the
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
            className={`mt-4 border p-3 text-sm ${notice.kind === "error" ? "border-[var(--cf-danger-border)] bg-[var(--cf-danger-surface-muted)] text-[var(--cf-danger)]" : "border-[#497352] bg-[#0e170f] text-[#a8e7b8]"}`}
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
            className="mt-4 border border-[var(--cf-danger-border)] bg-[var(--cf-danger-surface-muted)] p-3 text-sm text-[var(--cf-danger)]"
          >
            {error}
          </p>
        ) : null}
      </header>

      <Tabs defaultValue="strategy" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start rounded-none border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-1">
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
          <CampaignWorkspace workspace={workspace} onRefresh={load} />
        </TabsContent>
        <TabsContent value="distribution" className="mt-0">
          <OwnerMarketingDistributionWorkspace
            marketing={marketing}
            workspace={workspace}
            onSaved={() => {
              setMessage("Distribution workspace updated.");
              void load();
            }}
            onError={setError}
          />
        </TabsContent>
        <TabsContent value="media" className="mt-0">
          <CampaignMediaLibrary
            media={workspace.campaignMedia}
            pageInfo={workspace.campaignMediaPage}
            summary={workspace.campaignMediaSummary}
            onRefresh={load}
          />
        </TabsContent>
        <TabsContent value="results" className="mt-0">
          <OwnerMarketingResultsWorkspace marketing={marketing} workspace={workspace} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
