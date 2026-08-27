import type { BoundaryFailureKind, BoundaryLimit } from '@/shared/boundaryFailure';

export const ENVIRONMENT_ZONE_IDS = ['home', 'library', 'studio', 'profile', 'developer', 'owner'] as const;

export type ZoneId = typeof ENVIRONMENT_ZONE_IDS[number];
export type ZoneAccess = 'guest' | 'creator' | 'developer' | 'owner';
export type ZoneViewportPolicy = 'flow' | 'desk';

export interface ZoneDefinition {
  id: ZoneId;
  href: string;
  label: string;
  shortLabel: string;
  minimumAccess: ZoneAccess;
  showInPrivateRail: boolean;
  viewportPolicy: ZoneViewportPolicy;
}

export const ENVIRONMENT_ZONES = [
  { id: 'home', href: '/account', label: 'Home', shortLabel: 'Home', minimumAccess: 'guest', showInPrivateRail: true, viewportPolicy: 'flow' },
  { id: 'library', href: '/account?section=library', label: 'Library', shortLabel: 'Library', minimumAccess: 'guest', showInPrivateRail: true, viewportPolicy: 'flow' },
  { id: 'studio', href: '/studio', label: 'Studio', shortLabel: 'Studio', minimumAccess: 'guest', showInPrivateRail: true, viewportPolicy: 'desk' },
  { id: 'profile', href: '/account?section=profile', label: 'Profile', shortLabel: 'Profile', minimumAccess: 'guest', showInPrivateRail: true, viewportPolicy: 'flow' },
  { id: 'developer', href: '/developer/cockpit', label: 'Developer', shortLabel: 'Dev', minimumAccess: 'developer', showInPrivateRail: true, viewportPolicy: 'flow' },
  { id: 'owner', href: '/owner', label: 'Owner', shortLabel: 'Owner', minimumAccess: 'owner', showInPrivateRail: true, viewportPolicy: 'flow' },
] as const satisfies readonly ZoneDefinition[];

export interface EnvironmentViewer {
  signedIn: boolean;
  developer: boolean;
  owner: boolean;
}

const accessRank: Record<ZoneAccess, number> = { guest: 0, creator: 1, developer: 2, owner: 3 };

export const getViewerAccess = (viewer: EnvironmentViewer): ZoneAccess => {
  if (!viewer.signedIn) return 'guest';
  if (viewer.owner) return 'owner';
  if (viewer.developer) return 'developer';
  return 'creator';
};

export const getAvailableEnvironmentZones = (viewer: EnvironmentViewer): readonly ZoneDefinition[] => {
  const viewerAccess = getViewerAccess(viewer);
  return ENVIRONMENT_ZONES.filter((zone) => accessRank[zone.minimumAccess] <= accessRank[viewerAccess]);
};

export const getVisibleEnvironmentZones = (viewer: EnvironmentViewer): readonly ZoneDefinition[] => (
  getAvailableEnvironmentZones(viewer).filter((zone) => (
    viewer.signedIn ? zone.showInPrivateRail : zone.minimumAccess === 'guest'
  ))
);

export type ActionScope = 'zone' | 'selection' | 'object' | 'group';
export type ActionHierarchy = 'primary' | 'supporting' | 'overflow';
export type ActionCommitment = 'none' | 'destructive' | 'financial' | 'permission' | 'publication';
export type ActionPermission = 'guest' | 'creator' | 'developer' | 'owner';
export type ActionSource = 'browser-local' | 'google-drive' | 'local-folder' | 'temporary' | 'provider-native';
export type ActionRevisionPolicy = 'none' | 'current-required' | 'conflict-safe';
export type FeatureOwnerId =
  | 'account'
  | 'app-shell'
  | 'billing'
  | 'card-generator'
  | 'developer-access'
  | 'developer-assets'
  | 'developer-cockpit'
  | 'experience-settings'
  | 'legal'
  | 'owner'
  | 'personal-library'
  | 'project'
  | 'storage-management'
  | 'studio-documents'
  | 'template-editor';

export type PublishedMcpToolName =
  | 'search_personal_library'
  | 'list_connected_projects'
  | 'checkout_project'
  | 'commit_project'
  | 'upsert_card_set'
  | 'upsert_card'
  | 'upsert_cards'
  | 'move_cards'
  | 'preview_card_set'
  | 'validate_working_document';

export type ActionAutomation =
  | { kind: 'published-mcp'; tools: readonly [PublishedMcpToolName, ...PublishedMcpToolName[]] }
  | { kind: 'planned-mcp'; capability: string }
  | { kind: 'human-only'; owner: 'cardforge' | 'provider' };

