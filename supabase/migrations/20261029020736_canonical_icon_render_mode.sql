-- Correct the native iconRenderMode vocabulary to the canonical renderer and
-- authored Template schema. All other source and unknown-shape fences remain unchanged.
begin;
create or replace function public.cardforge_catalog_consumer_inspectable(p jsonb, kind text, depth integer default 0)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare strings text[]; numbers text[]; booleans text[]; nested text[]; k text; v jsonb; value text; child_kind text; child jsonb;
begin
 if depth>80 or jsonb_typeof(p) is distinct from 'object' then return false; end if;
 -- Studio's canonical parser accepts version-1 project documents, not an
 -- arbitrary wrapper. This subset includes all dependencies it can render;
 -- unproved card/data, package, custom-asset and production-plan paths stay opaque.
 if kind='studio' then
   if p->'version' is distinct from '1'::jsonb or jsonb_typeof(p->'userTemplates') is distinct from 'array' then return false; end if;
   for k,v in select * from jsonb_each(p) loop
     if k='version' then continue;
     elsif k in ('userTemplates','appearanceStyles') then
       if jsonb_typeof(v) is distinct from 'array' then return false; end if;
       for child in select * from jsonb_array_elements(v) loop
         if not public.cardforge_catalog_consumer_inspectable(child,case when k='userTemplates' then 'template' else 'style' end,depth+1) then return false; end if;
       end loop;
     elsif k in ('storedCards','cardSets','customFonts','mcpOperationReceipts') then
       if v is distinct from '[]'::jsonb then return false; end if;
     elsif k='customAssets' then
       if jsonb_typeof(v) is distinct from 'object' then return false; end if;
       if exists(select 1 from jsonb_each(v) a where a.key not in
         ('cardforge-maker-custom-textures','cardforge-maker-custom-dividers','cardforge-maker-custom-icons','cardforge-maker-custom-images')
         or a.value is distinct from '[]'::jsonb) then return false; end if;
     elsif k in ('exportSettings','productionPlan') then
       -- No dependency semantics are inferred from a nonempty auxiliary owner.
       if v is distinct from '{}'::jsonb then return false; end if;
     else return false;
     end if;
   end loop;
   return true;
 end if;
 numbers:='{}'; booleans:='{}'; nested:='{}';
 if kind='style' then
   if public.cardforge_valid_style_review_payload(p) is not true then return false; end if;
   -- SQL btrim and JavaScript trim differ. An ASCII non-whitespace witness
   -- proves runtime nonblankness without guessing about Unicode whitespace.
   if not ((p->>'id')~'[!-~]' and (p->>'name')~'[!-~]') then return false; end if;
   strings:=array['id','name','kind','librarySource','accessTier','registryStatus','contributorName','studioRoutingMode'];
   numbers:=array['studioOrder']; booleans:=array['studioFeatured']; nested:=array['appearance','updates','templateUpdates','targets','studioDestinations'];
 elsif kind in ('template','templatePatch') then
   if kind='template' and not coalesce(jsonb_typeof(p->'id')='string' and (p->>'id')~'[!-~]'
     and jsonb_typeof(p->'name')='string' and (p->>'name')~'[!-~]' and jsonb_typeof(p->'aspectRatio')='string' and jsonb_typeof(p->'freeformCanvas')='object',false) then return false; end if;
   strings:=array['id','name','aspectRatio','formatId','templateSource','templateLibrarySource','templateAccessTier','templateRegistryStatus','templateContributorName','templateLineageId','templateRevisionId','templateParentRevisionId','templateOriginLineageId','templateOriginRevisionId','templateUsage','templateCategory','templateDescription','frameStyle','cardBackgroundImageUrl','cardBackgroundImageFit','cardBorderImageSource','baseBackgroundColor','baseTextColor','defaultElementBorderColor','cardBorderColor','cardBorderWidth','cardBorderStyle','cardBorderRadius'];
   numbers:=array['trimWidthMm','trimHeightMm','templateRevision','templateOrder']; nested:=array['appearance','freeformCanvas','fieldContracts','templatePreviewData'];
 elsif kind in ('element','elementPatch') then
   if kind='element' and not coalesce(jsonb_typeof(p->'id')='string' and jsonb_typeof(p->'name')='string'
      and p->>'type' in ('text','image','icon','shape') and jsonb_typeof(p->'x')='number' and jsonb_typeof(p->'y')='number'
      and jsonb_typeof(p->'width')='number' and jsonb_typeof(p->'height')='number' and jsonb_typeof(p->'zIndex')='number',false) then return false; end if;
   -- Missing text/image content would synthesize a runtime field binding.
   if kind='element' and p->>'type' in ('text','image') and jsonb_typeof(p->'content') is distinct from 'string' then return false; end if;
   strings:=array['id','type','name','parentId','content','imageSource','iconImageSource','iconRenderMode','iconName','shapeKind','shapeRole','textColor','backgroundColor','backgroundImageUrl','fontFamily','fontSize','fontWeight','textAlign','fontStyle','writingMode','letterSpacing','lineHeight','textTransform','textDecoration','generatorFieldKind','padding','borderColor','borderWidth','borderRadius','minHeight','imageObjectFit','imageObjectPositionX','imageObjectPositionY','fillColor','strokeColor'];
   numbers:=array['x','y','width','height','rotation','opacity','zIndex','fontSizePx','textMinFontSizePx','imageScale','imageOffsetX','imageOffsetY','imageRotation','strokeWidth'];
   booleans:=array['flipX','flipY','locked','visible','generatorFieldRequired','textAutoFit']; nested:=array['appearance'];
 elsif kind='appearance' then
   if not public.cardforge_valid_style_review_payload(jsonb_build_object('id','inspection','name','inspection','kind','material','targets',jsonb_build_array('shape'),'appearance',p)) then return false; end if;
   strings:=array['assetSource','assetKind','assetRenderMode','assetTintColor','blendMode','tileMode','dividerAsset','shapeRole'];
   numbers:=array['textureScale','textureOpacity']; nested:=array['material','border','effects','rawCss'];
 elsif kind='material' then
   strings:=array['name','baseColor','textColor','fillColor','strokeColor']; nested:=array['gradient','texture'];
 elsif kind='gradient' then
   strings:=array['type']; numbers:=array['angle']; nested:=array['stops'];
 elsif kind='stop' then
   strings:=array['id','color']; numbers:=array['position','opacity'];
 elsif kind='texture' then
   strings:=array['kind','imageSource','assetSource','assetKind','blendMode','tileMode']; numbers:=array['intensity','scale','textureScale','textureOpacity'];
 elsif kind='border' then
   strings:=array['kind','color','secondaryColor']; numbers:=array['width','radius','innerWidth','outerWidth'];
 elsif kind='effects' then
   strings:='{}'; numbers:=array['shadow','glow','bevel','innerHighlight','overlayOpacity'];
 elsif kind='rawCss' then
   strings:=array['backgroundImage','borderImageSource'];
 elsif kind='canvas' then
   if not coalesce(jsonb_typeof(p->'width')='number' and jsonb_typeof(p->'height')='number'
       and jsonb_typeof(p->'elements')='array',false) then return false; end if;
   strings:='{}'; numbers:=array['width','height','gridSize','hierarchyVersion']; nested:=array['elements'];
 else return false;
 end if;
 for k,v in select * from jsonb_each(p) loop
   if k=any(strings) then
     if jsonb_typeof(v) is distinct from 'string' then return false; end if;
     value:=v#>>'{}';
     if kind='stop' and k='id' and value!~'[!-~]' then return false; end if;
     if k='type' and kind in ('element','elementPatch') and value not in ('text','image','icon','shape') then return false; end if;
     if k='shapeKind' and value not in ('rectangle','ellipse','diamond','hexagon','capsule','banner','notch-panel','bracket-frame','corner-frame','line') then return false; end if;
     if k='iconRenderMode' and value not in ('original','tint') then return false; end if;
     if k='imageObjectFit' and value not in ('cover','contain','fill','none','scale-down') then return false; end if;
     if k in ('name','label','description','contributorName','templateContributorName','templateDescription') then continue; end if;
     if kind='stop' and k='color' and not public.cardforge_source_contained_css_image('linear-gradient('||value||', transparent)') then return false; end if;
     if kind='rawCss' and k='backgroundImage' and public.cardforge_source_contained_css_image(value) then continue; end if;
     if k in ('backgroundImageUrl','cardBackgroundImageUrl','cardBorderImageSource')
       and value ~ '^(linear|radial)-gradient\(' and public.cardforge_source_contained_css_image(value) then continue; end if;
     -- Do not infer no dependency from URLs, encoded bytes, CSS indirection,
     -- relative paths or unresolved field bindings. No network reads here.
     if value ~* '(:|/|\\|%[0-9a-f]{2}|url[[:space:]]*\(|var[[:space:]]*\(|<|\{\{)' then
       -- Aspect ratios are typed geometry, not reference strings.
       if k<>'aspectRatio' or value!~'^[0-9]+:[0-9]+$' then return false; end if;
     end if;
     -- Typed sources are URLs, not CSS values: truthy 'none' can render as
     -- url(none). Only raw CSS properties interpret CSS none as no image.
     if k in ('assetSource','dividerAsset','imageSource','iconImageSource','backgroundImageUrl','cardBackgroundImageUrl','cardBorderImageSource')
       and value<>'' then return false; end if;
     if kind='rawCss' and k in ('backgroundImage','borderImageSource')
       and value<>'' and not (k='backgroundImage' and value='none') then return false; end if;
     if k='content' and (kind='elementPatch' or p->>'type'='image') and value<>'' then return false; end if;
   elsif k=any(numbers) then
     if jsonb_typeof(v) is distinct from 'number' then return false; end if;
     if abs((v#>>'{}')::numeric)>1.7976931348623157e308 then return false; end if;
     if k in ('width','height') and ((kind='border' and (v#>>'{}')::numeric<0)
       or (kind<>'border' and (v#>>'{}')::numeric<=0)) then return false; end if;
   elsif k=any(booleans) then
     if jsonb_typeof(v) is distinct from 'boolean' then return false; end if;
   elsif k=any(nested) then
     if k in ('targets','studioDestinations') then
       if jsonb_typeof(v) is distinct from 'array' then return false; end if;
       if exists(select 1 from jsonb_array_elements(v) e where jsonb_typeof(e) is distinct from 'string') then return false; end if;
     elsif k='fieldContracts' then
       if v is distinct from '[]'::jsonb then return false; end if;
     elsif k='templatePreviewData' then
       if v is distinct from '{}'::jsonb then return false; end if;
     elsif k in ('elements','stops') then
       if jsonb_typeof(v) is distinct from 'array' then return false; end if;
       for child in select * from jsonb_array_elements(v) loop
         if not public.cardforge_catalog_consumer_inspectable(child,case when k='elements' then 'element' else 'stop' end,depth+1) then return false; end if;
       end loop;
     else
       child_kind:=case k when 'updates' then 'elementPatch' when 'templateUpdates' then 'templatePatch' when 'freeformCanvas' then 'canvas' else k end;
       if not public.cardforge_catalog_consumer_inspectable(v,child_kind,depth+1) then return false; end if;
     end if;
   else return false;
   end if;
 end loop;
 return true;
end $$;
commit;
