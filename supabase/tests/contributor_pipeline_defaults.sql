-- Run against a migrated staging database. All probe rows are rolled back.
-- Before the repair, the native submission fails its automated tier check.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
declare
  probe_key text := 'defaults-regression-' || pg_catalog.gen_random_uuid()::text;
  revision_id uuid;
  calculated_tier text;
  automated_tier text;
begin
  revision_id := public.cardforge_submit_template_revision(
    p_asset_id => probe_key,
    p_name => 'Default contract regression',
    p_description => 'Rolled back database regression',
    p_contributor_id => probe_key,
    p_contributor_email => null,
    p_template_payload => pg_catalog.jsonb_build_object('id', probe_key, 'name', 'Default contract regression', 'fieldContracts', '[]'::jsonb),
    p_expected_revision => 0,
    p_submission_key => probe_key
  );
  select calculated_access_tier, automated_access_tier into calculated_tier, automated_tier
  from public.cardforge_contributor_asset_submissions where id = revision_id;
  if calculated_tier is distinct from 'contributor' or automated_tier is distinct from 'contributor' then
    raise exception 'Native Template submission must use Contributor tiers';
  end if;
  -- The owner publisher must reuse the same idempotent revision and project it
  -- through the existing publication owner, without a second write workflow.
  if public.cardforge_publish_owner_template_revision(
    probe_key, 'Default contract regression', 'Rolled back database regression',
    probe_key, null,
    pg_catalog.jsonb_build_object('id', probe_key, 'name', 'Default contract regression', 'fieldContracts', '[]'::jsonb),
    0, probe_key
  ) is distinct from revision_id then
    raise exception 'Owner publication must reuse the submitted revision';
  end if;
  if not exists (
    select 1 from public.cardforge_asset_registry
    where asset_id = probe_key and contributor_submission_id = revision_id
      and status = 'published' and access_tier = 'free'
  ) then
    raise exception 'Owner publication must project the published free Template';
  end if;
end;
$$;

-- Exercise omitted values against the real column defaults and checks without
-- involving publication triggers, providers or managed storage objects.
create temporary table submission_defaults_probe
  (like public.cardforge_contributor_asset_submissions including defaults including constraints) on commit drop;
create temporary table template_asset_defaults_probe
  (like public.cardforge_pipeline_template_assets including defaults including constraints) on commit drop;
create temporary table registry_defaults_probe
  (like public.cardforge_asset_registry including defaults including constraints) on commit drop;

insert into submission_defaults_probe (contributor_id, asset_type, name, lineage_id)
values ('defaults-regression', 'icons', 'Omitted tier defaults', pg_catalog.gen_random_uuid());
insert into template_asset_defaults_probe (asset_id, storage_path, mime_type, byte_count)
values (repeat('a', 64), 'defaults-regression.webp', 'image/webp', 1);
insert into registry_defaults_probe (asset_id, name, asset_type, url)
values ('defaults-regression', 'Omitted registry tier', 'icon', 'https://example.invalid/defaults-regression.svg');

do $$
begin
  if exists (select 1 from submission_defaults_probe where calculated_access_tier <> 'contributor' or automated_access_tier <> 'contributor') then
    raise exception 'Omitted tier values must use Contributor defaults';
  end if;
  if exists (select 1 from template_asset_defaults_probe where storage_bucket <> 'cardforge-contributor-assets') then
    raise exception 'Omitted Template asset bucket must use the current binary owner';
  end if;
  if exists (select 1 from registry_defaults_probe where access_tier <> 'free' or library_source <> 'official') then
    raise exception 'Official registry authorship must default to the current free access tier';
  end if;
end;
$$;

rollback;
