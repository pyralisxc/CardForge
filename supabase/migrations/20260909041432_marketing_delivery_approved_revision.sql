-- Existing deliveries deliberately retain NULL: their historical approval
-- revision cannot be inferred from today's editable campaign.
alter table public.cardforge_social_publish_jobs
  add column approved_campaign_version integer
    check (approved_campaign_version > 0);
