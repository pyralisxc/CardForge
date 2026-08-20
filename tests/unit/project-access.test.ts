import { describe, expect, it } from 'vitest';

import {
  getExportEntitlementCopy,
  getExportGateMessage,
  getProjectCapabilities,
  resolveAccessMode,
} from '@/domain/entitlements';

describe('projectAccess', () => {
  it('maps free access to watermarked preview, generation, and one cloud set without clean exports', () => {
    expect(getProjectCapabilities('free')).toEqual({
      canPreview: true,
      canGenerate: true,
      canExportClean: false,
      canUseProjectFiles: false,
      cloudSetLimit: 1,
    });
  });

  it('can make portable project files free without unlocking clean finished exports or extra cloud slots', () => {
    expect(getProjectCapabilities('free', 'free')).toEqual({
      canPreview: true,
      canGenerate: true,
      canExportClean: false,
      canUseProjectFiles: true,
      cloudSetLimit: 1,
    });
  });

  it('maps paid access to clean export and five cloud set slots without shipped library writes', () => {
    expect(getProjectCapabilities('paid')).toEqual({
      canPreview: true,
      canGenerate: true,
      canExportClean: true,
      canUseProjectFiles: true,
      cloudSetLimit: 5,
    });
  });

  it('maps dev access to project, export, and five cloud-set capabilities without owning developer permissions', () => {
    expect(getProjectCapabilities('dev')).toEqual({
      canPreview: true,
      canGenerate: true,
      canExportClean: true,
      canUseProjectFiles: true,
      cloudSetLimit: 5,
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
    expect(getExportGateMessage('free')).toBe('Free PNG, PDF, ZIP, and Tabletop Simulator downloads include the CardForge watermark. Creator Pass removes it from finished files.');
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
    expect(copy.panelMessage).toContain('unlimited local Templates and card sets');
    expect(copy.panelMessage).toContain('1 set backed up in the cloud');
    expect(copy.panelMessage).toContain('download watermarked finished files');
    expect(copy.panelMessage).toContain('5 cloud set slots');
  });

  it('describes owner-enabled free project files alongside one cloud slot and watermarked finished exports', () => {
    const copy = getExportEntitlementCopy('free', 'free');
    expect(copy).toMatchObject({
      modeLabel: 'Free plan',
      canExportClean: false,
      projectFileGateMessage: null,
    });
    expect(copy.panelMessage).toContain('unlimited local Templates and card sets');
    expect(copy.panelMessage).toContain('1 set backed up in the cloud');
    expect(copy.panelMessage).toContain('move portable project files for free');
    expect(copy.panelMessage).toContain('download watermarked finished files');
  });

  it('describes paid access with five cloud set slots while keeping local projects unlimited', () => {
    expect(getExportEntitlementCopy('paid')).toEqual({
      modeLabel: 'Creator Pass active',
      canExportClean: true,
      gateMessage: null,
      projectFileGateMessage: null,
      panelMessage: 'Watermark-free PNG, PDF, and ZIP downloads, portable project files, and up to 5 cloud-saved card sets are available. Local projects remain unlimited on this device.',
    });
  });

  it('describes dev access with five cloud set slots while keeping local projects unlimited', () => {
    expect(getExportEntitlementCopy('dev')).toEqual({
      modeLabel: 'Contributor access',
      canExportClean: true,
      gateMessage: null,
      projectFileGateMessage: null,
      panelMessage: 'Watermark-free downloads, portable project files, and up to 5 cloud-saved card sets are available. Local projects remain unlimited on this device.',
    });
  });
});
