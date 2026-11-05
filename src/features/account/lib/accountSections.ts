export const ACCOUNT_SECTIONS = ['desk', 'library', 'profile'] as const;

export type AccountSection = typeof ACCOUNT_SECTIONS[number];

interface ResolveAccountSectionInput {
  requestedSection?: string;
  hasStorageResult?: boolean;
  hasBillingIntent?: boolean;
}

export const resolveAccountSection = ({
  requestedSection,
  hasStorageResult = false,
  hasBillingIntent = false,
}: ResolveAccountSectionInput): AccountSection => {
  // Compatibility-only translators for links issued before locations and billing
  // became contextual tools of Library and Profile.
  if (requestedSection === 'storage') return 'library';
  if (requestedSection === 'billing') return 'profile';
  if (requestedSection === 'home') return 'desk';
  if (ACCOUNT_SECTIONS.some((section) => section === requestedSection)) {
    return requestedSection as AccountSection;
  }
  if (hasStorageResult) return 'library';
  if (hasBillingIntent) return 'profile';
  return 'desk';
};

export const getAccountSectionHref = (section: AccountSection): string => (
  section === 'desk' ? '/account' : `/account?section=${section}`
);

/** Prepared Output owns one account-entry lifetime across its internal Set navigation. */
export const getAccountDeskKey = ({ focusedWorkId, focusedArtifactId, returnContextKey, documentId, revision, outputRef }: {
  focusedWorkId?: string | null;
  focusedArtifactId?: string | null;
  returnContextKey?: string | null;
  documentId?: string | null;
  revision?: string | null;
  outputRef?: string | null;
}): string => outputRef !== null && outputRef !== undefined
  // A prepared source owns one mounted Desk for its complete install -> Output
  // transition. Internal Set focus changes must not discard preparation state.
  ? `desk:output:${JSON.stringify([documentId ?? null, revision ?? null, outputRef])}`
  : focusedWorkId || focusedArtifactId || returnContextKey
  ? `desk:${focusedWorkId ?? 'overview'}:${focusedArtifactId ?? 'set'}:${returnContextKey ?? 'fresh'}`
  : 'desk';
