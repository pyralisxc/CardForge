create index if not exists cardforge_campaign_attachments_derivative_media_idx
  on public.cardforge_social_campaign_media_attachments (derivative_id, media_id);
