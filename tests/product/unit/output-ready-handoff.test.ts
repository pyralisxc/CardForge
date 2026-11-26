import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ access: vi.fn(), refresh: vi.fn() }));
vi.mock('@/features/card-generator/lib/outputCleanAccess', () => ({ validateCleanOutputAccess: state.access }));
vi.mock('@/features/card-generator/lib/outputReadyStorage', () => ({ refreshReadyOutput: state.refresh }));
import { createReadyHandoffGuard, prepareReadyOutputHandoff, publishReadyOutput } from '@/features/card-generator/lib/outputReadyHandoff';

afterEach(() => { vi.useRealTimers(); state.access.mockReset(); state.refresh.mockReset(); });

describe('prepared output handoff', () => {
  it('blocks overlapping handoffs and ignores an older scope’s completion', () => {
    const guard = createReadyHandoffGuard();
    const old = guard.begin()!;
    expect(guard.busy()).toBe(true);
    expect(guard.begin()).toBeNull();
    guard.invalidate();
    const current = guard.begin()!;
    expect(guard.finish(old)).toBe(false);
    expect(guard.busy()).toBe(true);
    expect(guard.finish(current)).toBe(true);
    expect(guard.busy()).toBe(false);
  });

  it('times out a stalled file read and never continues to the pinned check afterward', async () => {
    vi.useFakeTimers();
    const output = { name: 'PDF', fileName: 'set.pdf', blob: new Blob(['pdf']), persistence: 'device' as const, restricted: true };
    let release!: (value: typeof output) => void;
    state.refresh.mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const validate = vi.fn(async () => {});
    const result = prepareReadyOutputHandoff('account:user-a', output, () => true, validate, 1000);
    const rejected = expect(result).rejects.toThrow(/took too long/i);
    await vi.advanceTimersByTimeAsync(1000);
    await rejected;
    release(output);
    await Promise.resolve(); await Promise.resolve();
    expect(validate).not.toHaveBeenCalled();
  });

  it('does not proceed to a file read if clean access completes after timeout', async () => {
    vi.useFakeTimers();
    const output = { name: 'PDF', fileName: 'set.pdf', blob: new Blob(['pdf']), persistence: 'device' as const, restricted: false, clean: true };
    let release!: () => void;
    state.access.mockImplementation(() => new Promise<void>(resolve => { release = resolve; }));
    const result = prepareReadyOutputHandoff('account:user-a', output, () => true, undefined, 1000);
    const rejected = expect(result).rejects.toThrow(/took too long/i);
    await vi.advanceTimersByTimeAsync(1000);
    await rejected;
    release();
    await Promise.resolve(); await Promise.resolve();
    expect(state.refresh).not.toHaveBeenCalled();
  });

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
