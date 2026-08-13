begin;

set local lock_timeout = '5s';

alter table public.cardforge_campaign_media
  add column if not exists pre_archive_review_state text
    check (pre_archive_review_state in ('private', 'needs_review', 'approved', 'public')),
  add column if not exists purge_state text
    check (purge_state in ('pending'));

comment on column public.cardforge_campaign_media.pre_archive_review_state
  is 'Review state restored when an owner reactivates archived campaign media.';
comment on column public.cardforge_campaign_media.purge_state
  is 'Recoverable handshake state while an owner permanently deletes campaign media, its relationships, derivatives, and storage objects.';

create or replace function public.cardforge_set_campaign_media_archived(
  p_media_id uuid,
  p_archived boolean,
  p_owner_id text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if nullif(pg_catalog.btrim(p_owner_id), '') is null then
    raise exception 'campaign_media_owner_required';
  end if;

  if p_archived then
    update public.cardforge_campaign_media
    set
      pre_archive_review_state = case
        when review_state = 'archived' then pre_archive_review_state
        else review_state
      end,
      review_state = 'archived',
      archived_at = coalesce(archived_at, pg_catalog.now()),
      reviewed_by = p_owner_id,
      reviewed_at = pg_catalog.now()
    where id = p_media_id
      and purge_state is null;
  else
    update public.cardforge_campaign_media
    set
      review_state = coalesce(pre_archive_review_state, 'needs_review'),
      pre_archive_review_state = null,
      archived_at = null,
      reviewed_by = p_owner_id,
      reviewed_at = pg_catalog.now()
    where id = p_media_id
      and review_state = 'archived'
      and purge_state is null;
  end if;

  if not found then
    raise exception 'campaign_media_not_found';
  end if;

  return true;
end;
$$;

revoke execute on function public.cardforge_set_campaign_media_archived(uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function public.cardforge_set_campaign_media_archived(uuid, boolean, text)
  to service_role;

create or replace function public.cardforge_prepare_campaign_media_purge(
  p_media_id uuid,
  p_expected_filename text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  media public.cardforge_campaign_media%rowtype;
  storage_objects jsonb;
begin
  select *
  into media
  from public.cardforge_campaign_media
  where id = p_media_id
  for update;

  if not found then
    raise exception 'campaign_media_not_found';
  end if;

  if nullif(pg_catalog.btrim(p_expected_filename), '') is null
    or pg_catalog.btrim(p_expected_filename) <> media.original_filename then
    raise exception 'campaign_media_purge_confirmation_mismatch';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(object_reference),
    '[]'::jsonb
  )
  into storage_objects
  from (
    select pg_catalog.jsonb_build_object(
      'storageBucket', media.original_storage_bucket,
      'storagePath', media.original_storage_path
    ) as object_reference
    union
    select pg_catalog.jsonb_build_object(
      'storageBucket', media.normalized_storage_bucket,
      'storagePath', media.normalized_storage_path
    )
    union
    select pg_catalog.jsonb_build_object(
      'storageBucket', derivative.storage_bucket,
      'storagePath', derivative.storage_path
    )
    from public.cardforge_campaign_media_derivatives as derivative
    where derivative.parent_media_id = media.id
  ) as objects;

  update public.cardforge_campaign_media
  set
    purge_state = 'pending',
    pre_archive_review_state = case
      when review_state = 'archived' then pre_archive_review_state
      else review_state
    end,
    review_state = 'archived',
    archived_at = coalesce(archived_at, pg_catalog.now())
  where id = media.id;

  return pg_catalog.jsonb_build_object('storageObjects', storage_objects);
end;
$$;

revoke execute on function public.cardforge_prepare_campaign_media_purge(uuid, text)
  from public, anon, authenticated;
grant execute on function public.cardforge_prepare_campaign_media_purge(uuid, text)
  to service_role;

create or replace function public.cardforge_finalize_campaign_media_purge(
  p_media_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.cardforge_social_campaign_media_attachments
  where media_id = p_media_id
    and exists (
      select 1
      from public.cardforge_campaign_media as media
      where media.id = p_media_id
        and media.purge_state = 'pending'
    );

  delete from public.cardforge_campaign_media_derivatives
  where parent_media_id = p_media_id
    and exists (
      select 1
      from public.cardforge_campaign_media as media
      where media.id = p_media_id
        and media.purge_state = 'pending'
    );

  delete from public.cardforge_campaign_media
  where id = p_media_id
    and purge_state = 'pending';

  if not found then
    raise exception 'campaign_media_purge_not_prepared';
  end if;

  return true;
end;
$$;

revoke execute on function public.cardforge_finalize_campaign_media_purge(uuid)
  from public, anon, authenticated;
grant execute on function public.cardforge_finalize_campaign_media_purge(uuid)
  to service_role;

commit;
