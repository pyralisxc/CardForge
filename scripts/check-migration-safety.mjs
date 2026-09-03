import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const MIGRATION_ROOT = 'supabase/migrations/';

// These exact contents are the one-time repairs required for the committed
// migration chain to bootstrap a brand-new Supabase project. The hash lock
// keeps the exception narrower than a permanent filename allowlist: any later
// edit remains unsafe, and the exception becomes dormant once main contains
// the repaired files.
const APPROVED_BOOTSTRAP_REPAIR_HASHES = new Map([
  [`${MIGRATION_ROOT}202605270002_remove_text_frame_presets.sql`, 'c4301bf98325e521ff63dbdb937806f290308c44ba9cf7f4259af7bd712b4560'],
  [`${MIGRATION_ROOT}202607140001_harden_privileged_functions.sql`, '0a6437e14753298869378c89c9d9ad839e92690e7985365692956898d499e618'],
  [`${MIGRATION_ROOT}20260814220651_consolidate_owner_identity.sql`, 'de835efd03c445b6cd3d1340bd9df63a2a0feb806d195752b02ae7db4d918fdb'],
]);

export const parseMigrationChanges = (output) => output
  .split(/\r?\n/u)
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const [status, ...paths] = line.split('\t');
    return { status, paths };
  })
  .filter(({ paths }) => paths.some((filePath) => filePath.replaceAll('\\', '/').startsWith(MIGRATION_ROOT)));

export const findUnsafeMigrationChanges = (changes) => changes.filter(({ status }) => status !== 'A' && status !== '??');

export const isApprovedBootstrapRepair = (root, { status, paths }) => {
  if (status !== 'M' || paths.length !== 1) return false;
  const migrationPath = paths[0].replaceAll('\\', '/');
  const expectedHash = APPROVED_BOOTSTRAP_REPAIR_HASHES.get(migrationPath);
  if (!expectedHash) return false;
  const contents = readFileSync(path.resolve(root, migrationPath));
  return createHash('sha256').update(contents).digest('hex') === expectedHash;
};

const runGit = (root, args) => execFileSync('git', args, {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

const resolveBase = (root, explicitBase) => {
  const candidate = explicitBase
    ?? process.env.CARDFORGE_VERIFY_BASE?.trim()
    ?? (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'origin/main');
  runGit(root, ['rev-parse', '--verify', candidate]);
  return candidate;
};

const parseArguments = (values) => {
  const args = { root: process.cwd(), base: undefined };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--root' || value === '--base') {
      const nextValue = values[index + 1];
      if (!nextValue) throw new Error(`${value} requires a value.`);
      args[value.slice(2)] = nextValue;
      index += 1;
      continue;
    }
    throw new Error(`Unknown migration-safety option: ${value}`);
  }
  return { root: path.resolve(args.root), base: args.base };
};

export const checkMigrationSafety = ({ root, base }) => {
  const resolvedBase = resolveBase(root, base);
  const tracked = runGit(root, [
    'diff', '--name-status', '--find-renames', resolvedBase, '--', MIGRATION_ROOT,
  ]);
  const untracked = runGit(root, [
    'ls-files', '--others', '--exclude-standard', '--', MIGRATION_ROOT,
  ])
    .split(/\r?\n/u)
    .map((filePath) => filePath.trim())
    .filter(Boolean)
    .map((filePath) => `??\t${filePath}`)
    .join('\n');

  const changes = parseMigrationChanges([tracked, untracked].join('\n'));
  const unsafeChanges = findUnsafeMigrationChanges(changes)
    .filter((change) => !isApprovedBootstrapRepair(root, change));
  if (unsafeChanges.length > 0) {
    const details = unsafeChanges
      .map(({ status, paths }) => `  ${status}\t${paths.join('\t')}`)
      .join('\n');
    throw new Error(
      `Existing Supabase migrations are immutable. Add a forward migration instead:\n${details}`,
    );
  }

  return changes;
};

const isDirectExecution = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) {
  try {
    const changes = checkMigrationSafety(parseArguments(process.argv.slice(2)));
    process.stdout.write(`Migration safety check passed (${changes.length} forward-only change${changes.length === 1 ? '' : 's'}).\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
