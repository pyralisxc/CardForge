begin;
-- This fixture is invoked only by the guarded disposable CI runner; rollback restores its seed.
delete from public.cardforge_roadmap_items where release_version='0.0.1' and status<>'shipped';
do $$
declare r public.cardforge_roadmap_items; retry public.cardforge_roadmap_items; published public.cardforge_roadmap_items;
 k uuid=gen_random_uuid(); notes jsonb='{"improvements":["Synthetic improvement"],"fixes":[],"knownLimits":[]}'::jsonb;
begin
 if has_function_privilege('anon','public.cardforge_save_website_release(text,jsonb,text,text,timestamptz,uuid,boolean,text)','execute') or has_function_privilege('authenticated','public.cardforge_save_website_release(text,jsonb,text,text,timestamptz,uuid,boolean,text)','execute') then raise exception 'release_privilege_expanded'; end if;
 select * into r from public.cardforge_save_website_release('99.0.1',notes,null,null,null,k,false,'synthetic-owner');
 if r.status<>'in_progress' or r.shipped_at is not null then raise exception 'working_release_fabricated'; end if;
 select * into retry from public.cardforge_save_website_release('99.0.1',notes,null,null,null,k,false,'synthetic-owner');
 if retry.id<>r.id or retry.updated_at<>r.updated_at then raise exception 'retry_changed_record'; end if;
 begin perform public.cardforge_save_website_release('99.0.1','{"improvements":["Changed"],"fixes":[],"knownLimits":[]}',null,null,null,k,false,'synthetic-owner'); raise exception 'attempt_rebound'; exception when raise_exception then if sqlerrm<>'website_release_attempt_conflict' then raise; end if; end;
 begin perform public.cardforge_save_website_release('99.0.1',notes,null,null,null,gen_random_uuid(),false,'synthetic-owner'); raise exception 'stale_admitted'; exception when raise_exception then if sqlerrm<>'website_release_conflict' then raise; end if; end;
 begin update public.cardforge_roadmap_items set status='shipped',shipped_at=now() where id=r.id; raise exception 'legacy_publish_bypass'; exception when check_violation then null; end;
 select * into r from public.cardforge_save_website_release('99.0.1',notes,null,repeat('b',40),r.updated_at,gen_random_uuid(),false,'synthetic-owner');
 select * into published from public.cardforge_save_website_release('99.0.1',notes,repeat('a',40),repeat('b',40),r.updated_at,gen_random_uuid(),true,'synthetic-owner');
 if published.shipped_at is null or published.release_source_sha<>repeat('a',40) then raise exception 'release_facts_missing'; end if;
 begin delete from public.cardforge_roadmap_items where id=r.id; raise exception 'published_deleted'; exception when raise_exception then if sqlerrm<>'website_release_published_immutable' then raise; end if; end;
 begin update public.cardforge_roadmap_items set status='testing',shipped_at=null where id=r.id; raise exception 'published_unshipped'; exception when raise_exception then if sqlerrm<>'website_release_published_immutable' then raise; end if; end;
 begin update public.cardforge_roadmap_items set shipped_at=clock_timestamp() where id=r.id; raise exception 'published_date_reset'; exception when raise_exception then if sqlerrm<>'website_release_published_immutable' then raise; end if; end;
 begin update public.cardforge_roadmap_items set release_source_sha=repeat('c',40) where id=r.id; raise exception 'published_source_changed'; exception when raise_exception then if sqlerrm<>'website_release_published_immutable' then raise; end if; end;
 select * into retry from public.cardforge_save_website_release('99.0.1','{"improvements":["Attributable correction"],"fixes":[],"knownLimits":[]}',repeat('a',40),repeat('b',40),published.updated_at,gen_random_uuid(),true,'synthetic-owner');
 if retry.shipped_at<>published.shipped_at or retry.release_version<>published.release_version then raise exception 'narrative_changed_facts'; end if;
 begin perform public.cardforge_save_website_release('99.0.2','{"improvements":[],"fixes":[],"knownLimits":[],"opaque":true}',null,null,null,gen_random_uuid(),false,'synthetic-owner'); raise exception 'unknown_notes_admitted'; exception when raise_exception then if sqlerrm<>'website_release_invalid' then raise; end if; end;
 if (select count(*) from public.cardforge_roadmap_items where release_version='99.0.1')<>1 then raise exception 'duplicate_release'; end if;

 -- Prepare another exact working packet, then import its independently verified
 -- Production facts and start the next working batch in one native transaction.
 select * into r from public.cardforge_save_website_release('99.0.3',notes,null,repeat('b',40),null,gen_random_uuid(),false,'synthetic-owner');
 begin perform public.cardforge_advance_website_release('99.0.3',r.updated_at,jsonb_build_object('version','99.0.3','notes',jsonb_build_object('improvements',jsonb_build_array('Changed after approval'),'fixes','[]'::jsonb,'knownLimits','[]'::jsonb),'sourceSha',repeat('a',40),'candidateSha',repeat('b',40),'shippedAt','2026-10-30T00:00:00Z'),'99.0.4',notes,gen_random_uuid(),'synthetic-owner');raise exception 'changed_advance_admitted';exception when raise_exception then if sqlerrm<>'website_release_conflict' then raise;end if;end;
 k=gen_random_uuid();
 select * into retry from public.cardforge_advance_website_release('99.0.3',r.updated_at,jsonb_build_object('version','99.0.3','notes',notes,'sourceSha',repeat('a',40),'candidateSha',repeat('b',40),'shippedAt','2026-10-30T00:00:00Z'),'99.0.4',notes,k,'synthetic-owner');
 if retry.shipped_at is not null or retry.release_operation_kind<>'working-advanced' then raise exception 'next_working_fabricated_release';end if;
 select * into published from public.cardforge_roadmap_items where id=r.id;
 if published.shipped_at<>'2026-10-30T00:00:00Z'::timestamptz or published.release_source_sha<>repeat('a',40) then raise exception 'verified_facts_not_retained';end if;
 select * into r from public.cardforge_advance_website_release('99.0.3',r.updated_at,jsonb_build_object('version','99.0.3','notes',notes,'sourceSha',repeat('a',40),'candidateSha',repeat('b',40),'shippedAt','2026-10-30T00:00:00Z'),'99.0.4',notes,k,'synthetic-owner');
 if r.id<>retry.id or r.updated_at<>retry.updated_at then raise exception 'advance_retry_duplicated';end if;
 raise notice 'PASS: website working/release distinction, exact retry/CAS, privilege, immutable facts, narrative correction and legacy-path guards';
end $$;
rollback;
