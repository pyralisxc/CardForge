-- Expand the curated catalog around eleven supported creation domains while
-- keeping the modeled production + staging footprint below the owner's
-- 500 MB asset allocation on the Supabase Free plan.

alter table public.cardforge_contributor_program_settings
  alter column tier_caps_by_type set default '{
    "templates": {"free": 55, "paid": 33},
    "elementPresets": {"free": 44, "paid": 22},
    "textures": {"free": 33, "paid": 16},
    "dividers": {"free": 44, "paid": 22},
    "icons": {"free": 55, "paid": 27},
    "imageAssets": {"free": 33, "paid": 16},
    "fonts": {"free": 22, "paid": 11},
    "sets": {"free": 11, "paid": 6}
  }'::jsonb;

-- Existing settings are owner-operated. Raise each lane to the new supported
-- floor without reducing a value the Owner has already chosen or discarding a
-- future lane added by a later environment-specific rollout.
update public.cardforge_contributor_program_settings
set
  tier_caps_by_type = tier_caps_by_type || jsonb_build_object(
    'templates', jsonb_build_object(
      'free', greatest(coalesce((tier_caps_by_type #>> '{templates,free}')::integer, 0), 55),
      'paid', greatest(coalesce((tier_caps_by_type #>> '{templates,paid}')::integer, 0), 33)
    ),
    'elementPresets', jsonb_build_object(
      'free', greatest(coalesce((tier_caps_by_type #>> '{elementPresets,free}')::integer, 0), 44),
      'paid', greatest(coalesce((tier_caps_by_type #>> '{elementPresets,paid}')::integer, 0), 22)
    ),
    'textures', jsonb_build_object(
      'free', greatest(coalesce((tier_caps_by_type #>> '{textures,free}')::integer, 0), 33),
      'paid', greatest(coalesce((tier_caps_by_type #>> '{textures,paid}')::integer, 0), 16)
    ),
    'dividers', jsonb_build_object(
      'free', greatest(coalesce((tier_caps_by_type #>> '{dividers,free}')::integer, 0), 44),
      'paid', greatest(coalesce((tier_caps_by_type #>> '{dividers,paid}')::integer, 0), 22)
    ),
    'icons', jsonb_build_object(
      'free', greatest(coalesce((tier_caps_by_type #>> '{icons,free}')::integer, 0), 55),
      'paid', greatest(coalesce((tier_caps_by_type #>> '{icons,paid}')::integer, 0), 27)
    ),
    'imageAssets', jsonb_build_object(
      'free', greatest(coalesce((tier_caps_by_type #>> '{imageAssets,free}')::integer, 0), 33),
      'paid', greatest(coalesce((tier_caps_by_type #>> '{imageAssets,paid}')::integer, 0), 16)
    ),
    'fonts', jsonb_build_object(
      'free', greatest(coalesce((tier_caps_by_type #>> '{fonts,free}')::integer, 0), 22),
      'paid', greatest(coalesce((tier_caps_by_type #>> '{fonts,paid}')::integer, 0), 11)
    ),
    'sets', jsonb_build_object(
      'free', greatest(coalesce((tier_caps_by_type #>> '{sets,free}')::integer, 0), 11),
      'paid', greatest(coalesce((tier_caps_by_type #>> '{sets,paid}')::integer, 0), 6)
    )
  ),
  updated_at = now()
where id = 'default';
