-- Make public roadmap income and expenses traceable to current product data and
-- official provider pricing instead of the former speculative 12x cost ladder.

alter table public.cardforge_owner_settings
  add column if not exists roadmap_estimated_tax_percent integer not null default 30
    check (roadmap_estimated_tax_percent between 0 and 100),
  add column if not exists roadmap_operating_reserve_percent integer not null default 20
    check (roadmap_operating_reserve_percent between 0 and 100);

alter table public.cardforge_roadmap_items
  add column if not exists expense_provider text,
  add column if not exists expense_plan text,
  add column if not exists expense_source_url text,
  add column if not exists expense_verified_at date;

-- target_mrr_cents stays in place for this additive rollout so the currently
-- deployed reader remains compatible. A follow-up migration can remove it
-- after the new reader is live and no longer selects that column.

update public.cardforge_roadmap_items
set
  title = 'Supabase Pro data durability',
  description = 'Upgrades the current Free organization to Pro: projects no longer pause, daily backups are retained for 7 days, and CardForge gains 8 GB database disk, 100 GB file storage, 250 GB egress, and 7-day logs.',
  status = 'planned',
  item_type = 'roi_checkpoint',
  visible_month = '2026-08',
  monthly_cost_cents = 2500,
  expense_provider = 'Supabase',
  expense_plan = 'Pro',
  expense_source_url = 'https://supabase.com/pricing',
  expense_verified_at = date '2026-07-19',
  sort_order = 10,
  updated_at = now()
where source = 'official'
  and item_type = 'roi_checkpoint'
  and title = 'Reliable live data foundation';

update public.cardforge_roadmap_items
set
  title = 'Vercel Pro production hosting',
  description = 'Moves the commercial CardForge deployment to Pro with a $20 monthly usage credit, faster builds without queues, cold-start prevention, advanced spend controls, and longer runtime-log visibility.',
  status = 'planned',
  item_type = 'roi_checkpoint',
  visible_month = '2026-09',
  monthly_cost_cents = 2000,
  expense_provider = 'Vercel',
  expense_plan = 'Pro',
  expense_source_url = 'https://vercel.com/pricing',
  expense_verified_at = date '2026-07-19',
  sort_order = 20,
  updated_at = now()
where source = 'official'
  and item_type = 'roi_checkpoint'
  and title = 'Production hosting headroom';

update public.cardforge_roadmap_items
set
  title = 'Resend Pro email capacity',
  description = 'Raises transactional email capacity from 3,000 to 50,000 messages per month, removes the Free plan daily sending limit, and expands custom-domain and webhook headroom for account and support workflows.',
  status = 'planned',
  item_type = 'roi_checkpoint',
  visible_month = '2026-10',
  monthly_cost_cents = 2000,
  expense_provider = 'Resend',
  expense_plan = 'Pro 50K',
  expense_source_url = 'https://resend.com/pricing',
  expense_verified_at = date '2026-07-19',
  sort_order = 30,
  updated_at = now()
where source = 'official'
  and item_type = 'roi_checkpoint'
  and title = 'Cross-device project saves';

update public.cardforge_roadmap_items
set
  title = 'Clerk Pro authentication controls',
  description = 'Adds production MFA, custom session lifetimes, removal of Clerk branding, and 7-day authentication logs. The checkpoint uses the $25 month-to-month price rather than assuming an annual commitment.',
  status = 'planned',
  item_type = 'roi_checkpoint',
  visible_month = '2026-11',
  monthly_cost_cents = 2500,
  expense_provider = 'Clerk',
  expense_plan = 'Pro monthly',
  expense_source_url = 'https://clerk.com/pricing',
  expense_verified_at = date '2026-07-19',
  sort_order = 40,
  updated_at = now()
where source = 'official'
  and item_type = 'roi_checkpoint'
  and title = 'Account recovery and safety tooling';

update public.cardforge_roadmap_items
set
  item_type = 'feature',
  monthly_cost_cents = null,
  expense_provider = null,
  expense_plan = null,
  expense_source_url = null,
  expense_verified_at = null,
  description = case title
    when 'Polished shared template library' then 'Build a searchable library of reviewed templates and launch-ready examples. Supabase Pro includes enough early storage that no separate fixed expense is claimed yet.'
    when 'Developer asset pipeline at scale' then 'Expand reviewed community submissions into durable moderation, publishing, attribution, and recovery workflows. No new fixed provider expense is required at the current scale.'
    when 'AI text and rules assistant' then 'Explore assisted card copy and rules cleanup only after a model, privacy path, and capped usage budget are chosen. No monthly expense is claimed before those decisions exist.'
    else description
  end,
  updated_at = now()
