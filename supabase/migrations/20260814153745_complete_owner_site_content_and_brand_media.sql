begin;

do $$
declare
  has_legacy_homepage_image boolean := false;
begin
  if to_regclass('public.cardforge_owner_settings') is null
    or to_regclass('public.cardforge_site_content_blocks') is null
    or to_regclass('public.cardforge_site_content_proposals') is null
    or to_regclass('public.cardforge_site_media') is null
    or to_regclass('public.cardforge_developer_program_settings') is null
    or to_regclass('public.cardforge_developer_profiles') is null
    or to_regprocedure('public.cardforge_update_developer_program_settings(jsonb,text)') is null then
    raise exception 'cardforge_owner_control_plane_required';
  end if;
  if exists (
    select 1
    from pg_catalog.pg_attribute
    where attrelid = 'public.cardforge_owner_settings'::pg_catalog.regclass
      and attname = 'homepage_share_image_url'
      and not attisdropped
  ) then
    execute $query$
      select exists (
        select 1
        from public.cardforge_owner_settings
        where id = 'cardforge'
          and nullif(pg_catalog.btrim(homepage_share_image_url), '') is not null
      )
    $query$ into has_legacy_homepage_image;
  end if;

  if has_legacy_homepage_image then
    raise exception 'homepage_share_image_url_must_be_migrated_to_brand_social_before_cleanup';
  end if;
end
$$;

alter table public.cardforge_owner_settings
  add column if not exists search_keywords jsonb not null default '[
    "card maker",
    "TCG card generator",
    "tabletop card creator",
    "printable card templates",
    "custom card set creator",
    "bulk card generator",
    "fantasy card template editor",
    "local-first card design studio"
  ]'::jsonb,
  add column if not exists watermark_preview_opacity integer not null default 24,
  add column if not exists watermark_share_opacity integer not null default 28,
  add column if not exists watermark_width_percent integer not null default 68;

alter table public.cardforge_owner_settings
  drop constraint if exists cardforge_owner_homepage_share_image_url_safe,
  drop constraint if exists cardforge_owner_search_keywords_array,
  drop constraint if exists cardforge_owner_watermark_preview_opacity_range,
  drop constraint if exists cardforge_owner_watermark_share_opacity_range,
  drop constraint if exists cardforge_owner_watermark_width_percent_range,
  drop column if exists homepage_share_image_url;

alter table public.cardforge_owner_settings
  add constraint cardforge_owner_search_keywords_array check (
    jsonb_typeof(search_keywords) = 'array'
    and jsonb_array_length(search_keywords) between 1 and 24
  ),
  add constraint cardforge_owner_watermark_preview_opacity_range check (watermark_preview_opacity between 5 and 80),
  add constraint cardforge_owner_watermark_share_opacity_range check (watermark_share_opacity between 5 and 80),
  add constraint cardforge_owner_watermark_width_percent_range check (watermark_width_percent between 20 and 90);

-- The Creator Pool is an archived legal record, not a live developer-program
-- control. Keep the legacy columns temporarily for migration-first compatibility
-- with the currently deployed bundle, but freeze them and remove them from the
-- active settings command.
update public.cardforge_developer_program_settings
set profit_share_pool_percent = 0
where profit_share_pool_percent <> 0;

update public.cardforge_developer_profiles
set eligible_for_profit_share = false
where eligible_for_profit_share;

alter table public.cardforge_developer_program_settings
  alter column profit_share_pool_percent set default 0;

alter table public.cardforge_developer_profiles
  alter column eligible_for_profit_share set default false;

create or replace function public.cardforge_freeze_archived_creator_pool_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_table_name = 'cardforge_developer_program_settings' then
    new.profit_share_pool_percent := 0;
  elsif tg_table_name = 'cardforge_developer_profiles' then
    new.eligible_for_profit_share := false;
  end if;
  return new;
end;
$$;

revoke execute on function public.cardforge_freeze_archived_creator_pool_fields()
  from public, anon, authenticated;
grant execute on function public.cardforge_freeze_archived_creator_pool_fields()
  to service_role;

drop trigger if exists cardforge_freeze_archived_creator_pool_settings
  on public.cardforge_developer_program_settings;
create trigger cardforge_freeze_archived_creator_pool_settings
before insert or update on public.cardforge_developer_program_settings
for each row execute function public.cardforge_freeze_archived_creator_pool_fields();

drop trigger if exists cardforge_freeze_archived_creator_pool_profile
  on public.cardforge_developer_profiles;
create trigger cardforge_freeze_archived_creator_pool_profile
before insert or update on public.cardforge_developer_profiles
for each row execute function public.cardforge_freeze_archived_creator_pool_fields();

