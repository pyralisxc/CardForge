-- Existing incomplete expense disclosures can be edited without inventing missing facts.
-- Preserve the existing positive-price and HTTPS validation whenever values are present.
alter table public.cardforge_roadmap_items
  drop constraint cardforge_roadmap_items_expense_checkpoint_check;

alter table public.cardforge_roadmap_items
  add constraint cardforge_roadmap_items_expense_checkpoint_check
  check (
    (item_type = 'roi_checkpoint'
      and (monthly_cost_cents is null or monthly_cost_cents > 0)
      and (expense_provider is null or nullif(trim(expense_provider), '') is not null)
      and (expense_plan is null or nullif(trim(expense_plan), '') is not null)
      and (expense_source_url is null or expense_source_url ~ '^https://'))
    or (item_type <> 'roi_checkpoint'
      and monthly_cost_cents is null and expense_provider is null and expense_plan is null
      and expense_source_url is null and expense_verified_at is null)
  );