where source = 'official'
  and title in (
    'Polished shared template library',
    'Developer asset pipeline at scale',
    'AI text and rules assistant'
  );

update public.cardforge_roadmap_items
set
  description = case title
    when 'Cloud project saves for signed-in users' then 'Move projects beyond browser-only storage so signed-in creators can recover work and continue on another device.'
    when 'Custom art uploads and reusable asset packs' then 'Let creators organize uploaded art into reusable project assets instead of selecting the same files repeatedly.'
    when 'Premium fantasy frame kits and texture library expansion' then 'Continue expanding reviewed frames, textures, dividers, and examples while the library and developer pipeline mature.'
    when 'Template marketplace and creator sharing tools' then 'Design publishing, attribution, moderation, licensing, and discovery before calling the existing template library a marketplace.'
    else description
  end,
  updated_at = now()
where source = 'official'
  and title in (
    'Cloud project saves for signed-in users',
    'Custom art uploads and reusable asset packs',
    'Premium fantasy frame kits and texture library expansion',
    'Template marketplace and creator sharing tools'
  );

update public.cardforge_roadmap_items
set
  status = 'shipped',
  item_type = 'shipped_update',
  visible_month = '2026-07',
  description = 'The signed-in account hub now combines access state, billing management, roadmap participation, developer requests, and owner-only operations.',
  monthly_cost_cents = null,
  expense_provider = null,
  expense_plan = null,
  expense_source_url = null,
  expense_verified_at = null,
  shipped_at = coalesce(shipped_at, timestamptz '2026-07-18 00:00:00+00'),
  updated_at = now()
where source = 'official'
  and title = 'Founders beta feedback hub';

update public.cardforge_roadmap_items
set
  status = 'shipped',
  item_type = 'shipped_update',
  visible_month = '2026-07',
  description = 'CardForge ships individual PNG, PNG ZIP, PDF, project-file, and Tabletop Simulator sprite-sheet exports with a stable manifest.',
  monthly_cost_cents = null,
  expense_provider = null,
  expense_plan = null,
  expense_source_url = null,
  expense_verified_at = null,
  shipped_at = coalesce(shipped_at, timestamptz '2026-07-06 00:00:00+00'),
  updated_at = now()
where source = 'official'
  and title = 'Export presets for print shops and tabletop platforms';

delete from public.cardforge_roadmap_items item
where item.source = 'official'
  and item.title = 'Founders beta feedback and account dashboard'
  and not exists (
    select 1
    from public.cardforge_roadmap_votes vote
    where vote.item_id = item.id
  );

insert into public.cardforge_roadmap_items (
  title,
  description,
  status,
  source,
  item_type,
  visible_month,
  monthly_cost_cents,
  sort_order
)
values (
  'Account recovery and safety tooling',
  'Add clearer recovery guidance, session controls, and project-restore paths after the underlying authentication and cloud-save work is ready.',
  'planned',
  'official',
  'feature',
  '2026-11',
  null,
  45
)
on conflict (source, title) do update
set
  description = excluded.description,
  item_type = excluded.item_type,
  monthly_cost_cents = null,
  expense_provider = null,
  expense_plan = null,
  expense_source_url = null,
  expense_verified_at = null,
  updated_at = now();

alter table public.cardforge_roadmap_items
  drop constraint if exists cardforge_roadmap_items_expense_checkpoint_check;

alter table public.cardforge_roadmap_items
  add constraint cardforge_roadmap_items_expense_checkpoint_check
  check (
    (
      item_type = 'roi_checkpoint'
      and monthly_cost_cents is not null
      and monthly_cost_cents > 0
      and nullif(trim(expense_provider), '') is not null
      and nullif(trim(expense_plan), '') is not null
      and expense_source_url is not null
      and expense_source_url ~ '^https://'
      and expense_verified_at is not null
    )
    or (
      item_type <> 'roi_checkpoint'
      and monthly_cost_cents is null
      and expense_provider is null
      and expense_plan is null
      and expense_source_url is null
      and expense_verified_at is null
    )
  );

comment on column public.cardforge_owner_settings.roadmap_estimated_tax_percent is
  'Public planning estimate deducted from active Creator Pass listed-price MRR; not filed tax accounting.';

comment on column public.cardforge_owner_settings.roadmap_operating_reserve_percent is
  'Share of after-estimated-tax Creator Pass income held before comparison with estimated roadmap capacity.';

comment on column public.cardforge_roadmap_items.monthly_cost_cents is
  'Incremental fixed monthly USD cost for a verified provider expense checkpoint, not a cumulative estimate.';
