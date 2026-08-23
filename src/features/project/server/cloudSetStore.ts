import { createHash } from 'node:crypto';

import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { getUtf8ByteLength } from '@/infrastructure/http/apiValidation';
import type { BoundaryFailureKind, BoundaryLimit } from '@/shared/boundaryFailure';
import { parseCardForgeTransferValue, type CardForgeTransferV1 } from '../model/cardTransfer';
import {
  CLOUD_SET_ASSET_BUCKET,
  getCloudSetAssetIdFromReference,
  isCloudSetAssetId,
  isCloudSetAssetMimeType,
  MAX_CLOUD_SET_ASSET_BYTES,
  MAX_CLOUD_SET_ASSETS,
  MAX_CLOUD_SET_BYTES,
  MAX_CLOUD_SET_METADATA_BYTES,
  type CloudSetAssetDescriptor,
  type CloudSetDownloadResult,
  type CloudSetListResult,
  type CloudSetPrepareResult,
  type CloudSetSummary,
} from '../model/cloudSet';

export class CloudSetStoreError extends Error {
  status: number;
  kind?: BoundaryFailureKind;
  nextAction?: string;
  limit?: BoundaryLimit;

  constructor(message: string, status = 500, options: {
    kind?: BoundaryFailureKind;
    nextAction?: string;
    limit?: BoundaryLimit;
  } = {}) {
    super(message);
    this.name = 'CloudSetStoreError';
    this.status = status;
    this.kind = options.kind;
    this.nextAction = options.nextAction;
    this.limit = options.limit;
  }
}

interface CloudSetRow {
  id: string;
  owner_user_id: string;
  set_id: string;
  name: string;
  revision: number;
  payload: unknown;
  asset_manifest: unknown;
  card_count: number;
  metadata_bytes: number;
  storage_bytes: number | string;
  created_at: string;
  updated_at: string;
}

const CLOUD_SET_COLUMNS = 'id,owner_user_id,set_id,name,revision,payload,asset_manifest,card_count,metadata_bytes,storage_bytes,created_at,updated_at';

const requireStore = () => {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new CloudSetStoreError('Cloud set storage is not configured yet.', 503);
  return supabase;
};

const toSummary = (row: CloudSetRow): CloudSetSummary => ({
  setId: row.set_id,
  name: row.name,
  revision: row.revision,
  cardCount: row.card_count,
  storageBytes: Number(row.storage_bytes) || 0,
  metadataBytes: row.metadata_bytes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const getSetStoragePrefix = (ownerUserId: string, setId: string) => {
  const ownerKey = ownerUserId.replace(/[^a-zA-Z0-9_-]/gu, '_').slice(0, 100);
  const setKey = createHash('sha256').update(setId).digest('hex').slice(0, 32);
  return `${ownerKey}/${setKey}`;
};

const validateDescriptors = (assets: CloudSetAssetDescriptor[]) => {
  if (assets.length > MAX_CLOUD_SET_ASSETS) {
    throw new CloudSetStoreError(`A cloud set can contain at most ${MAX_CLOUD_SET_ASSETS} embedded artwork files.`, 413);
  }
  const ids = new Set<string>();
  let assetBytes = 0;
  for (const asset of assets) {
    if (!isCloudSetAssetId(asset.id) || ids.has(asset.id)) {
      throw new CloudSetStoreError('Cloud artwork identifiers are invalid or duplicated.', 400);
    }
    if (!isCloudSetAssetMimeType(asset.mimeType)) {
      throw new CloudSetStoreError('Cloud artwork contains an unsupported image type.', 400);
    }
    if (!Number.isInteger(asset.size) || asset.size <= 0 || asset.size > MAX_CLOUD_SET_ASSET_BYTES) {
      throw new CloudSetStoreError(`Each cloud artwork file must be ${Math.round(MAX_CLOUD_SET_ASSET_BYTES / 1024 / 1024)} MB or smaller.`, 413);
    }
    ids.add(asset.id);
    assetBytes += asset.size;
  }
  return { ids, assetBytes };
};

const collectReferencedAssetIds = (value: unknown, ids = new Set<string>()): Set<string> => {
  if (typeof value === 'string') {
    const id = getCloudSetAssetIdFromReference(value);
    if (id) ids.add(id);
    return ids;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectReferencedAssetIds(entry, ids));
    return ids;
  }
  if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((entry) => collectReferencedAssetIds(entry, ids));
  }
  return ids;
};

