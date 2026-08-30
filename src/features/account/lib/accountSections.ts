export const ACCOUNT_SECTIONS = ['home', 'library', 'storage', 'billing', 'profile'] as const;

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
  if (ACCOUNT_SECTIONS.some((section) => section === requestedSection)) {
    return requestedSection as AccountSection;
  }
  if (hasStorageResult) return 'storage';
  if (hasBillingIntent) return 'billing';
  return 'home';
};

export const getAccountSectionHref = (section: AccountSection): string => (
  section === 'home' ? '/account' : `/account?section=${section}`
);
