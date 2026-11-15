import { describe, expect, it } from 'vitest';

import {
  closeEnvironmentDetail,
  createSelectionSession,
  getApplicableActionSources,
  isActionAvailable,
  isActionApplicable,
  openEnvironmentDetail,
  projectApiClientErrorBoundary,
  selectEnvironmentObject,
  type ActionDescriptor,
} from '@/features/app-shell/client/environment';
import { ApiClientError } from '@/infrastructure/http/clientResponses';
import type { BoundaryFailureKind } from '@/shared/boundaryFailure';

describe('Environment Foundation model', () => {
  it('enforces action availability, permissions, object kinds and exact source/revision context', () => {
    const action: ActionDescriptor = {
      id: 'library.open-set',
      label: 'Open in Studio',
      ownerFeature: 'studio-documents',
      supportedObjectKinds: ['set'],
      supportedSources: ['google-drive'],
      revisionPolicy: 'current-required',
      requiredPermission: 'member',
      scope: 'object',
      hierarchy: 'primary',
      availability: { kind: 'disabled', reason: 'Reconnect this location before opening its copy.' },
      commitment: 'permission',
      automation: { kind: 'published-mcp', tools: ['list_connected_projects', 'checkout_project'] },
      result: 'navigation',
    };

    expect(isActionAvailable(action)).toBe(false);
    expect(isActionAvailable({ ...action, availability: { kind: 'available' } })).toBe(true);
    expect(isActionAvailable({ ...action, availability: { kind: 'hidden', reason: 'Owner only' } })).toBe(false);
    const creator = { signedIn: true, contributor: false, owner: false };
    const currentDrive = { id: 'drive-current', label: 'Google Drive', source: 'google-drive' as const, currentRevisionAvailable: true };
    const staleDrive = { ...currentDrive, id: 'drive-stale', currentRevisionAvailable: false };
    const currentDevice = { id: 'device-current', label: 'This device', source: 'browser-local' as const, currentRevisionAvailable: true };
    expect(isActionApplicable(action, { objectKind: 'set', sources: [currentDrive], viewer: creator })).toBe(true);
    expect(isActionApplicable(action, { objectKind: 'template', sources: [currentDevice], viewer: creator })).toBe(false);
    expect(isActionApplicable(action, { objectKind: 'set', sources: [currentDrive], viewer: { signedIn: false, contributor: false, owner: false } })).toBe(false);
    expect(isActionApplicable(action, { objectKind: 'set', sources: [staleDrive], viewer: creator })).toBe(false);
    expect(getApplicableActionSources(action, { objectKind: 'set', sources: [staleDrive, currentDrive, currentDevice], viewer: creator })).toEqual([currentDrive]);
    const multiLocationAction: ActionDescriptor = { ...action, supportedSources: ['browser-local', 'google-drive'] };
    expect(isActionApplicable(multiLocationAction, { objectKind: 'set', sources: [staleDrive, currentDevice], viewer: creator })).toBe(true);
    expect(getApplicableActionSources(multiLocationAction, { objectKind: 'set', sources: [staleDrive, currentDevice], viewer: creator })).toEqual([currentDevice]);
  });

  it('projects transport failures without flattening their boundary meaning', () => {
    const failureKinds: BoundaryFailureKind[] = ['authentication', 'authorization', 'conflict', 'invalid', 'limit', 'not_found', 'unavailable'];
    for (const kind of failureKinds) {
      const error = new ApiClientError(
        `${kind} message`, 409, `${kind}_code`, kind, kind === 'unavailable', `correlation-${kind}`, `Resolve ${kind}`, 30,
        kind === 'limit' ? { resource: 'drafts', maximum: 5, unit: 'documents', current: 5 } : undefined,
      );
      expect(projectApiClientErrorBoundary(error)).toEqual({
        kind,
        code: `${kind}_code`,
        message: `${kind} message`,
        retryable: kind === 'unavailable',
        nextAction: `Resolve ${kind}`,
        correlationId: `correlation-${kind}`,
        retryAfterSeconds: 30,
        ...(kind === 'limit' ? { limit: { resource: 'drafts', maximum: 5, unit: 'documents', current: 5 } } : {}),
      });
    }
  });

  it('restores exact selection, list position, focus target, and zoom after detail closes', () => {
    const initial = createSelectionSession({ objectId: 'set-alpha', listOffset: 384, focusReturnId: 'library-row-set-alpha', zoom: 0.85 });
    const selected = selectEnvironmentObject(initial, { objectId: 'set-beta', listOffset: 912, focusReturnId: 'library-row-set-beta', zoom: 1.1 });
    const detail = openEnvironmentDetail(selected, { objectId: 'asset-detail', listOffset: 0, focusReturnId: 'detail-close', zoom: 1.75 });
    expect(closeEnvironmentDetail(detail)).toEqual(selected);
  });
});
