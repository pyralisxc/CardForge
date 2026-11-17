"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { TCGCardTemplate } from '@/domain/templates';
import { ApiClientError } from '@/infrastructure/http/clientResponses';
import { beginScopedSource, settleScopedSourceFailure, settleScopedSourceValue } from '@/shared/scopedSource';
import { getProjectPersistenceScope } from '../persistence/projectPersistenceScope';
import type { ProjectPersistenceScope } from '../lib/projectPersistenceIdentity';
import { useProjectStore } from '../store/workspaceStore';
import { inspectWorkspaceUpdates, type SetUpdateProjection, type WorkspaceTemplateUpdate } from '../client/workspaceUpdates';
import { openSetTemplateUpdateReview } from '../client/setTemplateUpdateReview';
import { readUpdateNoticeReceipts, writeUpdateNoticeAcknowledgement } from '../client/updateNoticeStorage';
import type { UpdateNoticeReceipt, UpdateNoticeReceipts } from '../model/updateNotices';
import { WorkspaceUpdatesContext, type UpdatePreferences, type WorkspaceUpdatesContextValue } from '../hooks/useWorkspaceUpdates';
import type { TemplatePreviewRenderer } from './templatePreviewRenderer';
import { SetUpdatesPanel } from './SetUpdates';

const EMPTY_SOURCES: TCGCardTemplate[] = [];
const EMPTY_PROJECTIONS: SetUpdateProjection[] = [];
const pendingKeys = (set: SetUpdateProjection | undefined) => set ? [...set.items.filter((item) => !item.reviewed).map((item) => item.key), ...set.unavailable.map((item) => item.key)] : [];

