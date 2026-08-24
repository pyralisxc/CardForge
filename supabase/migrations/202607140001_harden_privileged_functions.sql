-- Privileged RPCs must be callable only by the server-side service client.
-- RLS does not protect SECURITY DEFINER functions from callers with EXECUTE.

revoke execute on function public.cardforge_claim_founder_beta(text, text)
  from public, anon, authenticated;
revoke execute on function public.cardforge_claim_founder_beta(text, text)
  from service_role;
grant execute on function public.cardforge_claim_founder_beta(text, text)
  to service_role;

-- This event-trigger helper is invoked by PostgreSQL, not through PostgREST.
-- Older projects may have created it outside the repository; fresh projects do not.
do $$
begin
  if pg_catalog.to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated, service_role';
  end if;
end;
$$;

-- Require every future function to opt in to Data API execution explicitly.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from service_role;
