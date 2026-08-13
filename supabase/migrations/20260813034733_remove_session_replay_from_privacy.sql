begin;

select pg_advisory_xact_lock(hashtext('cardforge_privacy_remove_session_replay'));

do $migration$
declare
  current_publication record;
  current_identity_version bigint;
  old_replay_disclosure text := $old_replay_disclosure$PostHog session replay may run only on public informational pages. All visible text and form inputs are masked in the browser before replay data is sent; query strings, request and response headers and bodies, cross-origin frames, and canvas contents are excluded. Studio, sign-in, account, profile, owner, and developer-cockpit pages are never recorded. Card content, project or design names, account names, email addresses, uploaded files, non-campaign query values, and raw private workspace content are not sent as analytics properties. CardForge does not enable Google advertising storage, Google Signals, ad personalization, or Enhanced Measurement. Google and PostHog control the resulting analytics records under their own processing and retention practices; CardForge reads owner-only reports but does not copy raw visitor events into Supabase. Learn more in Google's privacy policy at https://policies.google.com/privacy and PostHog's privacy information at https://posthog.com/privacy.$old_replay_disclosure$;
  new_event_disclosure text := $new_event_disclosure$CardForge does not use PostHog session replay. PostHog receives only the allow-listed event properties described above; it does not receive recordings of page content, text, form inputs, card content, project or design names, account names, email addresses, uploaded files, non-campaign query values, or raw private workspace content. CardForge does not enable Google advertising storage, Google Signals, ad personalization, or Enhanced Measurement. Google and PostHog control the resulting analytics records under their own processing and retention practices; CardForge reads owner-only reports but does not copy raw visitor events into Supabase. Learn more in Google's privacy policy at https://policies.google.com/privacy and PostHog's privacy information at https://posthog.com/privacy.$new_event_disclosure$;
begin
  if to_regclass('public.cardforge_legal_documents') is null then
    raise exception 'cardforge_versioned_legal_publications_required';
  end if;

  select *
  into current_publication
  from public.cardforge_legal_documents
  where slug = 'privacy'
  order by version desc
  limit 1
  for update;

  if current_publication is null then
    raise exception 'cardforge_privacy_publication_required';
  end if;

  if position('CardForge does not use PostHog session replay.' in current_publication.body) > 0 then
    return;
  end if;

  if position(old_replay_disclosure in current_publication.body) = 0 then
    raise exception 'cardforge_privacy_publication_changed_before_replay_removal';
  end if;

  select identity_version
  into current_identity_version
  from public.cardforge_business_identity
  where id = 'cardforge';

  if current_identity_version is null then
    raise exception 'cardforge_business_identity_required';
  end if;

  insert into public.cardforge_legal_documents (
    slug,
    version,
    title,
    body,
    effective_date,
    published_at,
    business_identity_version
  ) values (
    'privacy',
    current_publication.version + 1,
    current_publication.title,
    replace(current_publication.body, old_replay_disclosure, new_event_disclosure),
    date '2026-08-12',
    now(),
    current_identity_version
  );
end
$migration$;

commit;
