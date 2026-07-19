import { nanoid } from 'nanoid';

import { getCurrentCardforgeUserAccess, resolveAccountEntitlement } from '@/features/account/server';
import { createApiErrorResponse, createNoStoreJsonResponse } from '@/infrastructure/http/apiResponses';
import {
  DEVELOPER_ASSET_STORAGE_BUCKET,
  DEVELOPER_ASSET_UPLOAD_ALLOWED_MIME_TYPES,
  DEVELOPER_ASSET_UPLOAD_MAX_BYTES,
  isDeveloperAssetType,
  type DeveloperAssetType,
} from '@/features/developer-assets/server';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { consumeRateLimit, RateLimitUnavailableError } from '@/infrastructure/security/abuseProtection';

export const dynamic = 'force-dynamic';

const ALLOWED_MIME_TYPES = new Set<string>(DEVELOPER_ASSET_UPLOAD_ALLOWED_MIME_TYPES);
const ALLOWED_EXTENSIONS = new Set(['svg', 'png', 'jpg', 'jpeg', 'webp', 'json', 'woff2', 'woff', 'ttf', 'otf']);
const FONT_EXTENSIONS = new Set(['woff2', 'woff', 'ttf', 'otf']);
const NON_FONT_EXTENSIONS = new Set(['svg', 'png', 'jpg', 'jpeg', 'webp', 'json']);

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
  if (file.type === 'font/woff2') return 'woff2';
  if (file.type === 'font/woff' || file.type === 'application/font-woff') return 'woff';
  if (file.type === 'font/ttf' || file.type === 'application/x-font-ttf') return 'ttf';
  if (file.type === 'font/otf' || file.type === 'application/x-font-otf') return 'otf';
  return '';
};

export async function POST(request: Request) {
  try {
    const access = await getDeveloperAccess();
    if (!access.ok) return access.response;
    const rateLimit = await consumeRateLimit({
      action: 'developer-upload',
      identity: access.user.id,
      limit: 30,
      windowSeconds: 3600,
    });
    if (!rateLimit.allowed) {
      return createApiErrorResponse(429, 'rate_limited', 'Too many developer uploads. Please try again later.');
    }

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
    if (file.size <= 0 || file.size > DEVELOPER_ASSET_UPLOAD_MAX_BYTES) {
      return createApiErrorResponse(413, 'payload_too_large', 'Developer asset files must be 10 MB or smaller.');
    }
    const extension = getFileExtension(file);
    const isFontUpload = assetTypeValue === 'fonts';
    const extensionAllowedForType = isFontUpload ? FONT_EXTENSIONS.has(extension) : NON_FONT_EXTENSIONS.has(extension);
    if (!ALLOWED_EXTENSIONS.has(extension) || !extensionAllowedForType || (file.type && !ALLOWED_MIME_TYPES.has(file.type))) {
      return createApiErrorResponse(400, 'developer_asset_request_invalid', isFontUpload
        ? 'Upload WOFF2, WOFF, TTF, or OTF font assets.'
        : 'Upload SVG, PNG, JPG, WEBP, or JSON assets.');
    }

    const assetType = assetTypeValue as DeveloperAssetType;
    const safeStem = sanitizeFileStem(file.name);
    const storagePath = `${access.user.id}/${assetType}/${Date.now()}-${safeStem}-${nanoid(8)}.${extension}`;
    const { error: uploadError } = await supabase
      .storage
      .from(DEVELOPER_ASSET_STORAGE_BUCKET)
      .upload(storagePath, await file.arrayBuffer(), {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      console.error('Failed to upload developer asset file:', uploadError);
      return createApiErrorResponse(500, 'developer_asset_unavailable', 'Unable to upload developer asset file.');
    }

    const { data } = supabase.storage.from(DEVELOPER_ASSET_STORAGE_BUCKET).getPublicUrl(storagePath);
    return createNoStoreJsonResponse({
      bucket: DEVELOPER_ASSET_STORAGE_BUCKET,
      path: storagePath,
      sourceUrl: data.publicUrl,
      previewUrl: data.publicUrl,
      fileSizeBytes: file.size,
      mimeType: file.type,
      fileName: file.name,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      return createApiErrorResponse(503, 'developer_asset_unavailable', error.message);
    }
    console.error('Failed to handle developer asset upload:', error);
    return createApiErrorResponse(
      500,
      'developer_asset_request_invalid',
      'Unable to upload developer asset.'
    );
  }
}
