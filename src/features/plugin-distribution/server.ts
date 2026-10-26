import 'server-only';
import { getCurrentOwnerAccess } from '@/features/owner/server';
import { getCurrentContributorAccess, ContributorAccessError } from '@/features/contributor-access/server';
import { AccountToolAccessError } from '@/features/account/server';
import { mayDownloadPlugin } from '../model/downloadPolicy';
import { buildCurrentPlugin } from './pluginReleases';
import type { PluginProduct, PluginEnvironment } from './pluginReleases';
export type { PluginProduct, PluginEnvironment } from './pluginReleases';
export { buildCurrentPlugin };
export async function pluginDownloadAccess(product: PluginProduct, environment: PluginEnvironment): Promise<200 | 401 | 403> {
  if (mayDownloadPlugin(product, environment, false, false)) return 200;
  try {
    const owner = await getCurrentOwnerAccess();
    if (owner.isOwner && owner.userId) return 200;
  } catch (error) {
    if (!(error instanceof AccountToolAccessError)) throw error;
  }
  try {
    await getCurrentContributorAccess();
    return mayDownloadPlugin(product, environment, false, true) ? 200 : 403;
  } catch (error) {
    if (error instanceof AccountToolAccessError) return error.status;
    if (error instanceof ContributorAccessError) return error.status;
    throw error;
  }
}
