-- No existing Contributor receives Roadmap authority from this migration.
alter table public.cardforge_contributor_profiles
  add column can_edit_roadmap boolean not null default false;

comment on column public.cardforge_contributor_profiles.can_edit_roadmap is
  'Owner-granted access to ordinary Roadmap detail corrections, effective only for an active Contributor profile.';
