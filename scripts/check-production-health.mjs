const origin = (process.env.CARDFORGE_HEALTH_ORIGIN || 'https://cardforges.com').replace(/\/+$/, '');
const checks = [
  { path: '/', content: 'CardForge' },
  { path: '/studio', content: 'CardForge' },
  { path: '/privacy', content: 'CardForge Studio is a software product created and operated by Cameron Locke, an independent sole proprietor based in Oregon.' },
  { path: '/api/templates', contentType: 'application/json' },
  { path: '/api/billing/status', contentType: 'application/json' },
];

const failures = [];
await Promise.all(checks.map(async (check) => {
  try {
    const response = await fetch(`${origin}${check.path}`, {
      headers: { 'User-Agent': 'CardForge production health check' },
      signal: AbortSignal.timeout(20_000),
    });
    const body = await response.text();
    if (!response.ok) failures.push(`${check.path}: HTTP ${response.status}`);
    if (check.content && !body.includes(check.content)) failures.push(`${check.path}: missing expected content`);
    if (check.contentType && !response.headers.get('content-type')?.includes(check.contentType)) {
      failures.push(`${check.path}: unexpected content type`);
    }
  } catch (error) {
    failures.push(`${check.path}: ${error instanceof Error ? error.message : 'request failed'}`);
  }
}));

if (failures.length > 0) {
  console.error(`CardForge production health check failed:\n${failures.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`CardForge production health check passed (${checks.length} routes).`);
}
