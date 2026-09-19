create table if not exists public.cardforge_collaboration_sessions (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider = 'google-drive'),
  provider_file_id text not null check (char_length(btrim(provider_file_id)) between 8 and 255),
  work_id text null check (work_id is null or char_length(btrim(work_id)) between 1 and 128),
  created_by_user_id text not null check (char_length(btrim(created_by_user_id)) between 1 and 255),
  status text not null default 'active' check (status in ('active', 'conflict', 'closed', 'expired')),
  base_provider_revision text not null check (char_length(btrim(base_provider_revision)) between 1 and 160),
  base_project_revision text not null check (char_length(btrim(base_project_revision)) between 1 and 160),
  checkpoint_provider_revision text not null check (char_length(btrim(checkpoint_provider_revision)) between 1 and 160),
  checkpoint_project_revision text not null check (char_length(btrim(checkpoint_project_revision)) between 1 and 160),
  crdt_state text null check (crdt_state is null or char_length(crdt_state) <= 5600000),
  crdt_version bigint not null default 0 check (crdt_version >= 0),
  last_activity_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '8 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.cardforge_collaboration_sessions is
  'Ephemeral authenticated collaboration rooms for provider-owned CardForge work. Drive remains the durable project owner; crdt_state is temporary session continuity only.';

comment on column public.cardforge_collaboration_sessions.crdt_state is
  'Base64url-encoded bounded merged Yjs state for reconnect continuity. It is not a durable creator backup and must never outlive the collaboration retention boundary.';

create unique index if not exists cardforge_collaboration_one_active_provider_file
  on public.cardforge_collaboration_sessions (provider, provider_file_id)
  where status = 'active';

create index if not exists cardforge_collaboration_session_expiry_idx
  on public.cardforge_collaboration_sessions (status, expires_at);

create table if not exists public.cardforge_collaboration_members (
  session_id uuid not null references public.cardforge_collaboration_sessions(id) on delete cascade,
  user_id text not null check (char_length(btrim(user_id)) between 1 and 255),
  role text not null check (role in ('viewer', 'editor')),
  provider_account_id text not null check (char_length(btrim(provider_account_id)) between 1 and 255),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  left_at timestamptz null,
  primary key (session_id, user_id)
);

comment on table public.cardforge_collaboration_members is
  'Server-verified collaboration membership. Every participant must independently authorize the same provider file; one participant OAuth grant never authorizes another.';

create index if not exists cardforge_collaboration_members_user_idx
  on public.cardforge_collaboration_members (user_id, session_id)
  where left_at is null;

alter table public.cardforge_collaboration_sessions enable row level security;
alter table public.cardforge_collaboration_members enable row level security;

revoke all on public.cardforge_collaboration_sessions from public, anon, authenticated;
revoke all on public.cardforge_collaboration_members from public, anon, authenticated;
grant all on public.cardforge_collaboration_sessions to service_role;
grant all on public.cardforge_collaboration_members to service_role;

create or replace function public.cardforge_can_use_collaboration_topic(
  p_topic text,
  p_require_editor boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1
    from public.cardforge_collaboration_sessions s
    join public.cardforge_collaboration_members m on m.session_id = s.id
    where p_topic = 'cardforge-collaboration:' || s.id::text
      and s.status = 'active'
      and s.expires_at > pg_catalog.now()
      and m.left_at is null
      and m.user_id = coalesce((select auth.jwt()->>'sub'), '')
      and (not p_require_editor or m.role = 'editor')
  );
$$;

revoke all on function public.cardforge_can_use_collaboration_topic(text, boolean) from public;
grant execute on function public.cardforge_can_use_collaboration_topic(text, boolean) to authenticated;

drop policy if exists "cardforge collaboration receive" on realtime.messages;
create policy "cardforge collaboration receive"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension in ('broadcast', 'presence')
  and (select public.cardforge_can_use_collaboration_topic(realtime.topic(), false))
);

drop policy if exists "cardforge collaboration presence" on realtime.messages;
create policy "cardforge collaboration presence"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension = 'presence'
  and (select public.cardforge_can_use_collaboration_topic(realtime.topic(), false))
);

drop policy if exists "cardforge collaboration edit broadcast" on realtime.messages;
create policy "cardforge collaboration edit broadcast"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension = 'broadcast'
  and (select public.cardforge_can_use_collaboration_topic(realtime.topic(), true))
);
