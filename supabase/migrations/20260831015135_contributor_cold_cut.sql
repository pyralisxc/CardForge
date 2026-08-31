begin;

-- A Contributor bucket is the one durable Pipeline binary owner. Existing bytes
-- are copied with the provider API before this migration; the guard prevents a
-- database cutover from pointing current rows at missing objects.
insert into storage.buckets (
  id,
  name,
  public,
  avif_autodetection,
  file_size_limit,
  allowed_mime_types
)
select
  'cardforge-contributor-assets',
  'cardforge-contributor-assets',
  public,
  avif_autodetection,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id = 'cardforge-developer-assets'
on conflict (id) do nothing;

do $$
begin
  if exists (
    select 1
    from storage.objects as source
    left join storage.objects as destination
      on destination.bucket_id = 'cardforge-contributor-assets'
      and destination.name = source.name
    where source.bucket_id = 'cardforge-developer-assets'
      and destination.id is null
  ) then
    raise exception 'contributor_storage_copy_required';
  end if;
end;
$$;

-- Snapshot current function and trigger definitions before renaming their
-- schema owners. This keeps the migration aligned with the final applied
-- schema without retaining aliases for the old contract.
create temporary table cardforge_contributor_function_cutover (
  old_oid oid primary key,
  schema_name text not null,
  old_name text not null,
  old_identity_arguments text not null,
  replacement_name text not null,
  replacement_identity_arguments text not null,
  replacement_definition text not null,
  temporary_name text not null
) on commit drop;

insert into cardforge_contributor_function_cutover (
  old_oid,
  schema_name,
  old_name,
  old_identity_arguments,
  replacement_name,
  replacement_identity_arguments,
  replacement_definition,
  temporary_name
)
select
  procedure.oid,
  namespace.nspname,
  procedure.proname,
  pg_get_function_identity_arguments(procedure.oid),
  replace(procedure.proname, 'developer', 'contributor'),
  replace(pg_get_function_identity_arguments(procedure.oid), 'developer', 'contributor'),
  replace(
    replace(pg_get_functiondef(procedure.oid), 'developer', 'contributor'),
    'Developer',
    'Contributor'
  ),
  format('_cardforge_cold_cut_%s', procedure.oid)
from pg_proc as procedure
join pg_namespace as namespace on namespace.oid = procedure.pronamespace
where namespace.nspname = 'public'
  and procedure.prokind = 'f'
  and pg_get_functiondef(procedure.oid) ilike '%developer%'
  and procedure.proname not in (
    'cardforge_freeze_archived_creator_pool_fields',
    'cardforge_prevent_retired_identity_recreation'
  );

create temporary table cardforge_contributor_trigger_cutover (
  relation_oid oid not null,
  old_name text not null,
  replacement_definition text not null
) on commit drop;

insert into cardforge_contributor_trigger_cutover (
  relation_oid,
  old_name,
  replacement_definition
)
select
  trigger.tgrelid,
  trigger.tgname,
  replace(
    replace(pg_get_triggerdef(trigger.oid, true), 'developer', 'contributor'),
    'Developer',
    'Contributor'
  )
from pg_trigger as trigger
join pg_class as relation on relation.oid = trigger.tgrelid
join pg_namespace as namespace on namespace.oid = relation.relnamespace
where not trigger.tgisinternal
  and namespace.nspname = 'public'
  and (
    relation.relname like 'cardforge_developer_%'
    or trigger.tgfoid in (select old_oid from cardforge_contributor_function_cutover)
  )
  and trigger.tgname not in (
    'cardforge_freeze_archived_creator_pool_profile',
    'cardforge_freeze_archived_creator_pool_settings',
    'cardforge_prevent_retired_identity_recreation'
  );

do $$
declare
  item record;
begin
  for item in
    select trigger.tgrelid, trigger.tgname
    from pg_trigger as trigger
    join pg_class as relation on relation.oid = trigger.tgrelid
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where not trigger.tgisinternal
      and namespace.nspname = 'public'
      and (
        relation.relname like 'cardforge_developer_%'
        or trigger.tgfoid in (select old_oid from cardforge_contributor_function_cutover)
        or trigger.tgname in (
          'cardforge_freeze_archived_creator_pool_profile',
          'cardforge_freeze_archived_creator_pool_settings',
          'cardforge_prevent_retired_identity_recreation'
        )
      )
  loop
    execute format('drop trigger %I on %s', item.tgname, item.tgrelid::regclass);
  end loop;
end;
$$;

do $$
declare
  item record;
begin
  for item in
    select * from cardforge_contributor_function_cutover order by old_oid
  loop
    execute format(
      'alter function %I.%I(%s) rename to %I',
      item.schema_name,
      item.old_name,
      item.old_identity_arguments,
      item.temporary_name
    );
  end loop;
end;
$$;

drop function if exists public.cardforge_freeze_archived_creator_pool_fields();
drop function if exists public.cardforge_prevent_retired_identity_recreation();

