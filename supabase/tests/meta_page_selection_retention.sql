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
  v_first integer;
  v_second integer;
  v_connections_digest text;
  v_destinations_digest text;
begin
  -- Fail closed when shared Staging already has eligible data. This proof
  -- never uses cleanup to mutate a real pending or completed selection.
  if exists(select 1 from public.cardforge_meta_page_selections
     where (terminal_receipt is null and expires_at <= pg_catalog.now())
        or (terminal_receipt is not null and completed_at <= pg_catalog.now() - interval '24 hours'))
  then raise exception 'existing eligible selections require separate isolation'; end if;
  select md5(coalesce(string_agg(to_jsonb(c)::text,'|' order by c.id),'')) into v_connections_digest
    from public.cardforge_marketing_connections c;
  select md5(coalesce(string_agg(to_jsonb(d)::text,'|' order by d.id),'')) into v_destinations_digest
    from public.cardforge_marketing_destinations d;

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

  -- 201 additional eligible rows force the cap to split across two calls.
  insert into public.cardforge_meta_page_selections(owner_user_id,expires_at,payload_ciphertext,payload_iv,payload_auth_tag)
    select v_owner,pg_catalog.now()-interval '2 seconds','bulk-cipher','bulk-iv','bulk-tag'
    from pg_catalog.generate_series(1,201);

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
  select coalesce(sum(scrubbed+removed),0)::integer into v_first
    from public.cardforge_cleanup_meta_page_selections(200);
  if v_first <> 200 then raise exception 'first cleanup exceeded or missed exact 200-row cap'; end if;
  select coalesce(sum(scrubbed+removed),0)::integer into v_second
    from public.cardforge_cleanup_meta_page_selections(200);
  if v_second <> 3 then raise exception 'second cleanup did not finish remaining three eligible rows'; end if;
  if exists(select 1 from public.cardforge_meta_page_selections
    where owner_user_id=v_owner and terminal_receipt is null and expires_at<=pg_catalog.now())
  then raise exception 'fixture left eligible encrypted payloads'; end if;
  if not exists(select 1 from public.cardforge_meta_page_selections
      where id=v_valid and payload_ciphertext='valid-cipher' and terminal_receipt is null)
    or not exists(select 1 from public.cardforge_meta_page_selections
      where id=v_expired and payload_ciphertext is null and payload_iv is null and payload_auth_tag is null
        and terminal_receipt='{"cancelled":true,"connectionCount":0,"selectedPageId":null}'::jsonb
        and completed_at is not null)
    or not exists(select 1 from public.cardforge_meta_page_selections where id=v_terminal)
    or exists(select 1 from public.cardforge_meta_page_selections where id=v_old_receipt)
  then raise exception 'retention boundaries incorrect'; end if;
  if (select md5(coalesce(string_agg(to_jsonb(c)::text,'|' order by c.id),'')) from public.cardforge_marketing_connections c)
       is distinct from v_connections_digest
    or (select md5(coalesce(string_agg(to_jsonb(d)::text,'|' order by d.id),'')) from public.cardforge_marketing_destinations d)
       is distinct from v_destinations_digest
  then raise exception 'cleanup changed existing marketing records'; end if;
end
$retention$;
