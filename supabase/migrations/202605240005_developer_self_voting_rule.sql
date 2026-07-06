alter table public.cardforge_developer_program_settings
  add column if not exists allow_contributor_self_voting boolean not null default true;
