begin;

set local lock_timeout = '5s';

create or replace function public.cardforge_publish_owner_template_revision(
  p_asset_id text,
  p_name text,
  p_description text,
  p_developer_id text,
  p_developer_email text,
  p_template_payload jsonb,
  p_expected_revision integer,
  p_submission_key text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  revision_id uuid;
begin
  revision_id := public.cardforge_submit_template_revision(
    p_asset_id,
    p_name,
    p_description,
    p_developer_id,
    p_developer_email,
    p_template_payload,
    p_expected_revision,
    p_submission_key
  );

  perform public.cardforge_set_developer_asset_owner_override(
    revision_id,
    true,
    'published',
    true,
    'free',
    'Published directly by the CardForge owner from Template Studio.',
    p_developer_id
  );

  return revision_id;
end;
$$;

revoke execute on function public.cardforge_publish_owner_template_revision(
  text, text, text, text, text, jsonb, integer, text
) from public, anon, authenticated;
grant execute on function public.cardforge_publish_owner_template_revision(
  text, text, text, text, text, jsonb, integer, text
) to service_role;

comment on function public.cardforge_publish_owner_template_revision(
  text, text, text, text, text, jsonb, integer, text
) is 'Atomically records and publishes one idempotent owner-authored Template revision while retaining revision history.';

commit;
