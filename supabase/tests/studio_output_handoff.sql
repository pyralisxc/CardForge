-- Native disposable replay only. No hosted data or generated files.
begin;
set local role service_role;
do $$
declare doc uuid := gen_random_uuid(); ref uuid; stale uuid; expired uuid := gen_random_uuid(); other_expired uuid := gen_random_uuid(); body jsonb; before_revision integer; after_revision integer;
begin
  insert into public.cardforge_studio_documents(id, owner_user_id, title, document_payload)
    values(doc, 'output-owner', 'Synthetic Output', '{"version":1,"userTemplates":[],"cardSets":[],"storedCards":[]}'::jsonb);
  select revision into before_revision from public.cardforge_studio_documents where id = doc;
  select jsonb_build_object('documentId', doc::text, 'revision', before_revision, 'setId', 'synthetic',
    'cardIds', jsonb_agg('card-' || g::text order by g)) into body from generate_series(1, 10000) g;
  insert into public.cardforge_studio_output_intents(id,owner_user_id,document_id,document_revision,intent,fingerprint,created_at,expires_at) values
    (expired,'output-owner',doc,before_revision,body,repeat('a',64),now()-interval '2 days',now()-interval '1 day'),
    (other_expired,'other-owner',doc,before_revision,body,repeat('a',64),now()-interval '2 days',now()-interval '1 day');
  ref := public.cardforge_prepare_studio_output_intent('output-owner', doc, before_revision, body, repeat('a',64));
  if ref is null then raise exception 'expected exact reference'; end if;
  if exists(select 1 from public.cardforge_studio_output_intents where id=expired) or not exists(select 1 from public.cardforge_studio_output_intents where id=other_expired) then raise exception 'expired intent cleanup scope invalid'; end if;
  if (select jsonb_array_length(intent -> 'cardIds') from public.cardforge_studio_output_intents where id=ref and owner_user_id='output-owner') <> 10000 then raise exception 'selection was truncated'; end if;
  if (select count(*) from public.cardforge_studio_output_intents where id=ref and owner_user_id='other-owner') <> 0 then raise exception 'wrong owner resolved metadata'; end if;
  begin
    insert into public.cardforge_studio_output_intents(owner_user_id, document_id, document_revision, intent, fingerprint)
      values ('output-owner', doc, before_revision, '{}'::jsonb, repeat('a',64));
    raise exception 'missing exact identity and selection were accepted';
  exception when check_violation then null;
  end;
  if public.cardforge_prepare_studio_output_intent('other-owner', doc, before_revision, body, repeat('a',64)) is not null then raise exception 'wrong owner prepared metadata'; end if;
  select revision into after_revision from public.cardforge_studio_documents where id = doc;
  if before_revision <> after_revision then raise exception 'intent changed authored revision'; end if;
  update public.cardforge_studio_documents set revision = revision + 1 where id = doc;
  stale := public.cardforge_prepare_studio_output_intent('output-owner', doc, before_revision, body, repeat('a',64));
  if stale is not null then raise exception 'stale revision prepared metadata'; end if;
  if has_table_privilege('anon', 'public.cardforge_studio_output_intents', 'select') or has_table_privilege('authenticated', 'public.cardforge_studio_output_intents', 'select') then raise exception 'browser roles can read private metadata'; end if;
  raise notice 'exact Output reference, 10000-card selection, ownership, revision and grants verified';
end $$;
rollback;
