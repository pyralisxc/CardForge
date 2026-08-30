begin;

create table if not exists public.cardforge_pipeline_asset_lineages (
  id uuid primary key default gen_random_uuid(),
  registry_asset_id text unique,
  purge_state text check (purge_state in ('pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cardforge_developer_asset_submissions
  add column if not exists lineage_id uuid;

insert into public.cardforge_pipeline_asset_lineages (registry_asset_id)
select registry.asset_id
from public.cardforge_asset_registry as registry
on conflict (registry_asset_id) do nothing;

update public.cardforge_developer_asset_submissions as submission
set lineage_id = lineage.id
from public.cardforge_pipeline_asset_lineages as lineage
where submission.lineage_id is null
  and lineage.registry_asset_id = coalesce(submission.target_registry_asset_id, submission.registry_asset_id);

insert into public.cardforge_pipeline_asset_lineages (id)
select distinct on (coalesce(submission.target_registry_asset_id, submission.registry_asset_id, submission.id::text))
  gen_random_uuid()
from public.cardforge_developer_asset_submissions as submission
where submission.lineage_id is null;

with unlinked as (
  select
    submission.id,
    coalesce(submission.target_registry_asset_id, submission.registry_asset_id, submission.id::text) as identity,
    dense_rank() over (order by coalesce(submission.target_registry_asset_id, submission.registry_asset_id, submission.id::text)) as identity_rank
  from public.cardforge_developer_asset_submissions as submission
  where submission.lineage_id is null
), available as (
  select
    lineage.id,
    row_number() over (order by lineage.created_at, lineage.id) as identity_rank
  from public.cardforge_pipeline_asset_lineages as lineage
  where lineage.registry_asset_id is null
    and not exists (
      select 1 from public.cardforge_developer_asset_submissions as linked where linked.lineage_id = lineage.id
    )
)
update public.cardforge_developer_asset_submissions as submission
set lineage_id = available.id
from unlinked
join available using (identity_rank)
where submission.id = unlinked.id;

alter table public.cardforge_developer_asset_submissions
  alter column lineage_id set not null,
  add constraint cardforge_developer_asset_submissions_lineage_fk
    foreign key (lineage_id) references public.cardforge_pipeline_asset_lineages(id) on delete restrict;

create index if not exists cardforge_developer_asset_submissions_lineage_idx
  on public.cardforge_developer_asset_submissions (lineage_id, revision_number desc nulls last, submitted_at desc);

create table if not exists public.cardforge_pipeline_asset_hearts (
  lineage_id uuid not null references public.cardforge_pipeline_asset_lineages(id) on delete cascade,
  account_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (lineage_id, account_id)
);

create index if not exists cardforge_pipeline_asset_hearts_account_idx
  on public.cardforge_pipeline_asset_hearts (account_id, created_at desc);

create or replace function public.cardforge_assign_pipeline_asset_lineage()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  matched_lineage_id uuid;
  matched_purge_state text;
begin
  if new.lineage_id is not null then
    insert into public.cardforge_pipeline_asset_lineages (id, registry_asset_id)
    values (new.lineage_id, coalesce(new.target_registry_asset_id, new.registry_asset_id))
    on conflict (id) do nothing;

    select lineage.purge_state
    into matched_purge_state
    from public.cardforge_pipeline_asset_lineages as lineage
    where lineage.id = new.lineage_id
    for update;

    if matched_purge_state = 'pending' then
      raise exception 'developer_asset_lineage_purge_pending';
    end if;
    return new;
  end if;

  select lineage.id, lineage.purge_state
  into matched_lineage_id, matched_purge_state
  from public.cardforge_pipeline_asset_lineages as lineage
  where lineage.registry_asset_id = coalesce(new.target_registry_asset_id, new.registry_asset_id)
  limit 1
  for update;

  if matched_lineage_id is null and new.target_registry_asset_id is not null then
    select submission.lineage_id, lineage.purge_state
    into matched_lineage_id, matched_purge_state
    from public.cardforge_developer_asset_submissions as submission
    join public.cardforge_pipeline_asset_lineages as lineage on lineage.id = submission.lineage_id
    where submission.registry_asset_id = new.target_registry_asset_id
       or submission.target_registry_asset_id = new.target_registry_asset_id
    order by submission.revision_number desc nulls last, submission.submitted_at desc
    limit 1
    for update of lineage;
  end if;

  if matched_purge_state = 'pending' then
    raise exception 'developer_asset_lineage_purge_pending';
  end if;

  if matched_lineage_id is null then
    insert into public.cardforge_pipeline_asset_lineages (registry_asset_id)
    values (coalesce(new.target_registry_asset_id, new.registry_asset_id))
    returning id into matched_lineage_id;
  end if;

  new.lineage_id := matched_lineage_id;
  return new;
end;
$$;

drop trigger if exists cardforge_developer_asset_submission_assign_lineage
  on public.cardforge_developer_asset_submissions;
create trigger cardforge_developer_asset_submission_assign_lineage
  before insert on public.cardforge_developer_asset_submissions
  for each row execute function public.cardforge_assign_pipeline_asset_lineage();

create or replace function public.cardforge_sync_pipeline_asset_lineage_registry()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.registry_asset_id is not null then
    update public.cardforge_pipeline_asset_lineages
    set registry_asset_id = new.registry_asset_id, updated_at = now()
    where id = new.lineage_id
      and registry_asset_id is distinct from new.registry_asset_id;
  end if;
  return new;
end;
$$;

drop trigger if exists cardforge_developer_asset_submission_sync_lineage_registry
  on public.cardforge_developer_asset_submissions;
create trigger cardforge_developer_asset_submission_sync_lineage_registry
  after insert or update of registry_asset_id on public.cardforge_developer_asset_submissions
  for each row execute function public.cardforge_sync_pipeline_asset_lineage_registry();

create or replace function public.cardforge_cleanup_pipeline_asset_lineage_after_submission_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.cardforge_pipeline_asset_lineages as lineage
  where lineage.id = old.lineage_id
    and not exists (
      select 1 from public.cardforge_developer_asset_submissions as submission where submission.lineage_id = lineage.id
    )
    and (
      lineage.registry_asset_id is null
      or not exists (
        select 1 from public.cardforge_asset_registry as registry where registry.asset_id = lineage.registry_asset_id
      )
    );
  return old;
end;
$$;

drop trigger if exists cardforge_developer_asset_submission_cleanup_lineage
  on public.cardforge_developer_asset_submissions;
create trigger cardforge_developer_asset_submission_cleanup_lineage
  after delete on public.cardforge_developer_asset_submissions
  for each row execute function public.cardforge_cleanup_pipeline_asset_lineage_after_submission_delete();

create or replace function public.cardforge_cleanup_pipeline_asset_lineage_after_registry_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.cardforge_pipeline_asset_lineages as lineage
  where lineage.registry_asset_id = old.asset_id
    and not exists (
      select 1 from public.cardforge_developer_asset_submissions as submission where submission.lineage_id = lineage.id
    );
  return old;
end;
$$;

drop trigger if exists cardforge_asset_registry_cleanup_pipeline_lineage
  on public.cardforge_asset_registry;
create trigger cardforge_asset_registry_cleanup_pipeline_lineage
  after delete on public.cardforge_asset_registry
  for each row execute function public.cardforge_cleanup_pipeline_asset_lineage_after_registry_delete();

drop trigger if exists cardforge_pipeline_asset_lineages_touch_updated_at
  on public.cardforge_pipeline_asset_lineages;
create trigger cardforge_pipeline_asset_lineages_touch_updated_at
  before update on public.cardforge_pipeline_asset_lineages
  for each row execute function public.cardforge_touch_updated_at();

drop trigger if exists cardforge_pipeline_asset_hearts_touch_updated_at
  on public.cardforge_pipeline_asset_hearts;
create trigger cardforge_pipeline_asset_hearts_touch_updated_at
  before update on public.cardforge_pipeline_asset_hearts
  for each row execute function public.cardforge_touch_updated_at();

create or replace function public.cardforge_reject_pending_pipeline_submission_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.purge_state = 'pending' then
    raise exception 'developer_asset_lineage_purge_pending';
  end if;
  return new;
end;
$$;

drop trigger if exists cardforge_developer_asset_submission_reject_pending_update
  on public.cardforge_developer_asset_submissions;
create trigger cardforge_developer_asset_submission_reject_pending_update
  before update on public.cardforge_developer_asset_submissions
  for each row execute function public.cardforge_reject_pending_pipeline_submission_update();

alter table public.cardforge_pipeline_asset_lineages enable row level security;
alter table public.cardforge_pipeline_asset_hearts enable row level security;

revoke all on table public.cardforge_pipeline_asset_lineages from public, anon, authenticated;
revoke all on table public.cardforge_pipeline_asset_hearts from public, anon, authenticated;
grant select, insert, update, delete on table public.cardforge_pipeline_asset_lineages to service_role;
grant select, insert, update, delete on table public.cardforge_pipeline_asset_hearts to service_role;

create or replace function public.cardforge_get_pipeline_heart_metrics(
  p_lineage_ids uuid[],
  p_account_id text default null
)
returns table (
  lineage_id uuid,
  heart_count integer,
  viewer_hearted boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    lineage.id,
    count(heart.account_id)::integer as heart_count,
    coalesce(bool_or(heart.account_id = p_account_id), false) as viewer_hearted
  from public.cardforge_pipeline_asset_lineages as lineage
  left join public.cardforge_pipeline_asset_hearts as heart
    on heart.lineage_id = lineage.id
  where lineage.id = any(coalesce(p_lineage_ids, array[]::uuid[]))
  group by lineage.id;
$$;

revoke execute on function public.cardforge_get_pipeline_heart_metrics(uuid[], text)
  from public, anon, authenticated;
grant execute on function public.cardforge_get_pipeline_heart_metrics(uuid[], text)
  to service_role;

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
declare
  lineage_registry_asset_id text;
  lineage_purge_state text;
  visible_to_viewer boolean := false;
  changed_count integer := 0;
begin
  if nullif(pg_catalog.btrim(p_account_id), '') is null
    or p_hearted is null
    or p_viewer_access not in ('free', 'paid', 'dev')
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
            or (p_viewer_access in ('paid', 'dev') and registry.access_tier = 'paid')
            or (p_viewer_access = 'dev' and registry.access_tier = 'developer')
          )
      ) or (
        (p_contributor or p_owner)
        and exists (
          select 1
          from public.cardforge_developer_asset_submissions as submission
          where submission.lineage_id = p_lineage_id
            and submission.purge_state is null
            and (
              p_owner
              or submission.developer_id = p_account_id
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
            or (p_viewer_access in ('paid', 'dev') and registry.access_tier = 'paid')
            or (p_viewer_access = 'dev' and registry.access_tier = 'developer')
          )
      ) or (
        (p_contributor or p_owner)
        and exists (
          select 1
          from public.cardforge_developer_asset_submissions as submission
          where submission.lineage_id = p_lineage_id
            and submission.purge_state is null
            and (
              p_owner
              or submission.developer_id = p_account_id
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

create or replace function public.cardforge_cast_developer_asset_vote(
  p_submission_id uuid,
  p_developer_id text,
  p_vote_value text,
  p_owner_developer_id text default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  vote_weight integer := 1;
  submission_status text;
  submission_developer_id text;
  allow_self_voting boolean;
begin
  if nullif(pg_catalog.btrim(p_developer_id), '') is null
    or p_vote_value not in ('positive', 'negative')
  then
    raise exception 'invalid_developer_asset_vote';
  end if;

  select settings.allow_contributor_self_voting, settings.owner_vote_weight
  into allow_self_voting, vote_weight
  from public.cardforge_developer_program_settings as settings
  where settings.id = 'default'
  for share;

  if not found then
    raise exception 'developer_program_settings_unavailable';
  end if;

  select status, developer_id
  into submission_status, submission_developer_id
  from public.cardforge_developer_asset_submissions
  where id = p_submission_id
    and purge_state is null
  for update;

  if not found then
    raise exception 'developer_asset_not_found';
  end if;

  if submission_status in ('draft', 'rejected')
    and submission_developer_id <> p_developer_id
    and p_owner_developer_id is null
  then
    raise exception 'developer_asset_vote_not_permitted';
  end if;

  if submission_developer_id = p_developer_id and not allow_self_voting then
    raise exception 'developer_asset_self_vote_not_permitted';
  end if;

  if p_owner_developer_id is null or p_developer_id <> p_owner_developer_id then
    vote_weight := 1;
  end if;

  insert into public.cardforge_developer_asset_votes (
    submission_id, developer_id, vote_value, vote_weight
  ) values (
    p_submission_id, p_developer_id, p_vote_value, vote_weight
  )
  on conflict (submission_id, developer_id) do update
  set vote_value = excluded.vote_value,
      vote_weight = excluded.vote_weight;

  if submission_status in ('submitted', 'voting', 'publish_candidate') then
    return public.cardforge_rebalance_developer_asset_pipeline(p_owner_developer_id);
  end if;

  update public.cardforge_developer_asset_submissions as submission
  set
    positive_votes = coalesce(votes.positive_votes, 0),
    negative_votes = coalesce(votes.negative_votes, 0)
  from (
    select
      coalesce(sum(vote_weight) filter (where vote_value = 'positive'), 0)::integer as positive_votes,
      coalesce(sum(vote_weight) filter (where vote_value = 'negative'), 0)::integer as negative_votes
    from public.cardforge_developer_asset_votes
    where submission_id = p_submission_id
  ) as votes
  where submission.id = p_submission_id;

  return 0;
end;
$$;

revoke execute on function public.cardforge_cast_developer_asset_vote(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.cardforge_cast_developer_asset_vote(uuid, text, text, text)
  to service_role;

create or replace function public.cardforge_prepare_developer_asset_purge(
  p_submission_id uuid,
  p_expected_name text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  submission public.cardforge_developer_asset_submissions%rowtype;
  lineage_uuid uuid;
  lineage_asset_id text;
  storage_objects jsonb;
begin
  select candidate.lineage_id
  into lineage_uuid
  from public.cardforge_developer_asset_submissions as candidate
  where candidate.id = p_submission_id;

  if not found then
    raise exception 'developer_asset_not_found';
  end if;

  select lineage.registry_asset_id
  into lineage_asset_id
  from public.cardforge_pipeline_asset_lineages as lineage
  where lineage.id = lineage_uuid
  for update;

  if not found then
    raise exception 'developer_asset_lineage_not_found';
  end if;

  select *
  into submission
  from public.cardforge_developer_asset_submissions
  where id = p_submission_id
    and lineage_id = lineage_uuid
  for update;

  if not found then
    raise exception 'developer_asset_not_found';
  end if;

  if nullif(pg_catalog.btrim(p_expected_name), '') is null
    or pg_catalog.btrim(p_expected_name) <> submission.name then
    raise exception 'developer_asset_purge_confirmation_mismatch';
  end if;

  update public.cardforge_pipeline_asset_lineages
  set purge_state = 'pending', updated_at = pg_catalog.now()
  where id = lineage_uuid;

  if lineage_asset_id is not null then
    insert into public.cardforge_pipeline_asset_tombstones (
      asset_id,
      asset_name,
      deleted_submission_id,
      deleted_at
    ) values (
      lineage_asset_id,
      submission.name,
      submission.id,
      pg_catalog.now()
    )
    on conflict (asset_id) do update
    set
      asset_name = excluded.asset_name,
      deleted_submission_id = excluded.deleted_submission_id,
      deleted_at = excluded.deleted_at;

    update public.cardforge_asset_registry
    set status = 'archived', access_tier = 'hidden'
    where asset_id = lineage_asset_id;
  end if;

  if exists (
    select 1
    from public.cardforge_developer_asset_submissions as lineage_submission
    where lineage_submission.lineage_id = lineage_uuid
      and ((lineage_submission.source_storage_bucket is null) <> (lineage_submission.source_storage_path is null))
  ) then
    raise exception 'developer_asset_storage_reference_incomplete';
  end if;

  select coalesce(pg_catalog.jsonb_agg(object_reference), '[]'::jsonb)
  into storage_objects
  from (
    select distinct pg_catalog.jsonb_build_object(
      'storageBucket', lineage_submission.source_storage_bucket,
      'storagePath', lineage_submission.source_storage_path
    ) as object_reference
    from public.cardforge_developer_asset_submissions as lineage_submission
    where lineage_submission.lineage_id = lineage_uuid
      and lineage_submission.source_storage_bucket is not null
      and lineage_submission.source_storage_path is not null
  ) as objects;

  update public.cardforge_developer_asset_submissions
  set purge_state = 'pending'
  where lineage_id = lineage_uuid
    and purge_state is null;

  return pg_catalog.jsonb_build_object(
    'lineageId', lineage_uuid,
    'registryAssetId', lineage_asset_id,
    'storageObjects', storage_objects
  );
end;
$$;

revoke execute on function public.cardforge_prepare_developer_asset_purge(uuid, text)
  from public, anon, authenticated;
grant execute on function public.cardforge_prepare_developer_asset_purge(uuid, text)
  to service_role;

create or replace function public.cardforge_finalize_developer_asset_purge(
  p_submission_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  submission public.cardforge_developer_asset_submissions%rowtype;
  lineage_uuid uuid;
  lineage_asset_id text;
  lineage_purge_state text;
begin
  select candidate.lineage_id
  into lineage_uuid
  from public.cardforge_developer_asset_submissions as candidate
  where candidate.id = p_submission_id
    and candidate.purge_state = 'pending';

  if not found then
    raise exception 'developer_asset_purge_not_prepared';
  end if;

  select lineage.registry_asset_id, lineage.purge_state
  into lineage_asset_id, lineage_purge_state
  from public.cardforge_pipeline_asset_lineages as lineage
  where lineage.id = lineage_uuid
  for update;

  if not found or lineage_purge_state is distinct from 'pending' then
    raise exception 'developer_asset_purge_not_prepared';
  end if;

  select *
  into submission
  from public.cardforge_developer_asset_submissions
  where id = p_submission_id
    and lineage_id = lineage_uuid
    and purge_state = 'pending'
  for update;

  if not found then
    raise exception 'developer_asset_purge_not_prepared';
  end if;

  if exists (
    select 1
    from public.cardforge_developer_asset_submissions as lineage_submission
    where lineage_submission.lineage_id = lineage_uuid
      and lineage_submission.purge_state is distinct from 'pending'
  ) then
    raise exception 'developer_asset_purge_not_prepared';
  end if;

  delete from public.cardforge_developer_asset_submissions
  where lineage_id = lineage_uuid
    and purge_state = 'pending';

  if not found then
    raise exception 'developer_asset_purge_not_prepared';
  end if;

  if lineage_asset_id is not null then
    delete from public.cardforge_asset_registry
    where asset_id = lineage_asset_id;
  end if;

  return true;
end;
$$;

revoke execute on function public.cardforge_finalize_developer_asset_purge(uuid)
  from public, anon, authenticated;
grant execute on function public.cardforge_finalize_developer_asset_purge(uuid)
  to service_role;

comment on table public.cardforge_pipeline_asset_lineages is
  'Stable identity for one Pipeline object across submission and publication revisions.';
comment on column public.cardforge_pipeline_asset_lineages.purge_state is
  'Lineage-wide deletion handshake. Pending prevents a revision from joining while managed objects are being removed.';
comment on table public.cardforge_pipeline_asset_hearts is
  'One signed-in account heart per Pipeline lineage; hearts never influence review or publication state.';
comment on function public.cardforge_get_pipeline_heart_metrics(uuid[], text) is
  'Returns aggregate heart counts and the requesting account reaction without exposing individual audience identities.';
comment on function public.cardforge_set_pipeline_heart(uuid, text, boolean, text, boolean, boolean) is
  'Atomically authorizes and changes one signed-in account reaction against the current locked Pipeline lineage state.';
comment on function public.cardforge_cast_developer_asset_vote(uuid, text, text, text) is
  'Records contributor revision votes on every visible lifecycle state; only active review states rebalance publication.';

commit;
