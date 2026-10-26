-- Storage deletion is an irreversible cross-boundary commitment, not a lease.
-- No catalog mutation or automatic deletion is performed by this migration.
begin;
set local lock_timeout = '5s';

alter table public.cardforge_pipeline_asset_lineages
  add column catalog_destructive_uncertainty text;
-- Earlier workers could release their only token after Storage I/O. There is
-- no durable negative evidence for these lineages. Do not infer safety from an
-- empty claim column or elapsed lease. Reconciliation requires independent
-- Storage/worker evidence; this migration deliberately cannot clear this flag.
update public.cardforge_pipeline_asset_lineages
  set catalog_destructive_uncertainty = 'legacy_destructive_history_unverified';

alter table public.cardforge_pipeline_asset_lineages
  add constraint cardforge_catalog_trash_dates_check check (
    (catalog_trashed_at is null and catalog_purge_after is null and not catalog_retention_hold)
    or (catalog_trashed_at is not null and catalog_purge_after is not null
      and isfinite(catalog_trashed_at) and isfinite(catalog_purge_after) and catalog_purge_after>catalog_trashed_at)),
  add constraint cardforge_catalog_trash_commitment_check check (catalog_trashed_at is null or
    (purge_state is null and catalog_destructive_uncertainty is null and catalog_claim_token is null and catalog_claimed_at is null));

create function public.cardforge_guard_catalog_lineage_write()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='DELETE' then
    if old.catalog_trashed_at is not null then raise exception 'catalog_trash_state_changed'; end if;
    return old;
  end if;
  if old.catalog_trashed_at is not null and
    (new.purge_state is not null
      or new.registry_asset_id is distinct from old.registry_asset_id
      or new.revision_high_water is distinct from old.revision_high_water) then
    raise exception 'catalog_trash_state_changed';
  end if;
  if new.catalog_trashed_at is not null and (new.purge_state is not null or new.catalog_destructive_uncertainty is not null
    or new.catalog_claim_token is not null or new.catalog_claimed_at is not null) then
    raise exception 'catalog_trash_already_claimed';
  end if;
  if (new.catalog_trashed_at is null)<>(new.catalog_purge_after is null)
    or (new.catalog_trashed_at is not null and (not isfinite(new.catalog_trashed_at)
      or not isfinite(new.catalog_purge_after) or new.catalog_purge_after<=new.catalog_trashed_at)) then
    raise exception 'catalog_trash_state_changed';
  end if;
  if old.catalog_destructive_uncertainty is not null
    and new.catalog_destructive_uncertainty is distinct from old.catalog_destructive_uncertainty then
    raise exception 'catalog_trash_already_claimed';
  end if;
  if new.purge_state='pending' then
    new.catalog_destructive_uncertainty := coalesce(old.catalog_destructive_uncertainty,'lineage_purge_committed');
  end if;
  return new;
end $$;
create trigger cardforge_catalog_lineage_write_guard
before update or delete on public.cardforge_pipeline_asset_lineages
for each row execute function public.cardforge_guard_catalog_lineage_write();

-- The existing submission, registry and publication-event tables remain the
-- authority. These guards cover direct writers as well as the normal RPCs.
-- A row-first legacy writer uses NOWAIT rather than waiting in reverse lock
-- order. It must roll back if a lineage-first command owns the lineage.
create function public.cardforge_guard_catalog_member_write()
returns trigger language plpgsql security invoker set search_path='' as $$
declare lineage_id uuid; l public.cardforge_pipeline_asset_lineages%rowtype;
  prior jsonb; candidate jsonb; key text;
