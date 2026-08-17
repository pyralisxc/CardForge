create table public.cardforge_studio_documents (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null check (char_length(owner_user_id) between 1 and 255),
  title text not null check (char_length(title) between 1 and 160),
  creation_source text not null default 'studio' check (creation_source in ('studio', 'gpt', 'import')),
  document_version integer not null default 1 check (document_version = 1),
  document_payload jsonb not null check (
    jsonb_typeof(document_payload) = 'object'
    and document_payload ->> 'version' = '1'
  ),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cardforge_studio_documents_owner_updated_idx
  on public.cardforge_studio_documents (owner_user_id, updated_at desc, id);

drop trigger if exists cardforge_studio_documents_touch_updated_at
  on public.cardforge_studio_documents;
create trigger cardforge_studio_documents_touch_updated_at
  before update on public.cardforge_studio_documents
  for each row execute function public.cardforge_touch_updated_at();

alter table public.cardforge_studio_documents enable row level security;

revoke all privileges on public.cardforge_studio_documents
  from public, anon, authenticated;
grant all privileges on public.cardforge_studio_documents
  to service_role;

comment on table public.cardforge_studio_documents is
  'Private account-owned editable Studio documents. Clerk identity is authorized by CardForge server routes; browser roles have no direct table access.';
comment on column public.cardforge_studio_documents.owner_user_id is
  'Immutable Clerk user id used by server-side ownership checks.';
comment on column public.cardforge_studio_documents.document_payload is
  'Canonical editable CardForge project document; watermark eligibility is resolved from current account entitlement and is never persisted here.';
