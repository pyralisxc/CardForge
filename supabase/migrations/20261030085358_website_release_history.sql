alter table public.cardforge_roadmap_items
 add column release_version text,
 add column release_updated_by text,
 add column release_operation_kind text,
 add column release_notes jsonb,
 add column release_source_sha text,
 add column release_candidate_sha text,
 add column release_operation_id uuid,
 add column release_operation_payload jsonb,
 add constraint website_release_shape check (release_version is null or (
 source='official' and item_type='shipped_update'
 and release_version ~ '^(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})$'
 and ((status='shipped') = (shipped_at is not null))
 and release_notes is not null and jsonb_typeof(release_notes)='object'
 and (release_source_sha is null or release_source_sha ~ '^[a-f0-9]{40}$')
 and (release_candidate_sha is null or release_candidate_sha ~ '^[a-f0-9]{40}$')
 and (status <> 'shipped' or (shipped_at is not null and release_source_sha is not null and release_candidate_sha is not null
 and (release_operation_payload @> jsonb_build_object('publish',true,'source',release_source_sha,'candidate',release_candidate_sha,'version',release_version)) is true))));
create unique index cardforge_website_release_version on public.cardforge_roadmap_items(release_version) where release_version is not null;

create function public.cardforge_guard_website_release() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if old.release_version is not null and old.status='shipped' then
   if tg_op='DELETE' then raise exception 'website_release_published_immutable'; end if;
   if (new.release_version,new.status,new.shipped_at,new.release_source_sha,new.release_candidate_sha,new.source,new.item_type)
     is distinct from (old.release_version,old.status,old.shipped_at,old.release_source_sha,old.release_candidate_sha,old.source,old.item_type)
   then raise exception 'website_release_published_immutable'; end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function public.cardforge_guard_website_release() from public,anon,authenticated;
create trigger cardforge_website_release_guard before update or delete on public.cardforge_roadmap_items for each row execute function public.cardforge_guard_website_release();

