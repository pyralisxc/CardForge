import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { EnvironmentCommandBand } from '@/features/app-shell/environment/components/EnvironmentCommandBand';
import { EnvironmentDesktopInspector } from '@/features/app-shell/environment/components/EnvironmentDetail';
import { EnvironmentShell } from '@/features/app-shell/environment/components/EnvironmentShell';
import { getActionsForRecord, homeCurrentWork, profileGroups, queueItems } from '@/features/app-shell/environment/lab/fixtures';
import type { ActionDescriptor } from '@/features/app-shell/environment/model';
import type { EnvironmentDetailRecord } from '@/features/app-shell/environment/presentation';

const baseAction: ActionDescriptor = {
  id: 'library.open-set',
  label: 'Open in Studio',
  ownerFeature: 'studio-documents',
  supportedObjectKinds: ['set'],
  supportedSources: ['browser-local'],
  revisionPolicy: 'none',
  requiredPermission: 'member',
  scope: 'object',
  hierarchy: 'primary',
  availability: { kind: 'available' },
  commitment: 'none',
  automation: { kind: 'human-only', owner: 'cardforge' },
  result: 'navigation',
};

const record: EnvironmentDetailRecord = {
  id: 'set-alpha',
  kind: 'set',
  eyebrow: 'Set',
  title: 'Set Alpha',
  summary: 'A test Set',
  status: 'Ready',
  tone: 'success',
  actionSources: [{ id: 'device', label: 'This device', source: 'browser-local', currentRevisionAvailable: true }],
  meta: [['Location', 'This device']],
};

describe('Environment action presentation', () => {
  it('renders a disabled primary action with its required reason', () => {
    const action: ActionDescriptor = { ...baseAction, availability: { kind: 'disabled', reason: 'Reconnect first.' } };
    const markup = renderToStaticMarkup(createElement(EnvironmentCommandBand, { zone: { id: 'library', label: 'Library' }, primaryAction: action, onCommand: vi.fn(), onAction: vi.fn() }));
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('title="Reconnect first."');
  });

  it('omits hidden actions from the detail surface', () => {
    const hidden: ActionDescriptor = { ...baseAction, id: 'owner.publish-set', label: 'Owner-only publication', requiredPermission: 'owner', availability: { kind: 'hidden', reason: 'Owner access required.' } };
    const markup = renderToStaticMarkup(createElement(EnvironmentDesktopInspector, { record, actions: [hidden], onClose: vi.fn(), onAction: vi.fn() }));
    expect(markup).not.toContain('Owner-only publication');
  });

  it('enforces record source and revision context in the shared shell action layer', () => {
    const revisionBound: ActionDescriptor = {
      ...baseAction,
      supportedSources: ['google-drive'],
      revisionPolicy: 'current-required',
    };
    const unavailableRecord: EnvironmentDetailRecord = {
      ...record,
      actionSources: [{ id: 'drive-stale', label: 'Google Drive', source: 'google-drive', currentRevisionAvailable: false }],
    };
    const markup = renderToStaticMarkup(createElement(EnvironmentShell, {
      ariaLabel: 'Environment test shell',
      brand: { src: '/brand/cardforge-studio/brand-mark.svg', alt: 'CardForge' },
      viewer: { signedIn: true, contributor: false, owner: false },
      zones: [{ id: 'library', href: '/account?section=library', label: 'Library', shortLabel: 'Library', minimumAccess: 'member', showInPrivateRail: true, viewportPolicy: 'flow' }],
      activeZone: 'library',
      viewportPolicy: 'flow',
      detail: unavailableRecord,
      actions: [revisionBound],
      statusContent: createElement('span', null, 'Ready'),
      footerContent: createElement('span', null, '1 selected'),
      onChooseZone: vi.fn(),
      onCommand: vi.fn(),
      onAction: vi.fn(),
      onCloseDetail: vi.fn(),
    }, createElement('p', null, 'Library content')));
    expect(markup).not.toContain('Open in Studio');

    const multiLocationRecord: EnvironmentDetailRecord = {
      ...record,
      actionSources: [
        { id: 'device-current', label: 'This device', source: 'browser-local', currentRevisionAvailable: true },
        { id: 'drive-stale', label: 'Google Drive', source: 'google-drive', currentRevisionAvailable: false },
      ],
    };
    const localRevisionBound: ActionDescriptor = { ...revisionBound, supportedSources: ['browser-local', 'google-drive'] };
    const multiLocationMarkup = renderToStaticMarkup(createElement(EnvironmentShell, {
      ariaLabel: 'Multi-location environment test shell',
      brand: { src: '/brand/cardforge-studio/brand-mark.svg', alt: 'CardForge' },
      viewer: { signedIn: true, contributor: false, owner: false },
      zones: [{ id: 'library', href: '/account?section=library', label: 'Library', shortLabel: 'Library', minimumAccess: 'member', showInPrivateRail: true, viewportPolicy: 'flow' }],
      activeZone: 'library',
      viewportPolicy: 'flow',
      detail: multiLocationRecord,
      actions: [localRevisionBound],
      statusContent: createElement('span', null, 'Ready'),
      footerContent: createElement('span', null, '1 selected'),
      onChooseZone: vi.fn(),
      onCommand: vi.fn(),
      onAction: vi.fn(),
      onCloseDetail: vi.fn(),
    }, createElement('p', null, 'Library content')));
    expect(multiLocationMarkup).toContain('Open in Studio');
  });

  it('maps demonstrated actions to their canonical feature owners', () => {
    expect(getActionsForRecord('home', homeCurrentWork, 'home')[0]?.ownerFeature).toBe('card-generator');
    expect(getActionsForRecord('profile', profileGroups[0]?.items[0] ?? null, 'profile')[0]?.ownerFeature).toBe('account');
    expect(getActionsForRecord('profile', profileGroups[1]?.items[0] ?? null, 'profile')[0]?.ownerFeature).toBe('account');
    expect(getActionsForRecord('queue', queueItems[0] ?? null, 'owner').map((action) => action.ownerFeature)).toEqual(['developer-assets', 'developer-assets']);
    expect(getActionsForRecord('collection', { ...record, kind: 'template' }, 'library')[0]?.ownerFeature).toBe('template-editor');
    expect(getActionsForRecord('queue', queueItems[2] ?? null, 'developer')[0]?.ownerFeature).toBe('billing');
  });
});
