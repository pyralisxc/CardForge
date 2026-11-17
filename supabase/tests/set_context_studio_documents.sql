begin;
set local role service_role;
do $$
declare
  doc uuid := gen_random_uuid();
  candidate jsonb;
begin
  insert into public.cardforge_studio_documents(id, owner_user_id, title, document_payload)
    values (doc, 'context-version-fixture', 'Legacy Set', '{"version":1}'::jsonb);
  update public.cardforge_studio_documents
    set document_version = 2,
      document_payload = '{"version":2,"cardSets":[{"id":"native","name":"Native Set","plan":{"version":1,"context":"Creator notes"}}]}'::jsonb
    where id = doc;
  if not exists (select 1 from public.cardforge_studio_documents
      where id = doc and document_version = 2
        and document_payload #>> '{cardSets,0,plan,context}' = 'Creator notes') then
    raise exception 'Native Set context was not preserved.';
  end if;
  begin
    update public.cardforge_studio_documents set document_version = 4,
      document_payload = '{"version":4}'::jsonb where id = doc;
    raise exception 'Unsupported document version was accepted.';
  exception when check_violation then null;
  end;
  foreach candidate in array array[
    '{"version":1}'::jsonb,
    '{"version":"2"}'::jsonb,
    '{}'::jsonb,
    '[]'::jsonb,
    'null'::jsonb
  ] loop
    begin
      update public.cardforge_studio_documents set document_payload = candidate where id = doc;
      raise exception 'Invalid or mismatched payload was accepted: %', candidate;
    exception when check_violation then null;
    end;
  end loop;
  if not exists (select 1 from public.cardforge_studio_documents
      where id = doc and document_payload #>> '{cardSets,0,plan,context}' = 'Creator notes') then
    raise exception 'Rejected writes changed the saved context.';
  end if;
  update public.cardforge_studio_documents
    set document_version = 3, document_payload = jsonb_set(document_payload, '{version}', '3'::jsonb)
    where id = doc;
  select document_payload into candidate from public.cardforge_studio_documents where id = doc;
  begin
    update public.cardforge_studio_documents
      set document_version = 2, document_payload = '{"version":2}'::jsonb, revision = revision + 1
      where id = doc;
    raise exception 'An older writer discarded Set ownership.';
  exception when check_violation then null;
  end;
  if not exists (select 1 from public.cardforge_studio_documents
      where id = doc and document_version = 3 and document_payload = candidate and revision = 1) then
    raise exception 'An older write changed the saved document or revision.';
  end if;
end $$;
rollback;
