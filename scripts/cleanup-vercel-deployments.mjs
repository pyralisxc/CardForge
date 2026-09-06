#!/usr/bin/env node

const API_ORIGIN = 'https://api.vercel.com';
const DEFAULT_PROJECT_ID = 'prj_395tFBFCrHJC2hP55haUKgas2cSC';
const DEFAULT_TEAM_ID = 'team_zVCGtHmdwYLDIJgA1mt8c7Nm';
const DEFAULT_PROJECT_NAME = 'card-forge';
const PREVIEW_RETENTION_MS = 24 * 60 * 60 * 1000;
const PRODUCTION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_PAGES = 200;
const MAX_RATE_LIMIT_RETRIES = 2;

const usage = `CardForge Vercel deployment cleanup\n\nUsage:\n  node scripts/cleanup-vercel-deployments.mjs\n  node scripts/cleanup-vercel-deployments.mjs --execute --confirm=card-forge\n\nEnvironment:\n  VERCEL_TOKEN        Required Vercel access token.\n  VERCEL_PROJECT_ID   Optional override; defaults to CardForge's project ID.\n  VERCEL_TEAM_ID      Optional override; defaults to the pyralis-projects team ID.\n  VERCEL_PROJECT_NAME Optional override; defaults to card-forge.\n\nSafety:\n  Dry-run is the default. Deletion requires both --execute and --confirm=<project name>.\n  The script keeps every deployment that still has an active alias and always keeps the\n  newest READY production deployment. Unknown/in-flight deployment states are never deleted.\n`;

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  console.log(usage);
  process.exit(0);
}

const allowedArguments = new Set(['--execute']);
for (const argument of argv) {
  if (allowedArguments.has(argument) || argument.startsWith('--confirm=')) continue;
  throw new Error(`Unknown argument ${JSON.stringify(argument)}. Run with --help for usage.`);
}

const execute = argv.includes('--execute');
const confirmation = argv.find((argument) => argument.startsWith('--confirm='))?.slice('--confirm='.length)?.trim();
const token = process.env.VERCEL_TOKEN?.trim();
const projectId = process.env.VERCEL_PROJECT_ID?.trim() || DEFAULT_PROJECT_ID;
const teamId = process.env.VERCEL_TEAM_ID?.trim() || DEFAULT_TEAM_ID;
const expectedProjectName = process.env.VERCEL_PROJECT_NAME?.trim() || DEFAULT_PROJECT_NAME;

if (!token) throw new Error('VERCEL_TOKEN is required. Dry-run also authenticates so it can inspect aliases safely.');
if (execute && confirmation !== expectedProjectName) {
  throw new Error(`Refusing deletion. Re-run with --confirm=${expectedProjectName}.`);
}

const normalizeState = (deployment) => String(deployment.state ?? deployment.readyState ?? '').toUpperCase();
const normalizeId = (deployment) => deployment.uid ?? deployment.id ?? null;
const createdAtMs = (deployment) => {
  const value = Number(deployment.createdAt ?? deployment.created ?? NaN);
  return Number.isFinite(value) ? value : NaN;
};
const ageLabel = (milliseconds) => {
  const hours = milliseconds / (60 * 60 * 1000);
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
};
const retentionFor = (deployment) => {
  const state = normalizeState(deployment);
  if (state === 'CANCELED' || state === 'ERROR') return PREVIEW_RETENTION_MS;
  if (state !== 'READY') return null;
  return deployment.target === 'production' ? PRODUCTION_RETENTION_MS : PREVIEW_RETENTION_MS;
};
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const request = async (pathname, { method = 'GET' } = {}) => {
  const url = new URL(pathname, API_ORIGIN);
  if (!url.searchParams.has('teamId')) url.searchParams.set('teamId', teamId);

  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'CardForge deployment cleanup',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const raw = await response.text();
    let payload = null;
    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = raw;
      }
    }

    if (response.ok) return payload;

    const message = typeof payload === 'object' && payload?.error?.message
      ? payload.error.message
      : typeof payload === 'object' && payload?.message
        ? payload.message
        : raw || response.statusText;

    if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
      const retryAfterSeconds = Number(response.headers.get('retry-after'));
      const minuteMatch = String(message).match(/try again in\s+(\d+)\s+minute/i);
      const fallbackMs = minuteMatch ? Number(minuteMatch[1]) * 60_000 : 60_000;
      const delayMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : fallbackMs;
      console.warn(`Vercel rate limit hit for ${url.pathname}; retrying in ${Math.ceil(delayMs / 1000)}s.`);
      await sleep(delayMs);
      continue;
    }

    throw new Error(`${method} ${url.pathname} failed with HTTP ${response.status}: ${message}`);
  }

  throw new Error(`${method} ${url.pathname} exhausted rate-limit retries.`);
};

const getProject = async () => request(`/v9/projects/${encodeURIComponent(projectId)}`);

const listDeployments = async () => {
  const deployments = new Map();
  let until = null;

  for (let pageNumber = 1; pageNumber <= MAX_PAGES; pageNumber += 1) {
    const url = new URL('/v7/deployments', API_ORIGIN);
    url.searchParams.set('projectId', projectId);
    url.searchParams.set('limit', '100');
    if (until) url.searchParams.set('until', String(until));

    const page = await request(`${url.pathname}${url.search}`);
    const entries = Array.isArray(page?.deployments) ? page.deployments : [];
    for (const deployment of entries) {
      const id = normalizeId(deployment);
      if (id) deployments.set(id, deployment);
    }

    const next = page?.pagination?.next;
    if (!next || entries.length === 0) return [...deployments.values()];
    if (String(next) === String(until)) throw new Error('Vercel deployment pagination repeated the same cursor; refusing to continue.');
    until = next;
  }

  throw new Error(`Deployment history exceeded the ${MAX_PAGES}-page safety cap.`);
};

