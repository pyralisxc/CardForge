begin;

insert into public.cardforge_site_content_blocks (slug, body, updated_at)
values
  ('shell.mobile.description', 'Explore CardForge, open your Desk, and browse public resources.', now()),
  ('shell.mobile.developer.body', 'Meet Cameron Locke, the independent developer building CardForge.', now()),
  ('shell.footer.independent', 'CardForge is an independent product built with care.', now()),
  ('landing.showcase.body', 'This walkthrough uses CardForge''s real Templates, sample rows, and card renderer. See how a Set moves from design through generation and review on the Desk.', now()),
  ('landing.access.headline', 'Start with your work on the Desk. Bring ChatGPT into the workflow when it helps.', now()),
  ('landing.final.body', 'Open your Desk, choose a Set or starting point, and make something that feels like yours.', now()),
  ('plans.meta.description', 'Compare CardForge plans, finished-export access, portable project files, ChatGPT capacity, and subscription options.', now()),
  ('plans.hero.body', 'Start free on your local-first Desk, then add clean finished exports, portable project files, and more CardForge for ChatGPT capacity when your workflow needs them.', now()),
  ('about.hero.eyebrow', 'About CardForge', now()),
  ('about.meta.description', 'See how CardForge helps creators build customized card Sets and how contributors support its shared Library.', now()),
  ('about.hero.body', 'CardForge turns a reusable design and structured content into a consistent Set without taking the creative decisions away from you. Your work stays central on a local-first Desk instead of being scattered across separate apps.', now()),
  ('about.beta.body', 'CardForge is independently built and actively improving. The public roadmap separates what works now from what is still planned.', now()),
  ('sharing.message', 'Check out CardForge—a local-first way to design one card and build the whole Set from your Desk.', now())
on conflict (slug) do update
set body = excluded.body, updated_at = excluded.updated_at;

update public.cardforge_owner_settings
set
  primary_cta_label = 'Open your Desk',
  primary_cta_href = '/account',
  search_keywords = '["card maker", "TCG card generator", "tabletop card creator", "printable card templates", "custom card set creator", "bulk card generator", "fantasy card template editor", "local-first card design desk"]'::jsonb,
  updated_at = now()
where id = 'cardforge';

commit;
