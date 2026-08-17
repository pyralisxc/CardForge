"use client";

import Image from 'next/image';
import { useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  ImagePlus,
  Loader2,
  Trash2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  CAMPAIGN_FIELD_LIMITS,
  MARKETING_CHANNELS as SOCIAL_SERVICES,
  MARKETING_CHANNEL_LABELS as SOCIAL_SERVICE_LABELS,
  type CampaignMedia,
  type CampaignMediaAttachment,
  type MarketingChannelVariant as SocialCampaignVariant,
  type MarketingChannel as SocialService,
} from '@/features/marketing-content/model';

const fieldClassName = 'min-h-11 w-full border border-[#5f4526] bg-[#0c0b09] px-3 py-2 text-sm text-[#ffe7ad] placeholder:text-[#6f5b3a]';

const normalizeAttachmentOrder = (
  attachments: CampaignMediaAttachment[],
) => attachments.map((attachment, displayOrder) => ({
  ...attachment,
  displayOrder,
}));

export function CampaignVariantEditor({
  index,
  variant,
  variants,
  mediaLibrary,
  disabled,
  uploading,
  onChange,
  onRemove,
  onIngest,
  onError,
}: {
  index: number;
  variant: SocialCampaignVariant;
  variants: SocialCampaignVariant[];
  mediaLibrary: CampaignMedia[];
  disabled: boolean;
  uploading: boolean;
  onChange: (variant: SocialCampaignVariant) => void;
  onRemove: () => void;
  onIngest: (file: File) => Promise<CampaignMedia | null>;
  onError: (message: string) => void;
}) {
  const [altText, setAltText] = useState('');
  const [selectedMediaId, setSelectedMediaId] = useState('');

  const attachMedia = (media: CampaignMedia) => {
    const contextualAltText = altText.trim();
    if (!contextualAltText) {
      onError('Add meaningful contextual alt text before attaching campaign media.');
      return false;
    }
    if (variant.attachments.length >= 4) {
      onError('Each channel can include at most four images.');
      return false;
    }
    if (variant.attachments.some((attachment) => attachment.mediaId === media.id)) {
      onError('That media is already attached to this channel.');
      return false;
    }

    onChange({
      ...variant,
      attachments: [...variant.attachments, {
        id: crypto.randomUUID(),
        mediaId: media.id,
        derivativeId: null,
        displayOrder: variant.attachments.length,
        altText: contextualAltText,
        captionOverride: media.reusableCaption,
        cropIntent: {},
        media,
      }],
    });
    setAltText('');
    setSelectedMediaId('');
    return true;
  };

  const updateAttachment = (
    attachmentIndex: number,
    patch: Partial<CampaignMediaAttachment>,
  ) => {
    onChange({
      ...variant,
      attachments: variant.attachments.map((attachment, candidateIndex) => (
        candidateIndex === attachmentIndex
          ? { ...attachment, ...patch }
          : attachment
      )),
    });
  };

  const removeAttachment = (attachmentIndex: number) => {
    onChange({
      ...variant,
      attachments: normalizeAttachmentOrder(
        variant.attachments.filter((_, candidateIndex) => (
          candidateIndex !== attachmentIndex
        )),
      ),
    });
  };

  const moveAttachment = (attachmentIndex: number, direction: -1 | 1) => {
    const destination = attachmentIndex + direction;
    if (destination < 0 || destination >= variant.attachments.length) return;
    const attachments = [...variant.attachments];
    [attachments[attachmentIndex], attachments[destination]] = [
      attachments[destination],
      attachments[attachmentIndex],
    ];
    onChange({
      ...variant,
      attachments: normalizeAttachmentOrder(attachments),
    });
  };

  const ingestMedia = async (file: File | null) => {
    if (!file) return;
    if (!altText.trim()) {
      onError('Add meaningful contextual alt text before ingesting campaign media.');
      return;
    }
    if (variant.attachments.length >= 4) {
      onError('Each channel can include at most four images.');
      return;
    }
    const media = await onIngest(file);
    if (media) attachMedia(media);
  };

  return (
    <article className="border border-[#4a3823] bg-[#100c08] p-4">
      <div className="flex flex-wrap gap-3">
        <select
          aria-label={`Channel ${index + 1}`}
          className={`${fieldClassName} flex-1`}
          value={variant.service}
          onChange={(event) => onChange({
            ...variant,
            service: event.target.value as SocialService,
          })}
        >
          {SOCIAL_SERVICES.map((service) => (
            <option
              key={service}
              value={service}
              disabled={variants.some((candidate, candidateIndex) => (
                candidateIndex !== index && candidate.service === service
              ))}
            >
              {SOCIAL_SERVICE_LABELS[service]}
            </option>
          ))}
        </select>
        {index > 0 && variants[0]?.text ? (
          <Button
            type="button"
            className="min-h-11"
            variant="ghost"
            onClick={() => onChange({ ...variant, text: variants[0].text })}
          >
            <Copy className="mr-2 h-4 w-4" />
            Start from primary copy
          </Button>
        ) : null}
        {variants.length > 1 ? (
          <Button
            type="button"
            className="min-h-11"
            variant="outline"
            onClick={onRemove}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remove
          </Button>
        ) : null}
      </div>

      <CountedField
        className="mt-3"
        label={`${SOCIAL_SERVICE_LABELS[variant.service]} post copy`}
        value={variant.text}
        limit={CAMPAIGN_FIELD_LIMITS.variantText}
      >
        <textarea
          className={`${fieldClassName} min-h-32`}
          maxLength={CAMPAIGN_FIELD_LIMITS.variantText}
          value={variant.text}
          onChange={(event) => onChange({ ...variant, text: event.target.value })}
        />
      </CountedField>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <CountedField
          label={`Contextual alt text for ${SOCIAL_SERVICE_LABELS[variant.service]}`}
          value={altText}
          limit={CAMPAIGN_FIELD_LIMITS.mediaAlt}
        >
          <input
            className={fieldClassName}
            maxLength={CAMPAIGN_FIELD_LIMITS.mediaAlt}
            value={altText}
            onChange={(event) => setAltText(event.target.value)}
          />
        </CountedField>
        <label className="grid gap-1 text-xs text-[#c7b288]">
          Reuse authorized media
          <select
            className={fieldClassName}
            value={selectedMediaId}
            onChange={(event) => setSelectedMediaId(event.target.value)}
          >
            <option value="">Choose media</option>
            {mediaLibrary.filter((media) => !media.archivedAt).map((media) => (
              <option key={media.id} value={media.id}>
                {media.originalFilename || media.id.slice(0, 8)} · {media.width}×{media.height}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          className="mt-auto min-h-11"
          variant="outline"
          onClick={() => {
            const media = mediaLibrary.find((candidate) => (
              candidate.id === selectedMediaId
            ));
            if (media) attachMedia(media);
            else onError('Choose a reusable media item.');
          }}
        >
          Attach selected media
        </Button>
      </div>

      <label
        className="mt-3 inline-flex min-h-11 cursor-pointer items-center justify-center border border-[#5f4526] px-4 text-sm text-[#ffe7ad] hover:bg-[#2a1b0d]"
        aria-disabled={disabled}
      >
        {uploading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <ImagePlus className="mr-2 h-4 w-4" />
        )}
        {uploading ? 'Ingesting image…' : 'Ingest new image'}
        <input
          type="file"
          accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
          className="sr-only"
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            event.target.value = '';
            void ingestMedia(file);
          }}
        />
      </label>

      {variant.attachments.length ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {variant.attachments.map((attachment, attachmentIndex) => (
            <article
              key={attachment.id}
              className="border border-[#4a3823] bg-[#15100a] p-3"
            >
              <Image
                src={attachment.media.previewUrl}
                alt={attachment.altText}
                width={640}
                height={360}
                unoptimized
                className="aspect-video w-full object-cover"
              />
              <CountedField
                className="mt-3"
                label="Attachment alt text"
                value={attachment.altText}
                limit={CAMPAIGN_FIELD_LIMITS.mediaAlt}
              >
                <textarea
                  className={`${fieldClassName} min-h-20`}
                  maxLength={CAMPAIGN_FIELD_LIMITS.mediaAlt}
                  value={attachment.altText}
                  onChange={(event) => updateAttachment(attachmentIndex, {
                    altText: event.target.value,
                  })}
                />
              </CountedField>
              <CountedField
                className="mt-3"
                label="Caption override"
                value={attachment.captionOverride}
                limit={CAMPAIGN_FIELD_LIMITS.captionOverride}
              >
                <textarea
                  className={`${fieldClassName} min-h-20`}
                  maxLength={CAMPAIGN_FIELD_LIMITS.captionOverride}
                  value={attachment.captionOverride}
                  onChange={(event) => updateAttachment(attachmentIndex, {
                    captionOverride: event.target.value,
                  })}
                  placeholder="Optional channel-specific caption for this image"
                />
              </CountedField>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="min-h-11"
                  size="sm"
                  variant="ghost"
                  aria-label="Move image earlier"
                  disabled={attachmentIndex === 0}
                  onClick={() => moveAttachment(attachmentIndex, -1)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  className="min-h-11"
                  size="sm"
                  variant="ghost"
                  aria-label="Move image later"
                  disabled={attachmentIndex === variant.attachments.length - 1}
                  onClick={() => moveAttachment(attachmentIndex, 1)}
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  className="min-h-11"
                  size="sm"
                  variant="ghost"
                  onClick={() => removeAttachment(attachmentIndex)}
                >
                  <Trash2 className="mr-2 h-3 w-3" />
                  Remove
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function CountedField({
  label,
  value,
  limit,
  className = '',
  children,
}: {
  label: string;
  value: string;
  limit: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`grid gap-1 text-xs text-[#c7b288] ${className}`}>
      <span className="flex justify-between gap-3">
        <span>{label}</span>
        <span>{value.length}/{limit}</span>
      </span>
      {children}
    </label>
  );
}
