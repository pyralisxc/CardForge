import { describe, expect, it, vi } from 'vitest';
import { mayShowOwnerDownloads } from '@/features/plugin-distribution/lib/ownerDownloadVisibility';

describe('server-rendered Owner download visibility (display only)', () => {
  it('is hidden for anonymous and non-Owner accounts', async () => {
    expect(await mayShowOwnerDownloads(async () => ({user:null,ownerAccess:{isOwner:false}}))).toBe(false);
    expect(await mayShowOwnerDownloads(async () => ({user:{id:'member'},ownerAccess:{isOwner:false}}))).toBe(false);
  });
  it('appears only with a signed-in authenticated Owner result', async () => {
    expect(await mayShowOwnerDownloads(async () => ({user:{id:'owner'},ownerAccess:{isOwner:true}}))).toBe(true);
    expect(await mayShowOwnerDownloads(async () => ({user:null,ownerAccess:{isOwner:true}}))).toBe(false);
  });
  it('fails closed on identity rejection without requiring Studio to be hidden', async () => {
    const read = vi.fn().mockRejectedValue(new Error('identity unavailable'));
    expect(await mayShowOwnerDownloads(read)).toBe(false);
    expect(read).toHaveBeenCalledTimes(1);
  });
});
