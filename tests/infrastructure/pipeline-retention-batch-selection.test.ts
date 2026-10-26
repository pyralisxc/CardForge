import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Deployment-source contract only. The native blocked-prefix fixture owns
// behavioral proof; these checks cannot establish PostgreSQL lock scheduling.
const directory = resolve(process.cwd(), 'supabase/migrations');
const definitions = readdirSync(directory).filter(name => name.endsWith('.sql')).sort()
  .flatMap(name => [...readFileSync(resolve(directory, name), 'utf8').matchAll(
    /create (?:or replace )?function public\.cardforge_claim_pipeline_revision_purges\([\s\S]*?\$\$;/gi,
  )].map(match => match[0]));
const definition = definitions.at(-1)!;
const selection = definition.match(/for candidate in ([\s\S]*?)\n  loop/i)![1].replace(/\s+/g, ' ').toLowerCase();
const beforeLimit = selection.slice(0, selection.indexOf('limit p_limit'));

describe('revision retention bounded-selection deployment contract', () => {
  it('excludes protected lineages before consuming the batch bound', () => {
    expect(beforeLimit).toContain('join public.cardforge_pipeline_asset_lineages l on l.id=s.lineage_id');
    expect(beforeLimit).toContain('l.catalog_trashed_at is null');
    expect(beforeLimit).toContain('l.purge_state is null');
  });
  it('excludes known unclaimable revision states before the bound', () => {
    for (const column of ['purge_state', 'purge_claim_token', 'purge_claimed_at', 'owner_purge_requested_at', 'published_at']) {
      expect(beforeLimit).toContain(`s.${column} is null`);
    }
    expect(beforeLimit).toContain('isfinite(s.trashed_at)');
    expect(beforeLimit).toContain('isfinite(s.purge_after)');
    expect(beforeLimit).toContain('not s.retention_hold');
    expect(beforeLimit).toContain('(s.source_storage_bucket is null)=(s.source_storage_path is null)');
    expect(beforeLimit).toContain('not exists(select 1 from public.cardforge_asset_registry');
    expect(beforeLimit).toContain('not exists(select 1 from public.cardforge_pipeline_publication_events');
  });
  it('keeps the bounded lineage order and authoritative locked recheck', () => {
    expect(selection).toContain('order by s.lineage_id,s.id limit p_limit');
    expect(selection).not.toContain('for update');
    expect(definition).toContain('return query select * from public.cardforge_claim_pipeline_revision_purge_locked(candidate)');
  });
});

const commandDefinitions = readdirSync(directory).filter(name => name.endsWith('.sql')).sort()
  .flatMap(name => [...readFileSync(resolve(directory, name), 'utf8').matchAll(
    /create (?:or replace )?function public\.cardforge_change_catalog_trash\([\s\S]*?\$\$;/gi,
  )].map(match => match[0]));
const commandDefinition = commandDefinitions.at(-1)!;
it('fails fast instead of waiting on a lineage while holding SHARE table locks', () => {
  const beforeSnapshot = commandDefinition.slice(0, commandDefinition.indexOf('snapshot:=public.cardforge_read_catalog_trash(target)'));
  expect(beforeSnapshot).toContain('in share mode nowait;');
  expect(beforeSnapshot).toContain('for update nowait;');
  expect(beforeSnapshot).toContain('where s.id=target');
});