begin
  prior := case when tg_op='INSERT' then null else to_jsonb(old) end;
  candidate := case when tg_op='DELETE' then prior else to_jsonb(new) end;
  if tg_table_name='cardforge_asset_registry' then
    if tg_op='UPDATE' and prior->>'asset_id' is distinct from candidate->>'asset_id' then
      raise exception 'catalog_trash_identity_changed';
    end if;
    key := candidate->>'asset_id';
    select * into l from public.cardforge_pipeline_asset_lineages where registry_asset_id=key for update nowait;
  else
    lineage_id := (candidate->>'lineage_id')::uuid;
    select * into l from public.cardforge_pipeline_asset_lineages where id=lineage_id for update nowait;
  end if;
  if l.catalog_trashed_at is not null then raise exception 'catalog_trash_state_changed'; end if;
  if tg_op='UPDATE' and tg_table_name<>'cardforge_asset_registry'
    and prior->>'lineage_id' is distinct from candidate->>'lineage_id' then
    raise exception 'catalog_trash_identity_changed';
  end if;
  if tg_table_name='cardforge_contributor_asset_submissions' and tg_op<>'DELETE'
    and candidate->>'purge_state'='pending' then
    if l.id is null then raise exception 'catalog_trash_identity_changed'; end if;
    if prior->>'purge_state'='pending' and
      prior->>'purge_claim_token' is distinct from candidate->>'purge_claim_token' then
      raise exception 'catalog_trash_already_claimed';
    end if;
    update public.cardforge_pipeline_asset_lineages
      set catalog_destructive_uncertainty=coalesce(catalog_destructive_uncertainty,'revision_purge_committed') where id=l.id;
  end if;
  if tg_table_name='cardforge_contributor_asset_submissions' and tg_op='UPDATE'
    and prior->>'purge_state'='pending' and
    (candidate->>'purge_state' is distinct from 'pending'
      or candidate->>'purge_claim_token' is distinct from prior->>'purge_claim_token'
      or candidate->>'retention_hold' is distinct from prior->>'retention_hold'
      or candidate->>'trashed_at' is distinct from prior->>'trashed_at'
      or candidate->>'source_storage_path' is distinct from prior->>'source_storage_path'
      or candidate->>'source_storage_bucket' is distinct from prior->>'source_storage_bucket') then
    raise exception 'catalog_trash_already_claimed';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger zz_cardforge_catalog_member_guard
before insert or update or delete on public.cardforge_contributor_asset_submissions
for each row execute function public.cardforge_guard_catalog_member_write();
create trigger zz_cardforge_catalog_registry_guard
before insert or update or delete on public.cardforge_asset_registry
for each row execute function public.cardforge_guard_catalog_member_write();
create trigger zz_cardforge_catalog_publication_guard
before insert or update or delete on public.cardforge_pipeline_publication_events
for each row execute function public.cardforge_guard_catalog_member_write();

-- One lineage-first claim owner, used by timer, target and Owner entry points.
-- Never recycle a pending claim. A timeout cannot revoke an old Storage worker.
create function public.cardforge_claim_pipeline_revision_purge_locked(
  p_submission_id uuid,p_owner boolean default false,p_expected_name text default null,p_expected_storage_path text default null
) returns table(submission_id uuid,storage_bucket text,storage_path text,claim_token uuid)
language plpgsql security invoker set search_path='' as $$
declare l public.cardforge_pipeline_asset_lineages%rowtype; s public.cardforge_contributor_asset_submissions%rowtype;
begin
  select lineage.* into l from public.cardforge_pipeline_asset_lineages lineage
    where lineage.id=(select r.lineage_id from public.cardforge_contributor_asset_submissions r where r.id=p_submission_id)
    for update skip locked;
  if not found or l.catalog_trashed_at is not null or l.purge_state is not null then return; end if;
  select * into s from public.cardforge_contributor_asset_submissions where id=p_submission_id for update;
  if not found or s.lineage_id<>l.id or s.trashed_at is null or not isfinite(s.trashed_at) or s.published_at is not null or s.retention_hold
    or s.purge_state is not null or s.purge_claim_token is not null or s.purge_claimed_at is not null
    or s.owner_purge_requested_at is not null
    or ((s.source_storage_bucket is null)<>(s.source_storage_path is null))
    or exists(select 1 from public.cardforge_asset_registry r where r.contributor_submission_id=s.id)
    or exists(select 1 from public.cardforge_pipeline_publication_events e where e.published_submission_id=s.id) then return; end if;
  if p_owner then
    if s.status<>'archived' or s.name is distinct from p_expected_name
      or s.source_storage_path is distinct from p_expected_storage_path then return; end if;
  elsif s.purge_after is null or not isfinite(s.purge_after) or s.purge_after>now() then return;
  end if;
  return query update public.cardforge_contributor_asset_submissions r
    set purge_state='pending',purge_claimed_at=now(),purge_claim_token=gen_random_uuid(),
      owner_purge_requested_at=case when p_owner then now() else null end,updated_at=now()
    where r.id=s.id returning r.id,r.source_storage_bucket,r.source_storage_path,r.purge_claim_token;
