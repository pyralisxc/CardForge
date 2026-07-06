alter table public.cardforge_developer_profiles
  add column if not exists first_name text,
  add column if not exists last_name text;

create index if not exists cardforge_developer_profiles_name_idx
  on public.cardforge_developer_profiles (last_name, first_name);
