import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
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
  await Promise.all(Object.entries(files).map(([relativePath, content]) => writeFixtureFile(root, relativePath, content)));
  return root;
};

const runArchitectureCheck = async (root: string, extraArgs: string[] = []) => new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve) => {
  execFile(process.execPath, [scriptPath, '--root', root, ...extraArgs], (error, stdout, stderr) => {
    const errorCode = error && 'code' in error ? error.code : null;
    resolve({ exitCode: typeof errorCode === 'number' ? errorCode : error ? 1 : 0, stdout, stderr });
  });
});

afterEach(async () => {
  await Promise.all(fixtureRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('architecture boundary CLI', () => {
  it('rejects cross-feature imports that bypass a public entry point', async () => {
    const root = await createFixture({
      'src/features/alpha/client.ts': "import { readSecret } from '@/features/beta/lib/internalRepository';\nexport const value = readSecret();\n",
      'src/features/beta/lib/internalRepository.ts': "export const readSecret = () => 'secret';\n",
    });
    const result = await runArchitectureCheck(root);
    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain('cross-feature-internal');
  });

  it('accepts narrow public interface subpaths and intended one-way flow', async () => {
    const root = await createFixture({
      'src/shared/strings.ts': "export const label = 'CardForge';\n",
      'src/domain/cards/model.ts': "import { label } from '@/shared/strings';\nexport const card = { label };\n",
      'src/features/gallery/client.ts': "import { card } from '@/domain/cards/model';\nexport const galleryCard = card;\n",
      'src/app/page.tsx': "import { galleryCard } from '@/features/gallery/client';\nexport default function Page() { return galleryCard.label; }\n",
    });
    const result = await runArchitectureCheck(root);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Architecture check passed (0 violations');
  });

  it('rejects client modules that import feature server code', async () => {
    const root = await createFixture({
      'src/features/alpha/components/ClientPanel.tsx': "'use client';\nimport { loadBeta } from '@/features/beta/server';\nexport const ClientPanel = () => loadBeta();\n",
      'src/features/beta/server.ts': "export const loadBeta = () => 'beta';\n",
    });
    const result = await runArchitectureCheck(root);
    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain('client-imports-server');
  });

  it('reports every feature edge in a dependency cycle', async () => {
    const root = await createFixture({
      'src/features/alpha/server.ts': "import { beta } from '@/features/beta/server';\nexport const alpha = () => beta();\n",
      'src/features/beta/server.ts': "import { alpha } from '@/features/alpha/server';\nexport const beta = () => alpha();\n",
    });
    const result = await runArchitectureCheck(root);
    const output = `${result.stdout}\n${result.stderr}`;
    expect(result.exitCode).toBe(1);
    expect(output).toContain('feature-cycle-edge|feature:alpha|feature:beta');
    expect(output).toContain('feature-cycle-edge|feature:beta|feature:alpha');
  });

  it('fails every violation directly without an exception baseline', async () => {
    const root = await createFixture({
      'src/shared/invalid.ts': "import { card } from '@/domain/cards/model';\nexport const invalid = card;\n",
      'src/domain/cards/model.ts': "export const card = 'card';\n",
    });
    const result = await runArchitectureCheck(root);
    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain('Architecture violation');
    expect(`${result.stdout}\n${result.stderr}`).toContain('shared-imports-upward');
  });

  it('rejects retired baseline options', async () => {
    const root = await createFixture({ 'src/shared/value.ts': "export const value = 1;\n" });
    const result = await runArchitectureCheck(root, ['--write-baseline']);
    expect(result.exitCode).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain('Unknown architecture option');
  });

  it('reports files above the review threshold without failing', async () => {
    const root = await createFixture({ 'src/shared/largeCatalog.ts': Array.from({ length: 501 }, (_, index) => `export const value${index} = ${index};`).join('\n') });
    const result = await runArchitectureCheck(root);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('File-size review warning');
  });
});
