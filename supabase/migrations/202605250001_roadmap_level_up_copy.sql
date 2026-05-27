update public.cardforge_roadmap_items
set description = 'The account page brings demo access, roadmap votes, developer requests, and clearer next steps into one place for early users.',
  updated_at = now()
where source = 'official'
  and title = 'Founders beta feedback hub';

update public.cardforge_roadmap_items
set title = case
    when exists (
      select 1
      from public.cardforge_roadmap_items newer
      where newer.source = 'official'
        and newer.title = 'Reliable live data foundation'
    ) then title
    else 'Reliable live data foundation'
  end,
  description = 'Pays for the managed database baseline behind votes, demo seats, roadmap signals, profile records, backups, and safer recovery work.',
  updated_at = now()
where source = 'official'
  and title in ('Durable community data', 'Reliable live data foundation');

update public.cardforge_roadmap_items
set title = case
    when exists (
      select 1
      from public.cardforge_roadmap_items newer
      where newer.source = 'official'
        and newer.title = 'Production hosting headroom'
    ) then title
    else 'Production hosting headroom'
  end,
  description = 'Adds enough app and database capacity for public beta traffic, stronger monitoring, and a less fragile path from demo use to real projects.',
  updated_at = now()
where source = 'official'
  and title in ('Production hosting and database baseline', 'Production hosting headroom');

update public.cardforge_roadmap_items
set title = case
    when exists (
      select 1
      from public.cardforge_roadmap_items newer
      where newer.source = 'official'
        and newer.title = 'Cross-device project saves'
    ) then title
    else 'Cross-device project saves'
  end,
  description = 'Unlocks the first signed-in cloud save path so creators can recover work beyond one browser and move projects between machines.',
  updated_at = now()
where source = 'official'
  and title in ('Signed-in cloud save prototype', 'Cross-device project saves');

update public.cardforge_roadmap_items
set description = 'Adds user-facing recovery paths, safer account protection, and stronger project restore behavior for creators building larger collections.',
  updated_at = now()
where source = 'official'
  and title = 'Account recovery and safety tooling';

update public.cardforge_roadmap_items
set title = case
    when exists (
      select 1
      from public.cardforge_roadmap_items newer
      where newer.source = 'official'
        and newer.title = 'Polished shared template library'
    ) then title
    else 'Polished shared template library'
  end,
  description = 'Funds a searchable library of reviewed templates, proven defaults, preview quality, and launch-ready examples that new users can trust.',
  updated_at = now()
where source = 'official'
  and title in ('Public template library', 'Polished shared template library');

update public.cardforge_roadmap_items
set title = case
    when exists (
      select 1
      from public.cardforge_roadmap_items newer
      where newer.source = 'official'
        and newer.title = 'Developer asset pipeline at scale'
    ) then title
    else 'Developer asset pipeline at scale'
  end,
  description = 'Expands reviewed community submissions into a durable pipeline for frames, symbols, dividers, textures, templates, moderation, and recovery.',
  updated_at = now()
where source = 'official'
  and title in ('Moderated community asset submissions', 'Developer asset pipeline at scale');

update public.cardforge_roadmap_items
set description = 'Adds a capped assistant budget for card copy, rules wording, bulk cleanup, template-field writing, and safer review before generated text is exported.',
  updated_at = now()
where source = 'official'
  and title = 'AI text and rules assistant';
