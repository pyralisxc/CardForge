update public.cardforge_founder_beta_campaigns
set
  public_slot_cap = 25,
  release_slot_cap = 25,
  landing_message = regexp_replace(
    landing_message,
    '\mfirst\s+[0-9]+\s+creators\M',
    'first 25 creators',
    'i'
  ),
  updated_at = timezone('utc', now())
where id = 'founder_beta'
  and public_slot_cap > 25
  and release_slot_cap > 25;
