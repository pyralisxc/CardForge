/** Current Profile action semantics for Development Intelligence. */
export const PROFILE_DEVELOPMENT_INTELLIGENCE = [
  {
    developmentIntelligence: {
      kind: 'action', id: 'profile.close-utility', label: 'Close utility', scope: 'zone', result: 'navigation',
      relationships: [{ kind: 'owned-by', to: 'feature:account' }],
    },
  },
  {
    developmentIntelligence: {
      kind: 'action', id: 'profile.manage-account', label: 'Manage account', scope: 'zone', result: 'provider-handoff',
      relationships: [{ kind: 'owned-by', to: 'feature:account' }],
    },
  },
] as const;
