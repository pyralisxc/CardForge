-- The hardened privilege baseline intentionally removed implicit grants from
-- future tables. On a fresh Supabase project, the server-owned tables created
-- before that baseline do not inherit service-role access either. Make their
-- existing CardForge server boundary explicit while keeping browser roles out.
revoke all privileges on table
  public.cardforge_asset_registry,
  public.cardforge_contact_requests,
  public.cardforge_developer_asset_submissions,
  public.cardforge_developer_asset_votes,
  public.cardforge_developer_profiles,
  public.cardforge_developer_program_settings,
  public.cardforge_owner_settings,
  public.cardforge_roadmap_items,
  public.cardforge_roadmap_votes,
  public.cardforge_site_content_blocks
from public, anon, authenticated;

grant all privileges on table
  public.cardforge_asset_registry,
  public.cardforge_contact_requests,
  public.cardforge_developer_asset_submissions,
  public.cardforge_developer_asset_votes,
  public.cardforge_developer_profiles,
  public.cardforge_developer_program_settings,
  public.cardforge_owner_settings,
  public.cardforge_roadmap_items,
  public.cardforge_roadmap_votes,
  public.cardforge_site_content_blocks
to service_role;
