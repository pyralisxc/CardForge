import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ access: vi.fn(), refresh: vi.fn() }));
vi.mock('@/features/card-generator/lib/outputCleanAccess', () => ({ validateCleanOutputAccess: state.access }));
vi.mock('@/features/card-generator/lib/outputReadyStorage', () => ({ refreshReadyOutput: state.refresh }));
import { prepareReadyOutputHandoff, publishReadyOutput } from '@/features/card-generator/lib/outputReadyHandoff';

describe('prepared output handoff', () => {
  it('retains an exact published copy without handoff when its pinned source changed during publication', async () => {
    const output = { name: 'PDF', fileName: 'set.pdf', blob: new Blob(['pdf']), persistence: 'session' as const, restricted: true };
    let sourceChanged = false;
    const stage = { publish: async () => { sourceChanged = true; return output; } };
    const result = await publishReadyOutput(stage, () => true, async () => { if (sourceChanged) throw new Error('source changed'); });
    expect(result).toEqual({ ok: false, output, error: expect.objectContaining({ message: 'source changed' }) });
  });

  it('rejects a pinned source changed during the access or file check', async () => {
    const output = { name: 'PDF', fileName: 'set.pdf', blob: new Blob(['pdf']), persistence: 'session' as const, restricted: true, clean: true };
    let sourceChanged = false;
    const order: string[] = [];
    state.access.mockImplementation(async () => { order.push('access'); });
    state.refresh.mockImplementation(async () => { order.push('file'); sourceChanged = true; return output; });
    const validate = vi.fn(async () => { order.push('source'); if (sourceChanged) throw new Error('source changed'); });
    await expect(prepareReadyOutputHandoff('account:user-a', output, () => true, validate)).rejects.toThrow('source changed');
    expect(order).toEqual(['access', 'file', 'source']);
  });
});