export function WorkspaceUpdatesProvider({ scope, loadSources, preferences, renderPreview, children }: {
  scope: ProjectPersistenceScope;
  loadSources: (signal?: AbortSignal) => Promise<TCGCardTemplate[]>;
  preferences: UpdatePreferences;
  renderPreview: TemplatePreviewRenderer;
  children: ReactNode;
}) {
  const cardSets = useProjectStore((state) => state.cardSets);
  const userTemplates = useProjectStore((state) => state.userTemplates);
  const storedCards = useProjectStore((state) => state.storedCards);
  const [source, setSource] = useState<WorkspaceUpdatesContextValue['source']>(null);
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const [localRevision, setLocalRevision] = useState(0);
  const [receipts, setReceipts] = useState<UpdateNoticeReceipts | null>(null);
  const [noticeError, setNoticeError] = useState<string | null>(null);
  const [noticeBusy, setNoticeBusy] = useState(false);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const mounted = useRef(false);
  const sourceRequest = useRef<AbortController | null>(null);
  const sourceObservation = useRef(0);
  const lastAttempt = useRef(0);
  const retryAfter = useRef(0);
  const receiptRevision = useRef(0);
  const acknowledgementBusy = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const isCurrent = useCallback(() => mounted.current && scope === getProjectPersistenceScope(), [scope]);
  const refreshLocal = useCallback(() => setLocalRevision((value) => value + 1), []);
  const published = source?.scope === scope ? source.value ?? EMPTY_SOURCES : EMPTY_SOURCES;
  const input = useMemo(() => ({ state: { cardSets, userTemplates, storedCards }, published, localRevision }), [cardSets, userTemplates, storedCards, published, localRevision]);
  const [inspection, setInspection] = useState<{ input: typeof input; sets: SetUpdateProjection[]; error: string | null } | null>(null);
  const checking = inspection?.input !== input;
  const sets = checking ? EMPTY_PROJECTIONS : inspection.sets;
  const inspectionError = checking ? null : inspection.error;

  const hydrateReceipts = useCallback(async () => {
    const revision = ++receiptRevision.current;
    try {
      const saved = await readUpdateNoticeReceipts(scope);
      if (!isCurrent() || revision !== receiptRevision.current) return;
      setReceipts(saved);
      setNoticeError(null);
    } catch (error) {
      if (!isCurrent() || revision !== receiptRevision.current) return;
      setReceipts(null);
      setNoticeError(error instanceof Error ? error.message : 'Notification acknowledgements could not be read.');
    }
  }, [isCurrent, scope]);

  const acknowledge = useCallback(async (keys: string[], action: UpdateNoticeReceipt) => {
    if (!keys.length || !receipts || acknowledgementBusy.current || !isCurrent()) return;
    acknowledgementBusy.current = true;
    setNoticeBusy(true);
    const revision = ++receiptRevision.current;
    try {
      const saved = await writeUpdateNoticeAcknowledgement(scope, keys, action);
      if (!isCurrent() || revision !== receiptRevision.current) return;
      setReceipts(saved);
      setNoticeError(null);
    } catch (error) {
      if (isCurrent()) setNoticeError(error instanceof Error ? error.message : 'Notification state was not saved. Try again.');
    } finally {
      acknowledgementBusy.current = false;
      if (isCurrent()) setNoticeBusy(false);
    }
  }, [isCurrent, receipts, scope]);

  const observeSources = useCallback(async (signal?: AbortSignal) => {
    const observation = ++sourceObservation.current;
    lastAttempt.current = Date.now();
    try {
      if (!navigator.onLine) throw new Error('Offline. Published sources could not be checked.');
      const templates = await loadSources(signal);
      signal?.throwIfAborted();
      if (!isCurrent()) throw new Error('The active account changed. Reopen Updates.');
      if (observation !== sourceObservation.current) throw new Error('A newer source check replaced this observation. Check again before reviewing.');
      setSource(settleScopedSourceValue(scope, templates, { empty: templates.length === 0 }));
      setLastChecked(Date.now());
      return templates;
    } catch (error) {
      if (!signal?.aborted && isCurrent() && observation === sourceObservation.current) {
        const failure = error instanceof ApiClientError
          ? { kind: error.kind, message: error.message, nextAction: error.nextAction, correlationId: error.correlationId }
          : { kind: 'unavailable' as const, message: error instanceof Error ? error.message : 'Published sources are unavailable.' };
        if (error instanceof ApiClientError && error.retryAfterSeconds) retryAfter.current = Date.now() + error.retryAfterSeconds * 1000;
        setSource((current) => settleScopedSourceFailure(current, scope, failure));
      }
      throw error;
    }
  }, [isCurrent, loadSources, scope]);

  const checkSources = useCallback(async () => {
    if (!isCurrent() || sourceRequest.current || Date.now() < retryAfter.current) return;
    const controller = new AbortController();
    sourceRequest.current = controller;
    setSource((current) => beginScopedSource(current, scope));
    try {
      await observeSources(controller.signal);
    } catch {
      // The source observation retains the typed failure and last successful check.
    } finally {
      if (sourceRequest.current === controller) sourceRequest.current = null;
    }
  }, [isCurrent, observeSources, scope]);

  useEffect(() => {
    mounted.current = true;
    void hydrateReceipts();
    return () => {
      mounted.current = false;
      sourceRequest.current?.abort();
      sourceRequest.current = null;
      receiptRevision.current += 1;
    };
  }, [hydrateReceipts]);

  useEffect(() => {
    const controller = new AbortController();
    void inspectWorkspaceUpdates(input.state, input.published, controller.signal).then((next) => {
      if (!controller.signal.aborted && isCurrent()) setInspection({ input, sets: next, error: null });
    }).catch((error) => {
      if (!controller.signal.aborted && isCurrent()) setInspection({ input, sets: [], error: error instanceof Error ? error.message : 'Loaded work could not be checked.' });
    });
    return () => controller.abort();
  }, [input, isCurrent]);

  useEffect(() => {
    if (!selectedSetId || checking || !receipts) return;
    const keys = pendingKeys(sets.find((set) => set.set.id === selectedSetId)).filter((key) => !receipts[key]);
    if (keys.length) void acknowledge(keys, 'read');
  }, [acknowledge, checking, receipts, selectedSetId, sets]);

  const loadedSetIds = cardSets.map((set) => set.id).join('\n');
  useEffect(() => {
    if (preferences.ready && preferences.automaticChecks && loadedSetIds && document.visibilityState === 'visible') void checkSources();
  }, [checkSources, loadedSetIds, preferences.automaticChecks, preferences.ready]);

  useEffect(() => {
    if (!preferences.ready || !preferences.automaticChecks || !loadedSetIds) return;
    const interval = preferences.intervalSeconds * 1000;
    const whenActive = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastAttempt.current >= interval) void checkSources();
    };
    const reconnect = () => { if (document.visibilityState === 'visible') void checkSources(); };
    const focus = () => { whenActive(); if (!acknowledgementBusy.current) void hydrateReceipts(); };
    const timer = window.setInterval(whenActive, interval);
    window.addEventListener('online', reconnect);
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', whenActive);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', reconnect);
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', whenActive);
    };
  }, [checkSources, hydrateReceipts, loadedSetIds, preferences.automaticChecks, preferences.intervalSeconds, preferences.ready]);

  const openSet = useCallback((setId: string, focus?: HTMLElement | null) => {
    if (!isCurrent() || !useProjectStore.getState().cardSets.some((set) => set.id === setId)) return;
    returnFocus.current = focus ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setSelectedSetId(setId);
    void acknowledge(pendingKeys(sets.find((set) => set.set.id === setId)), 'read');
  }, [acknowledge, isCurrent, sets]);
  const closeSet = useCallback(() => {
    setSelectedSetId(null);
    requestAnimationFrame(() => { if (returnFocus.current?.isConnected) returnFocus.current.focus(); });
  }, []);
  const openReview = useCallback(async (item: WorkspaceTemplateUpdate, signal?: AbortSignal) => {
    if (!isCurrent()) throw new Error('The active account changed. Reopen Updates.');
    const readSource = item.origin === 'published' ? async (readSignal?: AbortSignal) => {
      const sources = await observeSources(readSignal);
      if (!isCurrent()) throw new Error('The active account changed. Reopen Updates.');
      const exact = sources.find((candidate) => candidate.id === item.source.id && candidate.templateLineageId === item.source.templateLineageId && candidate.templateRevisionId === item.source.templateRevisionId);
      if (!exact) throw new Error('This revision is no longer in your accessible published catalog. Check for updates again; nothing was applied.');
      return exact;
    } : undefined;
    return openSetTemplateUpdateReview(item.setId, item.template.id!, item.source.id!, signal, readSource);
  }, [isCurrent, observeSources]);

  return <WorkspaceUpdatesContext.Provider value={{ scope, sets, checking, inspectionError, source, lastChecked, checkSources, refreshLocal, receipts, noticeError, noticeBusy,
    retryReceipts: () => { void hydrateReceipts(); }, acknowledge, openSet, closeSet, openReview, preferences }}>
    {children}
    {selectedSetId && cardSets.some((set) => set.id === selectedSetId) ? <SetUpdatesPanel key={selectedSetId} setId={selectedSetId} renderPreview={renderPreview} onClose={closeSet} /> : null}
  </WorkspaceUpdatesContext.Provider>;
}
