-- Website Editions: append-only presentation history, one atomic live pointer.
-- Forward-only; ROOT must coordinate application against the exact Staging migration head.
create table if not exists public.cardforge_website_editions (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(btrim(name)) between 1 and 100),
 created_at timestamptz not null default now(),
 archived_at timestamptz null
);
create table if not exists public.cardforge_website_revisions (
 id uuid primary key default gen_random_uuid(),
 edition_id uuid not null references public.cardforge_website_editions(id) on delete restrict,
 ordinal bigint not null check (ordinal > 0),
 schema_version integer not null check (schema_version > 0),
 manifest jsonb not null,
 created_by text not null,
 created_at timestamptz not null default now(),
 operation_id uuid not null unique,
 unique(edition_id, ordinal)
);
create table if not exists public.cardforge_website_revision_media (
 revision_id uuid not null references public.cardforge_website_revisions(id) on delete restrict,
 storage_path text not null,
 sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
 primary key (revision_id, storage_path)
);
create table if not exists public.cardforge_website_state (
 id text primary key check (id = 'cardforge'),
 live_revision_id uuid null references public.cardforge_website_revisions(id) on delete restrict,
 generation bigint not null default 0 check (generation >= 0)
);
create table if not exists public.cardforge_website_activations (
 id uuid primary key default gen_random_uuid(),
 revision_id uuid not null references public.cardforge_website_revisions(id) on delete restrict,
 previous_revision_id uuid null references public.cardforge_website_revisions(id) on delete restrict,
 generation bigint not null unique,
 actor text not null,
 operation_id uuid not null unique,
 url_disposition jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
insert into public.cardforge_website_state (id) values ('cardforge') on conflict (id) do nothing;

alter table public.cardforge_website_editions enable row level security;
alter table public.cardforge_website_revisions enable row level security;
alter table public.cardforge_website_revision_media enable row level security;
alter table public.cardforge_website_state enable row level security;
alter table public.cardforge_website_activations enable row level security;
revoke all on public.cardforge_website_editions, public.cardforge_website_revisions,
 public.cardforge_website_revision_media, public.cardforge_website_state,
 public.cardforge_website_activations from public, anon, authenticated;

-- Only the existing server-side service-role boundary may call these routines.
create or replace function public.cardforge_website_save_revision(
 p_edition_id uuid, p_expected_revision_id uuid, p_operation_id uuid,
 p_actor text, p_manifest jsonb, p_media jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_current uuid; v_existing uuid; v_revision uuid; v_ordinal bigint;
begin
 if p_actor is null or btrim(p_actor) = '' or p_manifest is null
    or jsonb_typeof(p_manifest) <> 'object' or jsonb_typeof(p_media) <> 'array' then
   raise exception 'website_invalid_input';
 end if;
 -- Lock the stable edition row, serializing independent Save requests.
 perform 1 from public.cardforge_website_editions where id=p_edition_id and archived_at is null for update;
 if not found then raise exception 'website_edition_unavailable'; end if;
 select id into v_existing from public.cardforge_website_revisions where operation_id=p_operation_id;
 if v_existing is not null then
   if not exists(select 1 from public.cardforge_website_revisions
       where id=v_existing and edition_id=p_edition_id and manifest=p_manifest) then
     raise exception 'website_operation_conflict';
   end if;
   return v_existing;
 end if;
 select id into v_current from public.cardforge_website_revisions
   where edition_id=p_edition_id order by ordinal desc limit 1;
 if v_current is distinct from p_expected_revision_id then raise exception 'website_revision_conflict'; end if;
 select coalesce(max(ordinal),0)+1 into v_ordinal
   from public.cardforge_website_revisions where edition_id=p_edition_id;
 insert into public.cardforge_website_revisions
   (edition_id,ordinal,schema_version,manifest,created_by,operation_id)
   values(p_edition_id,v_ordinal,(p_manifest->>'schemaVersion')::integer,p_manifest,p_actor,p_operation_id)
   returning id into v_revision;
 insert into public.cardforge_website_revision_media(revision_id,storage_path,sha256)
   select v_revision, value->>'storagePath', value->>'sha256'
   from jsonb_array_elements(p_media) as value
   where value->>'storagePath' is not null;
 return v_revision;
end $$;
create or replace function public.cardforge_website_activate(
 p_revision_id uuid, p_expected_generation bigint, p_operation_id uuid, p_actor text,
 p_url_disposition jsonb
) returns bigint language plpgsql security invoker set search_path = '' as $$
declare v_live uuid; v_generation bigint; v_existing bigint; v_prior_disposition jsonb;
begin
 if p_actor is null or btrim(p_actor) = '' or jsonb_typeof(p_url_disposition) <> 'object' then raise exception 'website_invalid_input'; end if;
 select generation into v_existing from public.cardforge_website_activations where operation_id=p_operation_id;
 if v_existing is not null then
   if not exists(select 1 from public.cardforge_website_activations where operation_id=p_operation_id
     and revision_id=p_revision_id and url_disposition=p_url_disposition) then raise exception 'website_operation_conflict'; end if;
   return v_existing;
 end if;
 select live_revision_id,generation into v_live,v_generation
 from public.cardforge_website_state where id='cardforge' for update;
 if v_generation is distinct from p_expected_generation then raise exception 'website_activation_conflict'; end if;
 if not exists(select 1 from public.cardforge_website_revisions r
    join public.cardforge_website_editions e on e.id=r.edition_id
    where r.id=p_revision_id and e.archived_at is null) then
    raise exception 'website_revision_unavailable';
 end if;
 select coalesce(url_disposition,'{}'::jsonb) into v_prior_disposition
 from public.cardforge_website_activations where generation=v_generation;
 p_url_disposition := coalesce(v_prior_disposition,'{}'::jsonb) || p_url_disposition;
 update public.cardforge_website_state
 set live_revision_id=p_revision_id,generation=v_generation+1 where id='cardforge';
 insert into public.cardforge_website_activations
 (revision_id,previous_revision_id,generation,actor,operation_id,url_disposition)
 values(p_revision_id,v_live,v_generation+1,p_actor,p_operation_id,p_url_disposition);
 return v_generation+1;
end $$;
revoke all on function public.cardforge_website_save_revision(uuid,uuid,uuid,text,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.cardforge_website_activate(uuid,bigint,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.cardforge_website_save_revision(uuid,uuid,uuid,text,jsonb,jsonb) to service_role;
grant execute on function public.cardforge_website_activate(uuid,bigint,uuid,text,jsonb) to service_role;
grant all on public.cardforge_website_editions, public.cardforge_website_revisions,
 public.cardforge_website_revision_media, public.cardforge_website_state,
 public.cardforge_website_activations to service_role;

-- Existing flat stores become non-writable for presentation after the first
-- exact activation. Domain columns on the owner settings row remain writable.
create or replace function public.cardforge_website_reject_legacy_presentation()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare v_active boolean;
begin
 select live_revision_id is not null into v_active
 from public.cardforge_website_state where id='cardforge';
 if not coalesce(v_active,false) then
   if TG_OP = 'DELETE' then return old; end if;
   return new;
 end if;
 if TG_TABLE_NAME = 'cardforge_owner_settings' and TG_OP = 'UPDATE' then
   if (select jsonb_object_agg(k, to_jsonb(old)->k)
     from unnest(array['announcement_enabled','announcement_message',
       'primary_cta_label','primary_cta_href','support_offer_visible',
       'homepage_title','homepage_description','search_keywords',
       'watermark_preview_opacity','watermark_share_opacity','watermark_width_percent',
       'primary_navigation','homepage_sections','site_pages']) as k)
     is not distinct from
     (select jsonb_object_agg(k, to_jsonb(new)->k)
     from unnest(array['announcement_enabled','announcement_message',
       'primary_cta_label','primary_cta_href','support_offer_visible',
       'homepage_title','homepage_description','search_keywords',
       'watermark_preview_opacity','watermark_share_opacity','watermark_width_percent',
       'primary_navigation','homepage_sections','site_pages']) as k) then
       return new;
   end if;
 end if;
 raise exception 'website_legacy_writer_disabled';
end $$;
create trigger cardforge_site_content_editions_writer_guard
before insert or update or delete on public.cardforge_site_content_blocks
for each row execute function public.cardforge_website_reject_legacy_presentation();
create trigger cardforge_site_media_editions_writer_guard
before insert or update or delete on public.cardforge_site_media
for each row execute function public.cardforge_website_reject_legacy_presentation();
create trigger cardforge_site_config_editions_writer_guard
before update on public.cardforge_owner_settings
for each row execute function public.cardforge_website_reject_legacy_presentation();

-- Revision identities, bodies and dependencies are immutable, including for
-- service-role clients. Restores create activations, never UPDATEs.
create or replace function public.cardforge_website_reject_history_mutation()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin raise exception 'website_history_immutable'; end $$;
create trigger cardforge_website_revisions_immutable
before update or delete on public.cardforge_website_revisions
for each row execute function public.cardforge_website_reject_history_mutation();
create trigger cardforge_website_media_immutable
before update or delete on public.cardforge_website_revision_media
for each row execute function public.cardforge_website_reject_history_mutation();
create trigger cardforge_website_activations_immutable
before update or delete on public.cardforge_website_activations
for each row execute function public.cardforge_website_reject_history_mutation();

-- Inactive editions may be archived; active editions and all history survive.
create or replace function public.cardforge_website_archive_edition(p_edition_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
 perform 1 from public.cardforge_website_state where id='cardforge' for update;
 if exists(select 1 from public.cardforge_website_state s
   join public.cardforge_website_revisions r on r.id=s.live_revision_id
   where r.edition_id=p_edition_id) then raise exception 'website_edition_active'; end if;
 update public.cardforge_website_editions set archived_at=now()
 where id=p_edition_id and archived_at is null;
 return found;
end $$;
revoke all on function public.cardforge_website_archive_edition(uuid) from public,anon,authenticated;
grant execute on function public.cardforge_website_archive_edition(uuid) to service_role;

-- First cutover is explicit and atomic: snapshot validated legacy output and
-- activate Current Website only when source revision tokens still match.
-- Root coordinates the migration and first invocation; no migration-time
-- content mutation or unauthenticated browser write occurs.
create or replace function public.cardforge_website_initialize(
 p_manifest jsonb, p_media jsonb, p_config_epoch text,
 p_copy_epochs jsonb, p_media_epochs jsonb, p_operation_id uuid, p_actor text
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_revision uuid; v_config_epoch timestamptz;
 v_existing uuid;
begin
 if p_manifest is null or jsonb_typeof(p_manifest) <> 'object'
   or jsonb_typeof(p_media) <> 'array'
   or p_actor is null or btrim(p_actor) = '' then raise exception 'website_invalid_input'; end if;
 -- Lock flat owners before validating source tokens. A stale snapshot cannot
 -- cross this gate even if it was assembled before another publication.
 lock table public.cardforge_owner_settings, public.cardforge_site_content_blocks,
   public.cardforge_site_media in share mode;
 select live_revision_id into v_existing from public.cardforge_website_state
 where id='cardforge' for update;
 if v_existing is not null then
   if exists(select 1 from public.cardforge_website_activations a where a.operation_id=p_operation_id
        and a.revision_id=v_existing) then return v_existing; end if;
   raise exception 'website_already_initialized';
 end if;
 select updated_at into v_config_epoch from public.cardforge_owner_settings where id='cardforge';
 if v_config_epoch is distinct from p_config_epoch::timestamptz
   or jsonb_typeof(p_copy_epochs) <> 'object'
   or jsonb_typeof(p_media_epochs) <> 'object'
   or exists (
     select 1 from public.cardforge_site_content_blocks b
     where (p_copy_epochs->>b.slug)::timestamptz is distinct from b.updated_at
   )
   or exists (
     select 1 from jsonb_object_keys(p_copy_epochs) slug
     where not exists(select 1 from public.cardforge_site_content_blocks b where b.slug=slug)
   )
   or exists (
     select 1 from public.cardforge_site_media m
     where (p_media_epochs->>m.slot)::timestamptz is distinct from m.updated_at
   )
   or exists (
     select 1 from jsonb_object_keys(p_media_epochs) slot
     where not exists(select 1 from public.cardforge_site_media m where m.slot=slot)
   ) then
   raise exception 'website_bootstrap_conflict';
 end if;
 insert into public.cardforge_website_editions(name) values('Current Website') returning id into v_id;
 insert into public.cardforge_website_revisions
  (edition_id,ordinal,schema_version,manifest,created_by,operation_id)
 values(v_id,1,(p_manifest->>'schemaVersion')::integer,p_manifest,p_actor,p_operation_id)
 returning id into v_revision;
 insert into public.cardforge_website_revision_media(revision_id,storage_path,sha256)
 select v_revision, value->>'storagePath', value->>'sha256'
 from jsonb_array_elements(p_media) as value
 where value->>'storagePath' is not null;
 update public.cardforge_website_state set live_revision_id=v_revision,generation=1 where id='cardforge';
 insert into public.cardforge_website_activations
 (revision_id,previous_revision_id,generation,actor,operation_id)
 values(v_revision,null,1,p_actor,p_operation_id);
 return v_revision;
end $$;
revoke all on function public.cardforge_website_initialize(jsonb,jsonb,text,jsonb,jsonb,uuid,text)
  from public,anon,authenticated;
grant execute on function public.cardforge_website_initialize(jsonb,jsonb,text,jsonb,jsonb,uuid,text)
  to service_role;

-- Public history is intentionally narrower than private revision history.
-- Only media from an activation can be resolved through an old public URL.
create or replace function public.cardforge_website_activated_media_version(p_slot text,p_path text)
returns table(storage_path text, sha256 text)
language sql security invoker set search_path = '' stable as $$
 select m.storage_path, m.sha256
 from public.cardforge_website_revision_media m
 join public.cardforge_website_activations a on a.revision_id=m.revision_id
 join public.cardforge_website_revisions r on r.id=m.revision_id
 where m.storage_path=p_path
  and exists (
    select 1 from jsonb_array_elements(r.manifest->'media') item
    where item->>'slot'=p_slot and item->>'storagePath'=p_path
      and item->>'sha256'=m.sha256
  )
 limit 1
$$;
revoke all on function public.cardforge_website_activated_media_version(text,text)
 from public,anon,authenticated;
grant execute on function public.cardforge_website_activated_media_version(text,text) to service_role;
