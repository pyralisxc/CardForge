import { execFileSync, spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const TEST_EXTENSIONS = ['.test.ts', '.spec.ts'];

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

const areaForFeature = (feature) => FEATURE_AREAS.find(({ features }) => features.includes(feature));

export const classifyChangedPath = (inputPath) => {
  const filePath = toPosixPath(inputPath);
  const featureMatch = /^src\/features\/([^/]+)/u.exec(filePath);
  if (featureMatch) {
    const owner = featureMatch[1];
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
  }

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
  if (changedPath.startsWith('src/features/')) {
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

export const buildAffectedVerification = async ({ root, changedPaths }) => {
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
    for (const filePath of output.split(/\r?\n/u).map((value) => value.trim()).filter(Boolean)) {
      changedPaths.add(toPosixPath(filePath));
    }
  };
  const base = explicitBase
    ?? (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'origin/main');
  try {
    runGit(root, ['rev-parse', '--verify', base]);
    addOutput(runGit(root, ['diff', '--name-only', `${base}...HEAD`]));
  } catch {
    runGit(root, ['rev-parse', '--verify', 'HEAD']);
  }
  addOutput(runGit(root, ['diff', '--name-only', 'HEAD']));
  addOutput(runGit(root, ['ls-files', '--others', '--exclude-standard']));
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
  const args = { base: undefined, paths: [], run: false };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--run') args.run = true;
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
    });
    printResult(result);
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
