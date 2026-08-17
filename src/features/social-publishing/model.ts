export {
  MARKETING_SERVICES as SOCIAL_SERVICES,
  MARKETING_SERVICE_LABELS as SOCIAL_SERVICE_LABELS,
  type MarketingService as SocialService,
} from '@/features/marketing/model';

export type SocialPublishJobStatus =
  | 'planned'
  | 'ready'
  | 'provider_draft'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'cancelled'
  | 'skipped'
  | 'unknown';
