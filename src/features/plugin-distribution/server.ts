import 'server-only';
import { getCurrentCardforgeUserAccess } from '@/features/account/server';
import { getCurrentContributorAccess, ContributorAccessError } from '@/features/contributor-access/server';
import { AccountToolAccessError } from '@/features/account/server';
import { mayDownloadPlugin } from './model/downloadPolicy';
import { buildCurrentPlugin } from './server/pluginReleases';
import type { PluginProduct, PluginEnvironment } from './server/pluginReleases';
export type { PluginProduct, PluginEnvironment } from './server/pluginReleases';
export { buildCurrentPlugin };
export async function pluginDownloadAccess(product: PluginProduct, environment: PluginEnvironment): Promise<200 | 401 | 403> {
  if (mayDownloadPlugin(product, environment, false, false)) return 200;
  try {
    const account = await getCurrentCardforgeUserAccess();
    if (account.ownerAccess.isOwner && account.ownerAccess.userId) return 200;
    if (!account.user) return 401;
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
