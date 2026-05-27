alter table public.cardforge_legal_documents
  drop constraint if exists cardforge_legal_documents_slug_check;

alter table public.cardforge_legal_documents
  add constraint cardforge_legal_documents_slug_check
  check (slug in ('privacy', 'terms', 'refund', 'contact', 'developer-terms', 'creator-pool'));

update public.cardforge_legal_documents
set
  title = 'Privacy Policy',
  body = $body$CardForge Studio is a local-first card creation tool. Card projects, imported data, generated previews, personal uploads, and export settings are designed to stay in your browser storage or downloaded project files unless you choose to submit something to the platform or CardForge introduces an explicit cloud save feature.

We use account and infrastructure providers to identify signed-in users, unlock access, run the site, protect owner/developer tools, process future payments, and store shared platform records. Those records may include account identifiers, email addresses, optional first and last names, entitlement status, Founder Beta claims, roadmap votes, feature suggestions, developer profiles, developer submissions, developer votes, asset registry records, legal documents, and owner settings.

Developer submissions, public source files, and published library assets are intentionally shared with the review pipeline and may become visible to other users. Do not upload confidential files, private client work, or content you do not have permission to share.

CardForge does not sell user project files. We do not intentionally collect information from children under 13. If you need privacy support, contact the support email listed on this site.$body$,
  published_at = coalesce(published_at, now())
where slug = 'privacy'
  and body = $old$CardForge Studio is a local-first card creation tool. Card projects, imported data, generated previews, and custom project files stay in browser storage or downloaded files unless a future cloud save feature is explicitly introduced.

We use account providers to identify signed-in users, unlock export access, and protect owner/developer tools. We may use lightweight database records for roadmap votes, feature suggestions, beta feedback, legal settings, and account-related product status.

We do not sell user project files. We do not intentionally collect information from children under 13. If you need privacy support, contact the support email listed on this site.$old$;

update public.cardforge_legal_documents
set
  title = 'Terms of Service',
  body = $body$CardForge Studio lets users create templates, generate previews, manage local projects, submit developer assets, and export content according to their account access. You are responsible for the content, artwork, data, trademarks, and intellectual property you bring into the tool.

You keep ownership of the content you create. By using CardForge, you grant CardForge the limited permission needed to operate the service, render previews, process exports, preserve local/project state, and, when you submit assets to the developer pipeline, review, display, publish, archive, and maintain those submitted assets as part of the shared library.

The product is in active beta. Features, pricing, access levels, export behavior, developer rules, and library availability may change as the service develops. Do not use CardForge for unlawful content, infringing content, malicious uploads, harassment, or activity that harms the platform or other users.

CardForge is a creative production tool, not a print vendor or legal clearance service. Always proof exports, keep your own backups, and confirm printer/manufacturer requirements before production.$body$,
  published_at = coalesce(published_at, now())
where slug = 'terms'
  and body = $old$CardForge Studio lets users create templates, generate previews, and export content according to their account access. You are responsible for the content, artwork, data, and intellectual property you bring into the tool.

The product is in active beta. Features, pricing, access levels, and export behavior may change as the service develops. Do not use CardForge for unlawful content or activity.

By using CardForge, you agree to use the service responsibly and to keep your own backups of local-first project data.$old$;

update public.cardforge_legal_documents
set
  title = 'Refund and Cancellation Policy',
  body = $body$CardForge is currently operating as an early beta. Founder Beta access, free demo seats, paid access, subscriptions, checkout behavior, and refund rules may differ by launch phase and will be shown before public self-serve billing is enabled.

When paid billing is active, cancellation and refund requests should be sent to the support email listed on this site and may also depend on the payment provider's records. Downloaded digital files, export access that has already been used, and time-limited beta passes may have limited refund availability unless required by law or approved by CardForge support.

If you have a billing, cancellation, or export-access issue, contact support with the account email, transaction reference if available, and a short description of the issue.$body$,
  published_at = coalesce(published_at, now())
where slug = 'refund'
  and body = $old$CardForge is currently operating as an early beta. Paid subscription and refund rules will be finalized before public self-serve billing launches.

If you have a billing, cancellation, or export-access issue, contact the support email listed on this site.$old$;

update public.cardforge_legal_documents
set
  title = 'Contact and Support',
  body = $body$For support, beta access, developer account requests, legal questions, billing questions, account problems, or asset pipeline concerns, contact the support email listed on this site.

For fastest help, include the account email, the page or workflow where the issue happened, what you expected, what actually happened, and whether the issue involves a local project, export, template, developer asset, or billing/access state.

CardForge is in active development. Support responses are handled by the CardForge owner/operator until a larger support process is introduced.$body$,
  published_at = coalesce(published_at, now())
where slug = 'contact'
  and body = 'For support, beta access, developer account requests, legal questions, or billing questions, contact the support email listed on this site.';

insert into public.cardforge_legal_documents (slug, title, body, published_at)
values
  (
    'developer-terms',
    'Developer Contributor Terms',
    $body$Forge Review is the developer contribution path for CardForge. Developers may submit templates, icons, dividers, textures, frames, source files, element recipes, and other approved creative assets into the shared review pipeline.

Only submit work you created, own, licensed, or have clear permission to contribute. Do not submit confidential work, client-restricted files, AI-generated material that violates its source license, infringing content, malware, deceptive files, or anything you would not want reviewed, archived, published, or used by other CardForge users.

Submitted assets move through the same platform pipeline as starter assets: draft, submitted, voting, publish candidate, published, archived, or rejected. Developer votes, owner rules, quality scores, access tiers, and platform caps can affect where an asset appears. Published assets may remain available after a developer leaves so existing users and templates do not break.

Contributor records are durable platform history. Deleting or disabling an account should not delete prior votes, source-file references, registry records, published assets, or contribution attribution snapshots. Owners may archive, remove, or edit platform availability for safety, quality, legal, licensing, or operational reasons.

These developer terms describe the current contribution model and do not create employment, partnership, guaranteed payment, or ownership of CardForge unless a separate written agreement says so.$body$,
    now()
  ),
  (
    'creator-pool',
    'Creator Pool Notice',
    $body$CardForge is building toward a creator pool that can share a portion of eligible platform profit with eligible active developers. The current planning target is a configurable percentage, currently represented in the product as 10% by default, split evenly among eligible active developers after financial launch systems are ready.

The creator pool is not active payout infrastructure today. It is not stock, equity, a security, employment, partnership, a wage promise, or guaranteed income. It depends on future billing, refund handling, tax handling, payout provider setup, creator eligibility rules, legal review, and owner-published program terms.

The owner console controls the visible planning percentage, developer eligibility flags, vote weights, voting rules, monthly contribution expectations, and access-tier rules. Changes should be published clearly before they affect active developers.

Until payout systems and final legal terms are live, treat creator-pool language as the product direction for the collective, not as a payable balance or enforceable distribution schedule.$body$,
    now()
  )
on conflict (slug) do nothing;
