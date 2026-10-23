begin;
create table if not exists public.cardforge_meta_page_selections (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  payload_ciphertext text,
  payload_iv text,
  payload_auth_tag text,
  expires_at timestamptz not null default now() + interval '10 minutes',
  terminal_receipt jsonb,
  completed_at timestamptz
);
alter table public.cardforge_meta_page_selections enable row level security;
revoke all on public.cardforge_meta_page_selections from public, anon, authenticated;
grant select, insert, delete on public.cardforge_meta_page_selections to service_role;

-- New OAuth attempts opportunistically purge already-expired encrypted payloads,
-- without activating a new scheduler. Terminal receipts remain for recovery.
create or replace function public.cardforge_prune_meta_page_selections()
returns trigger language plpgsql security definer set search_path='' as $cleanup$
begin
  delete from public.cardforge_meta_page_selections
    where expires_at <= pg_catalog.now() and terminal_receipt is null;
  return new;
end;
$cleanup$;
revoke all on function public.cardforge_prune_meta_page_selections() from public,anon,authenticated;
drop trigger if exists cardforge_meta_page_selection_cleanup on public.cardforge_meta_page_selections;
create trigger cardforge_meta_page_selection_cleanup before insert
  on public.cardforge_meta_page_selections for each statement
  execute function public.cardforge_prune_meta_page_selections();

create or replace function public.cardforge_complete_meta_page_selection(
  p_selection_id uuid, p_actor_id text, p_page_id text, p_accounts jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
  v_pending public.cardforge_meta_page_selections%rowtype;
  v_account jsonb;
  v_connection_id uuid;
  v_destination_id uuid;
  v_count integer := 0;
  v_receipt jsonb;
begin
  if nullif(p_actor_id,'') is null then raise exception 'owner_required'; end if;
  select * into v_pending from public.cardforge_meta_page_selections
    where id=p_selection_id and owner_user_id=p_actor_id for update;
  if not found then raise exception 'selection_not_found'; end if;
  if v_pending.terminal_receipt is not null then
    if (v_pending.terminal_receipt->>'selectedPageId') is distinct from p_page_id then
      raise exception 'selection_intent_conflict';
    end if;
    return v_pending.terminal_receipt;
  end if;
  if v_pending.expires_at <= pg_catalog.now() then
    if p_page_id is not null then raise exception 'selection_expired'; end if;
    v_receipt:='{"cancelled":true,"connectionCount":0,"selectedPageId":null}'::jsonb;
    update public.cardforge_meta_page_selections set payload_ciphertext=null,payload_iv=null,
      payload_auth_tag=null,terminal_receipt=v_receipt,completed_at=pg_catalog.now() where id=p_selection_id;
    return v_receipt;
  end if;
  if p_page_id is null then
    if p_accounts <> '[]'::jsonb then raise exception 'invalid_cancel_payload'; end if;
    v_receipt := '{"cancelled":true,"connectionCount":0}'::jsonb;
  else
    if pg_catalog.jsonb_typeof(p_accounts) <> 'array' or pg_catalog.jsonb_array_length(p_accounts) not between 1 and 2 then
      raise exception 'invalid_accounts';
    end if;
    if p_accounts->0->>'service' <> 'facebook' or p_accounts->0->>'account_id' <> p_page_id then
      raise exception 'selected_page_mismatch';
    end if;
    for v_account in select value from pg_catalog.jsonb_array_elements(p_accounts)
    loop
      if v_account->>'service' not in ('facebook','instagram')
        or nullif(v_account->>'account_id','') is null
        or nullif(v_account->>'ciphertext','') is null
        or nullif(v_account->>'iv','') is null
        or nullif(v_account->>'authTag','') is null then
        raise exception 'invalid_account_payload';
      end if;
      insert into public.cardforge_marketing_connections(
        provider,service,external_account_id,display_name,
        access_token_ciphertext,access_token_iv,access_token_auth_tag,
        granted_scopes,status,status_note,connected_by,last_verified_at
      ) values (
        'meta',v_account->>'service',v_account->>'account_id',v_account->>'display_name',
        v_account->>'ciphertext',v_account->>'iv',v_account->>'authTag',
        '["pages_show_list","pages_read_engagement","pages_manage_posts","instagram_basic","instagram_content_publish"]'::jsonb,
        'active','',p_actor_id,pg_catalog.now()
      ) on conflict (provider,service,external_account_id) do update set
        display_name=excluded.display_name,access_token_ciphertext=excluded.access_token_ciphertext,
        access_token_iv=excluded.access_token_iv,access_token_auth_tag=excluded.access_token_auth_tag,
        granted_scopes=excluded.granted_scopes,status='active',status_note='',
        connected_by=excluded.connected_by,last_verified_at=excluded.last_verified_at
      returning id into v_connection_id;
      select id into v_destination_id from public.cardforge_marketing_destinations
        where provider='meta' and service=v_account->>'service'
          and external_account_id=v_account->>'account_id' for update;
      if v_destination_id is null then
        insert into public.cardforge_marketing_destinations(
          connection_id,name,service,kind,provider,publishing_mode,external_account_id,active,created_by
        ) values (
          v_connection_id,v_account->>'display_name',v_account->>'service','owned','meta','automatic',
          v_account->>'account_id',true,p_actor_id
        );
      else
        update public.cardforge_marketing_destinations set
          connection_id=v_connection_id,name=v_account->>'display_name',kind='owned',
          publishing_mode='automatic',active=true
        where id=v_destination_id;
      end if;
      v_count:=v_count+1;
    end loop;
    v_receipt:=pg_catalog.jsonb_build_object('cancelled',false,'connectionCount',v_count,'selectedPageId',p_page_id);
  end if;
  update public.cardforge_meta_page_selections set
    payload_ciphertext=null,payload_iv=null,payload_auth_tag=null,
    terminal_receipt=v_receipt,completed_at=pg_catalog.now()
    where id=p_selection_id;
  return v_receipt;
end;
$fn$;
revoke all on function public.cardforge_complete_meta_page_selection(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.cardforge_complete_meta_page_selection(uuid,text,text,jsonb) to service_role;
commit;
