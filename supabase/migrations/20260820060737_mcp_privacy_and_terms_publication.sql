begin;

select pg_advisory_xact_lock(hashtext('cardforge_mcp_privacy_and_terms_publication'));

do $migration$
declare
  current_privacy record;
  current_terms record;
  current_identity_version bigint;
  old_provider_disclosure text := $old_provider_disclosure$Clerk provides authentication, account identity, session management, and trusted access metadata. Stripe processes billing and maintains payment, checkout, customer, refund, and subscription records. Supabase stores operational records used for shared platform features, including entitlement status, billing events, roadmap suggestions and votes, developer profiles, developer submissions and votes, asset registry records, contact requests, abuse-prevention records, legal publications, and owner settings. Resend sends communications for contact workflows and other transactional messages. Vercel hosts the site and server routes and may process standard request, device, network, and deployment log information needed to deliver and operate them. Each provider processes information for its role under its own terms and retention practices.$old_provider_disclosure$;
  new_provider_disclosure text := $new_provider_disclosure$Clerk provides authentication, account identity, session management, and trusted access metadata. Stripe processes billing and maintains payment, checkout, customer, refund, and subscription records. Supabase stores operational records used for shared platform features, including entitlement status, billing events, roadmap suggestions and votes, developer profiles, developer submissions and votes, asset registry records, contact requests, abuse-prevention records, legal publications, and owner settings. Resend sends communications for contact workflows and other transactional messages. Vercel hosts the site and server routes and may process standard request, device, network, and deployment log information needed to deliver and operate them. Each provider processes information for its role under its own terms and retention practices.

Signed-in users may connect CardForge to ChatGPT, Codex, or another compatible Model Context Protocol client. That client and its provider separately process conversation and tool-call data under their own terms. CardForge receives the tool inputs the client sends and returns the requested tool results. To support continued editing, Supabase stores private assistant working documents tied to the CardForge account. Those documents may contain editable Templates, cards and card sets, production plans, revisions, and artwork intentionally attached through the assistant workflow. They are separate from ordinary browser-local Studio projects and are not published unless the user later chooses a separate review or publication workflow.

CardForge also records aggregate MCP usage tied to the account and tool name, including attempts, success or failure, assisted-action units, request and response byte counts, tool duration, and private assistant document counts and storage size. The aggregate usage table does not store prompts, card content, artwork, or document payloads. Those totals support reliability review, capacity planning, plan presentation, abuse prevention, and future usage-policy decisions; the displayed capacity values are measurement targets and are not currently enforced quotas or overage charges.$new_provider_disclosure$;
  old_retention text := $old_retention$Browser IndexedDB data remains until you clear it or the browser removes it, and downloaded project files remain until you delete them from the places where you saved them. Platform and provider records are retained for periods that vary by record, operational need, security and abuse-prevention need, legal obligation, and provider setting. Some billing, legal, voting, attribution, published-asset, and security records may need to remain after an account is disabled or deleted to preserve accurate platform history and system integrity.$old_retention$;
  new_retention text := $new_retention$Browser IndexedDB data remains until you clear it or the browser removes it, and downloaded project files remain until you delete them from the places where you saved them. Private assistant working documents and aggregate MCP usage remain in CardForge's platform records until they are deleted through an available account or support process, or retained for an operational, security, abuse-prevention, legal, or record-integrity need. Other platform and provider records are retained for periods that vary by record, operational need, legal obligation, and provider setting. Some billing, legal, voting, attribution, published-asset, aggregate usage, and security records may need to remain after an account is disabled or deleted to preserve accurate platform history and system integrity.$new_retention$;
  old_deletion text := $old_deletion$For a privacy question or an access or deletion inquiry, contact [pyraliscameron@gmail.com](mailto:pyraliscameron@gmail.com). CardForge may need to verify the requester and may be unable to alter records that must remain for security, record-integrity, provider, or legal reasons. Account deletion does not delete browser IndexedDB or downloaded project files under your control.$old_deletion$;
  new_deletion text := $new_deletion$For a privacy question or an access or deletion inquiry, including a request concerning private assistant working documents, contact [pyraliscameron@gmail.com](mailto:pyraliscameron@gmail.com). CardForge may need to verify the requester and may be unable to alter records that must remain for security, record-integrity, provider, or legal reasons. Account deletion does not delete browser IndexedDB or downloaded project files under your control.$new_deletion$;
  old_terms_intro text := $old_terms_intro$Your agreement for the service is with Cameron Locke as the legal operator of CardForge Studio. CardForge lets users create templates, generate previews, manage local projects, submit developer assets, and export content according to their account access. You are responsible for the content, artwork, data, trademarks, and intellectual property you bring into the tool.$old_terms_intro$;
  new_terms_intro text := $new_terms_intro$Your agreement for the service is with Cameron Locke as the legal operator of CardForge Studio. CardForge lets users create templates, generate previews, manage local projects, use connected assistant tools that create private cloud working documents, submit developer assets, and export content according to their account access. You are responsible for the content, artwork, data, trademarks, and intellectual property you bring into the tool or send through a connected assistant.$new_terms_intro$;
begin
  if to_regclass('public.cardforge_legal_documents') is null then
    raise exception 'cardforge_versioned_legal_publications_required';
  end if;

  select identity_version
  into current_identity_version
  from public.cardforge_business_identity
  where id = 'cardforge';

  if current_identity_version is null then
    raise exception 'cardforge_business_identity_required';
  end if;

  select *
  into current_privacy
  from public.cardforge_legal_documents
  where slug = 'privacy'
  order by version desc
  limit 1
  for update;

  if current_privacy is null then
    raise exception 'cardforge_privacy_publication_required';
  end if;

  if position('private assistant working documents' in current_privacy.body) = 0 then
    if position(old_provider_disclosure in current_privacy.body) = 0
      or position(old_retention in current_privacy.body) = 0
      or position(old_deletion in current_privacy.body) = 0 then
      raise exception 'cardforge_privacy_publication_changed_before_mcp_disclosure';
    end if;

    insert into public.cardforge_legal_documents (
      slug, version, title, body, effective_date, published_at, business_identity_version
    ) values (
      'privacy',
      current_privacy.version + 1,
      current_privacy.title,
      replace(
        replace(
          replace(current_privacy.body, old_provider_disclosure, new_provider_disclosure),
          old_retention,
          new_retention
        ),
        old_deletion,
        new_deletion
      ),
      date '2026-08-20',
      now(),
      current_identity_version
    );
  end if;

  select *
  into current_terms
  from public.cardforge_legal_documents
  where slug = 'terms'
  order by version desc
  limit 1
  for update;

  if current_terms is null then
    raise exception 'cardforge_terms_publication_required';
  end if;

  if position('private cloud working documents' in current_terms.body) = 0 then
    if position(old_terms_intro in current_terms.body) = 0 then
      raise exception 'cardforge_terms_publication_changed_before_mcp_disclosure';
    end if;

    insert into public.cardforge_legal_documents (
      slug, version, title, body, effective_date, published_at, business_identity_version
    ) values (
      'terms',
      current_terms.version + 1,
      current_terms.title,
      replace(current_terms.body, old_terms_intro, new_terms_intro),
      date '2026-08-20',
      now(),
      current_identity_version
    );
  end if;
end
$migration$;

commit;
