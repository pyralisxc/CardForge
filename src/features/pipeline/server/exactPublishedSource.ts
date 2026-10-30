import 'server-only';
import { getImageFieldKeyForElement, TEMPLATE_PLACEHOLDER_REGEX } from '@/domain/rendering';
import { isRenderResourceField } from '@/domain/templates/sourceResourceFields';
import { createHash } from 'node:crypto';
import type { AccountToolAccess } from '@/features/account/server';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { getVisibleRegistryAccessTiers, getEmbeddedRegistryContent } from '../lib/registryContentAssets';
import { isRepositoryTemplate, isRepositoryStyle } from '../lib/registryContentValidation';
import { parsePipelineMediaPresentation } from '../lib/pipelineMediaPresentation';
import { PipelineRegistryCommandError } from '../lib/pipelineRegistryCommandsError';

export interface ExactPublishedSelection {
  assetId: string; submissionId: string; lineageId: string; selection: 'current' | 'historical';
}
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const unavailable = () => new PipelineRegistryCommandError('Exact Pipeline source is unavailable.', 503);

/** Reads retained identity, never resolves a name or substitutes a newer revision. */
export async function readExactPublishedSource(access: AccountToolAccess, target: ExactPublishedSelection) {
  const db = getSupabaseServerClient();
  if (!db) throw unavailable();
  async function read() {
    const [submission, registry, lineage] = await Promise.all([
      db!.from('cardforge_contributor_asset_submissions').select('id,lineage_id,contributor_id,asset_type,name,status,published_at,revision_number,target_registry_asset_id,registry_asset_id,source_payload,source_url,source_storage_bucket,source_storage_path,source_mime_type,source_content_sha256,media_presentation,trashed_at,purge_state,updated_at').eq('id', target.submissionId).maybeSingle(),
      db!.from('cardforge_asset_registry').select('asset_id,contributor_submission_id,status,access_tier,metadata,url,updated_at').eq('asset_id', target.assetId).maybeSingle(),
      db!.from('cardforge_pipeline_asset_lineages').select('id,registry_asset_id,catalog_trashed_at,purge_state,catalog_claimed_at,catalog_claim_token').eq('id', target.lineageId).maybeSingle(),
    ]);
    if (submission.error || registry.error || lineage.error) throw unavailable();
    const s = submission.data; const r = registry.data; const l = lineage.data;
    if (!s || !l) throw new PipelineRegistryCommandError('Exact Pipeline revision was not found.', 404);
    const current = r?.contributor_submission_id === s.id && r?.status === 'published';
    const visible = current && getVisibleRegistryAccessTiers(access.entitlement.accessMode).includes(r?.access_tier);
    if (!access.isOwner && s.contributor_id !== access.user.id && !visible) {
      throw new PipelineRegistryCommandError('This exact Pipeline revision is not accessible to this account.', 403);
    }
    if (s.lineage_id !== target.lineageId || l.registry_asset_id !== target.assetId
      || (s.target_registry_asset_id && s.target_registry_asset_id !== target.assetId)
      || (s.registry_asset_id && s.registry_asset_id !== target.assetId)
      || l.catalog_trashed_at || l.purge_state || l.catalog_claimed_at || l.catalog_claim_token || s.trashed_at || s.purge_state
      || (!s.published_at && s.status !== 'published')) {
      throw new PipelineRegistryCommandError('The selected published revision is unavailable or changed. Pending Templates require the exact Owner candidate reader.', 409);
    }
    if (target.selection === 'current' && (!current || !r?.updated_at)) {
      throw new PipelineRegistryCommandError('The current publication pointer changed or is unavailable.', 409);
    }
    return { s, r: target.selection === 'current' ? r : null, l };
  }
  const snapshot = await read();
  const { s, r } = snapshot;
  const downloads = new Map<string, string>();
  let totalBytes = 0;
  const download = async (bucket: string, path: string) => {
    if (!['cardforge-contributor-assets', 'cardforge-developer-assets'].includes(bucket) || !path || path.includes('..')) {
      throw new PipelineRegistryCommandError('This source is not a supported managed specimen.', 400);
    }
    const { data, error } = await db.storage.from(bucket).download(path);
    if (error || !data) throw unavailable();
    const bytes = Buffer.from(await data.arrayBuffer()); totalBytes += bytes.length;
    if (!bytes.length || totalBytes > 50 * 1024 * 1024) throw new PipelineRegistryCommandError('Exact source exceeds the native inspection budget.', 413);
    return { bytes, mimeType: data.type };
  };
  const hydrate = async (value: unknown, depth = 0, key = '', resourceData = new Set<string>(), inData = false, parentType = ''): Promise<unknown> => {
    if (depth > 80) throw new PipelineRegistryCommandError('Source nesting exceeds the native inspection budget.', 413);
    if (typeof value === 'string') {
      if (!(inData ? resourceData.has(key) : isRenderResourceField(key)) && !(parentType === 'image' && ['defaultValue','content'].includes(key))) return value;
      const hash = /^cardforge-pipeline-asset:\/\/([a-f0-9]{64})$/u.exec(value)?.[1];
      if (hash) {
        if (!downloads.has(value)) {
          const { bytes } = await download('cardforge-contributor-assets', `template-assets/${hash}.webp`);
          if (createHash('sha256').update(bytes).digest('hex') !== hash) throw new PipelineRegistryCommandError('Managed artwork changed.', 409);
          downloads.set(value, `data:image/webp;base64,${bytes.toString('base64')}`);
        }
        return downloads.get(value);
      }
      if (/^(?:https?:|blob:|cardforge-)/iu.test(value)) throw new PipelineRegistryCommandError('This exact specimen has an external or unsupported dependency. Open the native revision to inspect it.', 400);
      return value;
    }
    if (Array.isArray(value)) return Promise.all(value.map(v => hydrate(v, depth + 1, key, resourceData, inData, parentType)));
    if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([k,v]) => [k, await hydrate(v, depth + 1, k, resourceData, ['templatePreviewData','data','backingData'].includes(key), String(k === 'content' && (value as Record<string,unknown>).imageSource ? '' : (value as Record<string,unknown>).type ?? ''))])));
    return value;
  };
  let content: unknown = s.source_payload;
  if (!content && r) {
    if (s.asset_type === 'templates') content = getEmbeddedRegistryContent(r.metadata, ['template', 'content'], isRepositoryTemplate);
    if (s.asset_type === 'elementPresets') content = getEmbeddedRegistryContent(r.metadata, ['style', 'preset', 'content'], isRepositoryStyle);
  }
  let bytes: Buffer | null = null; let mimeType = s.source_mime_type;
  if (['templates', 'elementPresets'].includes(s.asset_type)) {
    if (s.asset_type === 'templates' ? !isRepositoryTemplate(content) : !isRepositoryStyle(content)) {
      throw new PipelineRegistryCommandError('Exact authored source is unavailable; no newer catalog payload was substituted.', 400);
    }
    const resourceData = new Set<string>();
    if (isRepositoryTemplate(content)) {
      for (const field of content.fieldContracts ?? []) if (field.type === 'image') resourceData.add(field.key);
      for (const element of content.freeformCanvas?.elements ?? []) if (element.type === 'image') {
        resourceData.add(getImageFieldKeyForElement(element));
        if (element.imageSource) resourceData.add(element.imageSource);
      }
    }
    const collectBindings = (value: unknown, key = '', parentType = '', depth = 0): void => {
      if (depth > 80) throw new PipelineRegistryCommandError('Source nesting exceeds the native inspection budget.', 413);
      if (typeof value === 'string' && (isRenderResourceField(key) || parentType === 'image' && ['defaultValue','content'].includes(key))) {
        for (const match of value.matchAll(new RegExp(TEMPLATE_PLACEHOLDER_REGEX))) resourceData.add(match[1]);
      } else if (Array.isArray(value)) value.forEach(v => collectBindings(v,key,parentType,depth+1));
      else if (value && typeof value === 'object') Object.entries(value).filter(([k]) => !['templatePreviewData','data','backingData'].includes(k)).forEach(([k,v]) => collectBindings(v,k,String(k === 'content' && (value as Record<string,unknown>).imageSource ? '' : (value as Record<string,unknown>).type ?? ''),depth+1));
    };
    collectBindings(content);
    if (isRepositoryTemplate(content)) {
      const data = { ...content.templatePreviewData };
      for (const field of content.fieldContracts ?? []) if (data[field.key] === undefined && field.defaultValue !== undefined) data[field.key] = field.defaultValue;
      for (const element of content.freeformCanvas?.elements ?? []) if (element.type === 'text') {
        for (const match of (element.content || '').matchAll(new RegExp(TEMPLATE_PLACEHOLDER_REGEX))) {
          if (resourceData.has(match[1]) && typeof data[match[1]] === 'string' && String(data[match[1]]).startsWith('cardforge-pipeline-asset://')) throw new PipelineRegistryCommandError('This exact source shares a managed artwork binding with printable text. No text or artwork was substituted.',400);
        }
      }
    }
    content = await hydrate(content, 0, '', resourceData);
  } else {
    if (!s.source_storage_bucket || !s.source_storage_path) throw new PipelineRegistryCommandError('This revision lacks an exact managed source tuple.', 400);
    const result = await download(s.source_storage_bucket, s.source_storage_path); bytes = result.bytes; mimeType ||= result.mimeType;
    if (s.source_content_sha256 && createHash('sha256').update(bytes).digest('hex') !== s.source_content_sha256) throw new PipelineRegistryCommandError('Managed source bytes changed.', 409);
  }
  if (digest(await read()) !== digest(snapshot)) throw new PipelineRegistryCommandError('Pipeline revision or publication changed during inspection.', 409);
  return {
    sourceIntegrity: bytes ? (s.source_content_sha256 ? { kind: 'verified-source-digest' as const, notice: 'Source bytes match the retained immutable digest.' } : { kind: 'observed-source-bytes' as const, notice: 'Legacy source: this render is bound to bytes observed now at the retained source location. Original publication bytes are not certified.' }) : { kind: 'authored-payload' as const, notice: 'Exact authored payload and embedded content-addressed dependencies.' },
    title: s.name, assetType: s.asset_type as string, content, bytes, presentation: parsePipelineMediaPresentation(s.media_presentation), mimeType: mimeType as string | null,
    sourceVersion: digest({ snapshot, content, bytes: bytes ? createHash('sha256').update(bytes).digest('hex') : null }),
    identity: { assetId: target.assetId, submissionId: s.id as string, lineageId: target.lineageId, revisionNumber: s.revision_number as number | null, publicationUpdatedAt: r?.updated_at ?? null },
  };
}
