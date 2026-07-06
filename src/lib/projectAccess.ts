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

export const getProjectCapabilities = (mode: AccessMode): ProjectCapabilities => {
  if (mode === 'dev') {
    return {
      canPreview: true,
      canGenerate: true,
      canExportClean: true,
      canWriteShippedLibrary: true,
    };
  }

  if (mode === 'paid') {
    return {
      canPreview: true,
      canGenerate: true,
      canExportClean: true,
      canWriteShippedLibrary: false,
    };
  }

  return {
    canPreview: true,
    canGenerate: true,
    canExportClean: false,
    canWriteShippedLibrary: false,
  };
};

export const resolveAccessMode = (env?: AccessEnvironment): AccessMode => {
  const source = readEnvironment(env);
  const explicitMode = source.CARDFORGE_ACCESS_MODE ?? source.NEXT_PUBLIC_CARDFORGE_ACCESS_MODE;

  if (isAccessMode(explicitMode)) return explicitMode;
  return source.NODE_ENV === 'development' ? 'dev' : 'free';
};

export const getExportGateMessage = (mode: AccessMode): string | null =>
  getProjectCapabilities(mode).canExportClean
    ? null
    : 'Available now: design layouts, import data, and generate previews in this browser. Unlock clean exports and portable project files with Creator Pass or dev access.';

export const getExportEntitlementCopy = (mode: AccessMode): ExportEntitlementCopy => {
  const gateMessage = getExportGateMessage(mode);
  const canExportClean = getProjectCapabilities(mode).canExportClean;

  if (mode === 'dev') {
    return {
      modeLabel: 'Dev export entitlement active',
      canExportClean,
      gateMessage,
      panelMessage: 'Clean export is unlocked for local validation. Projects remain local unless you export a project file yourself.',
    };
  }

  if (mode === 'paid') {
    return {
      modeLabel: 'Paid export entitlement active',
      canExportClean,
      gateMessage,
      panelMessage: 'Clean PDF, PNG, and ZIP export are unlocked. Projects remain local to this browser and project files; CardForge does not store your designs.',
    };
  }

  return {
    modeLabel: 'Free preview mode',
    canExportClean,
    gateMessage,
    panelMessage: 'Free mode can design layouts, import data, and generate previews. Project files plus clean PDF, PNG, and ZIP export unlock with Creator Pass or dev access.',
  };
};

export const isShippedLibraryWriteEnabled = (env?: AccessEnvironment): boolean => {
  const source = readEnvironment(env);
  const capabilities = getProjectCapabilities(resolveAccessMode(source));
  return capabilities.canWriteShippedLibrary && source.CARDFORGE_ALLOW_LIBRARY_WRITES === 'true';
};
