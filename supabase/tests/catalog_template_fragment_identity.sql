-- Disposable native matcher regression. Read-only assertions; no catalog writes.
begin;
set local role service_role;
do $$
declare
 template_a text := '/api/templates#qa-fragment-a';
 template_b text := '/api/templates#qa-fragment-b';
 icon_source text := 'https://assets.example.invalid/governed-icon.svg';
begin
 if not public.cardforge_catalog_known_reference(
   jsonb_build_object('imageSource', template_a), '{}'::text[], array[template_a]) then
   raise exception 'exact_template_fragment_not_detected';
 end if;
 if public.cardforge_catalog_known_reference(
   jsonb_build_object('imageSource', template_b), '{}'::text[], array[template_a]) then
   raise exception 'distinct_template_fragment_false_dependency';
 end if;
 -- Exercise the scalar imageSource field used by the native preview-image
 -- wrapper (jsonb_build_object('imageSource', preview_url)); arbitrary
 -- previewUrl object traversal is intentionally skipped.
 if not public.cardforge_catalog_known_reference(
   to_jsonb(template_a), '{}'::text[], array[template_a], 'imageSource') then
   raise exception 'exact_template_preview_scalar_not_detected';
 end if;
 if public.cardforge_catalog_known_reference(
   to_jsonb(template_b), '{}'::text[], array[template_a], 'imageSource') then
   raise exception 'distinct_template_preview_scalar_false_dependency';
 end if;
 if not public.cardforge_catalog_known_reference(
   jsonb_build_object('iconImageSource', 'governed-icon-id'), array['governed-icon-id'], '{}'::text[]) then
   raise exception 'governed_icon_identity_dependency_lost';
 end if;
 if not public.cardforge_catalog_known_reference(
   jsonb_build_object('iconImageSource', icon_source||'#render-preview'),
   '{}'::text[],array[icon_source]) then
   raise exception 'physical_media_source_fragment_compatibility_lost';
 end if;
 raise notice 'PASS identity-bearing Template fragments, distinct negatives and governed icon/media matching';
end $$;
rollback;
