alter table public.cardforge_developer_program_settings
  add column if not exists owner_vote_weight integer not null default 1 check (owner_vote_weight between 1 and 3);

alter table public.cardforge_developer_asset_votes
  add column if not exists vote_weight integer not null default 1 check (vote_weight between 1 and 3);
