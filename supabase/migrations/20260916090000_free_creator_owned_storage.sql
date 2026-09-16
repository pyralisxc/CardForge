begin;

insert into public.cardforge_site_content_blocks (slug, body, updated_at)
values
  ('plans.meta.description', 'Compare CardForge plans, creator-owned storage, finished-export access, current beta capacity targets, and subscription options.', now()),
  ('plans.hero.body', 'Start free with a local-first Desk and portable Sets in the locations you choose. Upgrade for clean finished exports and more CardForge-operated Studio capacity when your workflow needs it.', now())
on conflict (slug) do update
set body = excluded.body, updated_at = excluded.updated_at;

update public.cardforge_mcp_allowance_settings
set
  description = 'A real local-first studio: keep portable Sets on this device, in a local folder, or in your own Google Drive.',
  feature_summary = E'Local-first Desk and focused design tools\nPortable Sets and connected personal storage\n30 current beta ChatGPT actions target\n250 MB current beta private-workspace target',
  updated_at = now()
where plan_key = 'free';

update public.cardforge_mcp_allowance_settings
set
  description = 'For regular creators who want watermark-free finished exports and a longer private Studio work window.',
  feature_summary = E'Everything in Free\nWatermark-free finished exports\n300 current beta ChatGPT actions target\n2 GB current beta private-workspace target',
  updated_at = now()
where plan_key = 'creator';

update public.cardforge_mcp_allowance_settings
set
  description = 'For high-volume creators and approved contributors who want the highest current beta Studio capacity target.',
  feature_summary = E'Everything in Creator\n1,000 current beta ChatGPT actions target\n10 GB current beta private-workspace target\nContributor tools when approved',
  updated_at = now()
where plan_key = 'designer';

update public.cardforge_mcp_allowance_settings
set
  description = 'For teams that need a tailored CardForge Studio workflow, integration, capacity, and support.',
  feature_summary = E'Custom CardForge-operated Studio capacity\nTeam workflow consultation\nIntegration planning\nDirect business support',
  updated_at = now()
where plan_key = 'enterprise';

commit;
