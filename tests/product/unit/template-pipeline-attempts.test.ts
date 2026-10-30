import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TCGCardTemplate } from '@/domain/templates';
const storage = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));
vi.mock('@/features/project/client/persistence-preferences', () => ({ readStructuredBrowserValue: storage.read, writeStructuredBrowserValue: storage.write }));
import { listTemplatePipelineAttempts, retainTemplatePipelineAttempt, resolveTemplatePipelineAttempt } from '@/features/template-editor/lib/templatePipelineAttempts';
const template: TCGCardTemplate = {id:'local',name:'Original',aspectRatio:'63:88',templateSource:'user',freeformCanvas:{width:100,height:100,elements:[]}};
const selection = {registryAssetId:'source',publishedSubmissionId:'published',elementId:'slot'};
const records = new Map<string, unknown>();
const fetcher = vi.fn();
beforeEach(() => {
  records.clear(); vi.clearAllMocks();
  storage.read.mockImplementation(async key => structuredClone(records.get(key) ?? null));
  storage.write.mockImplementation(async (key,value) => { records.set(key,structuredClone(value)); });
  vi.stubGlobal('navigator',{locks:{request:async (_key:string,action:()=>unknown)=>action()}});
  vi.stubGlobal('window',{dispatchEvent:vi.fn()}); vi.stubGlobal('fetch',fetcher);
  fetcher.mockImplementation(async () => Response.json({contributorId:'A'}));
});
describe('initiated Template Pipeline attempt persistence', () => {
  it('retains distinct original snapshots across remounts, local edits, source and slot changes without altering authored bytes', async () => {
    const before=JSON.stringify(template);
    const first=await retainTemplatePipelineAttempt(template,selection);
    expect(await retainTemplatePipelineAttempt(structuredClone(template),{...selection})).toEqual(first);
    for (const [t,s] of [[{...template,name:'Edited'},selection],[template,{...selection,elementId:'other'}],[template,{...selection,registryAssetId:'other'}]] as const) {
      expect((await retainTemplatePipelineAttempt(t,s)).key).not.toBe(first.key);
    }
    expect(await listTemplatePipelineAttempts('local')).toHaveLength(4);
    expect((await listTemplatePipelineAttempts('local'))[0]).toEqual(first);
    expect(JSON.stringify(template)).toBe(before);
    fetcher.mockResolvedValue(Response.json({contributorId:'B'}));
    expect(await listTemplatePipelineAttempts('local')).toEqual([]);
  });
  it('checks the old snapshot, recovers committed outcome without another mutation, and retries only original bytes/key after an authoritative absent read', async () => {
    const attempt=await retainTemplatePipelineAttempt(template,selection);
    const url='/account?section=library&scope=pipeline&tool=contribute&submission=original';
    fetcher.mockReset(); fetcher.mockResolvedValue(Response.json({openInPipelineUrl:url}));
    expect(await resolveTemplatePipelineAttempt(attempt,true)).toBe(url);
    expect(fetcher).toHaveBeenCalledTimes(1); expect(fetcher.mock.calls[0][0]).toContain('lookup=1');
    fetcher.mockReset(); fetcher.mockResolvedValueOnce(Response.json({openInPipelineUrl:null})).mockResolvedValueOnce(Response.json({openInPipelineUrl:url}));
    expect(await resolveTemplatePipelineAttempt(attempt,true)).toBe(url);
    const [lookup,retry]=fetcher.mock.calls;
    expect(retry[1]).toEqual(lookup[1]);
    expect(JSON.parse(retry[1].body)).toEqual({...template,managedRasterSelection:selection});
    expect(retry[1].headers['Idempotency-Key']).toBe(attempt.key);
    expect(retry[1].headers['X-Pipeline-Contributor']).toBe('A');
  });
  it('does not post after unavailable lookup or failed persistence, and preserves the saved attempt', async () => {
    const attempt=await retainTemplatePipelineAttempt(template,selection);
    fetcher.mockReset(); fetcher.mockRejectedValue(new Error('offline'));
    await expect(resolveTemplatePipelineAttempt(attempt,true)).rejects.toThrow('offline');
    expect(fetcher).toHaveBeenCalledTimes(1); expect(records.size).toBe(1);
    fetcher.mockImplementation(async () => Response.json({contributorId:'A'})); storage.write.mockRejectedValue(new Error('quota'));
    await expect(retainTemplatePipelineAttempt({...template,name:'new'},selection)).rejects.toThrow('quota');
    expect((await listTemplatePipelineAttempts('local'))).toEqual([attempt]);
  });
});
