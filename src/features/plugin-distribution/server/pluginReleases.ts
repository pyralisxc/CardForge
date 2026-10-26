import 'server-only';
import { buildPluginArchive } from '../../../../scripts/plugin-package-core.mjs';

export type PluginProduct = 'studio' | 'owner';
export type PluginEnvironment = 'production' | 'preview';

export async function buildCurrentPlugin(product: PluginProduct, environment: PluginEnvironment) {
  const result = await buildPluginArchive(product, environment);
  return {
    ...result,
    appSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    releaseDate: process.env.VERCEL_GIT_COMMIT_DATE || null,
    changes: 'Canonical CardForge package with portable and legacy manifests, icon and maintained skills.',
    compatibility: ['Agent Plugins portable manifest', 'CardForge Codex overlay'],
  };
}
