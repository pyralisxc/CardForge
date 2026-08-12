export type AccessMode = 'free' | 'paid' | 'dev';

export type ProjectCapabilities = {
  canPreview: boolean;
  canGenerate: boolean;
  canExportClean: boolean;
  canWriteShippedLibrary: boolean;
};

export type ExportEntitlementCopy = {
  modeLabel: string;
  canExportClean: boolean;
  gateMessage: string | null;
  panelMessage: string;
};

type AccessEnvironment = Partial<Record<
  'NODE_ENV' | 'NEXT_PUBLIC_CARDFORGE_ACCESS_MODE' | 'CARDFORGE_ACCESS_MODE' | 'CARDFORGE_ALLOW_LIBRARY_WRITES',
  string
>>;

const ACCESS_MODES = new Set<AccessMode>(['free', 'paid', 'dev']);

const isAccessMode = (value: string | undefined): value is AccessMode =>
  typeof value === 'string' && ACCESS_MODES.has(value as AccessMode);

const readEnvironment = (env?: AccessEnvironment): AccessEnvironment => env ?? {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_CARDFORGE_ACCESS_MODE: process.env.NEXT_PUBLIC_CARDFORGE_ACCESS_MODE,
  CARDFORGE_ACCESS_MODE: process.env.CARDFORGE_ACCESS_MODE,
  CARDFORGE_ALLOW_LIBRARY_WRITES: process.env.CARDFORGE_ALLOW_LIBRARY_WRITES,
};

export const getProjectCapabilities = (mode: AccessMode): ProjectCapabilities => ({
  canPreview: true,
  canGenerate: true,
  canExportClean: mode !== 'free',
  canWriteShippedLibrary: mode === 'dev',
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
    : 'Creator Pass unlocks watermark-free PNG, PDF, and ZIP downloads plus portable CardForge project files. You can keep designing and making preview cards for free.';

export const getExportEntitlementCopy = (mode: AccessMode): ExportEntitlementCopy => {
  const gateMessage = getExportGateMessage(mode);
  const canExportClean = getProjectCapabilities(mode).canExportClean;

  if (mode === 'dev') {
    return {
      modeLabel: 'Contributor access',
      canExportClean,
      gateMessage,
      panelMessage: 'Watermark-free downloads and portable project files are available for local validation. Projects stay on this device unless you download and move a project file.',
    };
  }

  if (mode === 'paid') {
    return {
      modeLabel: 'Creator Pass active',
      canExportClean,
      gateMessage,
      panelMessage: 'Watermark-free PNG, PDF, and ZIP downloads and portable project files are available. Projects remain local to this browser unless you download and move a project file; CardForge does not store your card designs.',
    };
  }

  return {
    modeLabel: 'Free plan',
    canExportClean,
    gateMessage,
    panelMessage: 'Design layouts, add card data, and make preview cards for free. Creator Pass adds watermark-free downloads and portable project files.',
  };
};

export const isShippedLibraryWriteEnabled = (env?: AccessEnvironment): boolean => {
  const source = readEnvironment(env);
  return getProjectCapabilities(resolveAccessMode(source)).canWriteShippedLibrary
    && source.CARDFORGE_ALLOW_LIBRARY_WRITES === 'true';
};

export * from './ownerAccess';
