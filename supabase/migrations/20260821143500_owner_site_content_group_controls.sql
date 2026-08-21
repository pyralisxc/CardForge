begin;

do $$
begin
  if to_regclass('public.cardforge_site_content_blocks') is null
    or to_regclass('public.cardforge_site_content_proposals') is null then
    raise exception 'cardforge_site_content_control_plane_required';
  end if;
end
$$;

alter table public.cardforge_site_content_blocks
  drop constraint if exists cardforge_site_content_blocks_slug_check;

alter table public.cardforge_site_content_blocks
  add constraint cardforge_site_content_blocks_slug_check check (
    slug ~ '^(shell|landing|plans|account|about|founder|developer|roadmap|sharing)\.[a-z0-9.-]+$'
  );

alter table public.cardforge_site_content_proposals
  drop constraint if exists cardforge_site_content_proposals_slug_check;

alter table public.cardforge_site_content_proposals
  add constraint cardforge_site_content_proposals_slug_check check (
    slug ~ '^(shell|landing|plans|account|about|founder|developer|roadmap|sharing)\.[a-z0-9.-]+$'
  );

comment on constraint cardforge_site_content_blocks_slug_check on public.cardforge_site_content_blocks is
  'Allowlisted public presentation groups editable through the CardForge owner content control plane.';

comment on constraint cardforge_site_content_proposals_slug_check on public.cardforge_site_content_proposals is
  'Allowlisted public presentation groups that may receive reviewable site-copy proposals.';

commit;
