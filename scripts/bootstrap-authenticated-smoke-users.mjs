import { createClerkClient } from '@clerk/backend';
import { createClient } from '@supabase/supabase-js';

import {
  ensureQaClerkUsers,
  ensureQaDeveloperProfiles,
  readQaAccountConfiguration,
  summarizeQaBootstrap,
} from './lib/authenticated-smoke-qa.mjs';

const requireProtectedValue = (envKey) => {
  const value = process.env[envKey]?.trim();
  if (!value) throw new Error(`Missing protected QA bootstrap configuration: ${envKey}.`);
  return value;
};

const main = async () => {
  const accounts = readQaAccountConfiguration(process.env);
  const clerk = createClerkClient({
    secretKey: requireProtectedValue('CLERK_SECRET_KEY'),
  });
  const supabase = createClient(
    requireProtectedValue('SUPABASE_URL'),
    requireProtectedValue('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
  );

  const results = await ensureQaClerkUsers({ clerk, accounts });
  await ensureQaDeveloperProfiles({ supabase, accounts: results });
  const summary = summarizeQaBootstrap(results);

  console.log(`Authenticated smoke QA bootstrap ready: ${summary.total} roles, ${summary.created} created, ${summary.metadataUpdated} metadata alignments.`);
  for (const role of summary.roles) {
    console.log(`${role.role}: ${role.created ? 'created' : 'reused'}; metadata ${role.metadataUpdated ? 'aligned' : 'already aligned'}.`);
  }
};

main().catch(() => {
  console.error('Authenticated smoke QA bootstrap failed. Review protected configuration and provider availability.');
  process.exitCode = 1;
});
