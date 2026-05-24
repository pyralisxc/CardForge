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
    'The account page brings beta access, roadmap votes, and developer requests into one cleaner place.',
    'in_progress',
    'official',
    'shipped_update',
    '2026-05',
    null,
    null,
    5
  ),
  (
    'Durable community data',
    'Supabase Pro becomes financially safe for live votes, roadmap data, beta signals, backups, and future profile records.',
    'planned',
    'official',
    'roi_checkpoint',
    '2026-06',
    25000,
    2500,
    10
  ),
  (
    'Production hosting and database baseline',
    'Host Card Forge with production-grade app/database headroom so beta traffic does not depend on a fragile local setup.',
    'planned',
    'official',
    'roi_checkpoint',
    '2026-07',
    45000,
    4500,
    20
  ),
  (
    'Signed-in cloud save prototype',
    'First account-backed cloud project save flow for users who want browser-independent backups.',
    'planned',
    'official',
    'roi_checkpoint',
    '2026-09',
    75000,
    7500,
    30
  ),
  (
    'Account recovery and safety tooling',
    'Safer backups, recovery paths, and account protection for creators who build from more than one browser.',
    'planned',
    'official',
    'roi_checkpoint',
    '2026-12',
    125000,
    12500,
    40
  ),
  (
    'Public template library',
    'A searchable shared library for polished templates, proven defaults, and launch-ready forge examples.',
    'planned',
    'official',
    'roi_checkpoint',
    '2027-04',
    250000,
    25000,
    50
  ),
  (
    'Moderated community asset submissions',
    'Community-submitted frames, parts, and template packs with review, moderation, and curation controls.',
    'planned',
    'official',
    'roi_checkpoint',
    '2027-09',
    500000,
    50000,
    60
  ),
  (
    'AI text and rules assistant',
    'A capped AI budget for card copy, rules wording, bulk cleanup, and template-field writing support.',
    'planned',
    'official',
    'roi_checkpoint',
    '2027-12',
    1000000,
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
