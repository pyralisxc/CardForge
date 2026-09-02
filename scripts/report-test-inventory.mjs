import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const productRoot = join(root, 'tests', 'product');
const infrastructureRoot = join(root, 'tests', 'infrastructure');

const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? walk(path) : [path];
});

const testFiles = (directory) => walk(directory).filter((path) => (
  path.endsWith('.test.ts') || path.endsWith('.spec.ts')
));

const countDeclaredChecks = (source) => (
  source.match(/\b(?:it|test)(?:\.each(?:<[^>]+>)?\([^;]*?\))?\s*\(/gs)?.length ?? 0
);

const productDomains = [
  ['Billing & entitlements', /billing|entitlement|creator-pass|plan-management/],
  ['Identity & access', /account|auth|clerk|contributor|owner-access|server-cardforge-user|abuse-protection|openai-apps-challenge/],
  ['Studio & authoring', /studio|template|canvas|card|generator|generation|layer|element|focused-artifact|set-workspace|surface-return|text-|rich-text|artifact-contract|generated-gallery|creator-interaction|action-runtime/],
  ['Storage & projects', /project|browser-storage|workspace-revision|work-locations|library|zip-export|draft-retention|google-drive/],
  ['MCP & plugin', /mcp|plugin/],
  ['Pipeline & publication', /pipeline|roadmap|showcase|asset-registry|native-meta|new-template/],
  ['Public site & operations', /public|site-|sitemap|legal|business-identity|founder|marketing|analytics|email|social-share|structured-data/],
  ['Shared product boundaries', /.*/],
];

const summarize = (files, classify) => {
  const rows = new Map();
  for (const path of files) {
    const source = readFileSync(path, 'utf8');
    const key = classify(path);
    const current = rows.get(key) ?? { files: 0, checks: 0, lines: 0 };
    current.files += 1;
    current.checks += countDeclaredChecks(source);
    current.lines += source.split(/\r?\n/).length;
    rows.set(key, current);
  }
  return rows;
};

const classifyProduct = (path) => {
  const name = relative(productRoot, path).replaceAll('\\', '/').toLowerCase();
  if (name.startsWith('workflows/')) return 'Browser workflows';
  return productDomains.find(([, pattern]) => pattern.test(name))?.[0] ?? 'Shared product boundaries';
};

const product = summarize(testFiles(productRoot), classifyProduct);
const infrastructure = summarize(testFiles(infrastructureRoot), () => 'Infrastructure guardrails');
const rows = [...product, ...infrastructure];
const totals = rows.reduce((sum, [, row]) => ({
  files: sum.files + row.files,
  checks: sum.checks + row.checks,
  lines: sum.lines + row.lines,
}), { files: 0, checks: 0, lines: 0 });

const width = Math.max(...rows.map(([name]) => name.length), 'Lane / domain'.length);
console.log(`${'Lane / domain'.padEnd(width)}  Files  Checks  Lines`);
console.log(`${'-'.repeat(width)}  -----  ------  -----`);
for (const [name, row] of rows) {
  console.log(`${name.padEnd(width)}  ${String(row.files).padStart(5)}  ${String(row.checks).padStart(6)}  ${String(row.lines).padStart(5)}`);
}
console.log(`${'-'.repeat(width)}  -----  ------  -----`);
console.log(`${'Total'.padEnd(width)}  ${String(totals.files).padStart(5)}  ${String(totals.checks).padStart(6)}  ${String(totals.lines).padStart(5)}`);
console.log('\nChecks are declared test blocks; parameterized rows may expand to more runtime tests.');
