import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Execute the existing TypeScript source owner, not a second package parser. */
export async function interpretStarterSetPackage(bytes) {
  const directory = await mkdtemp(path.join(process.cwd(), '.set-source-'));
  try {
    const outfile = path.join(directory, 'interpret.mjs');
    await build({ entryPoints: ['src/features/studio-documents/server/setPackageDependencies.ts'],
      outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external',
      tsconfig: 'tsconfig.json', logLevel: 'silent' });
    const { interpretPipelineSetPackage } = await import(pathToFileURL(outfile).href);
    return await interpretPipelineSetPackage(bytes);
  } finally { await rm(directory, { recursive: true, force: true }); }
}
