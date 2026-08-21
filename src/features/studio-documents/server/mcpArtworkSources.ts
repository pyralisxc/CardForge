import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import {
  MAX_EMBEDDED_TEMPLATE_ASSET_BYTES,
  normalizeEmbeddedTemplateAsset,
  type EmbeddedTemplateAssetMimeType,
} from './embeddedTemplateAssets';
import { StudioDocumentStoreError } from './StudioDocumentStoreError';

export interface McpArtworkSource {
  mimeType: EmbeddedTemplateAssetMimeType;
  data?: string;
  sourceUrl?: string;
}

const isPrivateIpv4 = (address: string): boolean => {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value))) return true;
  return octets[0] === 10
    || octets[0] === 127
    || (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127)
    || (octets[0] === 169 && octets[1] === 254)
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168)
    || (octets[0] === 192 && octets[1] === 0)
    || (octets[0] === 198 && (octets[1] === 18 || octets[1] === 19))
    || (octets[0] === 198 && octets[1] === 51 && octets[2] === 100)
    || (octets[0] === 203 && octets[1] === 0 && octets[2] === 113)
    || octets[0] === 0
    || octets[0] >= 224;
};

const isPrivateAddress = (address: string): boolean => {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version !== 6) return true;
  const normalized = address.toLowerCase();
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    if (mapped.includes('.')) return isPrivateIpv4(mapped);
    const groups = mapped.split(':');
    if (groups.length === 2 && groups.every((group) => /^[a-f0-9]{1,4}$/u.test(group))) {
      const high = Number.parseInt(groups[0], 16);
      const low = Number.parseInt(groups[1], 16);
      return isPrivateIpv4(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
    }
    return true;
  }
  return normalized === '::1'
    || normalized === '::'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || normalized.startsWith('fe8')
    || normalized.startsWith('fe9')
    || normalized.startsWith('fea')
    || normalized.startsWith('feb')
    || normalized.startsWith('ff')
    || normalized.startsWith('2001:db8:');
};

const requirePublicHttpsUrl = async (value: string): Promise<URL> => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new StudioDocumentStoreError('Artwork sourceUrl must be a valid HTTPS URL.', 400);
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new StudioDocumentStoreError('Artwork sourceUrl must use HTTPS without embedded credentials.', 400);
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new StudioDocumentStoreError('Artwork sourceUrl must resolve to a public host.', 400);
  }
  const addresses = await lookup(hostname, { all: true, verbatim: true }).catch(() => []);
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new StudioDocumentStoreError('Artwork sourceUrl must resolve only to public network addresses.', 400);
  }
  return url;
};

const readBoundedResponse = async (response: Response): Promise<Buffer> => {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_EMBEDDED_TEMPLATE_ASSET_BYTES) {
    throw new StudioDocumentStoreError('Remote artwork must be 2.4 MB or smaller before CardForge normalization.', 413);
  }
  if (!response.body) throw new StudioDocumentStoreError('Remote artwork returned an empty response.', 400);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_EMBEDDED_TEMPLATE_ASSET_BYTES) {
      await reader.cancel();
      throw new StudioDocumentStoreError('Remote artwork must be 2.4 MB or smaller before CardForge normalization.', 413);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), size);
};

const downloadArtwork = async (sourceUrl: string, mimeType: EmbeddedTemplateAssetMimeType): Promise<Buffer> => {
  let url = await requirePublicHttpsUrl(sourceUrl);
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(url, {
        cache: 'no-store',
        redirect: 'manual',
        signal: controller.signal,
        headers: { Accept: 'image/png,image/jpeg,image/webp' },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location || redirect === 3) throw new StudioDocumentStoreError('Remote artwork redirected too many times.', 400);
        url = await requirePublicHttpsUrl(new URL(location, url).toString());
        continue;
      }
      if (!response.ok) throw new StudioDocumentStoreError('CardForge could not download the remote artwork.', 400);
      const responseType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
      if (responseType?.startsWith('image/') && responseType !== mimeType) {
        throw new StudioDocumentStoreError('Remote artwork content type does not match mimeType.', 400);
      }
      return await readBoundedResponse(response);
    } catch (error) {
      if (error instanceof StudioDocumentStoreError) throw error;
      throw new StudioDocumentStoreError('CardForge could not securely download the remote artwork.', 400);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new StudioDocumentStoreError('CardForge could not download the remote artwork.', 400);
};

export const normalizeMcpArtworkSource = async (source: McpArtworkSource) => {
  const hasData = typeof source.data === 'string' && source.data.length > 0;
  const hasUrl = typeof source.sourceUrl === 'string' && source.sourceUrl.length > 0;
  if (hasData === hasUrl) {
    throw new StudioDocumentStoreError('Artwork requires exactly one source: raw base64 data or an HTTPS sourceUrl.', 400);
  }
  const data = hasData
    ? source.data!
    : (await downloadArtwork(source.sourceUrl!, source.mimeType)).toString('base64');
  return normalizeEmbeddedTemplateAsset({ data, mimeType: source.mimeType });
};
