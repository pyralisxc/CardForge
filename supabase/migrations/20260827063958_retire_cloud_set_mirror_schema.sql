do $$
begin
  if exists (select 1 from public.cardforge_cloud_sets limit 1) then
    raise exception 'cardforge_cloud_set_mirrors_must_be_empty_before_retirement';
  end if;

  if exists (
    select 1
    from public.cardforge_studio_documents
    where source_cloud_set_id is not null
       or source_cloud_revision is not null
    limit 1
  ) then
    raise exception 'cardforge_cloud_set_lineage_must_be_empty_before_retirement';
  end if;
end;
$$;

alter table public.cardforge_studio_documents
  drop constraint if exists cardforge_studio_documents_source_cloud_revision_check,
  drop column source_cloud_set_id,
  drop column source_cloud_revision;

drop table public.cardforge_cloud_sets;
