// Disposable CI prerequisite, not a hosted maintenance command.
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const assert = (condition, message) => { if (!condition) { const error = new Error(message); error.code = 'LOCAL_GUARD'; throw error; } };
let stage = 'local-resource-guards';
try {
  assert(process.env.GITHUB_ACTIONS === 'true' && process.env.RUNNER_ENVIRONMENT === 'github-hosted', 'Requires ephemeral hosted CI');
  for (const key of ['DOCKER_HOST', 'SUPABASE_ACCESS_TOKEN', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'CARDFORGE_CONTRIBUTOR_ASSET_BUCKET']) {
    assert(!process.env[key], 'Caller provider configuration is forbidden');
  }
  const work = process.argv[2];
  const cid = process.env.CARDFORGE_LOCAL_DB_CONTAINER;
  assert(/^\/tmp\/cardforge-native-trash\.[A-Za-z0-9]+$/.test(work ?? '') && /^[a-f0-9]{64}$/.test(cid ?? ''), 'Invalid disposable resource identity');
  const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
  assert(docker('context', 'inspect', '--format', '{{.Endpoints.docker.Host}}').startsWith('unix://'), 'Requires local Docker');
  const identity = docker('inspect', '--format', '{{.Name}} {{.Config.Image}} {{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}', cid);
  assert(identity.startsWith(`/supabase_db_cf-trash-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT} `)
    && /supabase\/postgres:17\.[^ ]+ 54322$/.test(identity), 'Unexpected local database');
  // Native local credentials are read into memory only; never persisted or logged.
  stage = 'local-status';
  const status = JSON.parse(execFileSync('supabase', ['status', '--workdir', work, '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  stage = 'local-status-guards';
  assert(status.API_URL === 'http://127.0.0.1:54321', 'Unexpected local API');
  const key = status.SERVICE_ROLE_KEY;
  assert(typeof key === 'string' && key.length > 20, 'Local service credential unavailable');
  const localFetch = (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url ?? input.toString());
    assert(url.origin === status.API_URL && /^\/(rest|storage)\/v1\//.test(url.pathname), 'Nonlocal provider request rejected');
    return fetch(input, { ...init, redirect: 'error' });
  };
  const supabase = createClient(status.API_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: localFetch },
  });
  stage = 'canonical-import';
  const { backfillPipelineRegistryMedia } = await import('./sync-pipeline-defaults.mjs');
  console.log(JSON.stringify(await backfillPipelineRegistryMedia(supabase, { deferHistoricalPreviewPlaceholders: true, onProgress: value => { stage = value; console.log(`Preparation stage: ${stage}`); } })));
} catch (error) {
  // Provider errors can contain request headers. Keep the failure opaque here;
  // native local replay logs and read-only prerequisite queries own diagnosis.
  console.error(`Local Pipeline media preparation failed at ${stage}; no migration continuation permitted.`);
  if (error?.code === 'LOCAL_GUARD') console.error(error.message);
  if (/^[A-Za-z0-9_]{1,40}$/.test(error?.name ?? '')) console.error(`Error kind: ${error.name}`);
  if (/^[0-9]{3}$/.test(String(error?.statusCode ?? ''))) console.error(`HTTP status: ${error.statusCode}`);
  if (/^[A-Z0-9_]{1,32}$/.test(error?.code ?? '')) console.error(`Native error code: ${error.code}`);
  process.exitCode = 1;
}
