alter table public.cardforge_owner_settings
  add column if not exists billing_checkout_history_limit integer not null default 500
    check (billing_checkout_history_limit between 1 and 500),
  add column if not exists billing_checkout_history_cleared_before timestamptz;

comment on column public.cardforge_owner_settings.billing_checkout_history_limit is
  'Maximum Stripe Checkout Sessions shown in the owner console within the fixed retention window.';

comment on column public.cardforge_owner_settings.billing_checkout_history_cleared_before is
  'Display-only cutoff for owner checkout history; does not delete Stripe records.';
