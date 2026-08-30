import type { ReactNode } from 'react';
import {
  getCampaignMediaExpectation,
  getPublishJobStatusLabel,
} from '@/features/marketing-content/client/campaignWorkflow';
import {
  CalendarClock,
  ExternalLink,
  FileText,
  Link2,
  Scale,
} from 'lucide-react';

import { CampaignProviderPreview } from '@/features/marketing-content/components/CampaignProviderPreview';

import {
  MARKETING_CHANNEL_LABELS as SOCIAL_SERVICE_LABELS,
  type MarketingContentPackage as SocialCampaign,
  type MarketingDelivery as SocialPublishJob,
} from '@/features/marketing-content/model';

const formatDateTime = (value: string | null) => (
  value
    ? new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
    : 'No requested time'
);

export function CampaignPackageDetails({
  campaign,
  jobs,
}: {
  campaign: SocialCampaign;
  jobs: SocialPublishJob[];
}) {
  return (
    <div className="mt-4 flex flex-col gap-4">
      <section className="order-2">
        <div className="flex items-center gap-2 text-[var(--cf-accent-strong)]">
          <FileText className="h-4 w-4" />
          <h4 className="text-xs font-semibold uppercase tracking-[0.14em]">
            Release context
          </h4>
        </div>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <ContextItem icon={FileText} label="Marketing intent">
            {campaign.audienceKey.replaceAll('-', ' ')} · {campaign.contentPillar.replaceAll('-', ' ')} · {campaign.funnelStage} · {campaign.contentKind.replaceAll('-', ' ')}
          </ContextItem>
          <ContextItem icon={Link2} label="Call to action and tracking">
            {campaign.callToAction} · utm_content={campaign.utmContent}
          </ContextItem>
          <ContextItem icon={Link2} label="Destination">
            {campaign.destinationUrl ? (
              <a
                className="inline-flex items-center gap-1 break-all text-[#f1c875] underline"
                href={campaign.destinationUrl}
                target="_blank"
                rel="noreferrer"
              >
                {campaign.destinationUrl}
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
            ) : 'No destination requested'}
          </ContextItem>
          <ContextItem icon={CalendarClock} label="Requested timing">
            {formatDateTime(campaign.requestedPublishAt)}
          </ContextItem>
          <ContextItem icon={FileText} label="Release and review context">
            {campaign.productionNote || 'Not supplied'}
          </ContextItem>
          <ContextItem icon={Scale} label="Development associations">
            {campaign.associations.length ? (
              <ul className="grid gap-2">
                {campaign.associations.map((association) => (
                  <li key={association.id}>
                    <span className="block text-xs uppercase tracking-[0.1em] text-[var(--cf-text-subtle)]">
                      {association.kind.replaceAll('_', ' ')} · {association.externalKey}
                    </span>
                    {association.referenceUrl ? (
                      <a
                        className="text-[#f1c875] underline"
                        href={association.referenceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {association.titleSnapshot || association.externalKey}
                      </a>
                    ) : association.titleSnapshot || association.externalKey}
                    {association.note ? (
                      <span className="mt-1 block text-xs text-[var(--cf-text-subtle)]">
                        {association.note}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : 'Not supplied'}
          </ContextItem>
        </dl>
      </section>

      <section className="order-1" aria-labelledby={`provider-preview-${campaign.id}`}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--cf-accent-strong)]">Provider lens</p>
            <h4 id={`provider-preview-${campaign.id}`} className="font-serif text-lg text-[var(--cf-text-strong)]">What your audience will see</h4>
          </div>
          <p className="text-xs text-[var(--cf-text-subtle)]">Copy and media shown together before approval.</p>
        </div>
        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          {campaign.variants.map((variant) => (
            <CampaignProviderPreview
              key={variant.service}
              variant={variant}
              destinationUrl={campaign.destinationUrl}
              callToAction={campaign.callToAction}
              mediaExpectation={getCampaignMediaExpectation(campaign)}
              compact
            />
          ))}
        </div>
        {campaign.variants.flatMap((variant) => variant.attachments).length ? (
          <div className="mt-3 grid gap-2 text-xs text-[var(--cf-text-subtle)] sm:grid-cols-2">
            {campaign.variants.flatMap((variant) => variant.attachments).map((attachment) => (
              <p key={attachment.id} className="border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-3">
                <span className="block text-[var(--cf-text-muted)]">Alt: {attachment.altText}</span>
                {attachment.captionOverride ? <span className="mt-1 block">Caption: {attachment.captionOverride}</span> : null}
                <span className="mt-1 block">{attachment.media.reviewState.replace('_', ' ')} · {attachment.media.creatorCredit || attachment.media.rightsBasis || 'Rights pending'}</span>
              </p>
            ))}
          </div>
        ) : null}
      </section>

      {jobs.length ? <ProviderHistory jobs={jobs} /> : null}
    </div>
  );
}

function ProviderHistory({ jobs }: { jobs: SocialPublishJob[] }) {
  return (
    <section className="order-3 border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-3">
      <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--cf-accent-strong)]">
        Provider delivery history
      </h4>
      <ul className="mt-2 grid gap-2 text-xs text-[var(--cf-text-muted)] sm:grid-cols-2">
        {jobs.map((job) => (
          <li key={job.id} className="border border-[var(--cf-border-subtle)] px-3 py-2">
            <span className="font-semibold text-[#e8d5ac]">
              {SOCIAL_SERVICE_LABELS[job.service]}
            </span>
            {' / '}{getPublishJobStatusLabel(job.status)}
            {job.scheduledFor ? ` / ${formatDateTime(job.scheduledFor)}` : ''}
            {job.errorMessage ? ` / ${job.errorMessage}` : ''}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ContextItem({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Link2;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="border border-[var(--cf-border-subtle)] bg-[var(--cf-surface-inset)] p-3">
      <dt className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-[var(--cf-text-subtle)]">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className="mt-2 break-words text-sm leading-6 text-[var(--cf-text-muted)]">
        {children}
      </dd>
    </div>
  );
}
