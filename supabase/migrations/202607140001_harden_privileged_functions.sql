-- Privileged RPCs must be callable only by the server-side service client.
-- RLS does not protect SECURITY DEFINER functions from callers with EXECUTE.

revoke execute on function public.cardforge_claim_founder_beta(text, text)
  from public, anon, authenticated;
revoke execute on function public.cardforge_claim_founder_beta(text, text)
  from service_role;
grant execute on function public.cardforge_claim_founder_beta(text, text)
  to service_role;

-- This event-trigger helper is invoked by PostgreSQL, not through PostgREST.
revoke execute on function public.rls_auto_enable()
  from public, anon, authenticated;
revoke execute on function public.rls_auto_enable()
  from service_role;

-- Require every future function to opt in to Data API execution explicitly.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from service_role;
