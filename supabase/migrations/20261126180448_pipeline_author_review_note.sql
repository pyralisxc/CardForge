begin;
set local lock_timeout = '5s';

-- This is an explicit author-directed message, never a projection of the
-- reviewer's private notes or source-evidence packet. Existing reviews remain
-- without an author note until an Owner records one deliberately.
alter table public.cardforge_contributor_asset_submissions
  add column author_review_note text not null default ''
  check (char_length(author_review_note) <= 600);

-- Existing decision and evidence commands can reset or replace a decision.
-- Never carry a prior author message forward into that different decision.
create function public.cardforge_clear_stale_author_review_note()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.editorial_review_status is distinct from old.editorial_review_status
    or new.editorial_review_note is distinct from old.editorial_review_note
    or new.editorial_reviewed_by is distinct from old.editorial_reviewed_by
    or new.editorial_reviewed_at is distinct from old.editorial_reviewed_at then
    new.author_review_note := '';
  end if;
  return new;
end;
$$;
create trigger cardforge_clear_stale_author_review_note
  before update of editorial_review_status, editorial_review_note, editorial_reviewed_by, editorial_reviewed_at
  on public.cardforge_contributor_asset_submissions
  for each row execute function public.cardforge_clear_stale_author_review_note();
revoke all on function public.cardforge_clear_stale_author_review_note() from public,anon,authenticated;

-- A reviewed unpublished revision is the snapshot the Owner assessed. All
-- writers, including draft finalization, must preserve it; a new revision owns
-- subsequent author changes. Publication and review metadata remain mutable.
create function public.cardforge_guard_reviewed_author_snapshot()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.published_at is null and old.editorial_review_status <> 'pending'
    and row(new.source_payload,new.name,new.description,new.preview_url,new.source_url,
      new.source_notes,new.specialty_tags,new.use_case_tags,new.semantic_role,new.visual_family,
      new.variant_kind,new.variant_label,new.compatibility_tags,new.requested_studio_destination)
      is distinct from row(old.source_payload,old.name,old.description,old.preview_url,old.source_url,
      old.source_notes,old.specialty_tags,old.use_case_tags,old.semantic_role,old.visual_family,
      old.variant_kind,old.variant_label,old.compatibility_tags,old.requested_studio_destination)
  then raise exception 'reviewed_revision_immutable'; end if;
  return new;
end;
$$;
create trigger cardforge_guard_reviewed_author_snapshot
  before update on public.cardforge_contributor_asset_submissions
  for each row execute function public.cardforge_guard_reviewed_author_snapshot();
revoke all on function public.cardforge_guard_reviewed_author_snapshot() from public,anon,authenticated;

-- Author feedback is review metadata, not authored candidate content.
create or replace function public.cardforge_media_parent_content_version(p_submission_id uuid)
returns text language sql stable security invoker set search_path = '' as $$
  select pg_catalog.md5((pg_catalog.to_jsonb(submission) - array[
    'updated_at','positive_votes','negative_votes','quality_score','status','contributor_lifecycle_state',
    'automated_status','owner_status_override','calculated_access_tier','automated_access_tier','owner_access_tier_override',
    'tier_decision_reason','owner_note','decision_reason','editorial_review_status','editorial_review_note',
    'editorial_reviewed_by','editorial_reviewed_at','author_review_note','published_at','purge_state','trashed_at','purge_after',
    'trash_reason','retention_hold','purge_claimed_at','template_review_context','source_review_evidence','owner_purge_requested_at','purge_claim_token','catalog_dependencies','source_content_sha256','revision_recovery_version','revision_trash_actor_id','revision_trash_actor_role','revision_publication_retained','revision_trash_previous_status','revision_vote_trash_fingerprint'])::text)
  from public.cardforge_contributor_asset_submissions as submission where id=p_submission_id;
$$;

-- Reuse the existing exact-review transaction, target-local registry sync,
-- and evidence guards; the author note succeeds or rolls back with that decision.
create function public.cardforge_review_with_author_note(
  p_submission_id uuid, p_review_status text, p_review_note text,
  p_reviewer_contributor_id text, p_expected_evidence_version integer,
  p_author_note text
) returns integer language plpgsql security invoker set search_path = '' as $$
declare
  author_note text := pg_catalog.btrim(coalesce(p_author_note, ''));
  result integer;
begin
  if pg_catalog.char_length(author_note) > 600 then
    raise exception 'author_review_note_too_long';
  end if;
  result := public.cardforge_set_contributor_asset_editorial_review(
    p_submission_id, p_review_status, p_review_note, p_reviewer_contributor_id, p_expected_evidence_version);
  update public.cardforge_contributor_asset_submissions
    set author_review_note = case when p_review_status = 'pending' then '' else author_note end
    where id = p_submission_id;
  if not found then raise exception 'contributor_asset_not_found'; end if;
  return result;
end;
$$;
revoke all on function public.cardforge_review_with_author_note(uuid,text,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.cardforge_review_with_author_note(uuid,text,text,text,integer,text) to service_role;

commit;
