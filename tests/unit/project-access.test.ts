import { describe, expect, it } from 'vitest';

import {
  getExportEntitlementCopy,
  getExportGateMessage,
  getProjectCapabilities,
  isShippedLibraryWriteEnabled,
  resolveAccessMode,
} from '@/lib/projectAccess';

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
    expect(getExportGateMessage('free')).toBe('Clean export and project file portability require an active paid or dev account. Your layouts, imports, and generated previews stay local to this browser.');
    expect(getExportGateMessage('paid')).toBeNull();
    expect(getExportGateMessage('dev')).toBeNull();
  });

  it('describes free access as local preview mode with clean export locked', () => {
    expect(getExportEntitlementCopy('free')).toEqual({
      modeLabel: 'Free preview mode',
      canExportClean: false,
      gateMessage: 'Clean export and project file portability require an active paid or dev account. Your layouts, imports, and generated previews stay local to this browser.',
      panelMessage: 'Free mode can design layouts, import data, and generate previews. Project files plus clean PDF, PNG, and ZIP export unlock with an active paid or dev account.',
    });
  });

  it('describes paid access as export entitlement without cloud project storage', () => {
    expect(getExportEntitlementCopy('paid')).toEqual({
      modeLabel: 'Paid export entitlement active',
      canExportClean: true,
      gateMessage: null,
      panelMessage: 'Clean PDF, PNG, and ZIP export are unlocked. Projects remain local to this browser and project files; CardForge does not store your designs.',
    });
  });

  it('describes dev access as local validation entitlement without cloud project storage', () => {
    expect(getExportEntitlementCopy('dev')).toEqual({
      modeLabel: 'Dev export entitlement active',
      canExportClean: true,
      gateMessage: null,
      panelMessage: 'Clean export is unlocked for local validation. Projects remain local unless you export a project file yourself.',
    });
  });
});
