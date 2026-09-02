-- Roadmap row ids differ by environment. Select the official capability by
-- durable product identity so staging and fresh projects receive shipped truth.
update public.cardforge_roadmap_items
set
  status = 'shipped',
  updated_at = timezone('utc', now())
where title = 'Account recovery and safety tooling'
  and source = 'official'
  and item_type = 'feature'
  and status <> 'shipped';
