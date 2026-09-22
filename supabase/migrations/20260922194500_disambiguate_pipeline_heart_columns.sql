begin;

-- RETURNS TABLE fields are PL/pgSQL variables. Prefer table columns inside
-- SQL statements so the lineage_id output name cannot collide with the heart
-- ledger's lineage_id insert column.
create or replace function public.cardforge_set_pipeline_heart(
  p_lineage_id uuid,
  p_account_id text,
  p_hearted boolean,
  p_viewer_access text,
  p_contributor boolean,
  p_owner boolean
)
returns table (
  lineage_id uuid,
  heart_count integer,
  viewer_hearted boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  lineage_registry_asset_id text;
  lineage_purge_state text;
  visible_to_viewer boolean := false;
  changed_count integer := 0;
begin
  if nullif(pg_catalog.btrim(p_account_id), '') is null
    or p_hearted is null
    or p_viewer_access not in ('free', 'paid', 'contributor')
    or p_contributor is null
    or p_owner is null
  then
    raise exception 'invalid_pipeline_reaction';
  end if;

  select lineage.registry_asset_id, lineage.purge_state
  into lineage_registry_asset_id, lineage_purge_state
  from public.cardforge_pipeline_asset_lineages as lineage
  where lineage.id = p_lineage_id
  for update;

  if not found then
    raise exception 'pipeline_lineage_not_found';
  end if;
  if lineage_purge_state = 'pending' then
    raise exception 'pipeline_reaction_not_permitted';
  end if;

  if p_hearted then
    with authorized as materialized (
      select true as allowed
      where exists (
        select 1
        from public.cardforge_asset_registry as registry
        where registry.asset_id = lineage_registry_asset_id
          and registry.status = 'published'
          and (
            registry.access_tier = 'free'
            or (p_viewer_access in ('paid', 'contributor') and registry.access_tier = 'paid')
            or (p_viewer_access = 'contributor' and registry.access_tier = 'contributor')
          )
      ) or (
        (p_contributor or p_owner)
        and exists (
          select 1
          from public.cardforge_contributor_asset_submissions as submission
          where submission.lineage_id = p_lineage_id
            and submission.purge_state is null
            and (
              p_owner
              or submission.contributor_id = p_account_id
              or submission.status not in ('draft', 'rejected')
            )
        )
      )
    ), changed as (
      insert into public.cardforge_pipeline_asset_hearts (lineage_id, account_id)
      select p_lineage_id, p_account_id from authorized
      on conflict (lineage_id, account_id) do update
      set updated_at = pg_catalog.now()
      returning 1
    )
    select
      exists (select 1 from authorized),
      (select count(*)::integer from changed)
    into visible_to_viewer, changed_count;
  else
    with authorized as materialized (
      select true as allowed
      where exists (
        select 1
        from public.cardforge_asset_registry as registry
        where registry.asset_id = lineage_registry_asset_id
          and registry.status = 'published'
          and (
            registry.access_tier = 'free'
            or (p_viewer_access in ('paid', 'contributor') and registry.access_tier = 'paid')
            or (p_viewer_access = 'contributor' and registry.access_tier = 'contributor')
          )
      ) or (
        (p_contributor or p_owner)
        and exists (
          select 1
          from public.cardforge_contributor_asset_submissions as submission
          where submission.lineage_id = p_lineage_id
            and submission.purge_state is null
            and (
              p_owner
              or submission.contributor_id = p_account_id
              or submission.status not in ('draft', 'rejected')
            )
        )
      )
    ), changed as (
      delete from public.cardforge_pipeline_asset_hearts as heart
      where heart.lineage_id = p_lineage_id
        and heart.account_id = p_account_id
        and exists (select 1 from authorized)
      returning 1
    )
    select
      exists (select 1 from authorized),
      (select count(*)::integer from changed)
    into visible_to_viewer, changed_count;
  end if;

  if not visible_to_viewer then
    raise exception 'pipeline_reaction_not_permitted';
  end if;

  return query
  select
    p_lineage_id,
    count(heart.account_id)::integer,
    coalesce(pg_catalog.bool_or(heart.account_id = p_account_id), false)
  from public.cardforge_pipeline_asset_hearts as heart
  where heart.lineage_id = p_lineage_id;
end;
$$;

revoke execute on function public.cardforge_set_pipeline_heart(uuid, text, boolean, text, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.cardforge_set_pipeline_heart(uuid, text, boolean, text, boolean, boolean)
  to service_role;

comment on function public.cardforge_set_pipeline_heart(uuid, text, boolean, text, boolean, boolean) is
  'Atomically authorizes and changes one signed-in account reaction using canonical Contributor access modes and unambiguous ledger columns.';

commit;
