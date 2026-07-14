-- Align live operator identity and billing language with current operations.

update public.cardforge_owner_settings
set business_name = 'Neon Black Interactive LLC', updated_at = now()
where id = 'cardforge';

update public.cardforge_legal_documents
set
  body = $privacy$CardForge is operated by Neon Black Interactive LLC and is designed as a local-first card creation tool. Card projects, imported data, generated previews, personal uploads, and export settings stay in browser database storage or downloaded project files unless you choose to submit something to the platform or CardForge introduces an explicit cloud save feature.

We use account and infrastructure providers to identify signed-in users, unlock access, run the site, protect owner/developer tools, process payments, prevent abuse, and store shared platform records. Those records may include account identifiers, email addresses, optional first and last names, entitlement status, billing-event records, Founder Beta claims, roadmap votes, feature suggestions, developer profiles, developer submissions, developer votes, asset registry records, contact requests, legal documents, and owner settings.

Developer submissions, public source files, and published library assets are intentionally shared with the review pipeline and may become visible to other users. Do not upload confidential files, private client work, or content you do not have permission to share.

CardForge does not sell user project files. We do not intentionally collect information from children under 13. If you need privacy support, contact the support email listed on this site.$privacy$,
  published_at = now()
where slug = 'privacy';

update public.cardforge_legal_documents
set
  body = regexp_replace(
    body,
    '^CardForge Studio lets',
    'CardForge is a service operated by Neon Black Interactive LLC. It lets'
  ),
  published_at = now()
where slug = 'terms';

update public.cardforge_legal_documents
set
  body = $refund$CardForge is operated by Neon Black Interactive LLC and is currently in public beta. Self-service subscription billing and the customer billing portal are active when offered on the access page.

Use the account billing portal to manage or cancel an active subscription. Refund requests should be sent to the support email listed on this site and are reviewed using the payment record, product-access history, the circumstances of the request, and applicable law. Nothing in this policy limits rights that cannot legally be limited.

If you have a billing, cancellation, or export-access issue, contact support with the account email, transaction reference if available, and a short description of the issue.$refund$,
  published_at = now()
where slug = 'refund';
