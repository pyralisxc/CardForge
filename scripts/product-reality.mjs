import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
  buildCheckpointProductReality,
  checkSealedProductReality,
  createTemporaryProductRealityAudit,
  diffAgainstAccepted,
  queryCheckpointProductReality,
  sealProductReality,
} from './product-reality-checkpoint-lib.mjs';

const parseArgs = (values) => {
  const [command = 'query', ...rest] = values;
  const args = {
    command,
    base: null,
    surface: null,
    feature: null,
    kind: null,
    node: null,
    match: null,
    unknown: false,
    depth: 2,
  };

  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (value === '--unknown') {
      args.unknown = true;
      continue;
    }
    if (['--base', '--surface', '--feature', '--kind', '--node', '--match', '--depth'].includes(value)) {
      const next = rest[index + 1];
      if (!next) throw new Error(`${value} requires a value.`);
      if (value === '--depth') {
        const depth = Number.parseInt(next, 10);
        if (!Number.isInteger(depth) || depth < 0 || depth > 6) throw new Error('--depth must be an integer from 0 to 6.');
        args.depth = depth;
      } else args[value.slice(2)] = next;
      index += 1;
      continue;
    }
    throw new Error(`Unknown Product Reality option: ${value}`);
  }
  return args;
};

const baseRef = (args) => args.base ?? process.env.CARDFORGE_VERIFY_BASE?.trim() ?? 'origin/main';
const checkpointChangedFromBase = (root, base) => {
  const result = spawnSync('git', ['diff', '--name-only', `${base}...HEAD`, '--', 'docs/generated/product-reality.ndjson'], { cwd: root, encoding: 'utf8' });
  return result.status === 0 && result.stdout.split(/\r?\n/u).includes('docs/generated/product-reality.ndjson');
};

const run = async () => {
  const args = parseArgs(process.argv.slice(2));
  const root = process.cwd();

  if (args.command === 'generate' || args.command === 'seal') {
    const { graph } = await sealProductReality(root);
    console.log(`Product Reality checkpoint sealed (${graph.summary.nodes} nodes, ${graph.summary.edges} relationships, topology ${graph.topologyFingerprint}).`);
    return;
  }

  if (args.command === 'check') {
    const verifyBase = process.env.CARDFORGE_VERIFY_BASE?.trim();
    if (verifyBase && !checkpointChangedFromBase(root, verifyBase)) {
      console.log(`Product Reality checkpoint is not being sealed in this development change; live A→B auditing remains available against ${verifyBase}.`);
      return;
    }
    const result = await checkSealedProductReality(root);
    if (result.stale.length > 0) {
      console.error(`Product Reality checkpoint is stale: ${result.stale.join(', ')}. Run npm run product-reality:seal and commit the result before promoting this candidate.`);
      process.exitCode = 1;
      return;
    }
    console.log(`Product Reality checkpoint is current (${result.graph.summary.nodes} nodes, ${result.graph.summary.edges} relationships, topology ${result.graph.topologyFingerprint}).`);
    return;
  }

  if (args.command === 'audit') {
    const audit = await createTemporaryProductRealityAudit(root, baseRef(args));
    process.stdout.write(audit.report);
    process.stdout.write(`\nTemporary audit packet (not in the repository):\n- ${audit.reportPath}\n- ${audit.graphPath}\n`);
    return;
  }

  if (args.command === 'query') {
    const graph = await buildCheckpointProductReality(root);
    process.stdout.write(queryCheckpointProductReality(graph, args));
    return;
  }

  if (args.command === 'diff') {
    const base = baseRef(args);
    const result = await diffAgainstAccepted(root, base);
    process.stdout.write(result.report);
    return;
  }

  throw new Error(`Unknown Product Reality command: ${args.command}`);
};

const isDirectExecution = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isDirectExecution) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
