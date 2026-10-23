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

  -- Serialize target mutation with Pipeline votes/settings before reading or updating.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cardforge-contributor-pipeline', 0));

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
  -- The shared lifecycle lock is already held above.
  -- An exact current registry publication remains live when an Owner override
  -- is cleared; its historical automated score need not have caught up.
  update public.cardforge_contributor_asset_submissions as s
  set status = case when s.owner_status_override is null and exists (
        select 1 from public.cardforge_asset_registry r
        where r.contributor_submission_id=s.id and r.status='published'
      ) then 'published' else coalesce(s.owner_status_override,s.automated_status) end,
      calculated_access_tier = case
        when (case when s.owner_status_override is null and exists (select 1 from public.cardforge_asset_registry r where r.contributor_submission_id=s.id and r.status='published') then 'published' else coalesce(s.owner_status_override,s.automated_status) end) = 'published'
          then coalesce(s.owner_access_tier_override,
             (select r.access_tier from public.cardforge_asset_registry r where r.contributor_submission_id=s.id and r.status='published'),
             case when s.automated_access_tier in ('free','paid') then s.automated_access_tier else null end, 'free')
        when (case when s.owner_status_override is null and exists (select 1 from public.cardforge_asset_registry r where r.contributor_submission_id=s.id and r.status='published') then 'published' else coalesce(s.owner_status_override,s.automated_status) end) in ('archived','rejected') then 'hidden'
        else 'contributor' end,
      decision_reason = case when s.owner_status_override is not null then 'owner_status_override'
        when exists (select 1 from public.cardforge_asset_registry r where r.contributor_submission_id=s.id and r.status='published') then 'current_publication_protected'
        else coalesce(nullif(nullif(s.decision_reason,'owner_status_override'),'current_publication_protected'),'needs_more_votes') end,
      tier_decision_reason = case when s.owner_access_tier_override is not null then 'owner_forced_' || s.owner_access_tier_override
        when s.owner_status_override in ('archived','rejected') then 'hidden_status'
        when exists (select 1 from public.cardforge_asset_registry r where r.contributor_submission_id=s.id and r.status='published') then 'current_publication_protected'
        else coalesce(nullif(nullif(s.tier_decision_reason,'hidden_status'),'owner_forced_free'), 'needs_more_votes') end,
      published_at = case when (case when s.owner_status_override is null and exists (select 1 from public.cardforge_asset_registry r where r.contributor_submission_id=s.id and r.status='published') then 'published' else coalesce(s.owner_status_override,s.automated_status) end)='published'
        and s.published_at is null then pg_catalog.now() else s.published_at end,
      trashed_at = case when (case when s.owner_status_override is null and exists (select 1 from public.cardforge_asset_registry r where r.contributor_submission_id=s.id and r.status='published') then 'published' else coalesce(s.owner_status_override,s.automated_status) end) = 'archived'
        and s.published_at is null then coalesce(s.trashed_at, pg_catalog.now())
        when (case when s.owner_status_override is null and exists (select 1 from public.cardforge_asset_registry r where r.contributor_submission_id=s.id and r.status='published') then 'published' else coalesce(s.owner_status_override,s.automated_status) end) not in ('archived','rejected') then null
        else s.trashed_at end,
      trash_reason = case when coalesce(s.owner_status_override,s.automated_status) = 'archived'
        and s.published_at is null then coalesce(s.trash_reason,'declined')
        when coalesce(s.owner_status_override,s.automated_status) not in ('archived','rejected') then null
        else s.trash_reason end,
      purge_after = case when coalesce(s.owner_status_override,s.automated_status) = 'archived'
        and s.published_at is null then coalesce(s.purge_after,pg_catalog.now()+pg_catalog.make_interval(days => (select trash_retention_days from public.cardforge_contributor_program_settings where id='default')))
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
