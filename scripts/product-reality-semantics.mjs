import ts from 'typescript';

import { collectSourceModules } from './repository-analysis.mjs';

const unwrap = (node) => {
  let current = node;
  while (current && (
    ts.isAsExpression(current)
    || ts.isSatisfiesExpression?.(current)
    || ts.isParenthesizedExpression(current)
    || ts.isTypeAssertionExpression(current)
  )) current = current.expression;
  return current;
};

const staticString = (node) => {
  const current = unwrap(node);
  if (!current) return null;
  return ts.isStringLiteral(current) || ts.isNoSubstitutionTemplateLiteral(current) ? current.text : null;
};

const propertyName = (node) => {
  if (!node) return null;
  return ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node) ? node.text : null;
};

const objectProperties = (node) => {
  const current = unwrap(node);
  if (!current || !ts.isObjectLiteralExpression(current)) return new Map();
  const properties = new Map();
  for (const property of current.properties) {
    if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) continue;
    const name = propertyName(property.name);
    if (name) properties.set(name, ts.isPropertyAssignment(property) ? property.initializer : property.name);
  }
  return properties;
};

const staticArrayStrings = (node) => {
  const current = unwrap(node);
  if (!current || !ts.isArrayLiteralExpression(current)) return [];
  return current.elements.map(staticString).filter(Boolean);
};

const addSurface = (surfaces, value) => {
  if (!value.id) return;
  const current = surfaces.get(value.id);
  surfaces.set(value.id, {
    id: value.id,
    label: value.label ?? current?.label ?? value.id,
    role: value.role ?? current?.role ?? 'surface',
    evidence: [...(current?.evidence ?? []), ...(value.evidence ?? [])],
  });
};

export async function collectProductRealitySemantics(root) {
  const { modules } = await collectSourceModules(root);
  const surfaces = new Map();
  const capabilities = new Map();

  for (const module of modules) {
    const relativePath = `src/${module.relativePath}`;
    const sourceFile = ts.createSourceFile(
      module.filePath,
      module.source,
      ts.ScriptTarget.Latest,
      true,
      module.filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const lineFor = (node) => sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

    const visit = (node) => {
      if (
        ts.isVariableDeclaration(node)
        && ts.isIdentifier(node.name)
        && node.name.text === 'ENVIRONMENT_ZONES'
      ) {
        const array = unwrap(node.initializer);
        if (array && ts.isArrayLiteralExpression(array)) {
          for (const element of array.elements) {
            const props = objectProperties(element);
            const id = staticString(props.get('id'));
            if (!id) continue;
            addSurface(surfaces, {
              id,
              label: staticString(props.get('label')) ?? id,
              role: 'zone',
              evidence: [{ path: relativePath, reason: 'ENVIRONMENT_ZONES runtime declaration' }],
            });
          }
        }
      }

      if (ts.isObjectLiteralExpression(node)) {
        const props = objectProperties(node);
        const kind = staticString(props.get('productRealityKind'));
        if (kind === 'surface') {
          const id = staticString(props.get('id'));
          if (id) addSurface(surfaces, {
            id,
            label: staticString(props.get('label')) ?? id,
            role: staticString(props.get('role')) ?? 'surface',
            evidence: [{ path: relativePath, line: lineFor(node), reason: 'collocated Product Reality surface metadata' }],
          });
        }
        if (kind === 'capability') {
          const id = staticString(props.get('id'));
          if (id) {
            capabilities.set(id, {
              id,
              label: staticString(props.get('label')) ?? id,
              category: staticString(props.get('category')) ?? 'product',
              ownerFeature: staticString(props.get('ownerFeature')),
              surfaces: staticArrayStrings(props.get('surfaces')),
              evidence: [{ path: relativePath, line: lineFor(node), reason: 'collocated Product Reality capability metadata' }],
            });
          }
        }
      }

      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  return {
    surfaces: [...surfaces.values()].sort((a, b) => a.id.localeCompare(b.id)),
    capabilities: [...capabilities.values()].sort((a, b) => a.id.localeCompare(b.id)),
  };
}
