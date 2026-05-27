import { nanoid } from 'nanoid';

import { resolveAccountEntitlement } from '@/lib/accountEntitlement';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/lib/apiResponses';
import { isDeveloperAssetType, type DeveloperAssetType } from '@/lib/developerAssets';
import { getCurrentCardforgeUserAccess } from '@/lib/serverCardforgeUser';
import { getSupabaseServerClient } from '@/lib/supabaseServer';

export const dynamic = 'force-dynamic';

const BUCKET = 'cardforge-developer-assets';
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'image/svg+xml',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/json',
]);
const ALLOWED_EXTENSIONS = new Set(['svg', 'png', 'jpg', 'jpeg', 'webp', 'json']);

const getDeveloperAccess = async () => {
  const { authConfigured, user, ownerAccess } = await getCurrentCardforgeUserAccess();

  if (!user) {
    return {
      ok: false as const,
      response: createApiErrorResponse(401, 'sign_in_required', 'Sign in before uploading developer assets.'),
    };
  }

  const entitlement = resolveAccountEntitlement({
    authConfigured,
    isSignedIn: true,
    emailAddresses: user.emailAddresses,
    privateMetadata: user.privateMetadata,
    ownerAccess,
  });

  const isDeveloper = entitlement.accessMode === 'dev';
  if (!isDeveloper && !ownerAccess.isOwner) {
    return {
      ok: false as const,
      response: createApiErrorResponse(403, 'developer_access_required', 'Developer access is required for asset uploads.'),
    };
  }

  return { ok: true as const, user };
};

const sanitizeFileStem = (value: string): string =>
  value
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'asset';

const getFileExtension = (file: File): string => {
  const nameExtension = file.name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  if (nameExtension) return nameExtension === 'jpeg' ? 'jpg' : nameExtension;
  if (file.type === 'image/svg+xml') return 'svg';
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/jpeg') return 'jpg';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'application/json') return 'json';
  return '';
};

export async function POST(request: Request) {
  try {
    const access = await getDeveloperAccess();
    if (!access.ok) return access.response;

    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return createApiErrorResponse(503, 'developer_asset_unavailable', 'Developer asset storage is not configured yet.');
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const assetTypeValue = formData.get('assetType');
    if (!isDeveloperAssetType(assetTypeValue)) {
      return createApiErrorResponse(400, 'developer_asset_request_invalid', 'Choose a supported asset type.');
    }
    if (!(file instanceof File)) {
      return createApiErrorResponse(400, 'developer_asset_request_invalid', 'Choose a source file to upload.');
    }
    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      return createApiErrorResponse(413, 'payload_too_large', 'Developer asset files must be 10 MB or smaller.');
    }
    const extension = getFileExtension(file);
    if (!ALLOWED_EXTENSIONS.has(extension) || (file.type && !ALLOWED_MIME_TYPES.has(file.type))) {
      return createApiErrorResponse(400, 'developer_asset_request_invalid', 'Upload SVG, PNG, JPG, WEBP, or JSON assets.');
    }

    const assetType = assetTypeValue as DeveloperAssetType;
    const safeStem = sanitizeFileStem(file.name);
    const storagePath = `${access.user.id}/${assetType}/${Date.now()}-${safeStem}-${nanoid(8)}.${extension}`;
    const { error: uploadError } = await supabase
      .storage
      .from(BUCKET)
      .upload(storagePath, await file.arrayBuffer(), {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      console.error('Failed to upload developer asset file:', uploadError);
      return createApiErrorResponse(500, 'developer_asset_unavailable', 'Unable to upload developer asset file.');
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    return createNoStoreJsonResponse({
      bucket: BUCKET,
      path: storagePath,
      sourceUrl: data.publicUrl,
      previewUrl: data.publicUrl,
      fileSizeBytes: file.size,
      mimeType: file.type,
      fileName: file.name,
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to handle developer asset upload:', error);
    return createApiErrorResponse(
      500,
      'developer_asset_request_invalid',
      'Unable to upload developer asset.'
    );
  }
}
