export const BROWSER_WORKSPACE_RECORD_VERSION = 1 as const;

export interface BrowserWorkspaceRecord {
  cardforgeWorkspaceRecord: typeof BROWSER_WORKSPACE_RECORD_VERSION;
  revision: number;
  writerId: string;
  value: string;
}

export interface ParsedBrowserWorkspaceRecord {
  revision: number;
  writerId: string | null;
  value: string;
  legacy: boolean;
}

export class BrowserWorkspaceConflictError extends Error {
  readonly expectedRevision: number;
  readonly actualRevision: number;

  constructor(expectedRevision: number, actualRevision: number) {
    super('This browser workspace changed in another tab. Your current tab was left unchanged; reload before saving again.');
    this.name = 'BrowserWorkspaceConflictError';
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

export const parseBrowserWorkspaceRecord = (raw: string): ParsedBrowserWorkspaceRecord => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isRecord(parsed)
      && parsed.cardforgeWorkspaceRecord === BROWSER_WORKSPACE_RECORD_VERSION
      && Number.isSafeInteger(parsed.revision)
      && Number(parsed.revision) >= 1
      && typeof parsed.writerId === 'string'
      && typeof parsed.value === 'string') {
      return {
        revision: Number(parsed.revision),
        writerId: parsed.writerId,
        value: parsed.value,
        legacy: false,
      };
    }
  } catch {
    // A legacy Zustand payload is itself JSON; it remains the revision-zero value.
  }
  return { revision: 0, writerId: null, value: raw, legacy: true };
};

export const serializeBrowserWorkspaceRecord = ({
  revision,
  writerId,
  value,
}: Omit<BrowserWorkspaceRecord, 'cardforgeWorkspaceRecord'>): string => JSON.stringify({
  cardforgeWorkspaceRecord: BROWSER_WORKSPACE_RECORD_VERSION,
  revision,
  writerId,
  value,
} satisfies BrowserWorkspaceRecord);

export type GuestWorkspaceAdoptionChoice = 'keep-account-workspace' | 'replace-with-guest-workspace';

export const resolveGuestWorkspaceAdoption = ({
  choice,
  guestValue,
  accountValue,
}: {
  choice: GuestWorkspaceAdoptionChoice;
  guestValue: string;
  accountValue: string | null;
}): string | null => (
  choice === 'replace-with-guest-workspace' ? guestValue : accountValue
);