-- Remove checks that contain retired values before data and column cutover.
do $$
declare
  item record;
begin
  for item in
    select constraint_record.conrelid, constraint_record.conname
    from pg_constraint as constraint_record
    where constraint_record.contype = 'c'
      and (
        pg_get_constraintdef(constraint_record.oid) ilike '%developer%'
        or pg_get_constraintdef(constraint_record.oid) ilike '%profit_share%'
      )
  loop
    execute format(
      'alter table %s drop constraint %I',
      item.conrelid::regclass,
      item.conname
    );
  end loop;
end;
$$;

alter table public.cardforge_developer_profiles
  rename to cardforge_contributor_profiles;
alter table public.cardforge_developer_program_settings
  rename to cardforge_contributor_program_settings;
alter table public.cardforge_developer_asset_submissions
  rename to cardforge_contributor_asset_submissions;
alter table public.cardforge_developer_asset_votes
  rename to cardforge_contributor_asset_votes;

alter table public.cardforge_contributor_asset_submissions
  rename column developer_id to contributor_id;
alter table public.cardforge_contributor_asset_submissions
  rename column developer_email to contributor_email;
alter table public.cardforge_contributor_asset_votes
  rename column developer_id to contributor_id;
alter table public.cardforge_contributor_program_settings
  rename column max_active_developers to max_active_contributors;
alter table public.cardforge_asset_registry
  rename column developer_submission_id to contributor_submission_id;

alter table public.cardforge_contributor_profiles
  drop column eligible_for_profit_share;
alter table public.cardforge_contributor_program_settings
  drop column profit_share_pool_percent;

update public.cardforge_asset_registry
set
  access_tier = case when access_tier = 'developer' then 'contributor' else access_tier end,
  library_source = case when library_source = 'developer' then 'contributor' else library_source end,
  storage_bucket = case when storage_bucket = 'cardforge-developer-assets' then 'cardforge-contributor-assets' else storage_bucket end,
  url = replace(url, '/cardforge-developer-assets/', '/cardforge-contributor-assets/'),
  preview_url = replace(preview_url, '/cardforge-developer-assets/', '/cardforge-contributor-assets/');

update public.cardforge_contributor_asset_submissions
set
  automated_access_tier = case when automated_access_tier = 'developer' then 'contributor' else automated_access_tier end,
  calculated_access_tier = case when calculated_access_tier = 'developer' then 'contributor' else calculated_access_tier end,
  source_storage_bucket = case when source_storage_bucket = 'cardforge-developer-assets' then 'cardforge-contributor-assets' else source_storage_bucket end,
  source_url = replace(source_url, '/cardforge-developer-assets/', '/cardforge-contributor-assets/'),
  preview_url = replace(preview_url, '/cardforge-developer-assets/', '/cardforge-contributor-assets/');

update public.cardforge_pipeline_template_assets
set storage_bucket = 'cardforge-contributor-assets'
where storage_bucket = 'cardforge-developer-assets';

update public.cardforge_contact_requests
set kind = 'contributor'
where kind = 'developer';

update public.cardforge_social_campaigns
set creation_source = 'contributor'
where creation_source = 'developer';

delete from public.cardforge_legal_documents
where slug = 'creator-pool';

delete from public.cardforge_legal_documents as retired
where retired.slug = 'developer-terms'
  and exists (
    select 1 from public.cardforge_legal_documents as current
    where current.slug = 'contributor-terms'
  );
update public.cardforge_legal_documents
set slug = 'contributor-terms'
where slug = 'developer-terms';

delete from public.cardforge_site_content_blocks as retired
where (
    retired.slug like 'developer.%'
    or retired.slug = 'about.contributors.developer-action'
  )
  and exists (
    select 1
    from public.cardforge_site_content_blocks as current
    where current.slug = case
      when retired.slug like 'developer.%' then 'contributor.' || substring(retired.slug from 11)
      else 'about.contributors.contributor-action'
    end
  );
update public.cardforge_site_content_blocks
set
  slug = case
    when slug like 'developer.%' then 'contributor.' || substring(slug from 11)
    when slug = 'about.contributors.developer-action' then 'about.contributors.contributor-action'
    else slug
  end,
  body = replace(body, 'Developer Program', 'Contributor Program')
where slug like 'developer.%'
  or slug = 'about.contributors.developer-action';

delete from public.cardforge_site_content_proposals as retired
where (
    retired.slug like 'developer.%'
    or retired.slug = 'about.contributors.developer-action'
  )
  and exists (
    select 1
    from public.cardforge_site_content_proposals as current
    where current.slug = case
      when retired.slug like 'developer.%' then 'contributor.' || substring(retired.slug from 11)
      else 'about.contributors.contributor-action'
    end
  );
