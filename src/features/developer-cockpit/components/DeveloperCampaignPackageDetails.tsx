import Image from 'next/image';
import type { ReactNode } from 'react';
import {
  CalendarClock,
  ExternalLink,
  FileText,
  Images,
  Link2,
  Scale,
} from 'lucide-react';

import {
  SOCIAL_SERVICE_LABELS,
  type SocialCampaign,
  type SocialPublishJob,
} from '@/features/developer-cockpit/model';

const formatDateTime = (value: string | null) => (
  value
    ? new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
    : 'No requested time'
);

export function DeveloperCampaignPackageDetails({
  campaign,
  jobs,
}: {
  campaign: SocialCampaign;
  jobs: SocialPublishJob[];
}) {
  return (
    <div className="mt-4 space-y-4">
      <section>
        <div className="flex items-center gap-2 text-[#e2aa4a]">
          <FileText className="h-4 w-4" />
          <h4 className="text-xs font-semibold uppercase tracking-[0.14em]">
            Production context
          </h4>
        </div>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
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
          <ContextItem icon={FileText} label="Production note">
            {campaign.productionNote || 'Not supplied'}
          </ContextItem>
          <ContextItem icon={Scale} label="Development associations">
            {campaign.associations.length ? (
              <ul className="grid gap-2">
                {campaign.associations.map((association) => (
                  <li key={association.id}>
                    <span className="block text-xs uppercase tracking-[0.1em] text-[#a98a55]">
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
                      <span className="mt-1 block text-xs text-[#a98a55]">
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

      <section>
        <div className="flex items-center gap-2 text-[#e2aa4a]">
          <Images className="h-4 w-4" />
          <h4 className="text-xs font-semibold uppercase tracking-[0.14em]">
            Channel deliverables
          </h4>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {campaign.variants.map((variant) => (
            <article
              key={variant.service}
              className="border border-[#4a3823] bg-[#100c08] p-3"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#e2aa4a]">
                {SOCIAL_SERVICE_LABELS[variant.service]}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#d8c49a]">
                {variant.text}
              </p>
              {variant.attachments.length ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {variant.attachments.map((attachment) => (
                    <figure
                      key={attachment.id}
                      className="border border-[#4a3823] bg-[#15100a] p-2"
                    >
                      <Image
                        src={attachment.media.previewUrl}
                        alt={attachment.altText}
                        width={640}
                        height={360}
                        unoptimized
                        className="aspect-video w-full object-cover"
                      />
                      <figcaption className="mt-2 text-xs leading-5 text-[#c7b288]">
                        {attachment.altText}
                        {attachment.captionOverride ? (
                          <span className="mt-1 block text-[#d8c49a]">
                            Caption: {attachment.captionOverride}
                          </span>
                        ) : null}
                        <span className="mt-1 block text-[#a98a55]">
                          {attachment.media.reviewState.replace('_', ' ')} · {attachment.media.creatorCredit || attachment.media.rightsBasis || 'Rights pending'}
                        </span>
                        {attachment.media.rightsRestriction ? (
                          <span className="block text-[#a98a55]">
                            Restriction: {attachment.media.rightsRestriction}
                          </span>
                        ) : null}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              ) : (
                <p className="mt-3 border border-dashed border-[#4a3823] p-3 text-xs text-[#a98a55]">
                  Text-only channel deliverable
                </p>
              )}
            </article>
          ))}
        </div>
      </section>

      {jobs.length ? <ProviderHistory jobs={jobs} /> : null}
    </div>
  );
}

function ProviderHistory({ jobs }: { jobs: SocialPublishJob[] }) {
  return (
    <section className="border border-[#4a3823] bg-[#100c08] p-3">
      <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#e2aa4a]">
        Provider delivery history
      </h4>
      <ul className="mt-2 grid gap-2 text-xs text-[#c7b288] sm:grid-cols-2">
        {jobs.map((job) => (
          <li key={job.id} className="border border-[#4a3823] px-3 py-2">
            <span className="font-semibold text-[#e8d5ac]">
              {SOCIAL_SERVICE_LABELS[job.service]}
            </span>
            {' / '}{job.status.replaceAll('_', ' ')}
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
    <div className="border border-[#4a3823] bg-[#100c08] p-3">
      <dt className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-[#a98a55]">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className="mt-2 break-words text-sm leading-6 text-[#d8c49a]">
        {children}
      </dd>
    </div>
  );
}
