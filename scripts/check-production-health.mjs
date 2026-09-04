const rawOrigin = (process.env.CARDFORGE_HEALTH_ORIGIN || 'https://cardforges.com').replace(/\/+$/, '');
const origin = /^https?:\/\//u.test(rawOrigin) ? rawOrigin : `https://${rawOrigin}`;
const protectionBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
const requestedCategory = process.argv.find((argument) => argument.startsWith('--category='))?.split('=')[1] ?? 'all';
const allowedCategories = new Set(['all', 'route', 'product', 'provider']);
if (!allowedCategories.has(requestedCategory)) throw new Error('Use --category=route, product, provider, or all.');

const failures = [];
const passes = [];
const runCategory = (category) => requestedCategory === 'all' || requestedCategory === category;
// Route/provider smoke uses only native fetch; HTML and archive tooling belongs to product health.
const {
  assertContributorPublicTruth,
  assertContributorTermsPublicTruth,
  assertPrivacyPublicTruth,
  assertRepresentativeCatalogRouting,
} = runCategory('product') ? await import('./lib/production-health-contract.mjs') : {};
const check = async (category, label, operation) => {
  if (!runCategory(category)) return;
  try {
    await operation();
    passes.push(`[${category}] ${label}`);
  } catch (error) {
    failures.push(`[${category}] ${label}: ${error instanceof Error ? error.message : 'check failed'}`);
  }
};
const get = async (path, options = {}) => fetch(`${origin}${path}`, {
  headers: {
    'User-Agent': 'CardForge production health check',
    ...(protectionBypass ? { 'x-vercel-protection-bypass': protectionBypass } : {}),
  },
  redirect: 'follow',
  signal: AbortSignal.timeout(20_000),
  ...options,
});
const requireOk = async (path, expectedContent) => {
  const response = await get(path);
  const body = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (expectedContent && !body.includes(expectedContent)) throw new Error(`missing ${JSON.stringify(expectedContent)}`);
};
const requireSemanticHtml = async (path, assertion) => {
  const response = await get(path);
  const body = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  assertion(body);
};
const requireJson = async (path, acceptedStatuses = [200]) => {
  const response = await get(path);
  if (!acceptedStatuses.includes(response.status)) throw new Error(`HTTP ${response.status}`);
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('response is not JSON');
  return response.json();
};

const routeChecks = [
  ['/', 'Open your Desk'],
  ['/account', 'CardForge'],
  ['/plans', 'CardForge'],
  ['/about', 'CardForge'],
  ['/cameron', 'Cameron'],
  ['/contributors', 'Contributor'],
  ['/roadmap', 'Roadmap'],
  ['/privacy', 'independent sole proprietor based in Oregon'],
  ['/contact', 'CardForge'],
];
await Promise.all(routeChecks.map(([path, content]) => check('route', path, () => requireOk(path, content))));

let catalog = null;
await check('product', 'published catalog contract', async () => {
  catalog = await requireJson('/api/catalog');
  if (typeof catalog?.version !== 'string' || !catalog.version.startsWith('registry-1:') || !Array.isArray(catalog?.sets?.items) || !Array.isArray(catalog?.pipeline?.items)) {
    throw new Error('catalog shape is incomplete');
  }
});
await check('product', 'official 52-card starter package', async () => {
  const { default: JSZip } = await import('jszip');
  catalog ??= await requireJson('/api/catalog');
  const starter = catalog.sets?.items?.find((item) => item.id === 'standard-playing-card-deck');
  if (!starter || starter.access !== 'free' || starter.revision < 1 || !starter.packageUrl) {
    throw new Error('published starter metadata is missing or inaccessible');
  }
  const response = await fetch(starter.packageUrl, {
    headers: { 'User-Agent': 'CardForge production health check' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`package HTTP ${response.status}`);
  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  const manifestFile = zip.file('cardforge-project.json');
  if (!manifestFile) throw new Error('package manifest is missing');
  const manifest = JSON.parse(await manifestFile.async('string'));
  const artifacts = manifest?.project?.artifacts;
  const templates = manifest?.project?.userTemplates;
  const artifactIds = Array.isArray(artifacts) ? artifacts.map((artifact) => artifact.artifactId ?? artifact.card?.uniqueId) : [];
  if (!Array.isArray(artifacts) || artifacts.length !== 52 || new Set(artifactIds).size !== 52 || artifactIds.some((id) => typeof id !== 'string' || !id)) {
    throw new Error('starter must contain 52 stable unique Artifacts');
  }
  if (!Array.isArray(templates) || templates.length < 1) throw new Error('starter Template is missing');
});
await check('product', 'Desk-first public promise', () => requireOk('/', 'Open your Desk'));
await check('product', 'current Contributor publication boundary', () => requireSemanticHtml('/contributors', assertContributorPublicTruth));
await check('product', 'current Privacy vocabulary', () => requireSemanticHtml('/privacy', assertPrivacyPublicTruth));
await check('product', 'current Contributor Terms vocabulary', () => requireSemanticHtml('/contributor-terms', assertContributorTermsPublicTruth));
await check('product', 'representative catalog destinations', async () => {
  catalog ??= await requireJson('/api/catalog');
  assertRepresentativeCatalogRouting(catalog);
});
await check('product', 'public Roadmap provider records', async () => {
  const roadmap = await requireJson('/api/roadmap');
  if (roadmap?.configured !== true || !Array.isArray(roadmap?.items)) throw new Error('Roadmap provider state is unavailable');
  if (!roadmap.items.some((item) => item.itemType === 'feature') || !roadmap.items.some((item) => item.itemType === 'roi_checkpoint')) {
    throw new Error('Roadmap is missing feature or service-checkpoint records');
  }
});

await check('provider', 'Supabase catalog boundary', async () => {
  const value = await requireJson('/api/catalog');
  if (!value?.sets?.items?.length || !value?.templates?.defaults?.length) throw new Error('provider catalog is empty');
});
await check('provider', 'Stripe and Clerk configuration boundary', async () => {
  const value = await requireJson('/api/billing/status');
  if (value?.authConfigured !== true || value?.billing?.productAccessConfigured !== true || value?.billing?.webhookConfigured !== true) {
    throw new Error('auth, product access, or webhook configuration is unavailable');
  }
});
await check('provider', 'Google Drive authentication boundary', async () => {
  const value = await requireJson('/api/project-sources/google-drive/picker-config', [401]);
  if (value?.error?.kind !== 'authentication' || value?.error?.code !== 'google_drive_auth_required') {
    throw new Error('anonymous Drive boundary is not classified as authentication required');
  }
});

passes.forEach((message) => console.log(`PASS ${message}`));
if (failures.length > 0) {
  console.error(`CardForge production health check failed:\n${failures.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`CardForge production health passed (${passes.length} ${requestedCategory === 'all' ? 'route/product/provider' : requestedCategory} checks).`);
}
