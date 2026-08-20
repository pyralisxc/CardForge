begin;

select pg_advisory_xact_lock(hashtext('cardforge_designer_pass_legal_publication'));

do $migration$
declare
  current_document record;
  current_identity_version bigint;
  old_pass_intro text := $old$These supplemental terms apply when CardForge Studio offers Creator Pass access. Creator Pass unlocks the features and limits shown at purchase for the stated billing period; it does not transfer ownership of CardForge Studio, shared library assets, or third-party material.$old$;
  new_pass_intro text := $new$These supplemental terms apply when CardForge Studio offers Creator Pass or Designer Pass access. The selected pass unlocks the features and limits shown at purchase for the stated billing period; it does not transfer ownership of CardForge Studio, shared library assets, or third-party material. Designer Pass does not grant contributor access unless CardForge separately approves that account for the contributor program.$new$;
  old_support_intro text := $old$These supplemental terms apply only if CardForge Studio separately offers a supporter checkout. Voluntary support for the independent creator is separate from Creator Pass. A support payment does not grant product access or any other CardForge entitlement. An entitlement exists only when a separately identified offering expressly says so and is governed by that offering's own terms.$old$;
  new_support_intro text := $new$These supplemental terms apply only if CardForge Studio separately offers a supporter checkout. Voluntary support for the independent creator is separate from Creator Pass and Designer Pass. A support payment does not grant product access or any other CardForge entitlement. An entitlement exists only when a separately identified offering expressly says so and is governed by that offering's own terms.$new$;
  old_refund_management text := $old$Use the account billing portal to manage or cancel Creator Pass. Use the Stripe-hosted supporter management link in the support section of Cameron's page to cancel recurring support. Cancellation stops future renewals; access from a canceled Creator Pass ordinarily continues through the already-paid period unless Stripe shows otherwise.$old$;
  new_refund_management text := $new$Use the account billing portal to manage, change, or cancel Creator Pass or Designer Pass. Use the Stripe-hosted supporter management link in the support section of Cameron's page to cancel recurring support. Cancellation stops future renewals; access from a canceled paid pass ordinarily continues through the already-paid period unless Stripe shows otherwise.$new$;
  old_refund_review text := $old$Creator Pass refund requests are reviewed using the payment record, product-access history, the circumstances of the request, and applicable law.$old$;
  new_refund_review text := $new$Paid-pass refund requests are reviewed using the payment record, product-access history, the circumstances of the request, and applicable law.$new$;
begin
  select identity_version
  into current_identity_version
  from public.cardforge_business_identity
  where id = 'cardforge';

  if current_identity_version is null then
    raise exception 'cardforge_business_identity_required';
  end if;

  select * into current_document
  from public.cardforge_legal_documents
  where slug = 'creator-pass-terms'
  order by version desc
  limit 1
  for update;

  if current_document is null or position(old_pass_intro in current_document.body) = 0 then
    raise exception 'cardforge_paid_pass_terms_changed_before_designer_publication';
  end if;

  insert into public.cardforge_legal_documents (
    slug, version, title, body, effective_date, published_at, business_identity_version
  ) values (
    current_document.slug,
    current_document.version + 1,
    'Creator and Designer Pass Terms',
    replace(current_document.body, old_pass_intro, new_pass_intro),
    date '2026-08-20',
    now(),
    current_identity_version
  );

  select * into current_document
  from public.cardforge_legal_documents
  where slug = 'supporter-terms'
  order by version desc
  limit 1
  for update;

  if current_document is null or position(old_support_intro in current_document.body) = 0 then
    raise exception 'cardforge_supporter_terms_changed_before_designer_publication';
  end if;

  insert into public.cardforge_legal_documents (
    slug, version, title, body, effective_date, published_at, business_identity_version
  ) values (
    current_document.slug,
    current_document.version + 1,
    current_document.title,
    replace(current_document.body, old_support_intro, new_support_intro),
    date '2026-08-20',
    now(),
    current_identity_version
  );

  select * into current_document
  from public.cardforge_legal_documents
  where slug = 'refund'
  order by version desc
  limit 1
  for update;

  if current_document is null
    or position(old_refund_management in current_document.body) = 0
    or position(old_refund_review in current_document.body) = 0 then
    raise exception 'cardforge_refund_terms_changed_before_designer_publication';
  end if;

  insert into public.cardforge_legal_documents (
    slug, version, title, body, effective_date, published_at, business_identity_version
  ) values (
    current_document.slug,
    current_document.version + 1,
    current_document.title,
    replace(
      replace(current_document.body, old_refund_management, new_refund_management),
      old_refund_review,
      new_refund_review
    ),
    date '2026-08-20',
    now(),
    current_identity_version
  );
end
$migration$;

commit;
