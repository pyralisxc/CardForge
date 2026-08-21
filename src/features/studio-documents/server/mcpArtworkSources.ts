import { lookup } from 'node:dns/promises';
import type { IncomingMessage } from 'node:http';
import { request as httpsRequest, type RequestOptions } from 'node:https';
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

export const MAX_MCP_ARTWORK_ITEMS_PER_OPERATION = 64;
export const MAX_MCP_ARTWORK_BYTES_PER_OPERATION = 32 * 1024 * 1024;

export interface McpArtworkOperationBudget {
  consumeRemoteBytes: (bytes: number) => void;
}

const estimatedBase64Bytes = (value: string) => Math.floor(value.replace(/\s/gu, '').length * 3 / 4);

export const createMcpArtworkOperationBudget = (
  sources: McpArtworkSource[],
): McpArtworkOperationBudget => {
  if (sources.length > MAX_MCP_ARTWORK_ITEMS_PER_OPERATION) {
    throw new StudioDocumentStoreError(
      `One card write can include at most ${MAX_MCP_ARTWORK_ITEMS_PER_OPERATION} artwork files. Split larger sets across revision-safe calls.`,
      413,
    );
  }
  let consumedBytes = sources.reduce((total, source) => (
    total + (source.data ? estimatedBase64Bytes(source.data) : 0)
  ), 0);
  if (consumedBytes > MAX_MCP_ARTWORK_BYTES_PER_OPERATION) {
    throw new StudioDocumentStoreError('Artwork exceeds the 32 MB aggregate limit for one card write.', 413);
  }
  return {
    consumeRemoteBytes: (bytes) => {
      consumedBytes += bytes;
      if (consumedBytes > MAX_MCP_ARTWORK_BYTES_PER_OPERATION) {
        throw new StudioDocumentStoreError('Artwork exceeds the 32 MB aggregate limit for one card write.', 413);
      }
    },
  };
};

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

interface ResolvedPublicUrl {
  url: URL;
  address: string;
  family: 4 | 6;
}

const requirePublicHttpsUrl = async (value: string): Promise<ResolvedPublicUrl> => {
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
  const selected = addresses[0]!;
  return { url, address: selected.address, family: selected.family === 6 ? 6 : 4 };
};

const readBoundedResponse = async (response: IncomingMessage): Promise<Buffer> => {
  const declared = Number(response.headers['content-length']);
  if (Number.isFinite(declared) && declared > MAX_EMBEDDED_TEMPLATE_ASSET_BYTES) {
    throw new StudioDocumentStoreError('Remote artwork must be 2.4 MB or smaller before CardForge normalization.', 413);
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const value of response) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
    size += chunk.byteLength;
    if (size > MAX_EMBEDDED_TEMPLATE_ASSET_BYTES) {
      response.destroy();
      throw new StudioDocumentStoreError('Remote artwork must be 2.4 MB or smaller before CardForge normalization.', 413);
    }
    chunks.push(chunk);
  }
  if (size === 0) throw new StudioDocumentStoreError('Remote artwork returned an empty response.', 400);
  return Buffer.concat(chunks, size);
};

const requestPinned = (
  resolved: ResolvedPublicUrl,
  signal: AbortSignal,
): Promise<IncomingMessage> => new Promise((resolve, reject) => {
  const options: RequestOptions & { autoSelectFamily: boolean } = {
    autoSelectFamily: false,
    headers: { Accept: 'image/png,image/jpeg,image/webp' },
    lookup: (_hostname, _options, callback) => {
      callback(null, resolved.address, resolved.family);
    },
    servername: resolved.url.hostname,
    signal,
  };
  const request = httpsRequest(resolved.url, options, resolve);
  request.on('error', reject);
  request.end();
});

const downloadArtwork = async (
  sourceUrl: string,
  mimeType: EmbeddedTemplateAssetMimeType,
  budget: McpArtworkOperationBudget,
): Promise<Buffer> => {
  let resolved = await requirePublicHttpsUrl(sourceUrl);
  const signal = AbortSignal.timeout(10_000);
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    try {
      const response = await requestPinned(resolved, signal);
      const status = response.statusCode ?? 0;
      if ([301, 302, 303, 307, 308].includes(status)) {
        const location = response.headers.location;
        response.destroy();
        if (!location || redirect === 3) throw new StudioDocumentStoreError('Remote artwork redirected too many times.', 400);
        resolved = await requirePublicHttpsUrl(new URL(location, resolved.url).toString());
        continue;
      }
      if (status < 200 || status >= 300) {
        response.destroy();
        throw new StudioDocumentStoreError('CardForge could not download the remote artwork.', 400);
      }
      const responseType = response.headers['content-type']?.split(';')[0]?.trim().toLowerCase();
      if (responseType?.startsWith('image/') && responseType !== mimeType) {
        response.destroy();
        throw new StudioDocumentStoreError('Remote artwork content type does not match mimeType.', 400);
      }
      const bytes = await readBoundedResponse(response);
      budget.consumeRemoteBytes(bytes.byteLength);
      return bytes;
    } catch (error) {
      if (error instanceof StudioDocumentStoreError) throw error;
      throw new StudioDocumentStoreError('CardForge could not securely download the remote artwork.', 400);
    }
  }
  throw new StudioDocumentStoreError('CardForge could not download the remote artwork.', 400);
};

export const normalizeMcpArtworkSource = async (
  source: McpArtworkSource,
  budget = createMcpArtworkOperationBudget([source]),
) => {
  const hasData = typeof source.data === 'string' && source.data.length > 0;
  const hasUrl = typeof source.sourceUrl === 'string' && source.sourceUrl.length > 0;
  if (hasData === hasUrl) {
    throw new StudioDocumentStoreError('Artwork requires exactly one source: raw base64 data or an HTTPS sourceUrl.', 400);
  }
  const data = hasData
    ? source.data!
    : (await downloadArtwork(source.sourceUrl!, source.mimeType, budget)).toString('base64');
  return normalizeEmbeddedTemplateAsset({ data, mimeType: source.mimeType });
};
