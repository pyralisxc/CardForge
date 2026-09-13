import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
  buildProductReality,
  buildProductRealityAtRef,
  checkProductReality,
  diffProductReality,
  formatProductRealityDelta,
  generateProductReality,
  queryProductReality,
} from './product-reality-lib.mjs';

const parseArgs = (values) => {
  const [command = 'query', ...rest] = values;
  const args = {
    command,
    base: null,
    surface: null,
    feature: null,
    kind: null,
    unknown: false,
    depth: 2,
  };

  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (value === '--unknown') {
      args.unknown = true;
      continue;
    }
    if (['--base', '--surface', '--feature', '--kind', '--depth'].includes(value)) {
      const next = rest[index + 1];
      if (!next) throw new Error(`${value} requires a value.`);
      if (value === '--depth') {
        const depth = Number.parseInt(next, 10);
        if (!Number.isInteger(depth) || depth < 0 || depth > 6) {
          throw new Error('--depth must be an integer from 0 to 6.');
        }
        args.depth = depth;
      } else {
        args[value.slice(2)] = next;
      }
      index += 1;
      continue;
    }
    throw new Error(`Unknown Product Reality option: ${value}`);
  }
  return args;
};

const run = async () => {
  const args = parseArgs(process.argv.slice(2));
  const root = process.cwd();

  if (args.command === 'generate') {
    const { graph } = await generateProductReality(root);
    console.log(
      `Product Reality generated (${graph.summary.nodes} nodes, ${graph.summary.edges} relationships, topology ${graph.topologyFingerprint}).`,
    );
    return;
  }

  if (args.command === 'check') {
    const result = await checkProductReality(root);
    if (result.stale.length > 0) {
      console.error(
        `Product Reality is stale: ${result.stale.join(', ')}. Run npm run product-reality:generate and commit the result.`,
      );
      process.exitCode = 1;
      return;
    }
    console.log(
      `Product Reality is current (${result.graph.summary.nodes} nodes, ${result.graph.summary.edges} relationships, topology ${result.graph.topologyFingerprint}).`,
    );
    return;
  }

  if (args.command === 'query') {
    const graph = await buildProductReality(root);
    process.stdout.write(queryProductReality(graph, args));
    return;
  }

  if (args.command === 'diff') {
    const base = args.base ?? process.env.CARDFORGE_VERIFY_BASE?.trim() ?? 'origin/main';
    const [baseGraph, currentGraph] = await Promise.all([
      buildProductRealityAtRef(root, base),
      buildProductReality(root),
    ]);
    process.stdout.write(
      formatProductRealityDelta(
        diffProductReality(baseGraph, currentGraph),
        { baseLabel: base },
      ),
    );
    return;
  }

  throw new Error(`Unknown Product Reality command: ${args.command}`);
};

const isDirectExecution = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectExecution) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
