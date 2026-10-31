import 'server-only';
import { buildCurrentPlugin } from './pluginReleases';
import { createRetainedReleaseStore } from './retainedReleaseStore';
import { admitBuiltRelease } from './retainedReleaseCommands';
type Product = 'studio' | 'owner';
type Environment = 'production' | 'preview';
export class StalePreviewReleaseSelectionError extends Error {}
/** Manual Owner-only admission, invoked after current deployment SHA verification.
 * No timer, build hook, or application startup upload exists.
 */
export async function admitCurrentDeployedRelease(product: Product, environment: Environment, exactSha: string) {
  const deployed = process.env.VERCEL_GIT_COMMIT_SHA;
  if (process.env.VERCEL_ENV !== 'preview' || process.env.VERCEL_GIT_COMMIT_REF !== 'vercel-preview'
    || !deployed || !/^[a-f0-9]{40}$/.test(deployed)) throw new Error('Verified Preview deployment identity required');
  if (deployed !== exactSha) throw new StalePreviewReleaseSelectionError('Stale Preview source selection');
  const store = createRetainedReleaseStore();
  return admitBuiltRelease(store, {
    sourceSha: deployed,
    build: async (p, e) => {
      const result = await buildCurrentPlugin(p, e);
      return { bytes: result.bytes, version: result.version, checksum: result.checksum,
        endpoint: result.endpoint, name: result.name };
    },
  }, { product, environment, changes: 'Reviewed CardForge plugin archive from exact Preview deployment' });
}