create function public.cardforge_save_website_release(p_version text,p_notes jsonb,p_source_sha text,p_candidate_sha text,p_expected_updated_at timestamptz,p_operation_id uuid,p_publish boolean,p_actor_id text)
returns public.cardforge_roadmap_items language plpgsql security invoker set search_path=public as $$
declare r public.cardforge_roadmap_items; request jsonb; key text; note jsonb;
begin
 if p_actor_id is null or length(btrim(p_actor_id))=0 then raise exception 'website_release_invalid'; end if;
 if p_version is null or p_publish is null or p_version !~ '^(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})$' or p_operation_id is null
 or p_notes is null or jsonb_typeof(p_notes)<>'object' or (select count(*) from jsonb_object_keys(p_notes))<>3
 then raise exception 'website_release_invalid'; end if;
 foreach key in array array['improvements','fixes','knownLimits'] loop
  if jsonb_typeof(p_notes->key) is distinct from 'array' or jsonb_array_length(p_notes->key)>40 then raise exception 'website_release_invalid'; end if;
  for note in select value from jsonb_array_elements(p_notes->key) loop
   if jsonb_typeof(note)<>'string' or length(btrim(note#>>'{}')) not between 1 and 1000 then raise exception 'website_release_invalid'; end if;
  end loop;
 end loop;
 if not p_publish and p_source_sha is not null then raise exception 'website_release_invalid'; end if;
 if p_publish and (p_source_sha is null or p_source_sha !~ '^[a-f0-9]{40}$' or p_candidate_sha is null or p_candidate_sha !~ '^[a-f0-9]{40}$') then raise exception 'website_release_invalid'; end if;
 request=jsonb_build_object('version',p_version,'notes',p_notes,'source',p_source_sha,'candidate',p_candidate_sha,'publish',p_publish);
 perform pg_advisory_xact_lock(hashtextextended('cardforge-website-release-current',0));
 select * into r from public.cardforge_roadmap_items where release_version=p_version for update;
 if found then
  if r.release_operation_id=p_operation_id then
   if (r.release_operation_payload-'advanceFrom') is distinct from request then raise exception 'website_release_attempt_conflict'; end if;
   return r;
  end if;
  if p_expected_updated_at is null or r.updated_at<>p_expected_updated_at then raise exception 'website_release_conflict'; end if;
  if p_publish and r.status<>'shipped' and (r.release_notes is distinct from p_notes or r.release_candidate_sha is distinct from p_candidate_sha) then raise exception 'website_release_approved_snapshot_conflict'; end if;
  if r.status='shipped' and (not p_publish or r.release_source_sha is distinct from p_source_sha or r.release_candidate_sha is distinct from p_candidate_sha) then raise exception 'website_release_published_immutable'; end if;
  update public.cardforge_roadmap_items set release_operation_kind=case when r.status='shipped' then 'narrative-corrected' when p_publish then 'release-published' else 'working-saved' end,release_updated_by=p_actor_id,release_notes=p_notes,release_source_sha=p_source_sha,release_candidate_sha=p_candidate_sha,
   release_operation_id=p_operation_id,release_operation_payload=request,
   status=case when p_publish then 'shipped' else status end,
   shipped_at=case when p_publish then coalesce(shipped_at,now()) else shipped_at end,
   updated_at=clock_timestamp() where id=r.id returning * into r;
 else
  if p_publish then raise exception 'website_release_approved_snapshot_missing'; end if;
  if not p_publish and exists(select 1 from public.cardforge_roadmap_items where release_version is not null and status<>'shipped') then raise exception 'website_release_advance_requires_verified_release'; end if;
  if p_expected_updated_at is not null then raise exception 'website_release_conflict'; end if;
  insert into public.cardforge_roadmap_items(title,description,source,item_type,status,visible_month,release_version,release_notes,release_source_sha,release_candidate_sha,release_operation_id,release_operation_payload,shipped_at,created_by_user_id,release_updated_by,release_operation_kind)
  values ('Website '||p_version,'Versioned website update.','official','shipped_update',case when p_publish then 'shipped' else 'in_progress' end,to_char(now(),'YYYY-MM'),p_version,p_notes,p_source_sha,p_candidate_sha,p_operation_id,request,case when p_publish then now() else null end,p_actor_id,p_actor_id,'working-saved') returning * into r;
 end if;
 return r;
end $$;
revoke all on function public.cardforge_save_website_release(text,jsonb,text,text,timestamptz,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.cardforge_save_website_release(text,jsonb,text,text,timestamptz,uuid,boolean,text) to service_role;

-- An unreleased working batch is not a historical release or a publication.
insert into public.cardforge_roadmap_items(title,description,source,item_type,status,visible_month,release_version,release_notes)
values ('Website 0.0.1','Working/upcoming website version.','official','shipped_update','in_progress',to_char(now(),'YYYY-MM'),'0.0.1','{"improvements":[],"fixes":[],"knownLimits":[]}'::jsonb);
create unique index cardforge_website_release_attempt on public.cardforge_roadmap_items(release_operation_id) where release_operation_id is not null;

create function public.cardforge_advance_website_release(p_previous_version text,p_expected_updated_at timestamptz,p_published jsonb,p_next_version text,p_next_notes jsonb,p_operation_id uuid,p_actor_id text)
returns public.cardforge_roadmap_items language plpgsql security invoker set search_path=public as $$
declare previous public.cardforge_roadmap_items; next_row public.cardforge_roadmap_items;
begin
 perform pg_advisory_xact_lock(hashtextextended('cardforge-website-release-current',0));
 select * into next_row from public.cardforge_roadmap_items where release_version=p_next_version for update;
 if found and next_row.release_operation_id=p_operation_id then
  if next_row.release_operation_payload->>'advanceFrom' is distinct from p_previous_version then raise exception 'website_release_attempt_conflict'; end if;
  return public.cardforge_save_website_release(p_next_version,p_next_notes,null,null,null,p_operation_id,false,p_actor_id);
 end if;
 if p_next_version !~ '^(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})$'
 or string_to_array(p_next_version,'.')::int[] <= string_to_array(p_previous_version,'.')::int[] then raise exception 'website_release_invalid'; end if;
 select * into previous from public.cardforge_roadmap_items where release_version=p_previous_version for update;
 if not found or previous.updated_at is distinct from p_expected_updated_at or previous.shipped_at is not null
 or previous.release_notes is distinct from p_published->'notes'
 or previous.release_candidate_sha is distinct from p_published->>'candidateSha'
 or p_published->>'version' is distinct from p_previous_version
 or p_published->>'sourceSha' is null or p_published->>'sourceSha' !~ '^[a-f0-9]{40}$'
 or p_published->>'candidateSha' is null or p_published->>'candidateSha' !~ '^[a-f0-9]{40}$'
 or p_published->>'shippedAt' is null then raise exception 'website_release_conflict'; end if;
 update public.cardforge_roadmap_items set status='shipped',shipped_at=(p_published->>'shippedAt')::timestamptz,
 release_source_sha=p_published->>'sourceSha',release_updated_by=p_actor_id,
 release_operation_payload=jsonb_build_object('publish',true,'version',p_previous_version,'source',p_published->>'sourceSha','candidate',p_published->>'candidateSha')
 where id=previous.id;
 select * into next_row from public.cardforge_save_website_release(p_next_version,p_next_notes,null,null,null,p_operation_id,false,p_actor_id);
 update public.cardforge_roadmap_items set release_operation_kind='working-advanced',release_operation_payload=release_operation_payload||jsonb_build_object('advanceFrom',p_previous_version) where id=next_row.id returning * into next_row;
 return next_row;
end $$;
revoke all on function public.cardforge_advance_website_release(text,timestamptz,jsonb,text,jsonb,uuid,text) from public,anon,authenticated;
grant execute on function public.cardforge_advance_website_release(text,timestamptz,jsonb,text,jsonb,uuid,text) to service_role;