update public.cardforge_site_content_proposals
set
  slug = case
    when slug like 'developer.%' then 'contributor.' || substring(slug from 11)
    when slug = 'about.contributors.developer-action' then 'about.contributors.contributor-action'
    else slug
  end,
  base_body = replace(base_body, 'Developer Program', 'Contributor Program'),
  proposed_body = replace(proposed_body, 'Developer Program', 'Contributor Program')
where slug like 'developer.%'
  or slug = 'about.contributors.developer-action';

alter table public.cardforge_asset_registry
  add constraint cardforge_asset_registry_access_tier_check
  check (access_tier = any (array['hidden', 'free', 'paid', 'contributor']));
alter table public.cardforge_asset_registry
  add constraint cardforge_asset_registry_library_source_check
  check (library_source = any (array['official', 'contributor']));
alter table public.cardforge_contributor_asset_submissions
  add constraint cardforge_contributor_asset_submissions_automated_access_tier_check
  check (automated_access_tier = any (array['hidden', 'free', 'paid', 'contributor']));
alter table public.cardforge_contributor_asset_submissions
  add constraint cardforge_contributor_asset_submissions_calculated_access_tier_check
  check (calculated_access_tier = any (array['hidden', 'free', 'paid', 'contributor']));
alter table public.cardforge_contact_requests
  add constraint cardforge_contact_requests_kind_check
  check (kind = any (array['support', 'contributor', 'business']));
alter table public.cardforge_legal_documents
  add constraint cardforge_legal_documents_slug_check
  check (slug = any (array[
    'privacy',
    'terms',
    'creator-pass-terms',
    'supporter-terms',
    'refund',
    'contributor-terms',
    'contact',
    'accessibility'
  ]));
alter table public.cardforge_site_content_blocks
  add constraint cardforge_site_content_blocks_slug_check
  check (slug ~ '^(shell|landing|plans|account|about|founder|contributor|roadmap|sharing)\.[a-z0-9.-]+$');
alter table public.cardforge_site_content_proposals
  add constraint cardforge_site_content_proposals_slug_check
  check (slug ~ '^(shell|landing|plans|account|about|founder|contributor|roadmap|sharing)\.[a-z0-9.-]+$');
alter table public.cardforge_social_campaigns
  add constraint cardforge_social_campaigns_creation_source_check
  check (creation_source = any (array['human', 'contributor', 'ai-assisted']));

set local check_function_bodies = off;

do $$
declare
  item record;
begin
  for item in
    select * from cardforge_contributor_function_cutover order by old_oid
  loop
    execute item.replacement_definition;
    execute format(
      'revoke all on function %I.%I(%s) from public, anon, authenticated',
      item.schema_name,
      item.replacement_name,
      item.replacement_identity_arguments
    );
    execute format(
      'grant execute on function %I.%I(%s) to service_role',
      item.schema_name,
      item.replacement_name,
      item.replacement_identity_arguments
    );
  end loop;
end;
$$;

do $$
declare
  item record;
begin
  for item in
    select * from cardforge_contributor_trigger_cutover order by relation_oid, old_name
  loop
    execute item.replacement_definition;
  end loop;
end;
$$;

do $$
declare
  item record;
begin
  for item in
    select * from cardforge_contributor_function_cutover order by old_oid desc
  loop
    execute format(
      'drop function %I.%I(%s)',
      item.schema_name,
      item.temporary_name,
      item.old_identity_arguments
    );
  end loop;
end;
$$;

-- Constraints and indexes keep their object identity across table/column
-- renames, so rename the remaining catalog labels instead of recreating them.
do $$
declare
  item record;
begin
  for item in
    select constraint_record.conrelid, constraint_record.conname
    from pg_constraint as constraint_record
    join pg_namespace as namespace on namespace.oid = constraint_record.connamespace
    where namespace.nspname = 'public'
      and constraint_record.conname like '%developer%'
  loop
    execute format(
      'alter table %s rename constraint %I to %I',
      item.conrelid::regclass,
      item.conname,
      replace(item.conname, 'developer', 'contributor')
    );
  end loop;

  for item in
    select index_record.oid, index_record.relname
    from pg_class as index_record
    join pg_namespace as namespace on namespace.oid = index_record.relnamespace
    where namespace.nspname = 'public'
      and index_record.relkind = 'i'
      and index_record.relname like '%developer%'
  loop
    execute format(
      'alter index %s rename to %I',
      item.oid::regclass,
      replace(item.relname, 'developer', 'contributor')
    );
  end loop;
end;
$$;

comment on table public.cardforge_contributor_profiles is
  'Contributor profile ledger independent from provider identity rows.';
comment on table public.cardforge_contributor_asset_submissions is
  'Durable Contributor submission and publication history.';
comment on table public.cardforge_contributor_asset_votes is
  'Durable Contributor vote ledger for exact Pipeline revisions.';
comment on column public.cardforge_contributor_asset_votes.contributor_id is
  'Snapshot of the voting Contributor Clerk user id at vote time.';
comment on table public.cardforge_marketing_campaigns is
  'Campaign-level objective and measurement grouping for Contributor content packages.';

commit;
