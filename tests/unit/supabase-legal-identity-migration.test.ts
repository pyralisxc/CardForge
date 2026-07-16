import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('legal identity migration', () => {
  it('keeps the deployed retired-operator migration as immutable history', () => {
    const historicalSql = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/202607140005_legal_business_identity.sql'),
      'utf8',
    ).toLowerCase().replace(/\s+/g, ' ');

    const retiredOperator = ['neon', 'black interactive llc'].join(' ');
    expect(historicalSql).toContain(`business_name = '${retiredOperator}'`);
    expect(historicalSql).toContain('self-service subscription billing');
    expect(historicalSql).not.toContain('before public self-serve billing');
  });

  it('uses the forward foundation migration as the current Cameron/Oregon correction', () => {
    const migrationFile = readdirSync(resolve(process.cwd(), 'supabase/migrations'))
      .find((file) => file.endsWith('_business_identity_foundation.sql'));
    expect(migrationFile).toBeDefined();

    const currentSql = readFileSync(
      resolve(process.cwd(), 'supabase/migrations', migrationFile!),
      'utf8',
    ).toLowerCase().replace(/\s+/g, ' ');

    expect(currentSql).toContain("legal_operator_name, entity_type, jurisdiction_state");
    expect(currentSql).toContain("'cameron locke', 'sole_proprietor', 'oregon', 'united states'");
    expect(currentSql).toContain(
      'cardforge studio is a software product created and operated by cameron locke, an independent sole proprietor based in oregon.',
    );
    const splitRetiredOperator = ["'neon '", "'black interactive '"].join(' || ');
    expect(currentSql).toContain(
      `where slug = 'privacy' and body ~* ('^cardforge is operated by ' || ${splitRetiredOperator} || 'llc and is designed as a local-first card creation tool\\.');`,
    );
    expect(currentSql).toContain(
      'cardforge is designed as a local-first card creation tool.',
    );
    expect(currentSql).toContain(
      `where slug = 'terms' and body ~* ('^cardforge is a service operated by ' || ${splitRetiredOperator} || 'llc\\. it lets users create templates, generate previews, manage local projects, submit developer assets, and export content according to their account access\\.');`,
    );
    expect(currentSql).toContain(
      'your agreement for the service is with cameron locke as the legal operator of cardforge studio. cardforge lets users create templates, generate previews, manage local projects, submit developer assets, and export content according to their account access.',
    );
    expect(currentSql).toContain(
      `where slug = 'refund' and body ~* ('^cardforge is operated by ' || ${splitRetiredOperator} || 'llc and is currently in public beta\\.');`,
    );
    expect(currentSql).toContain('cardforge is currently in public beta.');
    const retiredOperatorStem = ['neon', 'black interactive'].join(' ');
    expect(currentSql).not.toContain(`regexp_replace( body, '${retiredOperatorStem} ' || 'llc',`);
  });
});
