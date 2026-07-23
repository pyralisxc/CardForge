-- The future developer pool is a tracked part of the operating reserve, not
-- a separate percentage of profit or a current Stripe payout obligation.

alter table public.cardforge_developer_program_settings
  add column if not exists developer_reserve_share_percent integer not null default 50
    check (developer_reserve_share_percent between 0 and 100);

alter table public.cardforge_developer_program_settings
  drop constraint if exists cardforge_developer_program_settings_max_active_developers_check;

alter table public.cardforge_developer_program_settings
  alter column max_active_developers set default 10;

update public.cardforge_developer_program_settings
set
  max_active_developers = least(max_active_developers, 10),
  developer_reserve_share_percent = 50,
  updated_at = now()
where id = 'default';

alter table public.cardforge_developer_program_settings
  add constraint cardforge_developer_program_settings_max_active_developers_check
  check (max_active_developers between 1 and 10);

alter table public.cardforge_developer_program_settings
  drop column if exists profit_share_pool_percent;

insert into public.cardforge_legal_documents (
  slug,
  version,
  title,
  body,
  effective_date,
  published_at,
  business_identity_version
)
values (
  'creator-pool',
  3,
  'Developer Pool Notice',
  $body$CardForge may earmark an owner-configurable share of its operating reserve for a future developer pool. The current default earmark is 50% of the operating reserve. This is a tagged part of money already reserved for CardForge; it is not an additional roadmap deduction and does not change the roadmap-income calculation.

The developer program has a maximum of 10 active seats. If payouts launch, eligible active developers for the applicable payout period will share the earmarked pool equally under owner-published eligibility and contribution rules. A full eligible roster would receive one tenth of that earmarked pool per developer.

The developer pool is not active payout infrastructure today. It is not stock, equity, a security, employment, partnership, a wage promise, or guaranteed income. It depends on future billing reconciliation, refund and dispute handling, tax handling, payout-provider setup, creator eligibility rules, legal review, and owner-published program terms.

Until payout systems and final legal terms are live, this notice describes the product direction for the collective, not a payable balance or enforceable distribution schedule.$body$,
  date '2026-07-19',
  now(),
  (select business_identity_version from public.cardforge_legal_documents order by version desc, published_at desc limit 1)
)
on conflict (slug, version) do update
set
  title = excluded.title,
  body = excluded.body,
  effective_date = excluded.effective_date,
  published_at = excluded.published_at,
  business_identity_version = excluded.business_identity_version,
  updated_at = now();

comment on column public.cardforge_developer_program_settings.developer_reserve_share_percent is
  'Owner-adjustable share of the operating reserve earmarked for the future developer pool; it is not a current payout obligation.';
