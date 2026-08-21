begin;

select pg_advisory_xact_lock(hashtext('cardforge_assistant_draft_retention'));

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
create extension if not exists pgcrypto with schema extensions;

alter table public.cardforge_mcp_allowance_settings
  add column if not exists draft_retention_hours integer;

update public.cardforge_mcp_allowance_settings
set draft_retention_hours = case plan_key
  when 'free' then 12
  when 'creator' then 24
  when 'designer' then 48
  when 'enterprise' then 168
end
where draft_retention_hours is null;

alter table public.cardforge_mcp_allowance_settings
  alter column draft_retention_hours set not null,
  add constraint cardforge_mcp_allowance_draft_retention_hours_check
    check (draft_retention_hours between 1 and 8760);

alter table public.cardforge_studio_documents
  add column if not exists last_activity_at timestamptz,
  add column if not exists retention_hours integer,
  add column if not exists expires_at timestamptz,
  add column if not exists retention_grace_until timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists purge_after timestamptz,
  add column if not exists purge_state text,
  add column if not exists purge_claimed_at timestamptz;

-- Legacy assistant drafts predate retention metadata. Give every existing draft
-- the longest self-serve window so rollout cannot prematurely shorten paid work.
-- The next authenticated account operation reconciles the row to its current plan.
update public.cardforge_studio_documents
set
  last_activity_at = coalesce(last_activity_at, updated_at, created_at, pg_catalog.now()),
  retention_hours = coalesce(retention_hours, 48),
  retention_grace_until = coalesce(retention_grace_until, pg_catalog.now() + interval '48 hours'),
  expires_at = greatest(
    coalesce(
      expires_at,
      coalesce(last_activity_at, updated_at, created_at, pg_catalog.now()) + interval '48 hours'
    ),
    pg_catalog.now() + interval '48 hours'
  )
where last_activity_at is null
  or retention_hours is null
  or expires_at is null;

alter table public.cardforge_studio_documents
  alter column last_activity_at set default pg_catalog.now(),
  alter column last_activity_at set not null,
  alter column retention_hours set default 48,
  alter column retention_hours set not null,
  alter column expires_at set default (pg_catalog.now() + interval '48 hours'),
  alter column expires_at set not null;

alter table public.cardforge_studio_documents
  add constraint cardforge_studio_documents_retention_hours_check
    check (retention_hours between 1 and 8760),
  add constraint cardforge_studio_documents_expiry_check
    check (expires_at is not null),
  add constraint cardforge_studio_documents_purge_after_check
    check (purge_after is null or deleted_at is not null),
  add constraint cardforge_studio_documents_purge_state_check
    check (purge_state is null or purge_state in ('pending', 'processing'));

create index if not exists cardforge_studio_documents_active_expiry_idx
  on public.cardforge_studio_documents (expires_at, id)
  where deleted_at is null and expires_at is not null;

create index if not exists cardforge_studio_documents_purge_queue_idx
  on public.cardforge_studio_documents (purge_after, id)
  where deleted_at is not null;

