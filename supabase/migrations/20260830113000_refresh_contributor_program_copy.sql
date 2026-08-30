-- Replace only untouched legacy seed copy. Owner-authored rows are preserved verbatim.
update public.cardforge_site_content_blocks
set
  body = case slug
    when 'developer.meta.title' then 'CardForge Contributor Program'
    when 'developer.hero.eyebrow' then 'Contributor Program'
    else body
  end,
  updated_at = now()
where (slug, body) in (
  ('developer.meta.title', 'CardForge Developer Program'),
  ('developer.hero.eyebrow', 'Developer Program')
);
