begin;

-- The existing approval path creates a public 1080x1350 JPEG derivative.
-- Keep the social media bucket public and capped at 12 MiB; only extend its
-- allowed MIME types so the already-approved derivative can be uploaded.
do $$
declare
  social_bucket storage.buckets%rowtype;
begin
  select *
  into social_bucket
  from storage.buckets
  where id = 'cardforge-social-media'
  for update;

  if not found then
    raise exception 'cardforge_social_media_bucket_missing';
  end if;

  if social_bucket.public is distinct from true then
    raise exception 'cardforge_social_media_bucket_visibility_mismatch';
  end if;

  if social_bucket.file_size_limit is distinct from 12582912 then
    raise exception 'cardforge_social_media_bucket_size_limit_mismatch';
  end if;

  if social_bucket.allowed_mime_types is null
    or not ('image/webp' = any(social_bucket.allowed_mime_types)) then
    raise exception 'cardforge_social_media_bucket_webp_contract_mismatch';
  end if;

  if not ('image/jpeg' = any(social_bucket.allowed_mime_types)) then
    update storage.buckets
    set allowed_mime_types = (
      select array_agg(distinct mime_type order by mime_type)
      from unnest(social_bucket.allowed_mime_types || array['image/jpeg']::text[]) as allowed(mime_type)
    )
    where id = 'cardforge-social-media';
  end if;

  if not exists (
    select 1
    from storage.buckets
    where id = 'cardforge-social-media'
      and public is true
      and file_size_limit = 12582912
      and 'image/webp' = any(allowed_mime_types)
      and 'image/jpeg' = any(allowed_mime_types)
  ) then
    raise exception 'cardforge_social_media_bucket_jpeg_contract_failed';
  end if;
end;
$$;

commit;
