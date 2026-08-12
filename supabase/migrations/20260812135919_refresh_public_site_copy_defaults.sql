-- Replace only untouched seed copy. Owner-authored rows are preserved verbatim.
update public.cardforge_site_content_blocks
set
  body = case slug
    when 'landing.hero.headline' then 'Design one card. Add your list. CardForge builds the set.'
    when 'landing.hero.body' then 'Make the look once, add the words and pictures for each card, and watch the whole set come together. Try it in your browser and keep your work on your device.'
    when 'landing.hero.support' then 'Build the card once. Let the set follow.'
    when 'about.hero.headline' then 'Give everyday creators room to make it their own.'
    when 'about.hero.body' then 'CardForge Studio turns a reusable design and structured content into a consistent set without taking the creative decisions away from you. It is built for people who want deep customization without rebuilding every item by hand.'
    else body
  end,
  updated_at = now()
where (slug, body) in (
  ('landing.hero.headline', 'Build cards faster. Generate complete sets. Shape the forge together.'),
  ('landing.hero.body', 'CardForge helps creators turn card ideas into full, export-ready sets while the community helps build the shared library that powers the studio.'),
  ('landing.hero.support', 'The fantasy forge is the doorway; underneath is a serious production workflow for reusable templates, structured data, bulk generation, and clean exports.'),
  ('about.hero.headline', 'A fantasy-forged studio for serious card production.'),
  ('about.hero.body', 'CardForge helps creators design reusable card systems, generate complete sets from structured data, and export clean files. The forge theme gives the product a memorable doorway; the deeper promise is a practical workbench for creators who need repeatable layouts, shared assets, and faster iteration.')
);
