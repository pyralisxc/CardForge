export type AccessMode = 'free' | 'paid' | 'dev';
export type PaidPlan = 'creator' | 'designer';
export type ProjectFileAccessPolicy = 'free' | 'creator_pass';

export type ProjectCapabilities = {
  canPreview: boolean;
  canGenerate: boolean;
  canExportClean: boolean;
  canUseProjectFiles: boolean;
  cloudSetLimit: number;
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

const ACCESS_MODES = new Set<AccessMode>(['free', 'paid', 'dev']);

const isAccessMode = (value: string | undefined): value is AccessMode =>
  typeof value === 'string' && ACCESS_MODES.has(value as AccessMode);

const readEnvironment = (env?: AccessEnvironment): AccessEnvironment => env ?? {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_CARDFORGE_ACCESS_MODE: process.env.NEXT_PUBLIC_CARDFORGE_ACCESS_MODE,
  CARDFORGE_ACCESS_MODE: process.env.CARDFORGE_ACCESS_MODE,
};

export const getCloudSetLimit = (mode: AccessMode): number => mode === 'free' ? 1 : 5;

export const getProjectCapabilities = (
  mode: AccessMode,
  projectFileAccess: ProjectFileAccessPolicy = 'creator_pass',
): ProjectCapabilities => ({
  canPreview: true,
  canGenerate: true,
  canExportClean: mode !== 'free',
  canUseProjectFiles: mode !== 'free' || projectFileAccess === 'free',
  cloudSetLimit: getCloudSetLimit(mode),
});

export const isWatermarkRequired = (canExportClean: boolean): boolean =>
  !canExportClean;

export const resolveAccessMode = (env?: AccessEnvironment): AccessMode => {
  const source = readEnvironment(env);
  const explicitMode = source.CARDFORGE_ACCESS_MODE ?? source.NEXT_PUBLIC_CARDFORGE_ACCESS_MODE;
  if (isAccessMode(explicitMode)) return explicitMode;
  return source.NODE_ENV === 'development' ? 'dev' : 'free';
};

export const getExportGateMessage = (mode: AccessMode): string | null =>
  getProjectCapabilities(mode).canExportClean
    ? null
    : 'Free PNG, PDF, ZIP, and Tabletop Simulator downloads include the CardForge watermark. Creator Pass removes it from finished files.';

export const getProjectFileGateMessage = (
  mode: AccessMode,
  projectFileAccess: ProjectFileAccessPolicy = 'creator_pass',
): string | null => getProjectCapabilities(mode, projectFileAccess).canUseProjectFiles
  ? null
  : 'Creator Pass lets you download and open portable CardForge project files.';

export const getExportEntitlementCopy = (
  mode: AccessMode,
  projectFileAccess: ProjectFileAccessPolicy = 'creator_pass',
): ExportEntitlementCopy => {
  const gateMessage = getExportGateMessage(mode);
  const projectFileGateMessage = getProjectFileGateMessage(mode, projectFileAccess);
  const canExportClean = getProjectCapabilities(mode, projectFileAccess).canExportClean;

  if (mode === 'dev') {
    return {
      modeLabel: 'Contributor access',
      canExportClean,
      gateMessage,
      projectFileGateMessage,
      panelMessage: 'Watermark-free downloads, portable project files, and up to 5 cloud-saved card sets are available. Local projects remain unlimited on this device.',
    };
  }

  if (mode === 'paid') {
    return {
      modeLabel: 'Creator Pass active',
      canExportClean,
      gateMessage,
      projectFileGateMessage,
      panelMessage: 'Watermark-free PNG, PDF, and ZIP downloads, portable project files, and up to 5 cloud-saved card sets are available. Local projects remain unlimited on this device.',
    };
  }

  return {
    modeLabel: 'Free plan',
    canExportClean,
    gateMessage,
    projectFileGateMessage,
    panelMessage: projectFileAccess === 'free'
      ? 'Build unlimited local Templates and card sets, keep 1 set backed up in the cloud when signed in, move portable project files for free, and download watermarked finished files. Creator Pass adds 5 cloud set slots and removes the watermark.'
      : 'Build unlimited local Templates and card sets, keep 1 set backed up in the cloud when signed in, and download watermarked finished files. Creator Pass adds 5 cloud set slots, removes the watermark, and adds portable project files.',
  };
};

export * from './ownerAccess';
