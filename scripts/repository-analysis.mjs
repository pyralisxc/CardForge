import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import ts from 'typescript';

export const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);

export const toPosixPath = (value) => value.split(path.sep).join('/');

export const stripModuleSuffix = (value) => value
  .replace(/\.(?:[cm]?[jt]sx?)$/u, '')
  .replace(/\/index$/u, '');

export const classifySourcePath = (relativePath) => {
  const modulePath = stripModuleSuffix(relativePath);
  const parts = modulePath.split('/');
  const [root, featureName] = parts;

  if (modulePath === 'proxy') return { kind: 'app', modulePath, parts };
  if (root === 'app') return { kind: 'app', modulePath, parts };
  if (root === 'domain') return { kind: 'domain', modulePath, parts };
  if (root === 'infrastructure') return { kind: 'infrastructure', modulePath, parts };
  if (root === 'shared') return { kind: 'shared', modulePath, parts };
  if (root === 'features' && featureName) {
    const featurePath = parts.slice(2).join('/');
    const [featureEntry] = featurePath.split('/');
    return {
      kind: 'feature',
      modulePath,
      parts,
      featureName,
      featurePath,
      publicEntry: featureEntry === 'client' || featureEntry === 'server' ? featureEntry : null,
    };
  }
  if (root === 'components' && featureName === 'ui') return { kind: 'ui', modulePath, parts };
  if (root === 'lib' || root === 'store' || root === 'types') {
    return { kind: 'legacy', modulePath, parts, legacyRoot: root };
  }
  return { kind: 'unowned', modulePath, parts, unownedRoot: root };
};

export const resolveLocalImport = ({ importerPath, sourceRoot, specifier }) => {
  let absoluteTarget;
  if (specifier.startsWith('@/')) absoluteTarget = path.join(sourceRoot, specifier.slice(2));
  else if (specifier.startsWith('.')) absoluteTarget = path.resolve(path.dirname(importerPath), specifier);
  else return null;

  const relativeTarget = path.relative(sourceRoot, absoluteTarget);
  if (
    relativeTarget === ''
    || relativeTarget === '..'
    || relativeTarget.startsWith(`..${path.sep}`)
    || path.isAbsolute(relativeTarget)
  ) return null;

  return stripModuleSuffix(toPosixPath(relativeTarget));
};

export const collectSourceFiles = async (directory) => {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectSourceFiles(entryPath));
    else if (SOURCE_EXTENSIONS.has(path.extname(entry.name)) && !entry.name.endsWith('.d.ts')) files.push(entryPath);
  }
  return files;
};

export const readSourceModule = async ({ filePath, sourceRoot }) => {
  const source = await readFile(filePath, 'utf8');
  const relativePath = toPosixPath(path.relative(sourceRoot, filePath));
  const classification = classifySourcePath(relativePath);
  const importedSpecifiers = ts.preProcessFile(source, true, true).importedFiles.map((entry) => entry.fileName);
  const localImports = importedSpecifiers.flatMap((specifier) => {
    const targetPath = resolveLocalImport({ importerPath: filePath, sourceRoot, specifier });
    if (!targetPath) return [];
    return [{
      specifier,
      targetPath,
      classification: classifySourcePath(targetPath),
    }];
  });
  return {
    filePath,
    relativePath,
    source,
    classification,
    importedSpecifiers,
    localImports,
  };
};

export const collectSourceModules = async (root) => {
  const sourceRoot = path.join(root, 'src');
  const files = await collectSourceFiles(sourceRoot);
  const modules = [];
  for (const filePath of files) modules.push(await readSourceModule({ filePath, sourceRoot }));
  return { sourceRoot, modules };
};
