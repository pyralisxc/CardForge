"use client";

import { createContext, useContext } from 'react';
import type { TCGCardTemplate } from '@/domain/templates';
import type { BoundaryFailureKind } from '@/shared/boundaryFailure';
import type { ScopedSourceSnapshot } from '@/shared/scopedSource';
import type { ProjectPersistenceScope } from '../lib/projectPersistenceIdentity';
import type { UpdateNoticeReceipt, UpdateNoticeReceipts } from '../model/updateNotices';
import type { OpenTemplateUpdateReview } from '../client/setTemplateUpdateReview';
import type { UpdateCheckIntervalSeconds } from '../client/editorPreferenceStorage';
import type { SetUpdateProjection, WorkspaceTemplateUpdate } from '../client/workspaceUpdates';

export interface UpdatePreferences {
  ready: boolean;
  notificationsEnabled: boolean;
  automaticChecks: boolean;
  intervalSeconds: UpdateCheckIntervalSeconds;
  error: string | null;
  retry: () => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setAutomaticChecks: (enabled: boolean) => void;
  setIntervalSeconds: (seconds: UpdateCheckIntervalSeconds) => void;
}

export interface UpdateSourceFailure {
  kind: BoundaryFailureKind;
  message: string;
  nextAction?: string;
  correlationId?: string | null;
}

export interface WorkspaceUpdatesContextValue {
  scope: ProjectPersistenceScope;
  sets: SetUpdateProjection[];
  checking: boolean;
  inspectionError: string | null;
  source: ScopedSourceSnapshot<ProjectPersistenceScope, TCGCardTemplate[], UpdateSourceFailure> | null;
  lastChecked: number | null;
  checkSources: () => Promise<void>;
  refreshLocal: () => void;
  receipts: UpdateNoticeReceipts | null;
  noticeError: string | null;
  noticeBusy: boolean;
  retryReceipts: () => void;
  acknowledge: (keys: string[], action: UpdateNoticeReceipt) => Promise<void>;
  openSet: (setId: string, returnFocus?: HTMLElement | null) => void;
  closeSet: () => void;
  openReview: (item: WorkspaceTemplateUpdate, signal?: AbortSignal) => Promise<OpenTemplateUpdateReview>;
  preferences: UpdatePreferences;
}

export const WorkspaceUpdatesContext = createContext<WorkspaceUpdatesContextValue | null>(null);

export const useWorkspaceUpdates = (): WorkspaceUpdatesContextValue => {
  const context = useContext(WorkspaceUpdatesContext);
  if (!context) throw new Error('Workspace Updates requires the ready account workspace boundary.');
  return context;
};
