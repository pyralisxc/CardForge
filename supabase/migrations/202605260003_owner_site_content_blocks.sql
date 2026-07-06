create table if not exists public.cardforge_site_content_blocks (
  slug text primary key check (slug in (
    'landing.hero.headline',
    'landing.hero.body',
    'landing.hero.support',
    'landing.demo.heading',
    'landing.demo.body',
    'about.hero.headline',
    'about.hero.body',
    'access.hero.headline',
    'access.hero.body',
    'access.creatorPool.note'
  )),
  body text not null check (char_length(body) between 1 and 800),
  updated_at timestamptz not null default now()
);

drop trigger if exists cardforge_site_content_blocks_touch_updated_at on public.cardforge_site_content_blocks;
create trigger cardforge_site_content_blocks_touch_updated_at
  before update on public.cardforge_site_content_blocks
  for each row
  execute function public.cardforge_touch_updated_at();

alter table public.cardforge_site_content_blocks enable row level security;

insert into public.cardforge_site_content_blocks (slug, body, updated_at)
values
  (
    'landing.hero.headline',
    'Build cards faster. Generate complete sets. Shape the forge together.',
    now()
  ),
  (
    'landing.hero.body',
    'CardForge helps creators turn card ideas into full, export-ready sets while the community helps build the shared library that powers the studio.',
    now()
  ),
  (
    'landing.hero.support',
    'The fantasy forge is the doorway; underneath is a serious production workflow for reusable templates, structured data, bulk generation, and clean exports.',
    now()
  ),
  (
    'landing.demo.heading',
    'Free demo seats are open for the current wave.',
    now()
  ),
  (
    'landing.demo.body',
    'Claiming a Founder Beta seat unlocks clean export access for the demo window while seats remain open. It is the fastest way to test the production workflow before CardForge moves into wider paid access.',
    now()
  ),
  (
    'about.hero.headline',
    'A fantasy-forged studio for serious card production.',
    now()
  ),
  (
    'about.hero.body',
    'CardForge helps creators design reusable card systems, generate complete sets from structured data, and export clean files. The forge theme gives the product a memorable doorway; the deeper promise is a practical workbench for creators who need repeatable layouts, shared assets, and faster iteration.',
    now()
  ),
  (
    'access.hero.headline',
    'Start free, claim a demo seat, then unlock cleaner production workflows.',
    now()
  ),
  (
    'access.hero.body',
    'CardForge is in beta, so access is intentionally staged. New users can explore the studio first, claim Founder Beta access when seats are open, and move toward Creator Pass or developer participation as the platform matures.',
    now()
  ),
  (
    'access.creatorPool.note',
    'Developer profit-sharing language is a future creator-pool plan, not active payout infrastructure yet.',
    now()
  )
on conflict (slug) do nothing;
