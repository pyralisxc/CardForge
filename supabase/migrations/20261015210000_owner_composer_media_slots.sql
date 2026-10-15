-- Allow Owner-managed images tied to validated website content blocks.
-- The established site media table remains the sole image publication owner.
-- No new role grants, permissive RLS, provider secrets, or user-project media.
alter table public.cardforge_site_media
  drop constraint if exists cardforge_site_media_slot_check;

alter table public.cardforge_site_media
  add constraint cardforge_site_media_slot_check check (
    slot in (
      'brand.mark',
      'brand.favicon',
      'brand.watermark',
      'brand.social',
      'landing.hero',
      'landing.showcase.layout',
      'landing.showcase.generator-single',
      'landing.showcase.generator-bulk',
      'landing.showcase.desk',
      'landing.showcase.set',
      'landing.showcase.template',
      'landing.showcase.output',
      'landing.showcase.art.playing.ace',
      'landing.showcase.art.playing.king',
      'landing.showcase.art.playing.queen',
      'landing.showcase.art.playing.jack',
      'landing.showcase.art.creature.emberclaw',
      'landing.showcase.art.creature.mossback',
      'landing.showcase.art.creature.moonveil',
      'landing.showcase.art.creature.stormglass',
      'founder.portrait'
    )
    or slot ~ '^landing[.]composer[.]block-[a-z0-9-]{1,39}$'
  );
