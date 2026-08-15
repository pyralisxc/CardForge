export type AccessMode = 'free' | 'paid' | 'dev';
export type ProjectFileAccessPolicy = 'free' | 'creator_pass';

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

const ACCESS_MODES = new Set<AccessMode>(['free', 'paid', 'dev']);

const isAccessMode = (value: string | undefined): value is AccessMode =>
  typeof value === 'string' && ACCESS_MODES.has(value as AccessMode);

const readEnvironment = (env?: AccessEnvironment): AccessEnvironment => env ?? {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_CARDFORGE_ACCESS_MODE: process.env.NEXT_PUBLIC_CARDFORGE_ACCESS_MODE,
  CARDFORGE_ACCESS_MODE: process.env.CARDFORGE_ACCESS_MODE,
};

export const getProjectCapabilities = (
  mode: AccessMode,
  projectFileAccess: ProjectFileAccessPolicy = 'creator_pass',
): ProjectCapabilities => ({
  canPreview: true,
  canGenerate: true,
  canExportClean: mode !== 'free',
  canUseProjectFiles: mode !== 'free' || projectFileAccess === 'free',
});

export const resolveAccessMode = (env?: AccessEnvironment): AccessMode => {
  const source = readEnvironment(env);
  const explicitMode = source.CARDFORGE_ACCESS_MODE ?? source.NEXT_PUBLIC_CARDFORGE_ACCESS_MODE;
  if (isAccessMode(explicitMode)) return explicitMode;
  return source.NODE_ENV === 'development' ? 'dev' : 'free';
};

export const getExportGateMessage = (mode: AccessMode): string | null =>
  getProjectCapabilities(mode).canExportClean
    ? null
    : 'Creator Pass unlocks watermark-free PNG, PDF, ZIP, and Tabletop Simulator downloads. You can keep designing and making preview cards for free.';

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
      panelMessage: 'Watermark-free downloads and portable project files are available for local validation. Projects stay on this device unless you download and move a project file.',
    };
  }

  if (mode === 'paid') {
    return {
      modeLabel: 'Creator Pass active',
      canExportClean,
      gateMessage,
      projectFileGateMessage,
      panelMessage: 'Watermark-free PNG, PDF, and ZIP downloads and portable project files are available. Projects remain local to this browser unless you download and move a project file; CardForge does not store your card designs.',
    };
  }

  return {
    modeLabel: 'Free plan',
    canExportClean,
    gateMessage,
    projectFileGateMessage,
    panelMessage: projectFileAccess === 'free'
      ? 'Build Templates, add card data, and move portable project files for free. Creator Pass adds watermark-free finished downloads.'
      : 'Build Templates, add card data, and make preview cards for free. Creator Pass adds watermark-free downloads and portable project files.',
  };
};

export * from './ownerAccess';
