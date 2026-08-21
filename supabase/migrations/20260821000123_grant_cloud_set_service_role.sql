-- Hardened default privileges intentionally require each server-owned table to
-- opt the service role back in. Cloud set access remains mediated by CardForge
-- server routes; browser roles receive no direct table privileges.
revoke all privileges on table public.cardforge_cloud_sets
  from public, anon, authenticated;

grant select, insert, update, delete on table public.cardforge_cloud_sets
  to service_role;