const validatePayload = ({
  setId,
  name,
  payload,
  assets,
}: {
  setId: string;
  name: string;
  payload: unknown;
  assets: CloudSetAssetDescriptor[];
}) => {
  const normalizedSetId = setId.trim();
  const normalizedName = name.trim().replace(/\s+/gu, ' ');
  if (!normalizedSetId || normalizedSetId.length > 160 || !normalizedName || normalizedName.length > 160) {
    throw new CloudSetStoreError('Cloud set id and name are required and must be 160 characters or fewer.', 400);
  }
  const transfer = parseCardForgeTransferValue(payload);
  if (!transfer || transfer.kind !== 'set' || transfer.sets.length !== 1 || transfer.sets[0]?.id !== normalizedSetId) {
    throw new CloudSetStoreError('Cloud saves require one valid CardForge set transfer matching the selected set.', 400);
  }
  const metadataBytes = getUtf8ByteLength(JSON.stringify(payload));
  if (metadataBytes > MAX_CLOUD_SET_METADATA_BYTES) {
    throw new CloudSetStoreError('This set has too much non-artwork data for one cloud save.', 413);
  }
  const descriptorResult = validateDescriptors(assets);
  const referencedIds = collectReferencedAssetIds(payload);
  if (referencedIds.size !== descriptorResult.ids.size || [...referencedIds].some((id) => !descriptorResult.ids.has(id))) {
    throw new CloudSetStoreError('Cloud artwork manifest does not match the artwork referenced by this set.', 400);
  }
  const storageBytes = metadataBytes + descriptorResult.assetBytes;
  if (storageBytes > MAX_CLOUD_SET_BYTES) {
    throw new CloudSetStoreError(`This set exceeds the ${Math.round(MAX_CLOUD_SET_BYTES / 1024 / 1024)} MB cloud-save limit.`, 413);
  }
  return {
    setId: normalizedSetId,
    name: normalizedName,
    transfer,
    metadataBytes,
    storageBytes,
  };
};

const getExistingRow = async (ownerUserId: string, setId: string): Promise<CloudSetRow | null> => {
  const { data, error } = await requireStore()
    .from('cardforge_cloud_sets')
    .select(CLOUD_SET_COLUMNS)
    .eq('owner_user_id', ownerUserId)
    .eq('set_id', setId)
    .maybeSingle();
  if (error) throw new CloudSetStoreError('Unable to load the cloud set.');
  return data ? data as unknown as CloudSetRow : null;
};

const assertSlotAvailable = async (ownerUserId: string, setId: string, limit: number) => {
  if (await getExistingRow(ownerUserId, setId)) return;
  const { count, error } = await requireStore()
    .from('cardforge_cloud_sets')
    .select('id', { count: 'exact', head: true })
    .eq('owner_user_id', ownerUserId);
  if (error) throw new CloudSetStoreError('Unable to check cloud save capacity.');
  if ((count ?? 0) >= limit) {
    throw new CloudSetStoreError(
      limit === 1
        ? 'Your Free account already has its 1 cloud-saved set. Remove that cloud save or activate Creator Pass for 5 cloud set slots.'
        : `Your account already has all ${limit} cloud set slots in use. Remove one cloud save before adding another.`,
      409,
      {
        kind: 'limit',
        nextAction: 'Remove an existing cloud save, then try again. Device-local sets are unaffected.',
        limit: {
          resource: 'cloud_set_slots',
          current: count ?? 0,
          maximum: limit,
          unit: 'sets',
        },
      },
    );
  }
};

