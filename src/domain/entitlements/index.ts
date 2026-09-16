export type AccessMode = 'free' | 'paid' | 'contributor';
export type PaidPlan = 'creator' | 'designer';

export type ProjectCapabilities = {
  canPreview: boolean;
  canGenerate: boolean;
  canExportClean: boolean;
  canUseProjectFiles: boolean;
};

export type ExportEntitlementCopy = {
  modeLabel: string;
  canExportClean: boolean;
  gateMessage: string | null;
  projectFileGateMessage: string | null;
  panelMessage: string;
};

type AccessEnvironment = Partial<Record<
  'NODE_ENV' | 'NEXT_PUBLIC_CARDFORGE_ACCESS_MODE' | 'CARDFORGE_ACCESS_MODE',
  string
>>;

const ACCESS_MODES = new Set<AccessMode>(['free', 'paid', 'contributor']);

const isAccessMode = (value: string | undefined): value is AccessMode =>
  typeof value === 'string' && ACCESS_MODES.has(value as AccessMode);

const readEnvironment = (env?: AccessEnvironment): AccessEnvironment => env ?? {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_CARDFORGE_ACCESS_MODE: process.env.NEXT_PUBLIC_CARDFORGE_ACCESS_MODE,
  CARDFORGE_ACCESS_MODE: process.env.CARDFORGE_ACCESS_MODE,
};

export const getProjectCapabilities = (mode: AccessMode): ProjectCapabilities => ({
  canPreview: true,
  canGenerate: true,
  canExportClean: mode !== 'free',
  // A creator's portable work belongs to them. CardForge plans improve the
  // finished output and CardForge-operated services; they never hold project
  // packages, local folders, or the creator's connected provider hostage.
  canUseProjectFiles: true,
});

export const isWatermarkRequired = (canExportClean: boolean): boolean =>
  !canExportClean;

export const resolveAccessMode = (env?: AccessEnvironment): AccessMode => {
  const source = readEnvironment(env);
  const explicitMode = source.CARDFORGE_ACCESS_MODE ?? source.NEXT_PUBLIC_CARDFORGE_ACCESS_MODE;
  if (isAccessMode(explicitMode)) return explicitMode;
  return source.NODE_ENV === 'development' ? 'contributor' : 'free';
};

export const getExportGateMessage = (mode: AccessMode): string | null =>
  getProjectCapabilities(mode).canExportClean
    ? null
    : 'Free PNG, PDF, ZIP, and Tabletop Simulator downloads include the CardForge watermark. Creator Pass removes it from finished files.';

export const getExportEntitlementCopy = (mode: AccessMode): ExportEntitlementCopy => {
  const gateMessage = getExportGateMessage(mode);
  const projectFileGateMessage = null;
  const canExportClean = getProjectCapabilities(mode).canExportClean;

  if (mode === 'contributor') {
    return {
      modeLabel: 'Contributor access',
      canExportClean,
      gateMessage,
      projectFileGateMessage,
      panelMessage: 'Watermark-free downloads and portable project files are available. Local projects remain unlimited on this device.',
    };
  }

  if (mode === 'paid') {
    return {
      modeLabel: 'Creator Pass active',
      canExportClean,
      gateMessage,
      projectFileGateMessage,
      panelMessage: 'Watermark-free PNG, PDF, and ZIP downloads and portable project files are available. Local projects remain unlimited on this device.',
    };
  }

  return {
    modeLabel: 'Free plan',
    canExportClean,
    gateMessage,
    projectFileGateMessage,
    panelMessage: 'Build unlimited local Templates and card sets, keep portable project files in your own locations, and download watermarked finished files. Creator Pass removes the watermark.',
  };
};

export * from './ownerAccess';
