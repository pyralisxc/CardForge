begin;

set local lock_timeout = '5s';

-- The previous forward migration establishes the final single-owner schema. Keep
-- one explicit compatibility projection until that runtime is production READY;
-- the current production catalog still reads metadata.template.
create or replace function public.cardforge_preserve_template_registry_runtime_compatibility()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  template_payload jsonb;
begin
  if new.asset_type = 'template' and new.developer_submission_id is not null then
    select submission.source_payload
    into template_payload
    from public.cardforge_developer_asset_submissions as submission
    where submission.id = new.developer_submission_id
      and submission.asset_type = 'templates';

    if pg_catalog.jsonb_typeof(template_payload) = 'object' then
      new.metadata := coalesce(new.metadata, '{}'::jsonb)
        || pg_catalog.jsonb_build_object('template', template_payload);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists cardforge_asset_registry_preserve_template_runtime_compatibility
  on public.cardforge_asset_registry;
create trigger cardforge_asset_registry_preserve_template_runtime_compatibility
  before insert or update of asset_type, developer_submission_id, metadata
  on public.cardforge_asset_registry
  for each row
  execute function public.cardforge_preserve_template_registry_runtime_compatibility();

revoke execute on function public.cardforge_preserve_template_registry_runtime_compatibility()
  from public, anon, authenticated;
grant execute on function public.cardforge_preserve_template_registry_runtime_compatibility()
  to service_role;

update public.cardforge_asset_registry as registry
set metadata = registry.metadata || pg_catalog.jsonb_build_object('template', submission.source_payload)
from public.cardforge_developer_asset_submissions as submission
where registry.asset_type = 'template'
  and registry.developer_submission_id = submission.id
  and pg_catalog.jsonb_typeof(submission.source_payload) = 'object';

comment on function public.cardforge_preserve_template_registry_runtime_compatibility() is
  'Temporary one-release projection for the pre-cut production runtime. Drop after the submission-owned runtime is production READY and legacy media is migrated.';

commit;