const listStoredAssets = async (prefix: string) => {
  const { data, error } = await requireStore().storage.from(CLOUD_SET_ASSET_BUCKET).list(prefix, {
    limit: MAX_CLOUD_SET_ASSETS,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error) throw new CloudSetStoreError('Unable to inspect private cloud artwork.');
  return data ?? [];
};

const objectSize = (value: unknown): number | null => {
  if (!value || typeof value !== 'object') return null;
  const metadata = (value as { metadata?: unknown }).metadata;
  if (!metadata || typeof metadata !== 'object') return null;
  const size = Number((metadata as Record<string, unknown>).size);
  return Number.isFinite(size) ? size : null;
};

export const listCloudSets = async (
  ownerUserId: string,
  limit: number,
): Promise<CloudSetListResult> => {
  const { data, error } = await requireStore()
    .from('cardforge_cloud_sets')
    .select(CLOUD_SET_COLUMNS)
    .eq('owner_user_id', ownerUserId)
    .order('updated_at', { ascending: false });
  if (error) throw new CloudSetStoreError('Unable to list cloud-saved sets.');
  const sets = (data ?? []).map((row) => toSummary(row as unknown as CloudSetRow));
  return { sets, limit, used: sets.length };
};

export const prepareCloudSetUploads = async ({
  ownerUserId,
  slotLimit,
  setId,
  name,
  payload,
  assets,
}: {
  ownerUserId: string;
  slotLimit: number;
  setId: string;
  name: string;
  payload: unknown;
  assets: CloudSetAssetDescriptor[];
}): Promise<CloudSetPrepareResult> => {
  const validated = validatePayload({ setId, name, payload, assets });
  await assertSlotAvailable(ownerUserId, validated.setId, slotLimit);
  const prefix = getSetStoragePrefix(ownerUserId, validated.setId);
  const existing = await listStoredAssets(prefix);
  const existingByName = new Map(existing.map((item) => [item.name, item]));
  const missing = assets.filter((asset) => {
    const stored = existingByName.get(asset.id);
    const storedSize = objectSize(stored);
    return !stored || (storedSize !== null && storedSize !== asset.size);
  });
  const uploads = await Promise.all(missing.map(async (asset) => {
    const { data, error } = await requireStore().storage
      .from(CLOUD_SET_ASSET_BUCKET)
      .createSignedUploadUrl(`${prefix}/${asset.id}`, { upsert: true });
    if (error || !data?.signedUrl) throw new CloudSetStoreError('Unable to prepare private artwork upload.');
    return { ...asset, signedUrl: data.signedUrl };
  }));
  return {
    setId: validated.setId,
    metadataBytes: validated.metadataBytes,
    storageBytes: validated.storageBytes,
    uploads,
  };
};

export const saveCloudSet = async ({
  ownerUserId,
  slotLimit,
  setId,
  name,
  payload,
  assets,
  expectedRevision,
}: {
  ownerUserId: string;
  slotLimit: number;
  setId: string;
  name: string;
  payload: unknown;
  assets: CloudSetAssetDescriptor[];
  expectedRevision?: number | null;
}): Promise<CloudSetSummary> => {
  const validated = validatePayload({ setId, name, payload, assets });
  await assertSlotAvailable(ownerUserId, validated.setId, slotLimit);
  const prefix = getSetStoragePrefix(ownerUserId, validated.setId);
  const storedAssets = await listStoredAssets(prefix);
  const storedByName = new Map(storedAssets.map((item) => [item.name, item]));
  for (const asset of assets) {
    const stored = storedByName.get(asset.id);
    const actualSize = objectSize(stored);
    if (!stored || (actualSize !== null && actualSize !== asset.size)) {
      throw new CloudSetStoreError('One or more cloud artwork uploads are incomplete. Retry the cloud save.', 409);
    }
  }

  const current = await getExistingRow(ownerUserId, validated.setId);
  if (current && expectedRevision !== undefined && expectedRevision !== null && expectedRevision !== current.revision) {
    throw new CloudSetStoreError(
      `This cloud set is already revision ${current.revision}. Reload the cloud library before replacing it.`,
      409,
    );
  }

  const nextValues = {
    name: validated.name,
    payload,
    asset_manifest: assets,
    card_count: validated.transfer.cards.length,
    metadata_bytes: validated.metadataBytes,
    storage_bytes: validated.storageBytes,
  };
  let saved: CloudSetRow | null = null;
  if (current) {
    const { data, error } = await requireStore()
      .from('cardforge_cloud_sets')
      .update({ ...nextValues, revision: current.revision + 1 })
      .eq('id', current.id)
      .eq('owner_user_id', ownerUserId)
      .eq('revision', current.revision)
      .select(CLOUD_SET_COLUMNS)
      .maybeSingle();
    if (error) throw new CloudSetStoreError('Unable to update the cloud set.');
    if (!data) throw new CloudSetStoreError('The cloud set changed while it was being saved. Reload and retry.', 409);
    saved = data as unknown as CloudSetRow;
  } else {
    const { data, error } = await requireStore()
      .from('cardforge_cloud_sets')
      .insert({
        owner_user_id: ownerUserId,
        set_id: validated.setId,
        ...nextValues,
      })
      .select(CLOUD_SET_COLUMNS)
      .single();
    if (error || !data) throw new CloudSetStoreError('Unable to create the cloud set.');
    saved = data as unknown as CloudSetRow;
  }

  const keep = new Set(assets.map((asset) => asset.id));
  const stalePaths = storedAssets
    .filter((item) => !keep.has(item.name))
    .map((item) => `${prefix}/${item.name}`);
  if (stalePaths.length > 0) {
    const { error } = await requireStore().storage.from(CLOUD_SET_ASSET_BUCKET).remove(stalePaths);
    if (error) console.error('Unable to clean stale cloud set artwork:', error);
  }
  return toSummary(saved);
};

const readAssetManifest = (value: unknown): CloudSetAssetDescriptor[] => {
  if (!Array.isArray(value)) throw new CloudSetStoreError('The cloud set artwork manifest is invalid.', 500);
  return value.map((entry) => {
    if (!entry || typeof entry !== 'object') throw new CloudSetStoreError('The cloud set artwork manifest is invalid.', 500);
    const record = entry as Record<string, unknown>;
    const descriptor = {
      id: String(record.id ?? ''),
      mimeType: String(record.mimeType ?? ''),
      size: Number(record.size),
    };
    validateDescriptors([descriptor as CloudSetAssetDescriptor]);
    return descriptor as CloudSetAssetDescriptor;
  });
};

export const getCloudSet = async (
  ownerUserId: string,
  setId: string,
): Promise<CloudSetDownloadResult> => {
  const row = await getExistingRow(ownerUserId, setId);
  if (!row) throw new CloudSetStoreError('Cloud set not found.', 404);
  const payload = parseCardForgeTransferValue(row.payload);
  if (!payload || payload.kind !== 'set') throw new CloudSetStoreError('The cloud set payload is invalid.', 500);
  const manifest = readAssetManifest(row.asset_manifest);
  const prefix = getSetStoragePrefix(ownerUserId, row.set_id);
  const paths = manifest.map((asset) => `${prefix}/${asset.id}`);
  const signed = paths.length > 0
    ? await requireStore().storage.from(CLOUD_SET_ASSET_BUCKET).createSignedUrls(paths, 15 * 60)
    : { data: [], error: null };
  if (signed.error) throw new CloudSetStoreError('Unable to authorize private cloud artwork downloads.');
  const signedByPath = new Map((signed.data ?? []).map((entry) => [entry.path, entry.signedUrl]));
  return {
    summary: toSummary(row),
    payload: payload as CardForgeTransferV1,
    assets: manifest.map((asset, index) => {
      const signedUrl = signedByPath.get(paths[index]!) ?? null;
      if (!signedUrl) throw new CloudSetStoreError('One of the private cloud artwork files is unavailable.', 500);
      return { ...asset, signedUrl };
    }),
  };
};

export const deleteCloudSet = async (
  ownerUserId: string,
  setId: string,
  expectedRevision?: number | null,
): Promise<void> => {
  const row = await getExistingRow(ownerUserId, setId);
  if (!row) throw new CloudSetStoreError('Cloud set not found.', 404);
  if (expectedRevision !== undefined && expectedRevision !== null && row.revision !== expectedRevision) {
    throw new CloudSetStoreError(
      `This cloud set is already revision ${row.revision}. Reload the cloud library before deleting it.`,
      409,
    );
  }
  let deletion = requireStore()
    .from('cardforge_cloud_sets')
    .delete()
    .eq('id', row.id)
    .eq('owner_user_id', ownerUserId);
  if (expectedRevision !== undefined && expectedRevision !== null) {
    deletion = deletion.eq('revision', expectedRevision);
  }
  const { data, error } = await deletion.select('id').maybeSingle();
  if (error) throw new CloudSetStoreError('Unable to remove the cloud set.');
  if (!data) throw new CloudSetStoreError('The cloud set changed while it was being deleted. Reload and retry.', 409);
  const prefix = getSetStoragePrefix(ownerUserId, setId);
  const objects = await listStoredAssets(prefix);
  const paths = objects.map((item) => `${prefix}/${item.name}`);
  if (paths.length > 0) {
    const result = await requireStore().storage.from(CLOUD_SET_ASSET_BUCKET).remove(paths);
    if (result.error) console.error('Unable to clean deleted cloud set artwork:', result.error);
  }
};
