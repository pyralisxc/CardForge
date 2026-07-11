create table if not exists public.cardforge_contact_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('support', 'developer')),
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  page_url text,
  status text not null default 'received' check (status in ('received', 'emailed', 'email_failed', 'closed')),
  resend_email_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists cardforge_contact_requests_touch_updated_at on public.cardforge_contact_requests;
create trigger cardforge_contact_requests_touch_updated_at
  before update on public.cardforge_contact_requests
  for each row
  execute function public.cardforge_touch_updated_at();

alter table public.cardforge_contact_requests enable row level security;
