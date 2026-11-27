-- Existing submissions remain available in the review queue without becoming unread notices.
alter table public.cardforge_contributor_program_settings
  add column review_notices_started_at timestamptz not null default now();
