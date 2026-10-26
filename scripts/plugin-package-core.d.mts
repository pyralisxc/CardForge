export function buildPluginArchive(
  product: 'studio' | 'owner',
  environment: 'production' | 'preview',
): Promise<{
  bytes: Buffer;
  checksum: string;
  name: string;
  filename: string;
  version: string;
  environment: 'production' | 'preview';
  endpoint: string;
}>;