end $$;

create or replace function public.cardforge_claim_pipeline_revision_purges(p_limit integer default 50)
returns table(submission_id uuid,storage_bucket text,storage_path text,claim_token uuid)
language plpgsql security invoker set search_path='' as $$
declare candidate uuid;
begin
  if p_limit is null or p_limit<1 or p_limit>250 then raise exception 'pipeline_retention_limit_invalid'; end if;
  for candidate in select s.id from public.cardforge_contributor_asset_submissions s
    where s.trashed_at is not null and s.purge_after<=now() and s.purge_state is null
      and s.published_at is null and not s.retention_hold
    order by s.lineage_id,s.id limit p_limit
  loop
    return query select * from public.cardforge_claim_pipeline_revision_purge_locked(candidate);
  end loop;
end $$;
create or replace function public.cardforge_claim_pipeline_revision_purge_target(p_submission_id uuid)
returns table(submission_id uuid,storage_bucket text,storage_path text,claim_token uuid)
language sql security invoker set search_path='' as $$
  select * from public.cardforge_claim_pipeline_revision_purge_locked(p_submission_id);
$$;
create or replace function public.cardforge_claim_pipeline_revision_purge_owner(
 p_submission_id uuid,p_expected_name text,p_expected_storage_path text
) returns table(submission_id uuid,storage_bucket text,storage_path text,claim_token uuid)
language sql security invoker set search_path='' as $$
  select * from public.cardforge_claim_pipeline_revision_purge_locked(p_submission_id,true,p_expected_name,p_expected_storage_path);
$$;
-- Compatibility for already-running workers: release no longer erases evidence
-- after an uncertain Storage operation. Reconciliation is explicit, not timed.
create or replace function public.cardforge_release_pipeline_revision_purge(p_submission_id uuid,p_claim_token uuid)
returns boolean language sql security invoker set search_path='' as $$ select false; $$;
revoke all on function public.cardforge_claim_pipeline_revision_purge_locked(uuid,boolean,text,text) from public,anon,authenticated;
grant execute on function public.cardforge_claim_pipeline_revision_purge_locked(uuid,boolean,text,text) to service_role;

create or replace function public.cardforge_finalize_pipeline_revision_purge(p_submission_id uuid,p_claim_token uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.cardforge_pipeline_asset_lineages l
 where l.id=(select s.lineage_id from public.cardforge_contributor_asset_submissions s where s.id=p_submission_id)
   and l.catalog_trashed_at is null for update;
 if not found then return false; end if;
 delete from public.cardforge_contributor_asset_submissions s
 where s.id=p_submission_id and s.purge_claim_token=p_claim_token and p_claim_token is not null
   and s.purge_state='pending' and s.trashed_at is not null
   and (s.purge_after<=now() or s.owner_purge_requested_at is not null)
   and s.published_at is null and s.retention_hold=false
   and not exists(select 1 from public.cardforge_asset_registry r where r.contributor_submission_id=s.id)
   and not exists(select 1 from public.cardforge_pipeline_publication_events e where e.published_submission_id=s.id);
 return found;
end $$;

commit;
