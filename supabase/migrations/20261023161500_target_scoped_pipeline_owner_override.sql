begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
CREATE OR REPLACE FUNCTION public.cardforge_set_contributor_asset_owner_override(p_submission_id uuid, p_update_status_override boolean, p_status_override text, p_update_tier_override boolean, p_tier_override text, p_owner_note text, p_owner_contributor_id text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  changed_count integer;
begin
  if p_update_status_override
    and p_status_override is not null
    and p_status_override not in ('voting', 'publish_candidate', 'published', 'archived', 'rejected')
  then
    raise exception 'invalid_owner_status_override';
  end if;
  if p_update_tier_override
    and p_tier_override is not null
    and p_tier_override not in ('hidden', 'free', 'paid')
  then
    raise exception 'invalid_owner_tier_override';
  end if;
  if p_update_status_override
    and p_status_override = 'published'
    and (
      nullif(pg_catalog.btrim(coalesce(p_owner_note, '')), '') is null
      or nullif(pg_catalog.btrim(coalesce(p_owner_contributor_id, '')), '') is null
    )
  then
    raise exception 'editorial_review_reason_required';
  end if;

  update public.cardforge_contributor_asset_submissions
  set
    owner_status_override = case when p_update_status_override then p_status_override else owner_status_override end,
    owner_access_tier_override = case when p_update_tier_override then p_tier_override else owner_access_tier_override end,
    owner_note = coalesce(p_owner_note, ''),
    editorial_review_status = case
      when p_update_status_override and p_status_override = 'published' and media_presentation is null and template_review_context is null then 'approved'
      else editorial_review_status
    end,
    editorial_review_note = case
      when p_update_status_override and p_status_override = 'published' and media_presentation is null and template_review_context is null then pg_catalog.btrim(p_owner_note)
      else editorial_review_note
    end,
    editorial_reviewed_by = case
      when p_update_status_override and p_status_override = 'published' and media_presentation is null and template_review_context is null then pg_catalog.btrim(p_owner_contributor_id)
      else editorial_reviewed_by
    end,
    editorial_reviewed_at = case
      when p_update_status_override and p_status_override = 'published' and media_presentation is null and template_review_context is null then pg_catalog.now()
      else editorial_reviewed_at
    end
  where id = p_submission_id
    and purge_state is null;

  if not found then
    raise exception 'contributor_asset_not_found';
  end if;

  -- Owner actions change the exact reviewed target, not every submitted asset.
  -- Lock the shared Pipeline lifecycle to serialize with voting/settings changes.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cardforge-contributor-pipeline', 0));
  update public.cardforge_contributor_asset_submissions as s
  set status = coalesce(s.owner_status_override, s.automated_status),
      calculated_access_tier = case
        when coalesce(s.owner_status_override, s.automated_status) = 'published'
          then coalesce(s.owner_access_tier_override,
             case when s.automated_access_tier in ('free','paid') then s.automated_access_tier else null end, 'free')
        when coalesce(s.owner_status_override, s.automated_status) in ('archived','rejected') then 'hidden'
        else 'contributor' end,
      decision_reason = case when s.owner_status_override is not null
        then 'owner_status_override' else s.decision_reason end,
      published_at = case when coalesce(s.owner_status_override, s.automated_status)='published'
        and s.published_at is null then pg_catalog.now() else s.published_at end,
      trashed_at = case when coalesce(s.owner_status_override, s.automated_status) in ('archived','rejected')
        and s.published_at is null then coalesce(s.trashed_at, pg_catalog.now())
        when coalesce(s.owner_status_override, s.automated_status) not in ('archived','rejected') then null
        else s.trashed_at end,
      trash_reason = case when coalesce(s.owner_status_override,s.automated_status) in ('archived','rejected')
        and s.published_at is null then coalesce(s.trash_reason,'declined')
        when coalesce(s.owner_status_override,s.automated_status) not in ('archived','rejected') then null
        else s.trash_reason end,
      purge_after = case when coalesce(s.owner_status_override,s.automated_status) in ('archived','rejected')
        and s.published_at is null then coalesce(s.purge_after,pg_catalog.now()+interval '30 days')
        when coalesce(s.owner_status_override,s.automated_status) not in ('archived','rejected') then null
        else s.purge_after end
  where s.id = p_submission_id and s.purge_state is null;
  get diagnostics changed_count = row_count;
  perform public.cardforge_sync_contributor_asset_registry(p_submission_id);

  return changed_count;
end;
$function$
;
commit;
