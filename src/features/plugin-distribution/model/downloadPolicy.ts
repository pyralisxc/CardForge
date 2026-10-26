export type PluginProduct = 'studio' | 'owner';
export type PluginEnvironment = 'production' | 'preview';

/** A listing and its download bytes use the same server-owned role decision. */
export function mayDownloadPlugin(
  product: PluginProduct, environment: PluginEnvironment, isOwner: boolean, isContributor: boolean,
): boolean {
  if (product === 'studio' && environment === 'production') return true;
  if (isOwner) return true;
  return product === 'studio' && environment === 'preview' && isContributor;
}
