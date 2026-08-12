begin;

select pg_advisory_xact_lock(hashtext('cardforge_privacy_posthog_interaction_analytics'));

do $migration$
declare
  current_publication record;
  current_identity_version bigint;
  old_measurement text := $old_measurement$CardForge may also offer optional, privacy-minimized Google Analytics measurement to understand website acquisition and how visitors move into core creation activities. This measurement is off until you choose "Accept" or "Accept once," and you may decline or turn it off later through the Analytics settings shown by CardForge. If allowed, Google Analytics uses a randomly generated client identifier in a first-party cookie to distinguish a browser and its sessions. Google may receive basic session, browser, device, language, and approximate-location information alongside a sanitized page path and title, limited referrer context, approved campaign parameters, and explicit events for opening Studio, signing up, creating a card, and completing an export. Card content, project names, account names, email addresses, non-campaign query values, and owner or developer-cockpit activity are not sent as analytics events. CardForge does not enable Google advertising storage, Google Signals, ad personalization, or Enhanced Measurement. Google controls the resulting analytics records and applies its own processing and retention practices; CardForge reads aggregated reports but does not copy raw visitor events into Supabase. You can learn more in Google's privacy policy at https://policies.google.com/privacy.$old_measurement$;
  new_measurement text := $new_measurement$CardForge may also offer optional, privacy-minimized measurement through Google Analytics and PostHog to understand website acquisition and how visitors interact with core creation activities. This measurement is off until you choose "Accept" or "Accept once," and you may decline or turn it off later through the Analytics settings shown by CardForge. If allowed, Google Analytics uses a randomly generated client identifier in a first-party cookie. Google may receive basic session, browser, device, language, and approximate-location information alongside a sanitized page path and title, limited referrer context, approved campaign parameters, and explicit CardForge activity events. PostHog uses an anonymous identifier kept only in browser session storage and receives a sanitized path, basic browser and device context, and allow-listed events such as navigation, card-format choices, card creation, and export outcomes. Approximate-location enrichment is disabled for PostHog events. CardForge does not identify visitors to PostHog or create PostHog person profiles.

PostHog session replay may run only on public informational pages. All visible text and form inputs are masked in the browser before replay data is sent; query strings, request and response headers and bodies, cross-origin frames, and canvas contents are excluded. Studio, sign-in, account, profile, owner, and developer-cockpit pages are never recorded. Card content, project or design names, account names, email addresses, uploaded files, non-campaign query values, and raw private workspace content are not sent as analytics properties. CardForge does not enable Google advertising storage, Google Signals, ad personalization, or Enhanced Measurement. Google and PostHog control the resulting analytics records under their own processing and retention practices; CardForge reads owner-only reports but does not copy raw visitor events into Supabase. Learn more in Google's privacy policy at https://policies.google.com/privacy and PostHog's privacy information at https://posthog.com/privacy.$new_measurement$;
  old_choice text := $old_choice$Choosing "Accept" or "Decline" stores the analytics choice in a first-party cookie for up to 180 days so CardForge can remember it. Choosing "Accept once" stores permission only for the current browser-tab session. Declining or turning analytics off prevents future Google Analytics collection from that browser and removes Google Analytics cookies that CardForge can identify, but it does not retroactively delete aggregated or previously processed Google records. You can also block or clear cookies in your browser. Google Search Console separately provides CardForge with aggregated information about how pages appear and perform in Google Search; it does not depend on the optional CardForge analytics choice.$old_choice$;
  new_choice text := $new_choice$Choosing "Accept" or "Decline" stores the analytics choice in a first-party cookie for up to 180 days so CardForge can remember it. Choosing "Accept once" stores permission only for the current browser-tab session. PostHog's anonymous browser state is session-only regardless of which acceptance option you choose. Declining or turning analytics off prevents future Google Analytics and PostHog collection from that browser and clears provider browser state that CardForge can identify, but it does not retroactively delete aggregated or previously processed provider records. You can also block or clear cookies and site storage in your browser. Google Search Console separately provides CardForge with aggregated information about how pages appear and perform in Google Search; it does not depend on the optional CardForge analytics choice.$new_choice$;
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

  if position('PostHog uses an anonymous identifier kept only in browser session storage' in current_publication.body) > 0 then
    return;
  end if;

  if position(old_measurement in current_publication.body) = 0
    or position(old_choice in current_publication.body) = 0 then
    raise exception 'cardforge_privacy_publication_changed_before_posthog_cutover';
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
    replace(replace(current_publication.body, old_measurement, new_measurement), old_choice, new_choice),
    date '2026-08-12',
    now(),
    current_identity_version
  );
end
$migration$;

commit;
