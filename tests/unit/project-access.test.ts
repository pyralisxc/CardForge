import { describe, expect, it } from 'vitest';

import {
  getExportEntitlementCopy,
  getExportGateMessage,
  getProjectCapabilities,
  isShippedLibraryWriteEnabled,
  resolveAccessMode,
} from '@/domain/entitlements';

describe('projectAccess', () => {
  it('maps free access to preview and generation only', () => {
    expect(getProjectCapabilities('free')).toEqual({
      canPreview: true,
      canGenerate: true,
      canExportClean: false,
      canWriteShippedLibrary: false,
    });
  });

  it('maps paid access to clean export without shipped library writes', () => {
    expect(getProjectCapabilities('paid')).toEqual({
      canPreview: true,
      canGenerate: true,
      canExportClean: true,
      canWriteShippedLibrary: false,
    });
  });

  it('maps dev access to every project capability', () => {
    expect(getProjectCapabilities('dev')).toEqual({
      canPreview: true,
      canGenerate: true,
      canExportClean: true,
      canWriteShippedLibrary: true,
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

  it('requires dev mode and an explicit server flag for shipped library writes', () => {
    expect(isShippedLibraryWriteEnabled({
      NODE_ENV: 'development',
      CARDFORGE_ALLOW_LIBRARY_WRITES: 'true',
    })).toBe(true);

    expect(isShippedLibraryWriteEnabled({
      NODE_ENV: 'development',
    })).toBe(false);

    expect(isShippedLibraryWriteEnabled({
      NODE_ENV: 'production',
      CARDFORGE_ACCESS_MODE: 'paid',
      CARDFORGE_ALLOW_LIBRARY_WRITES: 'true',
    })).toBe(false);
  });

  it('returns export gate copy only when clean export is unavailable', () => {
    expect(getExportGateMessage('free')).toBe('Creator Pass unlocks watermark-free PNG, PDF, and ZIP downloads plus portable CardForge project files. You can keep designing and making preview cards for free.');
    expect(getExportGateMessage('paid')).toBeNull();
    expect(getExportGateMessage('dev')).toBeNull();
  });

  it('describes free access without internal entitlement terminology', () => {
    expect(getExportEntitlementCopy('free')).toEqual({
      modeLabel: 'Free plan',
      canExportClean: false,
      gateMessage: 'Creator Pass unlocks watermark-free PNG, PDF, and ZIP downloads plus portable CardForge project files. You can keep designing and making preview cards for free.',
      panelMessage: 'Design layouts, add card data, and make preview cards for free. Creator Pass adds watermark-free downloads and portable project files.',
    });
  });

  it('describes paid access as export entitlement without cloud project storage', () => {
    expect(getExportEntitlementCopy('paid')).toEqual({
      modeLabel: 'Creator Pass active',
      canExportClean: true,
      gateMessage: null,
      panelMessage: 'Watermark-free PNG, PDF, and ZIP downloads and portable project files are available. Projects remain local to this browser unless you download and move a project file; CardForge does not store your card designs.',
    });
  });

  it('describes dev access as local validation entitlement without cloud project storage', () => {
    expect(getExportEntitlementCopy('dev')).toEqual({
      modeLabel: 'Contributor access',
      canExportClean: true,
      gateMessage: null,
      panelMessage: 'Watermark-free downloads and portable project files are available for local validation. Projects stay on this device unless you download and move a project file.',
    });
  });
});
