import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const TEST_EXTENSIONS = ['.test.ts', '.test.tsx', '.spec.ts'];

const FEATURE_AREAS = [
  {
    features: ['app-shell', 'creator-workbench', 'desk', 'experience-settings'],
    docs: ['docs/architecture.md#core-ownership', 'docs/product-direction.md#workbench-doctrine'],
  },
  {
    features: ['template-editor', 'card-generator', 'card-rendering', 'render-artifacts'],
    docs: ['docs/architecture.md#card-and-template-model', 'docs/architecture.md#canonical-rendering-doctrine'],
  },
  {
    features: ['project', 'storage-management', 'personal-library', 'library-picker'],
    docs: ['docs/architecture.md#storage-lanes', 'docs/integrations.md#browser-workspace--zustand-and-indexeddb'],
  },
  {
    features: ['studio-documents', 'mcp-usage'],
    docs: ['docs/architecture.md#mcp--agent-authoring', 'docs/integrations.md#mcp--agent-access-to-cardforge-studio'],
  },
  {
    features: ['account', 'billing', 'contributor-access'],
    docs: ['docs/architecture.md#access-model', 'docs/integrations.md'],
  },
  {
    features: ['pipeline', 'contributor-program'],
    docs: ['docs/architecture.md#contributor-pipeline', 'docs/product-direction.md#pipeline-revisions-voting-and-publication'],
  },
  {
    features: ['marketing', 'marketing-content', 'marketing-distribution', 'social-publishing', 'analytics'],
    docs: ['docs/architecture.md#campaign-and-publication-model', 'docs/integrations.md'],
  },
  {
    features: ['public-site', 'brand-presentation', 'business-identity', 'contact', 'legal', 'roadmap', 'owner'],
    docs: ['docs/architecture.md#core-ownership', 'docs/operations.md'],
  },
];

const HIGH_RISK_FEATURES = new Map([
  ['account', 'Clerk'],
  ['billing', 'Stripe'],
  ['contributor-access', 'Clerk + Supabase'],
  ['pipeline', 'Supabase'],
  ['marketing-distribution', 'Resend'],
  ['social-publishing', 'Meta'],
]);

