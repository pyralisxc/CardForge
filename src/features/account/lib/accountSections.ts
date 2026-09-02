export const ACCOUNT_SECTIONS = ['home', 'library', 'profile'] as const;

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
  if (ACCOUNT_SECTIONS.some((section) => section === requestedSection)) {
    return requestedSection as AccountSection;
  }
  if (hasStorageResult) return 'library';
  if (hasBillingIntent) return 'profile';
  return 'home';
};

export const getAccountSectionHref = (section: AccountSection): string => (
  section === 'home' ? '/account' : `/account?section=${section}`
);