export type ActionAvailability =
  | { kind: 'available' }
  | { kind: 'disabled'; reason: string }
  | { kind: 'hidden'; reason: string };

export interface ActionDescriptor {
  id: `${string}.${string}`;
  label: string;
  ownerFeature: FeatureOwnerId;
  supportedObjectKinds: readonly string[];
  supportedSources: readonly ActionSource[];
  revisionPolicy: ActionRevisionPolicy;
  requiredPermission: ActionPermission;
  scope: ActionScope;
  hierarchy: ActionHierarchy;
  availability: ActionAvailability;
  commitment: ActionCommitment;
  automation: ActionAutomation;
  result: 'navigation' | 'preview' | 'mutation' | 'provider-handoff' | 'download';
}

export const isActionAvailable = (action: ActionDescriptor): boolean => action.availability.kind === 'available';

export const canViewerRunAction = (action: ActionDescriptor, viewer: EnvironmentViewer): boolean => (
  accessRank[action.requiredPermission] <= accessRank[getViewerAccess(viewer)]
);

export interface ActionSourceContext {
  id: string;
  label: string;
  source: ActionSource;
  currentRevisionAvailable: boolean;
}

export interface ActionApplicabilityContext {
  objectKind: string | null;
  sources: readonly ActionSourceContext[];
  viewer: EnvironmentViewer;
}

export const isActionApplicable = (action: ActionDescriptor, context: ActionApplicabilityContext): boolean => {
  if (!canViewerRunAction(action, context.viewer)) return false;
  if (action.scope === 'zone') return true;
  if (context.objectKind === null || !action.supportedObjectKinds.includes(context.objectKind)) return false;
  return context.sources.some((source) => (
    action.supportedSources.includes(source.source)
    && (action.revisionPolicy === 'none' || source.currentRevisionAvailable)
  ));
};

export const getApplicableActionSources = (action: ActionDescriptor, context: ActionApplicabilityContext): readonly ActionSourceContext[] => (
  isActionApplicable(action, context)
    ? context.sources.filter((source) => (
      action.supportedSources.includes(source.source)
      && (action.revisionPolicy === 'none' || source.currentRevisionAvailable)
    ))
    : []
);

export type EnvironmentContentState =
  | { kind: 'ready' }
  | { kind: 'loading'; label: string }
  | { kind: 'empty'; message: string; nextAction?: string }
  | { kind: 'success'; message: string };

export interface EnvironmentBoundaryFailure {
  kind: BoundaryFailureKind | 'offline';
  code: string;
  message: string;
  retryable: boolean;
  nextAction?: string;
  correlationId: string | null;
  retryAfterSeconds?: number;
  limit?: BoundaryLimit;
}

export type EnvironmentBoundaryState = EnvironmentContentState | {
  kind: 'partial';
  message: string;
  failures: readonly EnvironmentBoundaryFailure[];
};

export interface SelectionTarget {
  objectId: string | null;
  listOffset: number;
  focusReturnId: string | null;
  zoom?: number;
}

export interface SelectionSession extends SelectionTarget {
  detailOpen: boolean;
  detailRestore: SelectionTarget | null;
}

const defaultSelection: SelectionTarget = { objectId: null, listOffset: 0, focusReturnId: null };

const copySelection = (selection: SelectionTarget): SelectionTarget => ({
  objectId: selection.objectId,
  listOffset: selection.listOffset,
  focusReturnId: selection.focusReturnId,
  ...(selection.zoom === undefined ? {} : { zoom: selection.zoom }),
});

const sessionFromSelection = (selection: SelectionTarget, detailOpen: boolean, detailRestore: SelectionTarget | null): SelectionSession => ({
  ...copySelection(selection),
  detailOpen,
  detailRestore,
});

export const createSelectionSession = (initial: SelectionTarget = defaultSelection): SelectionSession => sessionFromSelection(initial, false, null);

export const selectEnvironmentObject = (session: SelectionSession, target: SelectionTarget): SelectionSession => sessionFromSelection(target, session.detailOpen, session.detailRestore);

export const openEnvironmentDetail = (session: SelectionSession, target: SelectionTarget): SelectionSession => sessionFromSelection(
  target,
  true,
  session.detailOpen && session.detailRestore ? copySelection(session.detailRestore) : copySelection(session),
);

export const closeEnvironmentDetail = (session: SelectionSession): SelectionSession => {
  if (!session.detailOpen || !session.detailRestore) return session;
  return sessionFromSelection(session.detailRestore, false, null);
};
