begin;

-- CARDFORGE_OWNER_STATE_WRITE: add an atomic compare-and-publish command for Owner-authored site copy; the function writes only when the caller proves the exact revision it read.

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
    on conflict (slug) do nothing
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

commit;