const listProjectAliases = async () => {
  const aliasesByDeployment = new Map();
  let until = null;

  for (let pageNumber = 1; pageNumber <= MAX_PAGES; pageNumber += 1) {
    const url = new URL('/v4/aliases', API_ORIGIN);
    url.searchParams.set('projectId', projectId);
    url.searchParams.set('limit', '100');
    if (until) url.searchParams.set('until', String(until));

    const page = await request(`${url.pathname}${url.search}`);
    const aliases = Array.isArray(page?.aliases) ? page.aliases : [];
    for (const alias of aliases) {
      if (alias?.deletedAt) continue;
      const deploymentId = alias?.deploymentId ?? alias?.deployment?.id ?? null;
      if (!deploymentId) continue;
      const names = aliasesByDeployment.get(deploymentId) ?? [];
      if (alias?.alias) names.push(alias.alias);
      aliasesByDeployment.set(deploymentId, names);
    }

    const next = page?.pagination?.next;
    if (!next || aliases.length === 0) return aliasesByDeployment;
    if (String(next) === String(until)) throw new Error('Vercel alias pagination repeated the same cursor; refusing to continue.');
    until = next;
  }

  throw new Error(`Alias history exceeded the ${MAX_PAGES}-page safety cap.`);
};

const deleteDeployment = async (deploymentId) => request(`/v13/deployments/${encodeURIComponent(deploymentId)}`, { method: 'DELETE' });

const project = await getProject();
if (project?.id !== projectId || project?.name !== expectedProjectName || project?.accountId !== teamId) {
  throw new Error(
    `Project identity mismatch. Expected ${expectedProjectName} (${projectId}) in ${teamId}, got `
      + `${project?.name ?? 'unknown'} (${project?.id ?? 'unknown'}) in ${project?.accountId ?? 'unknown'}.`,
  );
}

const deployments = await listDeployments();
const aliasesByDeployment = await listProjectAliases();
const now = Date.now();
const newestReadyProduction = deployments
  .filter((deployment) => deployment.target === 'production' && normalizeState(deployment) === 'READY' && Number.isFinite(createdAtMs(deployment)))
  .sort((left, right) => createdAtMs(right) - createdAtMs(left))[0];
const newestReadyProductionId = newestReadyProduction ? normalizeId(newestReadyProduction) : null;

const eligible = [];
const skipped = [];

for (const deployment of deployments) {
  const id = normalizeId(deployment);
  const createdAt = createdAtMs(deployment);
  const state = normalizeState(deployment);
  const retentionMs = retentionFor(deployment);

  if (!id || !Number.isFinite(createdAt)) {
    skipped.push({ id: id ?? 'unknown', reason: 'missing deployment ID or creation timestamp' });
    continue;
  }
  if (retentionMs === null) {
    skipped.push({ id, reason: `state ${state || 'UNKNOWN'} is not eligible for automated deletion` });
    continue;
  }

  const ageMs = now - createdAt;
  if (ageMs < retentionMs) {
    skipped.push({ id, reason: `age ${ageLabel(ageMs)} is inside retention window` });
    continue;
  }
  if (id === newestReadyProductionId) {
    skipped.push({ id, reason: 'newest READY production deployment' });
    continue;
  }

  const aliases = aliasesByDeployment.get(id) ?? [];
  if (aliasesByDeployment.has(id)) {
    skipped.push({ id, reason: `still has active alias${aliases.length === 1 ? '' : 'es'}: ${aliases.join(', ') || 'unknown'}` });
    continue;
  }

  eligible.push({ deployment, id, ageMs, state, retentionMs });
}

console.log(`CardForge Vercel deployment cleanup (${execute ? 'DELETE' : 'DRY RUN'})`);
console.log(`Project: ${project.name} (${project.id})`);
console.log('Policy: previews/errors/canceled >= 24h; production >= 7d; active aliases and newest READY production are protected.');
console.log(`Scanned ${deployments.length} deployment(s); ${eligible.length} eligible; ${skipped.length} protected/ineligible.`);

if (eligible.length > 0) {
  console.log('\nEligible deployments:');
  for (const { deployment, id, ageMs, state } of eligible) {
    console.log(`- ${id} | ${deployment.target ?? 'preview'} | ${state} | ${ageLabel(ageMs)} | ${deployment.url ?? 'no URL'}`);
  }
}

if (!execute) {
  console.log('\nDry run only. Nothing was deleted. To delete this exact policy set, re-run with --execute --confirm=' + expectedProjectName + '.');
  process.exit(0);
}

// Refresh all aliases once immediately before the destructive phase. This catches aliases
// that appeared during the scan without making hundreds of per-deployment alias requests.
const executionAliasesByDeployment = await listProjectAliases();
let deleted = 0;
let failed = 0;
let reprotected = 0;
for (const { id } of eligible) {
  if (executionAliasesByDeployment.has(id)) {
    const aliases = executionAliasesByDeployment.get(id) ?? [];
    reprotected += 1;
    console.log(`SKIP ${id}: active alias appeared during execution (${aliases.join(', ') || 'unknown'}).`);
    continue;
  }

  try {
    await deleteDeployment(id);
    deleted += 1;
    console.log(`DELETED ${id}`);
  } catch (error) {
    failed += 1;
    console.error(`FAILED ${id}: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

console.log(`\nCleanup complete: ${deleted} deleted, ${failed} failed, ${reprotected} re-protected during execution.`);
if (failed > 0) process.exitCode = 1;
