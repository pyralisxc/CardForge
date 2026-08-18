import { createHmac, timingSafeEqual } from 'node:crypto';

import { StudioDocumentStoreError } from './StudioDocumentStoreError';

const PREVIEW_TOKEN_VERSION = 1 as const;
const PREVIEW_TOKEN_TTL_SECONDS = 15 * 60;
const PREVIEW_TOKEN_PURPOSE = 'cardforge-studio-draft-preview-v1';

interface StudioDocumentPreviewTokenPayload {
  version: 1;
  documentId: string;
  ownerUserId: string;
  revision: number;
  expiresAt: number;
}

const getSigningKey = (): string => {
  const value = process.env.CLERK_SECRET_KEY?.trim();
  if (!value) {
    throw new StudioDocumentStoreError('Studio draft preview signing is not configured.', 503);
  }
  return value;
};

const encodePayload = (payload: StudioDocumentPreviewTokenPayload): string => (
  Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
);

const sign = (encodedPayload: string): string => createHmac('sha256', getSigningKey())
  .update(`${PREVIEW_TOKEN_PURPOSE}.${encodedPayload}`)
  .digest('base64url');

export const createStudioDocumentPreviewToken = ({
  documentId,
  ownerUserId,
  revision,
  now = Date.now(),
}: {
  documentId: string;
  ownerUserId: string;
  revision: number;
  now?: number;
}): string => {
  const payload: StudioDocumentPreviewTokenPayload = {
    version: PREVIEW_TOKEN_VERSION,
    documentId,
    ownerUserId,
    revision,
    expiresAt: Math.floor(now / 1000) + PREVIEW_TOKEN_TTL_SECONDS,
  };
  const encodedPayload = encodePayload(payload);
  return `${encodedPayload}.${sign(encodedPayload)}`;
};

const parsePayload = (encodedPayload: string): StudioDocumentPreviewTokenPayload | null => {
  try {
    const value = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Partial<StudioDocumentPreviewTokenPayload>;
    if (
      value.version !== PREVIEW_TOKEN_VERSION
      || typeof value.documentId !== 'string'
      || typeof value.ownerUserId !== 'string'
      || !Number.isInteger(value.revision)
      || Number(value.revision) < 1
      || !Number.isInteger(value.expiresAt)
    ) return null;
    return value as StudioDocumentPreviewTokenPayload;
  } catch {
    return null;
  }
};

export const readStudioDocumentPreviewToken = (
  token: string,
  now = Date.now(),
): StudioDocumentPreviewTokenPayload | null => {
  const [encodedPayload, suppliedSignature, ...extra] = token.split('.');
  if (!encodedPayload || !suppliedSignature || extra.length > 0) return null;

  let expectedSignature: string;
  try {
    expectedSignature = sign(encodedPayload);
  } catch {
    return null;
  }
  const supplied = Buffer.from(suppliedSignature, 'utf8');
  const expected = Buffer.from(expectedSignature, 'utf8');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  const payload = parsePayload(encodedPayload);
  if (!payload || payload.expiresAt < Math.floor(now / 1000)) return null;
  return payload;
};
