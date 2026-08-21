update public.cardforge_site_content_blocks
set
  body = 'CardForge for ChatGPT',
  updated_at = pg_catalog.now()
where slug = 'landing.access.eyebrow'
  and body = 'Choose your next step';

update public.cardforge_site_content_blocks
set
  body = 'Start in the full Studio. Bring ChatGPT into the workflow when it helps.',
  updated_at = pg_catalog.now()
where slug = 'landing.access.headline'
  and body in (
    'Start free. Upgrade when you need watermark-free downloads.',
    'The complete Studio at every level. More creative power when you want it.',
    'The complete Studio at every level, with more ChatGPT plugin power as you grow.'
  );

update public.cardforge_site_content_blocks
set
  body = 'CardForge for ChatGPT is open for development beta testing through ChatGPT Developer Mode. Availability depends on ChatGPT access while the integration completes review.',
  updated_at = pg_catalog.now()
where slug = 'landing.access.developer-note'
  and body = 'Developers can help improve shared CardForge tools and artwork through the Developer Program.';
