'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod/v4';
import { readProjectPreferenceSafely, updateProjectPreference } from '@/features/project/client/persistence-preferences';
import { getProjectPersistenceScope, type ProjectPersistenceScope } from '@/features/project/client/persistence-workspace';
import { pipelineReviewNoticesSchema, type PipelineReviewNotice } from '../lib/pipelineReviewNotices';

const receiptSchema = z.object({ version: z.literal(1), receipts: z.record(z.string().uuid(), z.enum(['read', 'dismissed'])) }).strict();
type Receipts = z.infer<typeof receiptSchema>['receipts'];
const keyFor = (scope: ProjectPersistenceScope) => `pipeline-review-notice-receipts:v1:${scope}`;
const parseReceipts = (value: unknown): Receipts => value == null ? {} : receiptSchema.parse(value).receipts;

/** The Pipeline list owns eligibility; only browser-local read/dismiss receipts are stored. */
export function usePipelineReviewNotices(enabled: boolean, scope: ProjectPersistenceScope) {
  const [state, setState] = useState<{ scope: ProjectPersistenceScope; items: PipelineReviewNotice[]; receipts: Receipts; error: string | null; ready: boolean }>({ scope, items: [], receipts: {}, error: null, ready: false });
  const generation = useRef(0);
  const acknowledgement = useRef(0);
  const writesInFlight = useRef(0);
  const invalidate = useCallback(() => { generation.current++; }, []);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    const receiptVersion = acknowledgement.current;
    if (!enabled || scope !== getProjectPersistenceScope()) { setState({ scope, items: [], receipts: {}, error: null, ready: false }); return; }
    try {
      const [response, stored] = await Promise.all([fetch('/api/pipeline/review-notices', { cache: 'no-store' }), readProjectPreferenceSafely<unknown>(keyFor(scope))]);
      if (response.status === 401) throw new Error('Sign in to read Pipeline review notices.');
      if (response.status === 403) throw new Error('Contributor review access is required to read Pipeline notices.');
      if (!response.ok || stored.kind === 'unavailable') throw new Error('Pipeline review notices are unavailable. Try again.');
      const payload = pipelineReviewNoticesSchema.parse(await response.json());
      const receipts = parseReceipts(stored.kind === 'missing' ? null : stored.value);
      if (request === generation.current && receiptVersion === acknowledgement.current && writesInFlight.current === 0 && scope === getProjectPersistenceScope()) setState({ scope, items: payload.items, receipts, error: null, ready: true });
    } catch (error) {
      const message = error instanceof Error && (error.message.startsWith('Sign in') || error.message.startsWith('Contributor review')) ? error.message : 'Pipeline review notices are unavailable. Try again.';
      if (request === generation.current && receiptVersion === acknowledgement.current && writesInFlight.current === 0 && scope === getProjectPersistenceScope()) setState({ scope, items: [], receipts: {}, error: message, ready: false });
    }
  }, [enabled, scope]);
  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh(); window.addEventListener('focus', onFocus);
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 300_000);
    return () => { invalidate(); window.clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [refresh, invalidate]);
  const acknowledge = useCallback(async (submissionId: string, action: 'read' | 'dismissed' = 'read') => {
    if (!enabled || state.scope !== scope || !state.ready || scope !== getProjectPersistenceScope()) return false;
    generation.current++;
    const sequence = ++acknowledgement.current;
    writesInFlight.current++;
    try {
      const saved = await updateProjectPreference(keyFor(scope), current => {
        const receipts = parseReceipts(current);
        return { version: 1, receipts: { ...receipts, [submissionId]: receipts[submissionId] === 'dismissed' ? 'dismissed' : action } };
      });
      if (scope !== getProjectPersistenceScope()) return false;
      if (sequence === acknowledgement.current) setState(previous => ({ ...previous, receipts: parseReceipts(saved) }));
      return true;
    } catch { if (scope === getProjectPersistenceScope()) setState(previous => ({ ...previous, error: 'Review notice state could not be saved. Try again.' })); return false; }
    finally { writesInFlight.current--; }
  }, [enabled, scope, state.scope, state.ready]);
  const current = enabled && state.scope === scope && state.ready;
  const items = current ? state.items.filter(item => state.receipts[item.submissionId] !== 'dismissed') : [];
  return { items, unread: items.filter(item => !state.receipts[item.submissionId]).length, receipts: current ? state.receipts : {}, ready: current, error: enabled && state.scope === scope ? state.error : null, refresh, acknowledge };
}
export type { PipelineReviewNotice } from '../lib/pipelineReviewNotices';
