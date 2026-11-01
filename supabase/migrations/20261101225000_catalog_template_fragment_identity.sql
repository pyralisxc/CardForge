-- Forward-only correction to reversible dependency identity matching.
-- Template fragment identifies the catalog object; media URL fragments remain
-- non-identity components under the existing physical-source convention.
begin;
set local lock_timeout='5s';
create or replace function public.cardforge_catalog_known_reference(p jsonb,ids text[],sources text[],field text default '',depth integer default 0)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare k text; v jsonb; value text; source text; t jsonb; e jsonb; data jsonb; image_key text; candidate text; parts text[];
begin
 if depth>80 then return false; end if;
 -- The immutable Set manifest stores v2 card envelopes; the renderer's
 -- compatibility boundary unwraps them to the same runtime card data.
 if p->>'version'='2' and jsonb_typeof(p->'artifacts')='array' then
  p:=p||jsonb_build_object('storedCards',(select coalesce(jsonb_agg(a->'card'),'[]'::jsonb) from jsonb_array_elements(p->'artifacts') a where a->>'artifactType'='card'));
 end if;
 if jsonb_typeof(p)='object' then
  -- CardPreview resolves image data through a selected image element, never
  -- through arbitrary card text or metadata. The native projection only
  -- follows observed image keys; unresolved expressions remain coverage.
  if jsonb_typeof(p->'userTemplates')='array' or jsonb_typeof(p->'freeformCanvas')='object' then
   for t in select * from jsonb_array_elements(case when jsonb_typeof(p->'userTemplates')='array' then p->'userTemplates' else jsonb_build_array(p) end) loop
    for e in select * from jsonb_array_elements(case when jsonb_typeof(t->'freeformCanvas'->'elements')='array' then t->'freeformCanvas'->'elements' else '[]'::jsonb end) loop
     if e->>'type'<>'image' then continue; end if;
     image_key:=null;
     if lower(btrim(coalesce(e->>'imageSource',''))) !~ '^(data:|cardforge-studio-asset://|embedded://)' then
      foreach candidate in array array[e->>'imageSource',e->>'content'] loop
       parts:=regexp_match(candidate,'\{\{\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*(?::\s*"((?:[^"\\]|\\.)*)")?\s*\}\}');
       if parts is not null then image_key:=parts[1]; exit;
       elsif btrim(candidate) ~ '^[a-zA-Z0-9_-]+$' then image_key:=btrim(candidate); exit; end if;
      end loop;
     end if;
     if image_key is null then image_key:='image_'||coalesce(nullif(btrim(regexp_replace(lower(coalesce(e->>'name','image')),'[^a-z0-9]+','_','g'),'_'),''),'image')||'_'||coalesce(nullif(btrim(regexp_replace(lower(coalesce(e->>'id','layer')),'[^a-z0-9]+','_','g'),'_'),''),'layer'); end if;
     for data in select coalesce(t->'templatePreviewData','{}'::jsonb)
      union all select c->'data' from jsonb_array_elements(case when jsonb_typeof(p->'storedCards')='array' then p->'storedCards' else '[]'::jsonb end) c where c->>'templateId'=t->>'id'
      union all select c->'backingData' from jsonb_array_elements(case when jsonb_typeof(p->'storedCards')='array' then p->'storedCards' else '[]'::jsonb end) c where c->>'backingTemplateId'=t->>'id' loop
      if public.cardforge_catalog_known_reference(jsonb_build_object('imageSource',data->image_key,'iconImageSource',data->coalesce(e->>'imageSource',e->>'content')),ids,sources,'',depth+1) then return true; end if;
     end loop;
    end loop;
   end loop;
  end if;
  for k,v in select * from jsonb_each(p) loop
   if k in ('name','label','title','description','contributorName','templateDescription','metadata','mcpOperationReceipts','exportSettings','organization') then continue; end if;
   if k='content' and coalesce(p->>'type','')<>'image' then continue; end if;
   -- Walk only supported runtime structures. Unknown extensions are opaque,
   -- not evidence that their url/src/source strings render this asset.
   if jsonb_typeof(v) in ('object','array') and k not in ('userTemplates','appearanceStyles','storedCards','cardSets','freeformCanvas','elements','appearance','material','texture','border','effects','rawCss','gradient','stops','updates','templateUpdates','fieldContracts','customAssets','customFonts','source_payload','sourceManifest','project','assetId','registryAssetId','templateIds','templateId','backingTemplateId','templateLineageId','templateRevisionId','templateOriginLineageId','templateOriginRevisionId','styleId','presetId','lineageId','parentSubmissionId','imageSource','backgroundImage') and field<>'__assetDescriptors' then continue; end if;
   if k in ('url','src','source','previewUrl','preview_url','assetUrl','dataUrl') and field<>'__assetDescriptors' then continue; end if;
   if public.cardforge_catalog_known_reference(v,ids,sources,case when k in ('customAssets','customFonts') or (field='__assetDescriptors' and jsonb_typeof(v) in ('array','object')) then '__assetDescriptors' when k in ('content','defaultValue','example') and p->>'type'='image' then 'imageSource' else k end,depth+1) then return true; end if;
  end loop;
 elsif jsonb_typeof(p)='array' then
  for v in select * from jsonb_array_elements(p) loop
   if public.cardforge_catalog_known_reference(v,ids,sources,field,depth+1) then return true; end if;
  end loop;
 elsif jsonb_typeof(p)='string' then
  value:=p#>>'{}';
  if field in ('assetId','registryAssetId','templateId','backingTemplateId','templateIds','templateLineageId','templateRevisionId','templateOriginLineageId','templateOriginRevisionId','styleId','presetId','lineageId','parentSubmissionId','assetSource','dividerAsset','imageSource','iconImageSource','backgroundImageUrl','cardBackgroundImageUrl','cardBorderImageSource','url','src','source','previewUrl','preview_url','assetUrl','dataUrl','backgroundImage','borderImageSource') then
   if value=any(ids) then return true; end if;
   foreach source in array coalesce(sources,'{}'::text[]) loop
    if source<>'' and ((case when value like '/api/templates#%' or source like '/api/templates#%' then value=source else split_part(value,'#',1)=split_part(source,'#',1) end) or (field in ('backgroundImage','borderImageSource') and (strpos(value,'url("'||source||'")')>0 or strpos(value,'url('''||source||''')')>0 or strpos(value,'url('||source||')')>0))) then return true; end if;
   end loop;
  end if;
 end if;
 return false;
end $$;

-- Private inventory stays inside the native service boundary. Public/service
-- projections below decide which exact metadata the actor may receive.
create function public.cardforge_catalog_known_dependencies(refs jsonb,ids text[],sources text[])
returns boolean language sql immutable security invoker set search_path='' as $$
 select public.cardforge_catalog_known_reference(jsonb_build_object('assetId',refs->'identities','imageSource',refs->'sources','backgroundImage',refs->'sources'),ids,sources);
$$;
commit;
