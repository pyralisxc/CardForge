-- Pure typed-inspection proof inside the existing disposable native runner.
begin;
set local role service_role;
do $$
declare p jsonb:=jsonb_build_object('id','decimal-ratio','name','Decimal geometry','aspectRatio','62.857:88','freeformCanvas',jsonb_build_object('width',630,'height',880,'elements','[]'::jsonb)); ratio text;
begin
 foreach ratio in array array['62.857:88','63:88','0.5:1.25','100.125:2.5'] loop
  if not public.cardforge_catalog_consumer_inspectable(p||jsonb_build_object('aspectRatio',ratio),'template') then raise exception 'finite_typed_ratio_refused: %',ratio; end if;
 end loop;
 foreach ratio in array array['NaN:88','Infinity:88','1e309:88','62.857:https://example.invalid','62.857:88 url(x)','62.857:{{x}}','62.857%3A88','62.857\:88',repeat('9',400)||':88'] loop
  if public.cardforge_catalog_consumer_inspectable(p||jsonb_build_object('aspectRatio',ratio),'template') then raise exception 'unsafe_or_nonfinite_ratio_accepted: %',ratio; end if;
 end loop;
 foreach ratio in array array['https://example.invalid/a.png','url(x)','var(--image)','x%3Ay','{{image}}','x\y','62.857:88'] loop
  if public.cardforge_catalog_consumer_inspectable(p||jsonb_build_object('cardBackgroundImageUrl',ratio),'template') then raise exception 'typed_geometry_exception_weakened_resource_guard: %',ratio; end if;
 end loop;
 raise notice 'PASS finite decimal aspectRatio: integer/decimal geometry supported, nonfinite/URL/CSS/encoded/dynamic values and non-geometry sources still rejected';
end $$;
rollback;
