create schema if not exists cardforge_private;

revoke all on schema cardforge_private from public, anon;
grant usage on schema cardforge_private to authenticated;

create or replace function cardforge_private.can_use_collaboration_topic(
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

revoke all on function cardforge_private.can_use_collaboration_topic(text, boolean) from public, anon;
grant execute on function cardforge_private.can_use_collaboration_topic(text, boolean) to authenticated;

comment on function cardforge_private.can_use_collaboration_topic(text, boolean) is
  'Private Realtime authorization helper. Kept outside exposed API schemas so it can read server-owned collaboration membership without becoming a public RPC surface.';

drop policy if exists "cardforge collaboration receive" on realtime.messages;
create policy "cardforge collaboration receive"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension in ('broadcast', 'presence')
  and (select cardforge_private.can_use_collaboration_topic(realtime.topic(), false))
);

drop policy if exists "cardforge collaboration presence" on realtime.messages;
create policy "cardforge collaboration presence"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension = 'presence'
  and (select cardforge_private.can_use_collaboration_topic(realtime.topic(), false))
);

drop policy if exists "cardforge collaboration edit broadcast" on realtime.messages;
create policy "cardforge collaboration edit broadcast"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension = 'broadcast'
  and (select cardforge_private.can_use_collaboration_topic(realtime.topic(), true))
);

revoke all on function public.cardforge_can_use_collaboration_topic(text, boolean) from public, anon, authenticated;
drop function public.cardforge_can_use_collaboration_topic(text, boolean);