create or replace function public.cardforge_update_developer_program_settings(
  p_settings jsonb,
  p_owner_developer_id text default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_settings is null or pg_catalog.jsonb_typeof(p_settings) <> 'object' then
    raise exception 'invalid_developer_program_settings';
  end if;

  update public.cardforge_developer_program_settings
  set
    max_active_developers = (p_settings ->> 'maxActiveDevelopers')::integer,
    monthly_submission_limit = (p_settings ->> 'monthlySubmissionLimit')::integer,
    monthly_published_requirement = (p_settings ->> 'monthlyPublishedRequirement')::integer,
    minimum_votes_for_grading = (p_settings ->> 'minimumVotesForGrading')::integer,
    minimum_positive_vote_percent = (p_settings ->> 'freeAssetMinimumPositiveVotePercent')::integer,
    free_asset_minimum_positive_vote_percent = (p_settings ->> 'freeAssetMinimumPositiveVotePercent')::integer,
    paid_asset_minimum_positive_vote_percent = (p_settings ->> 'paidAssetMinimumPositiveVotePercent')::integer,
    minimum_votes_for_tier_assignment = (p_settings ->> 'minimumVotesForGrading')::integer,
    allow_contributor_self_voting = (p_settings ->> 'allowContributorSelfVoting')::boolean,
    owner_vote_weight = (p_settings ->> 'ownerVoteWeight')::integer,
    owner_final_review_required = false,
    publish_caps_by_type = p_settings -> 'publishCapsByType',
    tier_caps_by_type = p_settings -> 'tierCapsByType'
  where id = 'default';

  if not found then
    raise exception 'developer_program_settings_not_found';
  end if;

  return public.cardforge_rebalance_developer_asset_pipeline(p_owner_developer_id);
end;
$$;

comment on column public.cardforge_developer_program_settings.profit_share_pool_percent is
  'Archived compatibility column. The application no longer exposes or updates a Creator Pool setting.';
comment on column public.cardforge_developer_profiles.eligible_for_profit_share is
  'Archived compatibility column. CardForge does not currently operate a developer payout program; legacy writes are forced false.';

alter table public.cardforge_site_media
  drop constraint if exists cardforge_site_media_slot_check;

alter table public.cardforge_site_media
  add constraint cardforge_site_media_slot_check check (slot in (
    'brand.mark',
    'brand.favicon',
    'brand.watermark',
    'brand.social',
    'landing.hero',
    'landing.showcase.layout',
    'landing.showcase.generator-single',
    'landing.showcase.generator-bulk',
    'landing.showcase.art.playing.ace',
    'landing.showcase.art.playing.king',
    'landing.showcase.art.playing.queen',
    'landing.showcase.art.playing.jack',
    'landing.showcase.art.creature.emberclaw',
    'landing.showcase.art.creature.mossback',
    'landing.showcase.art.creature.moonveil',
    'landing.showcase.art.creature.stormglass',
    'founder.portrait'
  ));

alter table public.cardforge_site_content_blocks
  drop constraint if exists cardforge_site_content_blocks_slug_check;

alter table public.cardforge_site_content_blocks
  add constraint cardforge_site_content_blocks_slug_check check (
    slug ~ '^(shell|landing|about|founder|developer|roadmap|sharing)\.[a-z0-9.-]+$'
  );

alter table public.cardforge_site_content_proposals
  drop constraint if exists cardforge_site_content_proposals_slug_check;

alter table public.cardforge_site_content_proposals
  add constraint cardforge_site_content_proposals_slug_check check (
    slug ~ '^(shell|landing|about|founder|developer|roadmap|sharing)\.[a-z0-9.-]+$'
  );

insert into public.cardforge_site_content_blocks (slug, body, updated_at)
values
    ('shell.mobile.description', 'Explore CardForge Studio and its public resources.', now()),
    ('shell.mobile.developer.heading', 'Meet the developer', now()),
    ('shell.mobile.developer.body', 'Meet Cameron Locke, the independent developer building CardForge Studio.', now()),
    ('shell.footer.independent', 'CardForge Studio is an independent product built with care.', now()),
    ('landing.hero.headline', 'Design one card. Add your list. CardForge builds the set.', now()),
    ('landing.hero.body', 'Make the look once, add the words and pictures for each card, and watch the whole set come together. Try it in your browser and keep your work on your device.', now()),
    ('landing.hero.support', 'Build the card once. Let the set follow.', now()),
    ('landing.hero.secondary-action', 'See what it makes', now()),
    ('landing.showcase.eyebrow', 'Look inside CardForge', now()),
    ('landing.showcase.headline', 'Design the look, build the set, and see every finished card.', now()),
    ('landing.showcase.body', 'This walkthrough uses CardForge''s real templates, sample rows, and card renderer. Choose any step or set inside the Studio frame.', now()),
    ('landing.workflow.eyebrow', 'How it works', now()),
    ('landing.workflow.headline', 'From one good-looking card to the whole set.', now()),
    ('landing.workflow.step1.title', 'Make the look once', now()),
    ('landing.workflow.step1.body', 'Set up the front, back, words, and pictures for the kind of card you want.', now()),
    ('landing.workflow.step2.title', 'Add your card list', now()),
    ('landing.workflow.step2.body', 'Type the details or bring in a list you already have. Each line becomes a card.', now()),
    ('landing.workflow.step3.title', 'Build the whole set', now()),
    ('landing.workflow.step3.body', 'CardForge places every title, picture, and detail into the same design.', now()),
    ('landing.workflow.step4.title', 'Check and download', now()),
    ('landing.workflow.step4.body', 'Look through every card, fix anything odd, and save the finished files.', now()),
    ('landing.access.eyebrow', 'Choose your next step', now()),
    ('landing.access.headline', 'Start free. Upgrade when you need watermark-free downloads.', now()),
    ('landing.access.developer-note', 'Developers can help improve shared CardForge tools and artwork through the Developer Program.', now()),
    ('landing.founder.eyebrow', 'A real person is building this', now()),
    ('landing.founder.headline', 'Built independently by Cameron Locke', now()),
    ('landing.founder.body', 'I''m building CardForge in Oregon with a lot of curiosity, modern tools, and the belief that making a whole deck should feel just as creative as making the first card.', now()),
    ('landing.founder.action', 'Come say hello', now()),
    ('landing.final.headline', 'Build your first set.', now()),
    ('landing.final.body', 'Open the Studio, choose a starting point, and make something that feels like yours.', now()),
    ('about.hero.eyebrow', 'About CardForge Studio', now()),
    ('about.meta.title', 'About CardForge', now()),
    ('about.meta.description', 'See how CardForge Studio helps creators build customized card sets and how contributors support its shared library, marketing, and public-site improvements.', now()),
    ('about.hero.headline', 'Give everyday creators room to make it their own.', now()),
    ('about.hero.body', 'CardForge Studio turns a reusable design and structured content into a consistent set without taking the creative decisions away from you. It is built for people who want deep customization without rebuilding every item by hand.', now()),
    ('about.hero.secondary-action', 'Meet the developer', now()),
    ('about.principles.headline', 'Customization without repetitive work', now()),
    ('about.principles.body', 'The goal is a practical middle ground: enough structure to keep a large set coherent, and enough control for the finished work to belong unmistakably to its creator.', now()),
    ('about.principle1.title', 'Design the system once', now()),
    ('about.principle1.body', 'Build a reusable layout, then carry the visual rules across every item in the set.', now()),
    ('about.principle2.title', 'Your work stays with you', now()),
    ('about.principle2.body', 'Your projects and artwork stay in your browser or downloaded files unless you choose to share them.', now()),
    ('about.principle3.title', 'Tune every detail', now()),
    ('about.principle3.body', 'Mix shared structure with card-specific text, art, colors, and positioning so the result still feels personal.', now()),
    ('about.principle4.title', 'Review the whole run', now()),
    ('about.principle4.body', 'Inspect the complete set together, catch inconsistencies, then export images, a PDF, or a ZIP when it is ready.', now()),
    ('about.direction.headline', 'Cards are the starting point', now()),
    ('about.direction.body', 'Card sets are the product today. The wider ambition is a creation system that can serve many kinds of repeatable, printable design work while keeping the same data-driven workflow.', now()),
    ('about.direction.current.label', 'Available now', now()),
    ('about.direction.current.title', 'Complete custom card sets', now()),
    ('about.direction.current.body', 'Reusable card layouts, structured data, whole-set review, browser-based project control, and downloadable production files.', now()),
    ('about.direction.future.label', 'Long-term direction', now()),
    ('about.direction.future.title', 'More kinds of printable creation', now()),
    ('about.direction.future.body', 'Our future printable formats may include game aids, reference sheets, labels, badges, tokens, and other reusable layouts. These formats are a direction, not currently available features.', now()),
    ('about.contributors.headline', 'Growing with creators and developers', now()),
    ('about.contributors.body', 'Public roadmap voting helps creators influence priorities. Qualified contributors can submit shared assets, marketing drafts, and site-copy proposals.', now()),
    ('about.contributors.ownership', 'All public changes remain owner-approved. Contributions follow the current Developer Terms and do not create guaranteed payment, ownership of CardForge, or revenue-sharing rights.', now()),
    ('about.contributors.developer-action', 'Developer program', now()),
    ('about.contributors.roadmap-action', 'Public roadmap', now()),
    ('about.contributors.founder-action', 'About Cameron', now()),
    ('about.beta.headline', 'An honest public beta', now()),
    ('about.beta.body', 'CardForge Studio is independently built and actively improving. The public roadmap separates what works now from what is still planned.', now()),
    ('about.beta.showcase-action', 'See CardForge in action', now()),
    ('about.beta.roadmap-action', 'View roadmap', now()),
    ('founder.meta.title', 'Cameron Locke — Founder of CardForge Studio', now()),
    ('founder.meta.description', 'Meet Cameron Locke, the Oregon sole proprietor building CardForge Studio, and support his independent work.', now()),
    ('founder.hero.road-action', 'See what I''m building', now()),
    ('founder.hero.contact-action', 'Contact me', now()),
    ('founder.hero.support-action', 'Support the work', now()),
    ('founder.current.priorities-heading', 'What I''m focused on now', now()),
    ('founder.support.eyebrow', 'Support the journey', now()),
    ('founder.creator-pass.heading', 'Want CardForge too?', now()),
    ('founder.creator-pass.body', 'Creator Pass is the best way to support CardForge as a business. It is a product subscription that includes CardForge access and gives the business dependable support to keep growing.', now()),
    ('founder.creator-pass.action', 'See Creator Pass', now()),
    ('founder.support-uses.heading', 'What personal support can help with', now()),
    ('founder.support-uses.body', 'In plain terms: food, housing, transportation, development time, and the business expenses behind the work.', now()),
    ('founder.support-use1.title', 'Food and daily life', now()),
    ('founder.support-use1.body', 'The ordinary things that make it possible to sit down and keep building.', now()),
    ('founder.support-use2.title', 'Housing and stability', now()),
    ('founder.support-use2.body', 'A steady place to live, work, rest, and keep moving forward.', now()),
    ('founder.support-use3.title', 'Transportation', now()),
    ('founder.support-use3.body', 'Getting where I need to go while I build a more stable independent life.', now()),
    ('founder.support-use4.title', 'Business expenses', now()),
    ('founder.support-use4.body', 'Hosting, software, testing, design resources, and the services that keep CardForge running.', now()),
    ('developer.meta.title', 'CardForge Developer Program', now()),
    ('developer.meta.description', 'Learn how approved CardForge contributors submit shared assets, prepare campaign drafts, and propose public-site improvements.', now()),
    ('developer.hero.eyebrow', 'Developer Program', now()),
    ('developer.hero.headline', 'Help improve CardForge with reviewable contributions.', now()),
    ('developer.hero.body', 'Approved contributors add shared assets, prepare marketing drafts, and propose clearer public-site text from one secure workspace. Every contribution keeps its source and review history, and the owner approves all public changes.', now()),
    ('developer.lane.assets.title', 'Shared library assets', now()),
    ('developer.lane.assets.body', 'Submit templates, overlays, icons, textures, fonts, and reusable design presets for owner review.', now()),
    ('developer.lane.campaigns.title', 'Campaign packages', now()),
    ('developer.lane.campaigns.body', 'Combine post copy, media, rights details, and release context into reusable marketing drafts.', now()),
    ('developer.lane.site.title', 'Site improvements', now()),
    ('developer.lane.site.body', 'Propose clearer public-site copy against the current live text, with rationale and owner review.', now()),
    ('developer.rules.heading', 'Contribution rules', now()),
    ('roadmap.meta.title', 'CardForge Roadmap', now()),
    ('roadmap.meta.description', 'Vote on CardForge feature priorities and follow planned service upgrades for the shared card-system studio.', now()),
    ('roadmap.hero.eyebrow', 'Product roadmap', now()),
    ('roadmap.hero.headline', 'Vote for the CardForge tools you want next.', now()),
    ('roadmap.hero.body', 'Add compact ideas, vote on what matters, and follow the next milestones without digging through your account page. Suggestions and votes are shared public beta signals, not private project notes.', now()),
    ('sharing.message', 'Check out CardForge Studio—a friendly way to design one card and build the whole set.', now())
on conflict (slug) do nothing;

update storage.buckets
set allowed_mime_types = array['image/webp', 'image/png']
where id = 'cardforge-public-media';

comment on column public.cardforge_owner_settings.search_keywords is
  'Owner-authored search phrases. Code owns validation and metadata rendering.';
comment on column public.cardforge_owner_settings.watermark_preview_opacity is
  'Owner presentation value; entitlement code remains the owner of when a visible preview watermark is required.';
comment on table public.cardforge_site_media is
  'Canonical owner-controlled public brand and marketing media. User project media and campaign media remain separate owners.';

commit;
