alter table public.cardforge_roadmap_items
  add column if not exists item_type text not null default 'feature';

alter table public.cardforge_roadmap_items
  add column if not exists description text;

alter table public.cardforge_roadmap_items
  add column if not exists visible_month text not null default to_char(now(), 'YYYY-MM');

alter table public.cardforge_roadmap_items
  add column if not exists target_mrr_cents integer;

alter table public.cardforge_roadmap_items
  add column if not exists monthly_cost_cents integer;

alter table public.cardforge_roadmap_items
  add column if not exists shipped_at timestamptz;

alter table public.cardforge_roadmap_items
  drop constraint if exists cardforge_roadmap_items_item_type_check;

alter table public.cardforge_roadmap_items
  add constraint cardforge_roadmap_items_item_type_check
  check (item_type in ('roi_checkpoint', 'feature', 'shipped_update'));

alter table public.cardforge_roadmap_items
  drop constraint if exists cardforge_roadmap_items_visible_month_check;

alter table public.cardforge_roadmap_items
  add constraint cardforge_roadmap_items_visible_month_check
  check (visible_month ~ '^[0-9]{4}-[0-9]{2}$');

alter table public.cardforge_roadmap_items
  drop constraint if exists cardforge_roadmap_items_target_mrr_cents_check;

alter table public.cardforge_roadmap_items
  add constraint cardforge_roadmap_items_target_mrr_cents_check
  check (target_mrr_cents is null or target_mrr_cents >= 0);

alter table public.cardforge_roadmap_items
  drop constraint if exists cardforge_roadmap_items_monthly_cost_cents_check;

alter table public.cardforge_roadmap_items
  add constraint cardforge_roadmap_items_monthly_cost_cents_check
  check (monthly_cost_cents is null or monthly_cost_cents >= 0);

create unique index if not exists cardforge_roadmap_items_source_title_unique_idx
  on public.cardforge_roadmap_items (source, title);

update public.cardforge_roadmap_items
set item_type = case
    when status = 'shipped' then 'shipped_update'
    else 'feature'
  end,
  visible_month = coalesce(nullif(visible_month, ''), to_char(created_at, 'YYYY-MM'))
where item_type is null
  or visible_month is null
  or visible_month = '';

insert into public.cardforge_roadmap_items (
  title,
  description,
  status,
  source,
  item_type,
  visible_month,
  target_mrr_cents,
  monthly_cost_cents,
  sort_order
)
values
  (
    'Founders beta feedback hub',
    'The account page brings demo access, roadmap votes, developer requests, and clearer next steps into one place for early users.',
    'in_progress',
    'official',
    'shipped_update',
    '2026-05',
    null,
    null,
    5
  ),
  (
    'Reliable live data foundation',
    'Pays for the managed database baseline behind votes, demo seats, roadmap signals, profile records, backups, and safer recovery work.',
    'planned',
    'official',
    'roi_checkpoint',
    '2026-06',
    30000,
    2500,
    10
  ),
  (
    'Production hosting headroom',
    'Adds enough app and database capacity for public beta traffic, stronger monitoring, and a less fragile path from demo use to real projects.',
    'planned',
    'official',
    'roi_checkpoint',
    '2026-07',
    84000,
    4500,
    20
  ),
  (
    'Cross-device project saves',
    'Unlocks the first signed-in cloud save path so creators can recover work beyond one browser and move projects between machines.',
    'planned',
    'official',
    'roi_checkpoint',
    '2026-09',
    174000,
    7500,
    30
  ),
  (
    'Account recovery and safety tooling',
    'Adds user-facing recovery paths, safer account protection, and stronger project restore behavior for creators building larger collections.',
    'planned',
    'official',
    'roi_checkpoint',
    '2026-12',
    324000,
    12500,
    40
  ),
  (
    'Polished shared template library',
    'Funds a searchable library of reviewed templates, proven defaults, preview quality, and launch-ready examples that new users can trust.',
    'planned',
    'official',
    'roi_checkpoint',
    '2027-04',
    624000,
    25000,
    50
  ),
  (
    'Developer asset pipeline at scale',
    'Expands reviewed community submissions into a durable pipeline for frames, symbols, dividers, textures, templates, moderation, and recovery.',
    'planned',
    'official',
    'roi_checkpoint',
    '2027-09',
    1224000,
    50000,
    60
  ),
  (
    'AI text and rules assistant',
    'Adds a capped assistant budget for card copy, rules wording, bulk cleanup, template-field writing, and safer review before generated text is exported.',
    'planned',
    'official',
    'roi_checkpoint',
    '2027-12',
    2424000,
    100000,
    70
  )
on conflict (source, title) do update
set description = excluded.description,
  item_type = excluded.item_type,
  visible_month = excluded.visible_month,
  target_mrr_cents = excluded.target_mrr_cents,
  monthly_cost_cents = excluded.monthly_cost_cents,
  sort_order = excluded.sort_order,
  updated_at = now();
