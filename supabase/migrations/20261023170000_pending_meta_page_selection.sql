begin;
create table if not exists public.cardforge_meta_page_selections (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  payload_ciphertext text not null,
  payload_iv text not null,
  payload_auth_tag text not null,
  expires_at timestamptz not null default now() + interval '10 minutes'
);
alter table public.cardforge_meta_page_selections enable row level security;
revoke all on public.cardforge_meta_page_selections from public, anon, authenticated;
grant select, insert, delete on public.cardforge_meta_page_selections to service_role;
commit;
