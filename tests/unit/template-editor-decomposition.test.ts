import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const rootPath = (...parts: string[]) => path.join(process.cwd(), ...parts);

const pathExists = async (...parts: string[]) => {
  try {
    await access(rootPath(...parts));
    return true;
  } catch {
    return false;
  }
};

const collectTypeScriptFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectTypeScriptFiles(entryPath));
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) files.push(entryPath);
  }
  return files;
};

describe('template editor decomposition', () => {
  it('keeps the public editor entry and coordinator intentionally small', async () => {
    const makerPath = rootPath('src', 'features', 'template-editor', 'components', 'CardTemplateMaker.tsx');
    const maker = await readFile(makerPath, 'utf8');
    expect(maker.split('\n').length).toBeLessThanOrEqual(500);

    const shell = await readFile(
      rootPath('src', 'features', 'app-shell', 'components', 'CardForgeStudioShell.tsx'),
      'utf8',
    );
    expect(shell).toContain("import('@/features/template-editor/client')");
    expect(shell).not.toContain("@/features/template-editor/components/CardTemplateMaker");
  });

  it('has focused editor lifecycle and command owners', async () => {
    const requiredFiles = [
      ['src', 'features', 'template-editor', 'hooks', 'useTemplateEditorSession.ts'],
      ['src', 'features', 'template-editor', 'hooks', 'useTemplateEditorVariables.ts'],
      ['src', 'features', 'template-editor', 'hooks', 'useTemplateEditorElements.ts'],
      ['src', 'features', 'template-editor', 'hooks', 'useTemplateEditorViewport.ts'],
      ['src', 'features', 'template-editor', 'hooks', 'useTemplateEditorCommands.ts'],
      ['src', 'features', 'template-editor', 'components', 'TemplateEditorLibrarySidebar.tsx'],
      ['src', 'features', 'template-editor', 'components', 'TemplateEditorInspectorSidebar.tsx'],
    ];
    await Promise.all(requiredFiles.map(async (parts) => {
      await expect(pathExists(...parts)).resolves.toBe(true);
    }));
  });

  it('places shared field policy in Domain and removes generator-to-editor coupling', async () => {
    await expect(pathExists('src', 'domain', 'templates', 'fieldContracts.ts')).resolves.toBe(true);
    await expect(pathExists('src', 'domain', 'templates', 'templateFields.ts')).resolves.toBe(true);
    await expect(pathExists('src', 'features', 'template-editor', 'lib', 'fieldContracts.ts')).resolves.toBe(false);
    await expect(pathExists('src', 'features', 'template-editor', 'lib', 'templateFields.ts')).resolves.toBe(false);

    const generatorFiles = await collectTypeScriptFiles(rootPath('src', 'features', 'card-generator'));
    for (const file of generatorFiles) {
      const source = await readFile(file, 'utf8');
      expect(source, path.relative(process.cwd(), file)).not.toContain('@/features/template-editor');
    }
  });

  it('deletes editor-touched catch-all roots instead of retaining adapters', async () => {
    const retiredRoots = [
      ['src', 'lib', 'cardFrameKits.ts'],
      ['src', 'lib', 'clientBootstrapData.ts'],
      ['src', 'lib', 'constants.ts'],
      ['src', 'lib', 'utils.ts'],
      ['src', 'hooks', 'use-toast.ts'],
    ];
    await Promise.all(retiredRoots.map(async (parts) => {
      await expect(pathExists(...parts)).resolves.toBe(false);
    }));
  });
});
