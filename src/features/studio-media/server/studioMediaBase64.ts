import { MAX_STUDIO_MEDIA_BYTES } from './studioMediaImage';
import { StudioMediaError } from './StudioMediaError';

const MAX_STUDIO_MEDIA_BASE64_CHARS = Math.ceil(MAX_STUDIO_MEDIA_BYTES / 3) * 4 + 4;
const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

export const decodeStudioMediaBase64 = (value: string): Buffer => {
  const encoded = value.replace(/\s+/g, '');
  if (!encoded || encoded.length > MAX_STUDIO_MEDIA_BASE64_CHARS || !BASE64_PATTERN.test(encoded)) {
    throw new StudioMediaError('Generated Studio media must be valid base64 image data up to 8 MB.', 400);
  }
  const remainder = encoded.length % 4;
  if (remainder === 1) {
    throw new StudioMediaError('Generated Studio media contains invalid base64 image data.', 400);
  }
  const padded = remainder === 0 ? encoded : `${encoded}${'='.repeat(4 - remainder)}`;
  const bytes = Buffer.from(padded, 'base64');
  if (bytes.byteLength <= 0 || bytes.byteLength > MAX_STUDIO_MEDIA_BYTES) {
    throw new StudioMediaError('Generated Studio media must be 8 MB or smaller.', 413);
  }
  const normalizedInput = padded.replace(/=+$/, '');
  const normalizedOutput = bytes.toString('base64').replace(/=+$/, '');
  if (normalizedInput !== normalizedOutput) {
    throw new StudioMediaError('Generated Studio media contains invalid base64 image data.', 400);
  }
  return bytes;
};
