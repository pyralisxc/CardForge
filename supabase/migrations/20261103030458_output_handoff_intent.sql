-- Private immutable Output intent metadata. This stores no generated files and
-- never changes the authored Studio document or its revision.
create table public.cardforge_studio_output_intents (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null check (char_length(owner_user_id) between 1 and 255),
  document_id uuid not null references public.cardforge_studio_documents(id) on delete cascade,
  document_revision integer not null check (document_revision > 0),
  intent jsonb not null check (jsonb_typeof(intent) = 'object' and octet_length(intent::text) <= 16777216),
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  check (expires_at > created_at and expires_at <= created_at + interval '24 hours'),
  check (coalesce(intent ->> 'documentId' = document_id::text and intent ->> 'revision' = document_revision::text, false)),
  check (case when jsonb_typeof(intent -> 'cardIds') = 'array'
    then jsonb_array_length(intent -> 'cardIds') between 1 and 10000 else false end)
);
alter table public.cardforge_studio_output_intents enable row level security;
revoke all on public.cardforge_studio_output_intents from public, anon, authenticated;
grant select, insert, delete on public.cardforge_studio_output_intents to service_role;
create index cardforge_studio_output_intents_expiry_idx on public.cardforge_studio_output_intents(owner_user_id, expires_at, id);

-- Serialize the revision check with document updates; a reference cannot be
-- prepared against a revision that was already replaced or deleted.
create function public.cardforge_prepare_studio_output_intent(
  p_owner_user_id text, p_document_id uuid, p_revision integer, p_intent jsonb, p_fingerprint text
) returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_id uuid; v_document_expiry timestamptz;
begin
  select expires_at into v_document_expiry from public.cardforge_studio_documents
    where id = p_document_id and owner_user_id = p_owner_user_id
      and revision = p_revision and deleted_at is null and expires_at > now()
    for share;
  if not found then return null; end if;
  -- Bounded opportunistic maintenance for this actor only. Dormant rows are
  -- also removed by the existing parent-document purge through the FK.
  delete from public.cardforge_studio_output_intents where id in (
    select id from public.cardforge_studio_output_intents
      where owner_user_id = p_owner_user_id and expires_at <= now()
      order by expires_at, id limit 100
  );
  insert into public.cardforge_studio_output_intents(owner_user_id, document_id, document_revision, intent, fingerprint, expires_at)
    values (p_owner_user_id, p_document_id, p_revision, p_intent, p_fingerprint, least(v_document_expiry, now() + interval '24 hours')) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.cardforge_prepare_studio_output_intent(text, uuid, integer, jsonb, text) from public, anon, authenticated;
grant execute on function public.cardforge_prepare_studio_output_intent(text, uuid, integer, jsonb, text) to service_role;
comment on table public.cardforge_studio_output_intents is 'Expiring immutable private Output handoff metadata; never generated files or publication authority.';