const toPosixPath = (value) => value.replaceAll('\\', '/').replace(/^\.\//u, '');

export const specializedJobsForPath = (inputPath) => {
  const filePath = toPosixPath(inputPath);
  const browserSurface = (
    /^src\//u.test(filePath)
    || /^tests\/product\/(?:fixtures|hosted-smoke|workflows)\//u.test(filePath)
    || /^(?:package(?:-lock)?\.json|playwright(?:\.hosted)?\.config\.ts|scripts\/(?:report-affected-verification|run-changed-browser-specs)\.mjs|\.github\/workflows\/ci\.yml)$/u.test(filePath)
  );
  return browserSurface ? ['browser-golden'] : [];
};

const BROWSER_SMOKE = {
  account: ['account-workspace-lifecycle.spec.ts', 'completed-deletion-cleanup.spec.ts'],
  desk: ['desk-tool-context.spec.ts', 'desk-desktop-drag.spec.ts', 'spatial-gestures.spec.ts'],
  library: ['library-context-review.spec.ts', 'catalog-trash.spec.ts', 'revision-recovery.spec.ts'],
  design: ['studio-controls.spec.ts', 'output-artifacts.spec.ts'],
  output: ['output-artifacts.spec.ts', 'output-handoff.spec.ts'],
  pipeline: ['library-context-review.spec.ts', 'catalog-trash.spec.ts', 'pipeline-source-reactions.spec.ts'],
  site: ['website-updates.spec.ts'],
};
const SMOKE_ROOT = 'tests/product/workflows/';
const ALL_BROWSER_SMOKE = [...new Set(Object.values(BROWSER_SMOKE).flat())].map((file) => SMOKE_ROOT + file).sort();
const FEATURE_SMOKE = {
  desk: ['desk', 'account', 'output'],
  'storage-management': ['library', 'account', 'desk'], 'personal-library': ['library', 'account', 'desk'], 'library-picker': ['library', 'account', 'desk'],
  'template-editor': ['design', 'desk', 'output'],
  'card-generator': ['output', 'design', 'desk'],
  'studio-documents': ['output', 'account'],
};

// Unknown and shared browser surfaces deliberately run all small smoke journeys.
export const browserSmokeForPaths = (changedPaths, { all = false } = {}) => {
  if (all) return [...ALL_BROWSER_SMOKE];
  const selected = new Set();
  for (const changedPath of changedPaths) {
    const filePath = toPosixPath(changedPath);
    if (specializedJobsForPath(filePath).length === 0) continue;
    const feature = /^src\/features\/([^/]+)\//u.exec(filePath)?.[1];
    const groups = !filePath.includes('/server/') && feature && FEATURE_SMOKE[feature];
    const files = groups ? groups.flatMap((group) => BROWSER_SMOKE[group].map((file) => SMOKE_ROOT + file)) : ALL_BROWSER_SMOKE;
    for (const file of files) selected.add(file);
  }
  return [...selected].sort();
};

const areaForFeature = (feature) => FEATURE_AREAS.find(({ features }) => features.includes(feature));

const APP_ROUTE_OWNERS = [
  [/^src\/app\/api\/billing\//u, 'billing'],
  [/^src\/app\/api\/account\//u, 'account'],
  [/^src\/app\/api\/pipeline\//u, 'pipeline'],
  [/^src\/app\/api\/project-sources\/google-drive\//u, 'project'],
  [/^src\/app\/api\/studio-documents\//u, 'studio-documents'],
  [/^src\/app\/mcp\/route\.ts$/u, 'studio-documents'],
];

const classifyFeatureOwner = (filePath, owner) => {
  const providerVerification = HIGH_RISK_FEATURES.get(owner)
    ?? (owner === 'project' && /google-drive|googleDrive/u.test(filePath) ? 'Google Drive' : null);
  return {
    path: filePath,
    owner,
    risk: providerVerification ? 'high' : 'product',
    providerVerification,
    docs: areaForFeature(owner)?.docs ?? ['docs/architecture.md#core-ownership'],
    architectureBoundaryAffected: true,
  };
};

export const classifyChangedPath = (inputPath) => {
  const filePath = toPosixPath(inputPath);
  const featureMatch = /^src\/features\/([^/]+)/u.exec(filePath);
  if (featureMatch) return classifyFeatureOwner(filePath, featureMatch[1]);

  const appOwner = APP_ROUTE_OWNERS.find(([pattern]) => pattern.test(filePath))?.[1];
  if (appOwner) return classifyFeatureOwner(filePath, appOwner);

  const routes = [
    [/^src\/app\//u, 'app-composition', 'product', ['docs/architecture.md#core-ownership'], true],
    [/^src\/domain\//u, 'domain', 'product', ['docs/architecture.md#dependency-rules'], true],
    [/^src\/infrastructure\//u, 'infrastructure', 'high', ['docs/integrations.md'], true],
    [/^src\/components\/ui\//u, 'ui-primitives', 'product', ['docs/architecture.md#dependency-rules'], true],
    [/^src\/shared\//u, 'shared', 'product', ['docs/architecture.md#dependency-rules'], true],
    [/^supabase\/migrations\//u, 'supabase-migrations', 'high', ['docs/operations.md#supabase-migration-and-security-procedure'], false],
    [/^(?:scripts\/|tests\/infrastructure\/|package(?:-lock)?\.json$|\.github\/workflows\/)/u, 'repository-tooling', 'product', ['docs/testing.md'], filePath === 'scripts/check-architecture.mjs'],
    [/^tests\/product\//u, 'product-tests', 'product', ['docs/testing.md'], false],
    [/^(?:docs\/|README\.md$|AGENTS\.md$|\.agents\/)/u, 'documentation', 'routine', ['docs/agent-map.md'], false],
  ];
  const route = routes.find(([pattern]) => pattern.test(filePath));
  if (route) {
    const [, owner, risk, docs, architectureBoundaryAffected] = route;
    return { path: filePath, owner, risk, docs, architectureBoundaryAffected, providerVerification: null };
  }
  return {
    path: filePath,
    owner: 'repository',
    risk: 'product',
    docs: ['README.md'],
    architectureBoundaryAffected: false,
    providerVerification: null,
  };
};

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(entryPath));
    else files.push(entryPath);
  }
  return files;
};

const collectTestFiles = async (root) => {
  const testRoot = path.join(root, 'tests');
  try {
    return (await walk(testRoot)).filter((filePath) => TEST_EXTENSIONS.some((extension) => filePath.endsWith(extension)));
  } catch {
    return [];
  }
};

const testMatchesChange = ({ relativeTestPath, source, changedPath, classification }) => {
  if (relativeTestPath === changedPath) return true;
  if (classification.owner === 'repository-tooling') {
    if (/^(?:package(?:-lock)?\.json|\.github\/workflows\/)/u.test(changedPath)) {
      return relativeTestPath.endsWith('/agent-efficiency.test.ts');
    }
    return source.includes(path.posix.basename(changedPath));
  }
  if (classification.owner === 'supabase-migrations') {
    return relativeTestPath.endsWith('/migration-safety.test.ts');
  }
  if (changedPath.startsWith('tests/')) return relativeTestPath === changedPath;
  if (changedPath.startsWith('src/features/')
    || (changedPath.startsWith('src/app/') && classification.owner !== 'app-composition')) {
    return source.includes(`/features/${classification.owner}/`)
      || source.includes(`/features/${classification.owner}'`)
      || source.includes(`/features/${classification.owner}"`);
  }
  if (changedPath.startsWith('src/domain/')) return source.includes('/domain/');
  if (changedPath.startsWith('src/shared/')) return source.includes('/shared/');
  if (changedPath.startsWith('src/infrastructure/')) return source.includes('/infrastructure/');
  if (changedPath.startsWith('src/components/ui/')) return source.includes('/components/ui/');
  return false;
};

export const buildAffectedVerification = async ({ root, changedPaths, allBrowserSmoke = false }) => {
  const normalizedPaths = [...new Set(changedPaths.map(toPosixPath))].sort();
  const classifications = normalizedPaths.map(classifyChangedPath);
  const tests = [];
  for (const testPath of await collectTestFiles(root)) {
    const relativeTestPath = toPosixPath(path.relative(root, testPath));
    const source = await readFile(testPath, 'utf8');
    if (classifications.some((classification, index) => testMatchesChange({
      relativeTestPath,
      source,
      changedPath: normalizedPaths[index],
      classification,
    }))) {
      tests.push(relativeTestPath);
    }
  }

  const changedBrowserSpecs = normalizedPaths.filter((file) => file.startsWith('tests/product/workflows/') && file.endsWith('.spec.ts') && existsSync(path.join(root, file)));
  const browserSmoke = browserSmokeForPaths(normalizedPaths, { all: allBrowserSmoke }).filter((file) => !changedBrowserSpecs.includes(file));
  const riskOrder = { routine: 0, product: 1, high: 2 };
  const risk = classifications.reduce(
    (highest, classification) => riskOrder[classification.risk] > riskOrder[highest] ? classification.risk : highest,
    'routine',
  );
  return {
    changedPaths: normalizedPaths,
    owners: [...new Set(classifications.map(({ owner }) => owner))].sort(),
    docs: [...new Set(classifications.flatMap(({ docs }) => docs))].sort(),
    tests: tests.sort(),
    risk,
    architectureBoundaryAffected: classifications.some(({ architectureBoundaryAffected }) => architectureBoundaryAffected),
    providerVerification: [...new Set(classifications.map(({ providerVerification }) => providerVerification).filter(Boolean))].sort(),
    browserSmoke,
    changedBrowserSpecs,
    specializedJobs: [...new Set(normalizedPaths.flatMap(specializedJobsForPath))].sort(),
    fullGateRequired: normalizedPaths.length > 0,
  };
};

const runGit = (root, args) => execFileSync('git', args, {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

export const collectChangedPaths = (root, explicitBase) => {
  const changedPaths = new Set();
  const addOutput = (output) => {
    for (const filePath of output.split('\0').filter(Boolean)) {
      if (filePath.includes('\\')) throw new Error('Unsupported backslash in changed Git path; inspect it manually.');
      changedPaths.add(toPosixPath(filePath));
    }
  };
  const base = explicitBase
    ?? (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'origin/main');
  try {
    runGit(root, ['rev-parse', '--verify', base]);
    addOutput(runGit(root, ['diff', '--no-renames', '--name-only', '-z', `${base}...HEAD`]));
  } catch (error) {
    throw new Error(`Unable to compare verification base ${base} with HEAD; ensure the base and merge history are fetched.`, { cause: error });
  }
  addOutput(runGit(root, ['diff', '--no-renames', '--name-only', '-z', 'HEAD']));
  addOutput(runGit(root, ['ls-files', '--others', '--exclude-standard', '-z']));
  return [...changedPaths]
    .filter((filePath) => !filePath.startsWith('.codex-remote-attachments/'))
    .sort();
};

const printResult = (result) => {
  console.log(`Changed paths: ${result.changedPaths.length}`);
  console.log(`Owners: ${result.owners.join(', ') || 'none'}`);
  console.log(`Risk: ${result.risk}`);
  console.log(`Architecture boundary affected: ${result.architectureBoundaryAffected ? 'yes' : 'no'}`);
  console.log(`Provider verification: ${result.providerVerification.join(', ') || 'none'}`);
  console.log(`Specialized CI: ${result.specializedJobs.join(', ') || 'none'}`);
  console.log(`Browser smoke: ${result.browserSmoke.join(', ') || 'none'}`);
  console.log(`Changed browser specs: ${result.changedBrowserSpecs.join(', ') || 'none'}`);
  console.log(`Full gate before PR: ${result.fullGateRequired ? 'yes' : 'no'}`);
  if (result.docs.length > 0) console.log(`Read: ${result.docs.join(', ')}`);
  if (result.tests.length > 0) {
    console.log('Focused tests:');
    for (const testPath of result.tests) console.log(`  ${testPath}`);
  } else {
    console.log('Focused tests: none discovered');
  }
};

const runCommand = (command, args) => {
  const result = spawnSync(command, args, { cwd: process.cwd(), stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};

const parseArguments = (values) => {
  const args = { base: undefined, githubOutput: false, paths: [], run: false };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--run') args.run = true;
    else if (value === '--github-output') args.githubOutput = true;
    else if (value === '--base') {
      if (!values[index + 1]) throw new Error('--base requires a Git ref.');
      args.base = values[index + 1];
      index += 1;
    } else args.paths.push(value);
  }
  return args;
};

const isDirectExecution = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) {
  try {
    const args = parseArguments(process.argv.slice(2));
    const root = process.cwd();
    const result = await buildAffectedVerification({
      root,
      changedPaths: args.paths.length > 0 ? args.paths : collectChangedPaths(root, args.base),
      allBrowserSmoke: process.env.CARDFORGE_BROWSER_ALL === 'true',
    });
    printResult(result);
    if (args.githubOutput) {
      const outputPath = process.env.GITHUB_OUTPUT?.trim();
      if (!outputPath) throw new Error('--github-output requires GITHUB_OUTPUT.');
      appendFileSync(outputPath, [
        `browser_golden=${result.browserSmoke.length + result.changedBrowserSpecs.length > 0}`,
        `browser_smoke_files=${result.browserSmoke.join(' ')}`,
        `browser_changed_specs=${JSON.stringify(result.changedBrowserSpecs)}`,
        `risk=${result.risk}`,
        `changed_count=${result.changedPaths.length}`,
        '',
      ].join('\n'));
    }
    if (args.run && result.tests.length > 0) {
      const productTests = result.tests.filter((testPath) => testPath.startsWith('tests/product/unit/'));
      const infrastructureTests = result.tests.filter((testPath) => testPath.startsWith('tests/infrastructure/'));
      const vitestCli = path.join(root, 'node_modules', 'vitest', 'vitest.mjs');
      if (productTests.length > 0) runCommand(process.execPath, [vitestCli, 'run', ...productTests]);
      if (infrastructureTests.length > 0) {
        runCommand(process.execPath, [vitestCli, 'run', '--config', 'vitest.infrastructure.config.ts', ...infrastructureTests]);
      }
    }
    if (args.run && result.architectureBoundaryAffected) {
      runCommand(process.execPath, ['scripts/check-architecture.mjs', '--changed']);
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
