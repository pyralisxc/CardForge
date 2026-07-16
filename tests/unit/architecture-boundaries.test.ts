import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const scriptPath = path.join(process.cwd(), 'scripts', 'check-architecture.mjs');
const fixtureRoots: string[] = [];

const writeFixtureFile = async (root: string, relativePath: string, content: string) => {
  const filePath = path.join(root, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
};

const createFixture = async (files: Record<string, string>) => {
  const root = await mkdtemp(path.join(tmpdir(), 'cardforge-architecture-'));
  fixtureRoots.push(root);

  for (const [relativePath, content] of Object.entries(files)) {
    await writeFixtureFile(root, relativePath, content);
  }

  const baselinePath = path.join(root, 'architecture-baseline.json');
  await writeFile(baselinePath, `${JSON.stringify({ version: 1, violations: [] }, null, 2)}\n`, 'utf8');
  return { root, baselinePath };
};

const runArchitectureCheck = async (
  root: string,
  baselinePath: string,
  extraArgs: string[] = [],
) => new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve) => {
  execFile(
    process.execPath,
    [scriptPath, '--root', root, '--baseline', baselinePath, ...extraArgs],
    (error, stdout, stderr) => {
      const errorCode = error && 'code' in error ? error.code : null;
      resolve({
        exitCode: typeof errorCode === 'number' ? errorCode : error ? 1 : 0,
        stdout,
        stderr,
      });
    },
  );
});

afterEach(async () => {
  await Promise.all(fixtureRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('architecture boundary CLI', () => {
  it('rejects cross-feature imports that bypass a public entry point', async () => {
    const fixture = await createFixture({
      'src/features/alpha/client.ts': "import { readSecret } from '@/features/beta/server/internalRepository';\nexport const value = readSecret();\n",
      'src/features/beta/server/internalRepository.ts': "export const readSecret = () => 'secret';\n",
    });

    const result = await runArchitectureCheck(fixture.root, fixture.baselinePath);

    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain('cross-feature-internal');
  });

  it('rejects client modules that import another feature server interface', async () => {
    const fixture = await createFixture({
      'src/features/alpha/components/ClientPanel.tsx': "'use client';\nimport { loadBeta } from '@/features/beta/server';\nexport const ClientPanel = () => loadBeta();\n",
      'src/features/beta/server.ts': "export const loadBeta = () => 'beta';\n",
    });

    const result = await runArchitectureCheck(fixture.root, fixture.baselinePath);

    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain('client-imports-server');
  });

  it('rejects client modules that import their own feature server code', async () => {
    const fixture = await createFixture({
      'src/features/alpha/components/ClientPanel.tsx': "'use client';\nimport { loadAlpha } from '@/features/alpha/server/internalRepository';\nexport const ClientPanel = () => loadAlpha();\n",
      'src/features/alpha/server/internalRepository.ts': "export const loadAlpha = () => 'alpha';\n",
    });

    const result = await runArchitectureCheck(fixture.root, fixture.baselinePath);

    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain('client-imports-server');
  });

  it('reports every feature edge that participates in a dependency cycle', async () => {
    const fixture = await createFixture({
      'src/features/alpha/server.ts': "import { beta } from '@/features/beta/server';\nexport const alpha = () => beta();\n",
      'src/features/beta/server.ts': "import { alpha } from '@/features/alpha/server';\nexport const beta = () => alpha();\n",
    });

    const result = await runArchitectureCheck(fixture.root, fixture.baselinePath);
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.exitCode).toBe(1);
    expect(output).toContain('feature-cycle-edge|feature:alpha|feature:beta');
    expect(output).toContain('feature-cycle-edge|feature:beta|feature:alpha');
  });

  it('records the current violations and accepts an exact baseline match', async () => {
    const fixture = await createFixture({
      'src/features/alpha/client.ts': "import { beta } from '@/features/beta/model/internal';\nexport const alpha = beta;\n",
      'src/features/beta/model/internal.ts': "export const beta = 'beta';\n",
    });

    const writeResult = await runArchitectureCheck(fixture.root, fixture.baselinePath, ['--write-baseline']);
    const baseline = JSON.parse(await readFile(fixture.baselinePath, 'utf8')) as { violations: string[] };
    const checkResult = await runArchitectureCheck(fixture.root, fixture.baselinePath);

    expect(writeResult.exitCode).toBe(0);
    expect(baseline.violations.some((violation) => violation.startsWith('cross-feature-internal|'))).toBe(true);
    expect(checkResult.exitCode).toBe(0);
    expect(checkResult.stdout).toContain('Architecture baseline matches');
  });

  it('fails when a new violation is added after the baseline is written', async () => {
    const fixture = await createFixture({
      'src/features/alpha/client.ts': "export const alpha = 'alpha';\n",
    });
    await runArchitectureCheck(fixture.root, fixture.baselinePath, ['--write-baseline']);
    await writeFixtureFile(
      fixture.root,
      'src/shared/invalid.ts',
      "import { card } from '@/domain/cards/model';\nexport const invalid = card;\n",
    );
    await writeFixtureFile(fixture.root, 'src/domain/cards/model.ts', "export const card = 'card';\n");

    const result = await runArchitectureCheck(fixture.root, fixture.baselinePath);

    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain('New architecture violation');
    expect(`${result.stdout}\n${result.stderr}`).toContain('shared-imports-upward');
  });

  it('fails when a resolved violation remains in a stale baseline', async () => {
    const fixture = await createFixture({
      'src/features/alpha/client.ts': "import { beta } from '@/features/beta/model/internal';\nexport const alpha = beta;\n",
      'src/features/beta/model/internal.ts': "export const beta = 'beta';\n",
    });
    await runArchitectureCheck(fixture.root, fixture.baselinePath, ['--write-baseline']);
    await writeFixtureFile(fixture.root, 'src/features/alpha/client.ts', "export const alpha = 'alpha';\n");

    const result = await runArchitectureCheck(fixture.root, fixture.baselinePath);

    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain('Stale architecture baseline');
  });

  it('accepts the intended one-way dependency flow', async () => {
    const fixture = await createFixture({
      'src/shared/strings.ts': "export const label = 'CardForge';\n",
      'src/domain/cards/model.ts': "import { label } from '@/shared/strings';\nexport const card = { label };\n",
      'src/features/gallery/client.ts': "import { card } from '@/domain/cards/model';\nexport const galleryCard = card;\n",
      'src/app/page.tsx': "import { galleryCard } from '@/features/gallery/client';\nexport default function Page() { return galleryCard.label; }\n",
    });

    const result = await runArchitectureCheck(fixture.root, fixture.baselinePath);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Architecture baseline matches');
  });

  it('reports files above the review threshold without failing', async () => {
    const fixture = await createFixture({
      'src/shared/largeCatalog.ts': Array.from({ length: 501 }, (_, index) => `export const value${index} = ${index};`).join('\n'),
    });

    const result = await runArchitectureCheck(fixture.root, fixture.baselinePath);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('File-size review warning');
    expect(result.stdout).toContain('src/shared/largeCatalog.ts');
  });
});