create or replace function public.cardforge_apply_studio_document_retention(
  p_owner_user_id text,
  p_retention_hours integer
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  affected integer := 0;
  expired integer := 0;
begin
  if pg_catalog.char_length(pg_catalog.btrim(p_owner_user_id)) not between 1 and 255
    or p_retention_hours not between 1 and 8760
  then
    raise exception 'studio_document_retention_invalid';
  end if;

  update public.cardforge_studio_documents
  set
    last_activity_at = coalesce(last_activity_at, updated_at),
    retention_hours = p_retention_hours,
    expires_at = greatest(
      coalesce(last_activity_at, updated_at)
        + pg_catalog.make_interval(hours => p_retention_hours),
      coalesce(retention_grace_until, '-infinity'::timestamptz)
    )
  where owner_user_id = p_owner_user_id
    and deleted_at is null
    and (
      retention_hours is distinct from p_retention_hours
      or last_activity_at is null
      or expires_at is null
    );
  get diagnostics affected = row_count;

  update public.cardforge_studio_documents
  set
    deleted_at = pg_catalog.now(),
    purge_after = pg_catalog.now() + interval '24 hours',
    purge_state = 'pending',
    purge_claimed_at = null
  where owner_user_id = p_owner_user_id
    and deleted_at is null
    and expires_at <= pg_catalog.now();
  get diagnostics expired = row_count;

  return affected + expired;
end;
$$;

create or replace function public.cardforge_touch_studio_document(
  p_owner_user_id text,
  p_document_id uuid,
  p_retention_hours integer
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_deadline timestamptz;
begin
  if pg_catalog.char_length(pg_catalog.btrim(p_owner_user_id)) not between 1 and 255
    or p_retention_hours not between 1 and 8760
  then
    raise exception 'studio_document_retention_invalid';
  end if;

  update public.cardforge_studio_documents
  set
    retention_hours = p_retention_hours,
    expires_at = greatest(
      coalesce(last_activity_at, updated_at)
        + pg_catalog.make_interval(hours => p_retention_hours),
      coalesce(retention_grace_until, '-infinity'::timestamptz)
    )
  where id = p_document_id
    and owner_user_id = p_owner_user_id
    and deleted_at is null
  returning expires_at into current_deadline;

  if current_deadline is null then
    return false;
  end if;

  if current_deadline <= pg_catalog.now() then
    update public.cardforge_studio_documents
    set
      deleted_at = pg_catalog.now(),
      purge_after = pg_catalog.now() + interval '24 hours',
      purge_state = 'pending',
      purge_claimed_at = null
    where id = p_document_id
      and owner_user_id = p_owner_user_id
      and deleted_at is null;
    return false;
  end if;

  update public.cardforge_studio_documents
  set
    last_activity_at = pg_catalog.now(),
    retention_hours = p_retention_hours,
    expires_at = pg_catalog.now() + pg_catalog.make_interval(hours => p_retention_hours),
    retention_grace_until = null
  where id = p_document_id
    and owner_user_id = p_owner_user_id
    and deleted_at is null;

  return found;
end;
$$;

create or replace function public.cardforge_authorize_assistant_draft_retention(
  p_secret text
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select extensions.digest(pg_catalog.convert_to(secret.decrypted_secret, 'UTF8'), 'sha256')
        = extensions.digest(pg_catalog.convert_to(p_secret, 'UTF8'), 'sha256')
      from vault.decrypted_secrets as secret
      where secret.name = 'assistant_draft_retention_cron_secret'
      limit 1
    ),
    false
  );
$$;

create or replace function public.cardforge_expire_studio_documents(
  p_limit integer default 250
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  affected integer := 0;
begin
  if p_limit not between 1 and 1000 then
    raise exception 'studio_document_expiry_limit_invalid';
  end if;

  with candidates as (
    select document.id
    from public.cardforge_studio_documents as document
    where document.deleted_at is null
      and document.expires_at is not null
      and document.expires_at <= pg_catalog.now()
    order by document.expires_at, document.id
    for update skip locked
    limit p_limit
  )
  update public.cardforge_studio_documents as document
  set
    deleted_at = pg_catalog.now(),
    purge_after = pg_catalog.now() + interval '24 hours',
    purge_state = 'pending',
    purge_claimed_at = null
  from candidates
  where document.id = candidates.id;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.cardforge_claim_studio_document_purges(
  p_limit integer default 100
)
returns table (
  document_id uuid,
  owner_user_id text
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_limit not between 1 and 250 then
    raise exception 'studio_document_purge_limit_invalid';
  end if;

  return query
  with candidates as (
    select document.id
    from public.cardforge_studio_documents as document
    where document.deleted_at is not null
      and document.purge_after <= pg_catalog.now()
      and (
        document.purge_state = 'pending'
        or (
          document.purge_state = 'processing'
          and document.purge_claimed_at < pg_catalog.now() - interval '15 minutes'
        )
      )
    order by document.purge_after, document.id
    for update skip locked
    limit p_limit
  )
  update public.cardforge_studio_documents as document
  set
    purge_state = 'processing',
    purge_claimed_at = pg_catalog.now()
  from candidates
  where document.id = candidates.id
  returning document.id, document.owner_user_id;
end;
$$;

create or replace function public.cardforge_finalize_studio_document_purge(
  p_owner_user_id text,
  p_document_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.cardforge_studio_documents
  where id = p_document_id
    and owner_user_id = p_owner_user_id
    and purge_state = 'processing'
    and purge_after <= pg_catalog.now();

  return found;
end;
$$;

create or replace function public.cardforge_release_studio_document_purge(
  p_owner_user_id text,
  p_document_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.cardforge_studio_documents
  set
    purge_state = 'pending',
    purge_claimed_at = null
  where id = p_document_id
    and owner_user_id = p_owner_user_id
    and purge_state = 'processing';

  return found;
end;
$$;

revoke execute on function public.cardforge_apply_studio_document_retention(text, integer)
  from public, anon, authenticated;
revoke execute on function public.cardforge_touch_studio_document(text, uuid, integer)
  from public, anon, authenticated;
revoke execute on function public.cardforge_expire_studio_documents(integer)
  from public, anon, authenticated;
revoke execute on function public.cardforge_claim_studio_document_purges(integer)
  from public, anon, authenticated;
revoke execute on function public.cardforge_finalize_studio_document_purge(text, uuid)
  from public, anon, authenticated;
revoke execute on function public.cardforge_release_studio_document_purge(text, uuid)
  from public, anon, authenticated;
revoke execute on function public.cardforge_authorize_assistant_draft_retention(text)
  from public, anon, authenticated;

grant execute on function public.cardforge_apply_studio_document_retention(text, integer)
  to service_role;
grant execute on function public.cardforge_touch_studio_document(text, uuid, integer)
  to service_role;
grant execute on function public.cardforge_expire_studio_documents(integer)
  to service_role;
grant execute on function public.cardforge_claim_studio_document_purges(integer)
  to service_role;
grant execute on function public.cardforge_finalize_studio_document_purge(text, uuid)
  to service_role;
grant execute on function public.cardforge_release_studio_document_purge(text, uuid)
  to service_role;
grant execute on function public.cardforge_authorize_assistant_draft_retention(text)
  to service_role;

do $schedule$
declare
  existing_job_id bigint;
begin
  if not exists (
    select 1
    from vault.decrypted_secrets
    where name = 'assistant_draft_retention_cron_secret'
  ) then
    perform vault.create_secret(
      pg_catalog.encode(extensions.gen_random_bytes(32), 'hex'),
      'assistant_draft_retention_cron_secret',
      'Dedicated least-privilege secret for the assistant draft retention worker.'
    );
  end if;

  if exists (select 1 from vault.decrypted_secrets where name = 'project_url')
    and exists (select 1 from vault.decrypted_secrets where name = 'publishable_key')
  then
    select jobid
    into existing_job_id
    from cron.job
    where jobname = 'cardforge-assistant-draft-retention';

    if existing_job_id is not null then
      perform cron.unschedule(existing_job_id);
    end if;

    perform cron.schedule(
      'cardforge-assistant-draft-retention',
      '*/15 * * * *',
      $job$
        select net.http_post(
          url := (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'project_url'
          ) || '/functions/v1/purge-assistant-drafts',
          headers := pg_catalog.jsonb_build_object(
            'Content-Type', 'application/json',
            'apikey', (
              select decrypted_secret
              from vault.decrypted_secrets
              where name = 'publishable_key'
            ),
            'X-CardForge-Cron-Secret', (
              select decrypted_secret
              from vault.decrypted_secrets
              where name = 'assistant_draft_retention_cron_secret'
            )
          ),
          body := '{}'::jsonb
        );
      $job$
    );
  else
    raise notice 'Assistant draft retention Cron was not scheduled because project_url or publishable_key is missing from Vault.';
  end if;
end
$schedule$;

do $legal_publication$
declare
  current_document record;
  current_identity_version bigint;
  old_privacy_retention text := $copy$Browser IndexedDB data remains until you clear it or the browser removes it, and downloaded project files remain until you delete them from the places where you saved them. Private assistant working documents and aggregate MCP usage remain in CardForge's platform records until they are deleted through an available account or support process, or retained for an operational, security, abuse-prevention, legal, or record-integrity need. Other platform and provider records are retained for periods that vary by record, operational need, legal obligation, and provider setting. Some billing, legal, voting, attribution, published-asset, aggregate usage, and security records may need to remain after an account is disabled or deleted to preserve accurate platform history and system integrity.$copy$;
  new_privacy_retention text := $copy$Browser IndexedDB data remains until you clear it or the browser removes it, and downloaded project files remain until you delete them from the places where you saved them. Private assistant working documents use an inactivity window tied to the current account plan: 12 hours for Free, 24 hours for Creator Pass, and 48 hours for Designer Pass and owner/developer accounts by default. Opening or updating a document restarts its window; merely listing documents on the Account page does not. The CardForge owner may adjust these plan windows in the Owner Console. An expired or manually deleted assistant document remains in recoverable trash for 24 hours, then CardForge permanently removes its stored document and private artwork. Aggregate MCP usage may remain for operational, security, abuse-prevention, legal, or record-integrity needs. Other platform and provider records are retained for periods that vary by record, operational need, legal obligation, and provider setting. Some billing, legal, voting, attribution, published-asset, aggregate usage, and security records may need to remain after an account is disabled or deleted to preserve accurate platform history and system integrity.$copy$;
  terms_anchor text := $copy$Your agreement for the service is with Cameron Locke as the legal operator of CardForge Studio. CardForge lets users create templates, generate previews, manage local projects, use connected assistant tools that create private cloud working documents, submit developer assets, and export content according to their account access. You are responsible for the content, artwork, data, trademarks, and intellectual property you bring into the tool or send through a connected assistant.$copy$;
  terms_retention text := $copy$Private assistant working documents are temporary collaboration storage, not permanent project backups. Their current inactivity window is shown with the applicable plan and in Account storage. Expired or manually deleted drafts remain recoverable for 24 hours before permanent removal. Keep portable project files or another copy of work you need to preserve.$copy$;
  old_pass_retention text := $copy$Keep your own project backups and review exported work before production. Availability, included features, usage limits, and pricing may change for future billing periods, subject to notice and applicable law. Cancellation stops future renewal and does not erase projects stored in your browser or files you downloaded.$copy$;
  new_pass_retention text := $copy$Keep your own project backups and review exported work before production. Private assistant draft retention follows the current plan presentation and is separate from permanent browser projects and downloaded project files. Availability, included features, usage limits, retention windows, and pricing may change for future billing periods, subject to notice and applicable law. Cancellation stops future renewal and does not erase projects stored in your browser or files you downloaded.$copy$;
begin
  select identity_version
  into current_identity_version
  from public.cardforge_business_identity
  where id = 'cardforge';

  if current_identity_version is null then
    raise exception 'cardforge_business_identity_required';
  end if;

  select * into current_document
  from public.cardforge_legal_documents
  where slug = 'privacy'
  order by version desc
  limit 1
  for update;

  if current_document is null or position(old_privacy_retention in current_document.body) = 0 then
    raise exception 'cardforge_privacy_publication_changed_before_draft_retention';
  end if;

  insert into public.cardforge_legal_documents (
    slug, version, title, body, effective_date, published_at, business_identity_version
  ) values (
    'privacy',
    current_document.version + 1,
    current_document.title,
    replace(current_document.body, old_privacy_retention, new_privacy_retention),
    date '2026-08-21',
    pg_catalog.now(),
    current_identity_version
  );

  select * into current_document
  from public.cardforge_legal_documents
  where slug = 'terms'
  order by version desc
  limit 1
  for update;

  if current_document is null or position(terms_anchor in current_document.body) = 0 then
    raise exception 'cardforge_terms_publication_changed_before_draft_retention';
  end if;

  insert into public.cardforge_legal_documents (
    slug, version, title, body, effective_date, published_at, business_identity_version
  ) values (
    'terms',
    current_document.version + 1,
    current_document.title,
    replace(current_document.body, terms_anchor, terms_anchor || E'\n\n' || terms_retention),
    date '2026-08-21',
    pg_catalog.now(),
    current_identity_version
  );

  select * into current_document
  from public.cardforge_legal_documents
  where slug = 'creator-pass-terms'
  order by version desc
  limit 1
  for update;

  if current_document is null or position(old_pass_retention in current_document.body) = 0 then
    raise exception 'cardforge_pass_terms_publication_changed_before_draft_retention';
  end if;

  insert into public.cardforge_legal_documents (
    slug, version, title, body, effective_date, published_at, business_identity_version
  ) values (
    'creator-pass-terms',
    current_document.version + 1,
    current_document.title,
    replace(current_document.body, old_pass_retention, new_pass_retention),
    date '2026-08-21',
    pg_catalog.now(),
    current_identity_version
  );
end
$legal_publication$;

comment on column public.cardforge_mcp_allowance_settings.draft_retention_hours is
  'Owner-controlled inactivity window for private assistant working drafts on this plan.';
comment on column public.cardforge_studio_documents.last_activity_at is
  'Last explicit document open or content update. Listing documents does not refresh activity.';
comment on column public.cardforge_studio_documents.purge_after is
  'End of the 24-hour recoverable trash window. Artwork and the document are removed together after this time.';

commit;
