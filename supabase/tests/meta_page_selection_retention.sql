-- Rollback-only native Meta selection retention fixture; execute only after approval.
-- Caller must install the exact proposed migration functions in the same
-- outer transaction, stripping its BEGIN/COMMIT wrappers.
-- Validates expiry, receipt retention, NULL/oversized limits, and no impact
-- on live Meta connections or destinations.
do $retention$
declare
  v_owner text := 'fixture-owner-' || gen_random_uuid()::text;
  v_valid uuid;
  v_expired uuid;
  v_terminal uuid;
  v_old_receipt uuid;
  v_count integer;
  v_connections_before bigint;
  v_destinations_before bigint;
begin
  select count(*) into v_connections_before from public.cardforge_marketing_connections;
  select count(*) into v_destinations_before from public.cardforge_marketing_destinations;

  insert into public.cardforge_meta_page_selections(owner_user_id,expires_at,payload_ciphertext,payload_iv,payload_auth_tag)
  values(v_owner,now()+interval '10 minutes','valid-cipher','valid-iv','valid-tag') returning id into v_valid;
  insert into public.cardforge_meta_page_selections(owner_user_id,expires_at,payload_ciphertext,payload_iv,payload_auth_tag)
  values(v_owner,now()-interval '1 second','expired-cipher','expired-iv','expired-tag') returning id into v_expired;
  insert into public.cardforge_meta_page_selections(owner_user_id,expires_at,terminal_receipt,completed_at)
  values(v_owner,now()-interval '2 days','{"cancelled":true,"connectionCount":0,"selectedPageId":null}',now()-interval '23 hours')
  returning id into v_terminal;
  insert into public.cardforge_meta_page_selections(owner_user_id,expires_at,terminal_receipt,completed_at)
  values(v_owner,now()-interval '3 days','{"cancelled":true,"connectionCount":0,"selectedPageId":null}',now()-interval '25 hours')
  returning id into v_old_receipt;

  begin
    perform public.cardforge_cleanup_meta_page_selections(null);
    raise exception 'null cleanup cap accepted';
  exception when raise_exception then
    if sqlerrm <> 'invalid_cleanup_limit' then raise; end if;
  end;
  begin
    perform public.cardforge_cleanup_meta_page_selections(201);
    raise exception 'oversized cleanup cap accepted';
  exception when raise_exception then
    if sqlerrm <> 'invalid_cleanup_limit' then raise; end if;
  end;
  select coalesce(sum(scrubbed+removed),0)::integer into v_count
    from public.cardforge_cleanup_meta_page_selections(200);
  if v_count < 2 then raise exception 'cleanup did not process disposable expired records'; end if;
  if not exists(select 1 from public.cardforge_meta_page_selections
      where id=v_valid and payload_ciphertext='valid-cipher' and terminal_receipt is null)
    or not exists(select 1 from public.cardforge_meta_page_selections
      where id=v_expired and payload_ciphertext is null and payload_iv is null and payload_auth_tag is null
        and terminal_receipt->>'selectedPageId' is null)
    or not exists(select 1 from public.cardforge_meta_page_selections where id=v_terminal)
    or exists(select 1 from public.cardforge_meta_page_selections where id=v_old_receipt)
  then raise exception 'retention boundaries incorrect'; end if;
  if (select count(*) from public.cardforge_marketing_connections) <> v_connections_before
    or (select count(*) from public.cardforge_marketing_destinations) <> v_destinations_before
  then raise exception 'cleanup touched live marketing state'; end if;
end
$retention$;
