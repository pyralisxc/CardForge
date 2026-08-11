import Image from 'next/image';
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
  type SocialCampaignMedia,
  type SocialPublishJob,
} from '@/features/developer-cockpit/model';

const formatDateTime = (value: string | null): string => {
  if (!value) return 'No requested time';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Invalid date';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const getMediaPreviewUrl = (media: SocialCampaignMedia): string => (
  media.publicUrl
  ?? (media.sourcePath
    ? `/api/developer-cockpit/media?path=${encodeURIComponent(media.sourcePath)}`
    : '')
);

const getExternalReference = (value: string): string | null => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
};

export function DeveloperCampaignPackageDetails({
  campaign,
  jobs,
}: {
  campaign: SocialCampaign;
  jobs: SocialPublishJob[];
}) {
  const sourceUrl = getExternalReference(campaign.sourceReference);

  return (
    <div className="mt-4 space-y-4">
      <section aria-labelledby={`production-context-${campaign.id}`}>
        <div className="flex items-center gap-2 text-[#e2aa4a]">
          <FileText className="h-4 w-4" />
          <h4
            id={`production-context-${campaign.id}`}
            className="text-xs font-semibold uppercase tracking-[0.14em]"
          >
            Production context
          </h4>
        </div>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <ContextItem icon={Link2} label="Destination">
            {campaign.destinationUrl ? (
              <a
                className="inline-flex items-center gap-1 break-all text-[#f1c875] underline decoration-[#8c6436] underline-offset-4"
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
          <ContextItem icon={FileText} label="Source or release">
            {sourceUrl ? (
              <a
                className="inline-flex items-center gap-1 break-all text-[#f1c875] underline decoration-[#8c6436] underline-offset-4"
                href={sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                {campaign.sourceReference}
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
            ) : campaign.sourceReference || 'Not supplied'}
          </ContextItem>
          <ContextItem icon={Scale} label="Rights and ownership">
            {campaign.licenseNotes || 'Not supplied'}
          </ContextItem>
        </dl>
      </section>

      <section aria-labelledby={`channel-deliverables-${campaign.id}`}>
        <div className="flex items-center gap-2 text-[#e2aa4a]">
          <Images className="h-4 w-4" />
          <h4
            id={`channel-deliverables-${campaign.id}`}
            className="text-xs font-semibold uppercase tracking-[0.14em]"
          >
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
              {variant.media.length ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {variant.media.map((media, index) => (
                    <CampaignMediaProof
                      key={`${media.sourcePath ?? media.publicUrl}:${index}`}
                      media={media}
                    />
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

      {jobs.length ? (
        <section
          className="border border-[#4a3823] bg-[#100c08] p-3"
          aria-labelledby={`delivery-history-${campaign.id}`}
        >
          <h4
            id={`delivery-history-${campaign.id}`}
            className="text-xs font-semibold uppercase tracking-[0.14em] text-[#e2aa4a]"
          >
            Provider delivery history
          </h4>
          <ul className="mt-2 grid gap-2 text-xs text-[#c7b288] sm:grid-cols-2">
            {jobs.map((job) => (
              <li key={job.id} className="border border-[#4a3823] px-3 py-2">
                <span className="font-semibold text-[#e8d5ac]">
                  {SOCIAL_SERVICE_LABELS[job.service]}
                </span>
                {' / '}
                {job.status.replaceAll('_', ' ')}
                {job.scheduledFor ? ` / ${formatDateTime(job.scheduledFor)}` : ''}
                {job.errorMessage ? ` / ${job.errorMessage}` : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ContextItem({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Link2;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-[#4a3823] bg-[#100c08] p-3">
      <dt className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-[#a98a55]">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className="mt-2 break-words text-sm leading-6 text-[#d8c49a]">{children}</dd>
    </div>
  );
}

function CampaignMediaProof({ media }: { media: SocialCampaignMedia }) {
  const src = getMediaPreviewUrl(media);
  return (
    <figure className="border border-[#4a3823] bg-[#15100a] p-2">
      {src ? (
        <Image
          src={src}
          alt={media.alt}
          width={640}
          height={360}
          unoptimized
          className="aspect-video w-full object-cover"
        />
      ) : (
        <div className="grid aspect-video place-items-center bg-[#0c0b09] text-xs text-[#a98a55]">
          Preview unavailable
        </div>
      )}
      <figcaption className="mt-2 text-xs leading-5 text-[#c7b288]">
        {media.alt}
        <span className="mt-1 block text-[#a98a55]">
          {media.publicUrl ? 'Approved public media' : 'Protected source media'}
        </span>
      </figcaption>
    </figure>
  );
}
