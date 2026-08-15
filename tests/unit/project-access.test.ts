import { describe, expect, it } from 'vitest';

import {
  getExportEntitlementCopy,
  getExportGateMessage,
  getProjectCapabilities,
  resolveAccessMode,
} from '@/domain/entitlements';

describe('projectAccess', () => {
  it('maps free access to preview and generation only', () => {
    expect(getProjectCapabilities('free')).toEqual({
      canPreview: true,
      canGenerate: true,
      canExportClean: false,
      canUseProjectFiles: false,
    });
  });

  it('can make portable project files free without unlocking clean finished exports', () => {
    expect(getProjectCapabilities('free', 'free')).toEqual({
      canPreview: true,
      canGenerate: true,
      canExportClean: false,
      canUseProjectFiles: true,
    });
  });

  it('maps paid access to clean export without shipped library writes', () => {
    expect(getProjectCapabilities('paid')).toEqual({
      canPreview: true,
      canGenerate: true,
      canExportClean: true,
      canUseProjectFiles: true,
    });
  });

  it('maps dev access to project and export capabilities without owning developer permissions', () => {
    expect(getProjectCapabilities('dev')).toEqual({
      canPreview: true,
      canGenerate: true,
      canExportClean: true,
      canUseProjectFiles: true,
    });
  });

  it('resolves explicit public access mode overrides', () => {
    expect(resolveAccessMode({
      NODE_ENV: 'production',
      NEXT_PUBLIC_CARDFORGE_ACCESS_MODE: 'paid',
    })).toBe('paid');
  });

  it('resolves explicit server access mode overrides', () => {
    expect(resolveAccessMode({
      NODE_ENV: 'production',
      CARDFORGE_ACCESS_MODE: 'dev',
    })).toBe('dev');
  });

  it('prefers server access mode when both explicit overrides are present', () => {
    expect(resolveAccessMode({
      NODE_ENV: 'production',
      NEXT_PUBLIC_CARDFORGE_ACCESS_MODE: 'free',
      CARDFORGE_ACCESS_MODE: 'dev',
    })).toBe('dev');
  });

  it('defaults development to dev and production to free', () => {
    expect(resolveAccessMode({ NODE_ENV: 'development' })).toBe('dev');
    expect(resolveAccessMode({ NODE_ENV: 'production' })).toBe('free');
  });

  it('ignores unsupported explicit modes and falls back to environment defaults', () => {
    expect(resolveAccessMode({
      NODE_ENV: 'production',
      NEXT_PUBLIC_CARDFORGE_ACCESS_MODE: 'enterprise',
    })).toBe('free');
  });

  it('returns export gate copy only when clean export is unavailable', () => {
    expect(getExportGateMessage('free')).toBe('Creator Pass unlocks watermark-free PNG, PDF, ZIP, and Tabletop Simulator downloads. You can keep designing and making preview cards for free.');
    expect(getExportGateMessage('paid')).toBeNull();
    expect(getExportGateMessage('dev')).toBeNull();
  });

  it('describes free access without internal entitlement terminology', () => {
    const copy = getExportEntitlementCopy('free');
    expect(copy).toMatchObject({
      modeLabel: 'Free plan',
      canExportClean: false,
      projectFileGateMessage: 'Creator Pass lets you download and open portable CardForge project files.',
    });
    expect(copy.panelMessage).toContain('Build Templates');
    expect(copy.panelMessage).toContain('preview cards for free');
    expect(copy.panelMessage).toContain('watermark-free downloads');
  });

  it('describes owner-enabled free project files without implying finished exports are free', () => {
    const copy = getExportEntitlementCopy('free', 'free');
    expect(copy).toMatchObject({
      modeLabel: 'Free plan',
      canExportClean: false,
      projectFileGateMessage: null,
    });
    expect(copy.panelMessage).toContain('Build Templates');
    expect(copy.panelMessage).toContain('move portable project files for free');
    expect(copy.panelMessage).toContain('watermark-free finished downloads');
  });

  it('describes paid access as export entitlement without cloud project storage', () => {
    expect(getExportEntitlementCopy('paid')).toEqual({
      modeLabel: 'Creator Pass active',
      canExportClean: true,
      gateMessage: null,
      projectFileGateMessage: null,
      panelMessage: 'Watermark-free PNG, PDF, and ZIP downloads and portable project files are available. Projects remain local to this browser unless you download and move a project file; CardForge does not store your card designs.',
    });
  });

  it('describes dev access as local validation entitlement without cloud project storage', () => {
    expect(getExportEntitlementCopy('dev')).toEqual({
      modeLabel: 'Contributor access',
      canExportClean: true,
      gateMessage: null,
      projectFileGateMessage: null,
      panelMessage: 'Watermark-free downloads and portable project files are available for local validation. Projects stay on this device unless you download and move a project file.',
    });
  });
});
