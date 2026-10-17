begin;

-- CARDFORGE_OWNER_STATE_WRITE: repair first publication without changing existing Owner copy; the native regression uses one transaction-local, uniquely named fixture and removes it before commit.

create or replace function public.cardforge_publish_site_content_block(
  p_slug text,
  p_body text,
  p_expected_updated_at timestamptz
)
returns table (
  slug text,
  body text,
  updated_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  changed public.cardforge_site_content_blocks%rowtype;
begin
  if nullif(pg_catalog.btrim(coalesce(p_slug, '')), '') is null
    or nullif(pg_catalog.btrim(coalesce(p_body, '')), '') is null
  then
    raise exception 'invalid_site_content_block';
  end if;

  if p_expected_updated_at is null then
    insert into public.cardforge_site_content_blocks (slug, body, updated_at)
    values (p_slug, p_body, pg_catalog.now())
    -- The TABLE return column named slug is also a PL/pgSQL variable.
    -- Name the existing primary key rather than an ambiguous column target.
    on conflict on constraint cardforge_site_content_blocks_pkey do nothing
    returning * into changed;

    if not found then
      raise exception 'site_content_conflict';
    end if;
  else
    update public.cardforge_site_content_blocks
    set body = p_body
    where cardforge_site_content_blocks.slug = p_slug
      and cardforge_site_content_blocks.updated_at = p_expected_updated_at
    returning * into changed;

    if not found then
      if exists (
        select 1
        from public.cardforge_site_content_blocks existing
        where existing.slug = p_slug
      ) then
        raise exception 'site_content_conflict';
      end if;
      raise exception 'site_content_not_found';
    end if;
  end if;

  return query
  select changed.slug, changed.body, changed.updated_at;
end;
$$;

revoke execute on function public.cardforge_publish_site_content_block(text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.cardforge_publish_site_content_block(text, text, timestamptz)
  to service_role;

comment on function public.cardforge_publish_site_content_block(text, text, timestamptz)
  is 'Atomically publishes one Owner-authored site copy block only when its expected updated_at revision still matches; null expected revision may create only a currently missing block.';

-- Exercise the actual PostgreSQL function, not a mocked RPC or SQL-text check.
-- Any regression rolls back this repair; the disposable row never survives.
do $publication_regression$
declare
  fixture_slug text := 'landing.owner-publication-regression-' || gen_random_uuid()::text;
  committed public.cardforge_site_content_blocks%rowtype;
begin
  select * into strict committed
  from public.cardforge_publish_site_content_block(fixture_slug, 'First publication fixture', null);
  if committed.slug <> fixture_slug or committed.body <> 'First publication fixture'
    or committed.updated_at is null then
    raise exception 'first_publication_regression';
  end if;

  begin
    perform * from public.cardforge_publish_site_content_block(fixture_slug, 'Duplicate fixture', null);
    raise exception 'missing_first_publication_conflict';
  exception when raise_exception then
    if sqlerrm <> 'site_content_conflict' then raise; end if;
  end;

  select * into strict committed
  from public.cardforge_publish_site_content_block(fixture_slug, 'Current revision fixture', committed.updated_at);
  if committed.body <> 'Current revision fixture' then
    raise exception 'current_revision_publication_regression';
  end if;

  begin
    perform * from public.cardforge_publish_site_content_block(
      fixture_slug, 'Stale fixture', committed.updated_at - interval '1 microsecond'
    );
    raise exception 'missing_stale_publication_conflict';
  exception when raise_exception then
    if sqlerrm <> 'site_content_conflict' then raise; end if;
  end;

  begin
    perform * from public.cardforge_publish_site_content_block(fixture_slug || '-missing', 'Missing fixture', committed.updated_at);
    raise exception 'missing_publication_not_found';
  exception when raise_exception then
    if sqlerrm <> 'site_content_not_found' then raise; end if;
  end;

  begin
    perform * from public.cardforge_publish_site_content_block(fixture_slug, '   ', committed.updated_at);
    raise exception 'missing_publication_validation';
  exception when raise_exception then
    if sqlerrm <> 'invalid_site_content_block' then raise; end if;
  end;

  if not exists (
    select 1 from public.cardforge_site_content_blocks
    where slug = fixture_slug and body = 'Current revision fixture'
  ) then
    raise exception 'rejected_publication_changed_owner_copy';
  end if;
  delete from public.cardforge_site_content_blocks where slug = fixture_slug;
end;
$publication_regression$;

commit;
