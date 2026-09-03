begin;

select pg_advisory_xact_lock(hashtext('cardforge_publish_current_contributor_and_legal_truth'));

do $migration$
declare
  current_document record;
  current_identity_version bigint;
  next_body text;
  current_contributor_terms constant text := $copy$CardForge Studio is a software product created and operated by Cameron Locke, an independent sole proprietor based in Oregon.

Your Contributor agreement is with Cameron Locke as the legal operator of CardForge Studio. Forge Review is the contribution path for CardForge. Contributors may submit Templates, icons, dividers, textures, frames, source files, element recipes, and other approved creative assets into the shared review Pipeline.

Only submit work you created, own, licensed, or have clear permission to contribute. Do not submit confidential work, client-restricted files, AI-generated material that violates its source license, infringing content, malware, deceptive files, or anything you would not want reviewed, archived, published, or used by other CardForge users.

Submitted assets move through the same platform Pipeline as starter assets: draft, submitted, voting, publish candidate, published, archived, or rejected. Contributor votes, owner rules, quality scores, access tiers, and platform caps can affect where an asset appears. Published assets may remain available after a Contributor leaves so existing users and Templates do not break.

Contributor records are durable platform history. Deleting or disabling an account should not delete prior votes, source-file references, registry records, published assets, or contribution attribution snapshots. Owners may archive, remove, or edit platform availability for safety, quality, legal, licensing, or operational reasons.

These Contributor Terms describe the current contribution model and do not create employment, partnership, guaranteed payment, or ownership of CardForge unless a separate written agreement says so.$copy$;
begin
  if to_regclass('public.cardforge_site_content_blocks') is null
    or to_regclass('public.cardforge_legal_documents') is null
    or to_regclass('public.cardforge_business_identity') is null then
    raise exception 'cardforge_current_public_truth_dependencies_required';
  end if;

  insert into public.cardforge_site_content_blocks (slug, body, updated_at)
  values (
    'contributor.hero.body',
    'Approved contributors add shared assets and prepare marketing drafts from secure, reviewable workflows. Every contribution keeps its source and review history, while the owner retains publication authority.',
    pg_catalog.now()
  )
  on conflict (slug) do update
  set body = excluded.body, updated_at = excluded.updated_at;

  if to_regclass('public.cardforge_roadmap_items') is not null then
    update public.cardforge_roadmap_items
    set
      title = pg_catalog.regexp_replace(title, '\mdeveloper\M', 'Contributor', 'gi'),
      description = pg_catalog.regexp_replace(
        replace(description, 'developer requests', 'Contributor access requests'),
        '\mdeveloper\M',
        'Contributor',
        'gi'
      ),
      updated_at = pg_catalog.now()
    where title ilike '%developer%'
      or description ilike '%developer%';
  end if;

  select identity_version
  into current_identity_version
  from public.cardforge_business_identity
  where id = 'cardforge';

  if current_identity_version is null then
    raise exception 'cardforge_business_identity_required';
  end if;

  select *
  into current_document
  from public.cardforge_legal_documents
  where slug = 'privacy'
  order by version desc
  limit 1
  for update;

  if current_document is null then
    raise exception 'cardforge_privacy_publication_required';
  end if;

  next_body := current_document.body;
  next_body := replace(next_body, 'developer profiles', 'Contributor profiles');
  next_body := replace(next_body, 'developer profile details', 'Contributor profile details');
  next_body := replace(next_body, 'developer submissions', 'Contributor submissions');
  next_body := replace(next_body, 'developer votes', 'Contributor votes');
  next_body := replace(next_body, 'Developer profiles', 'Contributor profiles');
  next_body := replace(next_body, 'Developer submissions', 'Contributor submissions');
  next_body := replace(next_body, 'Developer votes', 'Contributor votes');
  next_body := replace(next_body, 'owner/developer accounts', 'Contributor and owner accounts');
  next_body := replace(next_body, 'Owner Console', 'protected Profile utility');
  next_body := replace(next_body, 'browser-local Studio projects', 'browser-local CardForge projects');
  next_body := replace(next_body, 'submit developer assets', 'submit work to the Contributor Pipeline');
  next_body := replace(next_body, 'review pipeline', 'review Pipeline');

  if next_body ~* 'developer profile|developer submission|developer vote|owner/developer accounts|Owner Console|browser-local Studio projects' then
    raise exception 'cardforge_privacy_retired_vocabulary_remains';
  end if;

  if next_body is distinct from current_document.body then
    insert into public.cardforge_legal_documents (
      slug, version, title, body, effective_date, published_at, business_identity_version
    ) values (
      'privacy',
      current_document.version + 1,
      'Privacy Policy',
      next_body,
      date '2026-09-02',
      pg_catalog.now(),
      current_identity_version
    );
  end if;

  select *
  into current_document
  from public.cardforge_legal_documents
  where slug = 'terms'
  order by version desc
  limit 1
  for update;

  if current_document is null then
    raise exception 'cardforge_terms_publication_required';
  end if;

  next_body := current_document.body;
  next_body := replace(next_body, 'submit developer assets', 'submit work to the Contributor Pipeline');
  next_body := replace(next_body, 'developer assets', 'Contributor assets');
  next_body := replace(next_body, 'developer pipeline', 'Contributor Pipeline');
  next_body := replace(next_body, 'Developer rules', 'Contributor rules');
  next_body := replace(next_body, 'developer rules', 'Contributor rules');
  next_body := replace(next_body, 'shared library', 'shared Library');

  if next_body is distinct from current_document.body then
    insert into public.cardforge_legal_documents (
      slug, version, title, body, effective_date, published_at, business_identity_version
    ) values (
      'terms',
      current_document.version + 1,
      'Terms of Service',
      next_body,
      date '2026-09-02',
      pg_catalog.now(),
      current_identity_version
    );
  end if;

  select *
  into current_document
  from public.cardforge_legal_documents
  where slug = 'contributor-terms'
  order by version desc
  limit 1
  for update;

  if current_document is null
    or current_document.title is distinct from 'Contributor Terms'
    or current_document.body is distinct from current_contributor_terms then
    insert into public.cardforge_legal_documents (
      slug, version, title, body, effective_date, published_at, business_identity_version
    ) values (
      'contributor-terms',
      coalesce(current_document.version, 0) + 1,
      'Contributor Terms',
      current_contributor_terms,
      date '2026-09-02',
      pg_catalog.now(),
      current_identity_version
    );
  end if;
end
$migration$;

commit;
