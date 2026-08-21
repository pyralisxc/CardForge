"use client";

import { useState } from "react";
import Image from "next/image";
import { Copy, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildOrganicCampaignUrl } from "@/features/analytics/client";
import type { MarketingContentWorkspaceView } from "@/features/marketing-content/client";
import {
  runMarketingCommand,
  type MarketingCampaign,
  type MarketingDestination,
} from "@/features/marketing/client";

import { ownerMarketingFieldClassName } from "./OwnerMarketingFields";

export function OwnerMarketingManualDeliveryRow({
  job,
  content,
  destination,
  campaign,
  onSaved,
  onError,
}: {
  job: MarketingContentWorkspaceView["publishJobs"][number];
  content: MarketingContentWorkspaceView["campaigns"][number] | undefined;
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
    <article className="border border-[var(--cf-border)] bg-[var(--cf-surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--cf-accent-strong)]">
            Manual publication · {job.status}
          </p>
          <h4 className="mt-1 font-medium text-[var(--cf-accent-text)]">
            {content?.title ?? "Content"} → {destination?.name ?? job.service}
          </h4>
          {job.scheduledFor ? (
            <p className="mt-1 text-xs text-[var(--cf-text-subtle)]">
              Due {new Date(job.scheduledFor).toLocaleString()}
            </p>
          ) : null}
        </div>
        <div className="grid max-w-2xl gap-3">
          <div className="whitespace-pre-wrap border border-[var(--cf-border-subtle)] bg-[var(--cf-canvas)] p-3 text-sm leading-6 text-[#e4d2aa]">
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
                  className="group block border border-[var(--cf-border-subtle)] bg-[var(--cf-canvas)] p-2"
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
                  <span className="mt-1 block text-center text-[10px] uppercase tracking-[0.1em] text-[var(--cf-text-muted)]">
                    Open image
                  </span>
                </a>
              ))}
            </div>
          ) : null}
          {destination?.postingGuidance || destination?.rulesSummary ? (
            <p className="text-xs leading-5 text-[var(--cf-text-subtle)]">
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
            className={ownerMarketingFieldClassName}
            type="url"
            placeholder="Published post link (optional)"
            value={publicationUrl}
            onChange={(event) => setPublicationUrl(event.target.value)}
          />
          <input
            className={ownerMarketingFieldClassName}
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
