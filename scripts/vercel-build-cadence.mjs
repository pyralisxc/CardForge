import { execFileSync } from 'node:child_process';

const SAFE_PREFIXES = ['docs/', 'tests/', '.agents/'];
const SAFE_ROOT_FILES = new Set(['AGENTS.md', 'README.md']);

const runGit = (args) => execFileSync('git', args, {
  cwd: process.cwd(),
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
}).trim();

export const isVercelNonRuntimePath = (filePath) => (
  SAFE_ROOT_FILES.has(filePath)
  || SAFE_PREFIXES.some((prefix) => filePath.startsWith(prefix))
);

export const shouldIgnoreVercelBuild = (changedFiles) => (
  changedFiles.length > 0
  && changedFiles.every(isVercelNonRuntimePath)
);

const gitObjectExists = (ref) => {
  try {
    runGit(['cat-file', '-e', `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
};

const resolveDiffBase = () => {
  const previousSha = process.env.VERCEL_GIT_PREVIOUS_SHA?.trim();
  if (previousSha) {
    return gitObjectExists(previousSha) ? previousSha : null;
  }

  if (process.env.VERCEL_ENV === 'preview' && gitObjectExists('origin/main')) {
    try {
      const mergeBase = runGit(['merge-base', 'HEAD', 'origin/main']);
      if (mergeBase) return mergeBase;
    } catch {
      // Fall through to HEAD^ for a normal single-commit branch.
    }
  }

  return gitObjectExists('HEAD^') ? 'HEAD^' : null;
};

export const collectVercelChangedFiles = (baseRef) => {
  if (!baseRef) return [];
  const output = runGit([
    'diff',
    '--name-only',
    '--no-renames',
    '--diff-filter=ACDMRTUXB',
    baseRef,
    'HEAD',
    '--',
  ]);
  return output ? output.split(/\r?\n/u).filter(Boolean) : [];
};

const main = () => {
  try {
    const baseRef = resolveDiffBase();
    if (!baseRef) {
      console.log('Vercel build required: unable to establish a trustworthy Git diff base.');
      process.exitCode = 1;
      return;
    }

    const changedFiles = collectVercelChangedFiles(baseRef);
    if (!shouldIgnoreVercelBuild(changedFiles)) {
      const runtimeFiles = changedFiles.filter((filePath) => !isVercelNonRuntimePath(filePath));
      console.log(
        runtimeFiles.length > 0
          ? `Vercel build required: ${runtimeFiles.slice(0, 8).join(', ')}${runtimeFiles.length > 8 ? ', …' : ''}`
          : 'Vercel build required: no safe-only change set could be established.',
      );
      process.exitCode = 1;
      return;
    }

    console.log(`Vercel build ignored: ${changedFiles.length} non-runtime file(s) changed.`);
    process.exitCode = 0;
  } catch (error) {
    console.log(`Vercel build required: cadence check failed (${error instanceof Error ? error.message : String(error)}).`);
    process.exitCode = 1;
  }
};

if (import.meta.url === `file://${process.argv[1]}`) main();
