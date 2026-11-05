import { beforeEach, expect, it, vi } from 'vitest';
const boundary = vi.hoisted(() => ({ auth: vi.fn(), redirect: vi.fn(), signIn: vi.fn() }));
vi.mock('@clerk/nextjs/server', () => ({ auth: boundary.auth }));
vi.mock('next/navigation', () => ({ redirect: boundary.redirect }));
vi.mock('@/infrastructure/auth/clerk', () => ({ isClerkServerConfigPresent: () => true }));
import StudioPage from '@/app/studio/page';
const params = { document: '74bdfb13-5534-4f37-995e-1addd0eacf96', revision: '3', outputRef: '0ef36289-878c-4282-8fc6-86089d4ae05d' };
beforeEach(() => {
  vi.clearAllMocks();
  boundary.auth.mockResolvedValue({ isAuthenticated: true, redirectToSignIn: boundary.signIn });
  boundary.redirect.mockImplementation(() => { throw new Error('redirect'); });
});
it('actual Studio page preserves the exact Output intent into contextual account entry', async () => {
  await expect(StudioPage({ searchParams: Promise.resolve(params) })).rejects.toThrow('redirect');
  const href = boundary.redirect.mock.calls[0][0];
  expect(Object.fromEntries(new URL(href, 'https://cardforge.test').searchParams)).toEqual({ tool: 'output', ...params });
});
it('signed-out entry retains exact Output intent through the canonical sign-in return', async () => {
  boundary.auth.mockResolvedValueOnce({ isAuthenticated: false, redirectToSignIn: boundary.signIn });
  await StudioPage({ searchParams: Promise.resolve(params) });
  const href = boundary.signIn.mock.calls[0][0].returnBackUrl;
  expect(Object.fromEntries(new URL(href, 'https://cardforge.test').searchParams)).toEqual({ tool: 'output', ...params });
  expect(boundary.redirect).not.toHaveBeenCalled();
});
it('malformed Output ingress remains Output intent for downstream rejection; Design links stay Design', async () => {
  await expect(StudioPage({ searchParams: Promise.resolve({ outputRef: '', revision: 'bad' }) })).rejects.toThrow('redirect');
  expect(boundary.redirect).toHaveBeenLastCalledWith('/account?tool=output&outputRef=&revision=bad');
  await expect(StudioPage({ searchParams: Promise.resolve({ document: params.document, revision: '3' }) })).rejects.toThrow('redirect');
  expect(boundary.redirect).toHaveBeenLastCalledWith(`/account?tool=design&document=${params.document}&revision=3`);
});
