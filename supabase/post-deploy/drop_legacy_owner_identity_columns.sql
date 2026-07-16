-- Manual post-deploy cleanup. Do not place this file in supabase/migrations.
-- Preconditions and execution order are documented in this directory's README.

begin;

do $$
begin
  if to_regclass('public.cardforge_business_identity') is null then
    raise exception 'cardforge_business_identity must exist before legacy cleanup';
  end if;

  if not exists (
    select 1
    from public.cardforge_business_identity
    where id = 'cardforge'
      and brand_name = 'CardForge Studio'
      and legal_operator_name = 'Cameron Locke'
      and entity_type = 'sole_proprietor'
      and jurisdiction_state = 'Oregon'
      and jurisdiction_country = 'United States'
      and assumed_business_name_status = 'unverified'
  ) then
    raise exception 'approved CardForge business identity does not match the cleanup guard';
  end if;
end;
$$;

alter table public.cardforge_owner_settings
  drop column business_name,
  drop column owner_name,
  drop column support_email,
  drop column support_phone,
  drop column website_url;

commit;
