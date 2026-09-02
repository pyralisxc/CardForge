begin;

insert into public.cardforge_site_content_blocks (slug, body, updated_at)
values
  ('shell.mobile.developer.heading', 'Meet the founder', now()),
  ('about.hero.secondary-action', 'Meet the founder', now()),
  ('about.contributors.headline', 'Growing with creators and contributors', now()),
  ('about.contributors.body', 'Public roadmap voting helps creators influence priorities. Qualified contributors can submit shared assets and prepare reviewable marketing drafts.', now()),
  ('about.contributors.ownership', 'All public changes remain owner-approved. Contributions follow the current Contributor Terms and do not create guaranteed payment, ownership of CardForge, or revenue-sharing rights.', now()),
  ('about.contributors.contributor-action', 'Contributor program', now()),
  ('roadmap.meta.description', 'Vote on CardForge feature priorities and follow planned service upgrades for the shared card-creation workspace.', now())
on conflict (slug) do update
set body = excluded.body, updated_at = excluded.updated_at;

update public.cardforge_mcp_allowance_settings
set
  description = 'Explore CardForge on your local-first Desk and try CardForge for ChatGPT.',
  feature_summary = E'Local-first Desk and focused design tools\nSets saved on this device\n30 ChatGPT actions each month\n250 MB private ChatGPT workspace',
  updated_at = now()
where plan_key = 'free';

update public.cardforge_mcp_allowance_settings
set
  description = 'For regular creators who want clean finished exports, portable project files, and more ChatGPT capacity.',
  feature_summary = E'Everything in Free\nWatermark-free finished exports\nPortable CardForge project files\n300 ChatGPT actions each month\n2 GB private ChatGPT workspace',
  updated_at = now()
where plan_key = 'creator';

commit;
