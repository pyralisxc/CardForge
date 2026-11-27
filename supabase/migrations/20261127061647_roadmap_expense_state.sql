-- Existing checkpoints remain unclassified until the Owner explicitly identifies them.
alter table public.cardforge_roadmap_items
  add column expense_state text;

alter table public.cardforge_roadmap_items
  add constraint cardforge_roadmap_items_expense_state_check
  check (expense_state is null or (item_type = 'roi_checkpoint' and expense_state in ('current', 'planned')));

comment on column public.cardforge_roadmap_items.expense_state is
  'Owner-classified recurring expense state; null means not yet classified, not planned or current.';
