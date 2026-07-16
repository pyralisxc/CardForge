import { createClerkClient } from '@clerk/backend';
import { createClient } from '@supabase/supabase-js';

import {
  describeQaBootstrapFailure,
  ensureQaClerkUsers,
  ensureQaDeveloperProfiles,
  readQaAccountConfiguration,
  summarizeQaBootstrap,
} from './lib/authenticated-smoke-qa.mjs';

let bootstrapStage = 'configuration validation';

const requireProtectedValue = (envKey) => {
  const value = process.env[envKey]?.trim();
  if (!value) throw new Error(`Missing protected QA bootstrap configuration: ${envKey}.`);
  return value;
};

const main = async () => {
  const accounts = readQaAccountConfiguration(process.env);
  bootstrapStage = 'Clerk client initialization';
  const clerk = createClerkClient({
    secretKey: requireProtectedValue('CLERK_SECRET_KEY'),
  });
  bootstrapStage = 'Supabase client initialization';
  const supabase = createClient(
    requireProtectedValue('SUPABASE_URL'),
    requireProtectedValue('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
  );

  bootstrapStage = 'Clerk account alignment';
  const results = await ensureQaClerkUsers({ clerk, accounts });
  bootstrapStage = 'developer profile alignment';
  await ensureQaDeveloperProfiles({ supabase, accounts: results });
  const summary = summarizeQaBootstrap(results);

  console.log(`Authenticated smoke QA bootstrap ready: ${summary.total} roles, ${summary.created} created, ${summary.metadataUpdated} metadata alignments.`);
  for (const role of summary.roles) {
    console.log(`${role.role}: ${role.created ? 'created' : 'reused'}; metadata ${role.metadataUpdated ? 'aligned' : 'already aligned'}.`);
  }
};

main().catch((error) => {
  console.error(describeQaBootstrapFailure(bootstrapStage, error));
  process.exitCode = 1;
});
