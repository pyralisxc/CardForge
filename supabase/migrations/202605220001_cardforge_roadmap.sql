create extension if not exists pgcrypto;

create table if not exists public.cardforge_roadmap_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  status text not null default 'planned' check (
    status in ('planned', 'in_progress', 'testing', 'shipped', 'archived_negative_signal')
  ),
  source text not null default 'user' check (source in ('official', 'user')),
  created_by_user_id text,
  created_by_email text,
  sort_order integer not null default 100,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cardforge_roadmap_votes (
  item_id uuid not null references public.cardforge_roadmap_items(id) on delete cascade,
  user_id text not null,
  vote text not null check (vote in ('up', 'down')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (item_id, user_id)
);

create index if not exists cardforge_roadmap_items_active_idx
  on public.cardforge_roadmap_items (status, source, sort_order, created_at);

create index if not exists cardforge_roadmap_votes_item_vote_idx
  on public.cardforge_roadmap_votes (item_id, vote);

create unique index if not exists cardforge_roadmap_items_source_title_unique_idx
  on public.cardforge_roadmap_items (source, title);

create or replace function public.cardforge_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cardforge_roadmap_items_touch_updated_at on public.cardforge_roadmap_items;
create trigger cardforge_roadmap_items_touch_updated_at
  before update on public.cardforge_roadmap_items
  for each row
  execute function public.cardforge_touch_updated_at();

drop trigger if exists cardforge_roadmap_votes_touch_updated_at on public.cardforge_roadmap_votes;
create trigger cardforge_roadmap_votes_touch_updated_at
  before update on public.cardforge_roadmap_votes
  for each row
  execute function public.cardforge_touch_updated_at();

alter table public.cardforge_roadmap_items enable row level security;
alter table public.cardforge_roadmap_votes enable row level security;

comment on table public.cardforge_roadmap_items is
  'Card Forge beta roadmap and compact user suggestions. Access is mediated by Next.js API routes and Clerk.';

comment on table public.cardforge_roadmap_votes is
  'One thumbs up/down vote per Clerk user per Card Forge roadmap item. Access is mediated by Next.js API routes and Clerk.';

insert into public.cardforge_roadmap_items (title, status, source, sort_order)
values
  ('Cloud project saves for signed-in users', 'planned', 'official', 10),
  ('Custom art uploads and reusable asset packs', 'planned', 'official', 20),
  ('Premium fantasy frame kits and texture library expansion', 'in_progress', 'official', 30),
  ('Template marketplace and creator sharing tools', 'planned', 'official', 40),
  ('Export presets for print shops and tabletop platforms', 'testing', 'official', 50),
  ('Founders beta feedback and account dashboard', 'in_progress', 'official', 60)
on conflict do nothing;
