import type { AccessMode, PaidPlan } from '@/domain/entitlements';

export const MCP_USAGE_PLAN_KEYS = ['free', 'creator', 'designer', 'enterprise'] as const;
export type McpUsagePlanKey = typeof MCP_USAGE_PLAN_KEYS[number];

export interface McpAllowance {
  planKey: McpUsagePlanKey;
  displayName: string;
  description: string;
  featureSummary: string;
  ctaLabel: string;
  priceLabel: string;
  priceNote: string;
  isVisible: boolean;
  monthlyActionLimit: number;
  dailySafetyLimit: number;
  onlineStorageLimitBytes: number;
  draftRetentionHours: number;
}

export interface McpAccountUsageSummary {
  allowance: McpAllowance;
  availablePlans: McpAllowance[];
  currentMonthStart: string;
  dailyActionUnits: number;
  documentBytes: number;
  documentCount: number;
  failedCalls: number;
  mcpAccessAvailable: boolean;
  monthlyActionUnits: number;
  observationOnly: true;
  requestBytes: number;
  responseBytes: number;
  successfulCalls: number;
  toolCalls: number;
}

export interface McpUsageAccessContext {
  accountUserId: string | null;
  accessMode: AccessMode;
  isOwner: boolean;
  isSignedIn: boolean;
  paidPlan: PaidPlan | null;
}

export interface McpOwnerUsageSummary {
  activeUsers: number;
  currentMonthStart: string;
  documentBytes: number;
  documentCount: number;
  durationMs: number;
  failedCalls: number;
  monthlyActionUnits: number;
  requestBytes: number;
  responseBytes: number;
  successfulCalls: number;
  toolCalls: number;
}

export interface McpOwnerUsageDashboard {
  allowances: McpAllowance[];
  observationOnly: true;
  summary: McpOwnerUsageSummary;
}

const gibibytes = (value: number) => value * 1024 * 1024 * 1024;
const mebibytes = (value: number) => value * 1024 * 1024;

export const DEFAULT_MCP_ALLOWANCES: McpAllowance[] = [
  { planKey: 'free', displayName: 'Free', priceLabel: '$0', priceNote: 'No card required', description: 'A real local-first studio: keep portable Sets on this device, in a local folder, or in your own Google Drive.', featureSummary: 'Local-first Desk and focused design tools\nPortable Sets and connected personal storage\n30 current beta ChatGPT actions target\n250 MB current beta private-workspace target', ctaLabel: 'Start creating', isVisible: true, monthlyActionLimit: 30, dailySafetyLimit: 5, onlineStorageLimitBytes: mebibytes(250), draftRetentionHours: 12 },
  { planKey: 'creator', displayName: 'Creator Pass', priceLabel: '$8.99', priceNote: 'per month', description: 'For regular creators who want watermark-free finished exports and a longer private Studio work window.', featureSummary: 'Everything in Free\nWatermark-free finished exports\n300 current beta ChatGPT actions target\n2 GB current beta private-workspace target', ctaLabel: 'Choose Creator', isVisible: true, monthlyActionLimit: 300, dailySafetyLimit: 50, onlineStorageLimitBytes: gibibytes(2), draftRetentionHours: 24 },
  { planKey: 'designer', displayName: 'Designer Pass', priceLabel: '$19.99', priceNote: 'per month', description: 'For high-volume creators and approved contributors who want the highest current beta Studio capacity target.', featureSummary: 'Everything in Creator\n1,000 current beta ChatGPT actions target\n10 GB current beta private-workspace target\nContributor tools when approved', ctaLabel: 'Choose Designer', isVisible: true, monthlyActionLimit: 1_000, dailySafetyLimit: 150, onlineStorageLimitBytes: gibibytes(10), draftRetentionHours: 48 },
  { planKey: 'enterprise', displayName: 'Business Solutions', priceLabel: 'Custom', priceNote: 'Built around your team', description: 'For teams that need a tailored CardForge Studio workflow, integration, capacity, and support.', featureSummary: 'Custom CardForge-operated Studio capacity\nTeam workflow consultation\nIntegration planning\nDirect business support', ctaLabel: 'Talk with CardForge', isVisible: true, monthlyActionLimit: 10_000, dailySafetyLimit: 1_000, onlineStorageLimitBytes: gibibytes(100), draftRetentionHours: 168 },
];

export const isMcpUsagePlanKey = (value: unknown): value is McpUsagePlanKey => (
  typeof value === 'string' && (MCP_USAGE_PLAN_KEYS as readonly string[]).includes(value)
);

export const resolveMcpUsagePlanKey = ({
  accessMode,
  isOwner,
  paidPlan,
}: {
  accessMode: AccessMode;
  isOwner: boolean;
  paidPlan?: PaidPlan | null;
}): McpUsagePlanKey => {
  if (isOwner || accessMode === 'contributor') return 'designer';
  if (accessMode === 'paid' && paidPlan === 'designer') return 'designer';
  return accessMode === 'paid' ? 'creator' : 'free';
};

export const getDefaultMcpAllowance = (planKey: McpUsagePlanKey): McpAllowance => (
  DEFAULT_MCP_ALLOWANCES.find((allowance) => allowance.planKey === planKey)
  ?? DEFAULT_MCP_ALLOWANCES[0]
);

export const isMcpAvailableForAccount = ({
  isSignedIn,
}: {
  isSignedIn: boolean;
}): boolean => isSignedIn;

export const METERED_MCP_TOOL_NAMES = new Set([
  'attach_template_artwork',
  'create_editable_template',
  'update_editable_template',
  'upsert_card',
  'upsert_card_set',
  'upsert_cards',
]);

export const isMeteredMcpToolName = (toolName: string): boolean => METERED_MCP_TOOL_NAMES.has(toolName);
