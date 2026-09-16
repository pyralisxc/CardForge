/** Current Desk action semantics for Development Intelligence. */
export const DESK_DEVELOPMENT_INTELLIGENCE = [
  {
    developmentIntelligence: {
      kind: 'action', id: 'desk.create-set', label: 'New Set', scope: 'zone', result: 'tool-opened',
      relationships: [
        { kind: 'opens', to: 'tool:create-set' },
        { kind: 'owned-by', to: 'feature:card-generator' },
      ],
    },
  },
  {
    developmentIntelligence: {
      kind: 'action', id: 'desk.delete-set', label: 'Delete from this device', scope: 'object', result: 'tool-opened',
      relationships: [
        { kind: 'opens', to: 'tool:delete-set-confirmation' },
        { kind: 'owned-by', to: 'feature:project' },
      ],
    },
  },
  {
    developmentIntelligence: {
      kind: 'action', id: 'desk.duplicate-set', label: 'Duplicate', scope: 'object', result: 'mutation',
      relationships: [{ kind: 'owned-by', to: 'feature:project' }],
    },
  },
  {
    developmentIntelligence: {
      kind: 'action', id: 'desk.export-set', label: 'Output', scope: 'object', result: 'tool-opened',
      relationships: [
        { kind: 'opens', to: 'tool:output' },
        { kind: 'owned-by', to: 'feature:card-generator' },
      ],
    },
  },
  {
    developmentIntelligence: {
      kind: 'action', id: 'desk.generate-set', label: 'Generate cards', scope: 'object', result: 'tool-opened',
      relationships: [
        { kind: 'opens', to: 'tool:generate' },
        { kind: 'owned-by', to: 'feature:card-generator' },
      ],
    },
  },
  {
    developmentIntelligence: {
      kind: 'action', id: 'desk.manage-location', label: 'Manage source', scope: 'object', result: 'navigation',
      relationships: [{ kind: 'owned-by', to: 'feature:storage-management' }],
    },
  },
  {
    developmentIntelligence: {
      kind: 'action', id: 'desk.open-set', label: 'Open work', scope: 'object', result: 'contextual',
      relationships: [
        { kind: 'automated-by', to: 'mcp:checkout_project' },
        { kind: 'automated-by', to: 'mcp:list_connected_projects' },
        { kind: 'owned-by', to: 'feature:marketing-content' },
        { kind: 'owned-by', to: 'feature:pipeline' },
        { kind: 'owned-by', to: 'feature:project' },
        { kind: 'owned-by', to: 'feature:studio-documents' },
      ],
    },
  },
  {
    developmentIntelligence: {
      kind: 'action', id: 'desk.pin-set', label: 'Pin or unpin from Desk', scope: 'object', result: 'mutation',
      relationships: [{ kind: 'owned-by', to: 'feature:project' }],
    },
  },
  {
    developmentIntelligence: {
      kind: 'action', id: 'desk.rename-set', label: 'Rename', scope: 'object', result: 'tool-opened',
      relationships: [
        { kind: 'opens', to: 'tool:rename-set' },
        { kind: 'owned-by', to: 'feature:project' },
      ],
    },
  },
  {
    developmentIntelligence: {
      kind: 'action', id: 'desk.save-move-set', label: 'Save & move', scope: 'object', result: 'tool-opened',
      relationships: [
        { kind: 'opens', to: 'tool:locations' },
        { kind: 'owned-by', to: 'feature:storage-management' },
      ],
    },
  },
  {
    developmentIntelligence: {
      kind: 'action', id: 'desk.send-pipeline', label: 'Send to Pipeline', scope: 'object', result: 'tool-opened',
      relationships: [{ kind: 'owned-by', to: 'feature:pipeline' }],
    },
  },
  { developmentIntelligence: { kind: 'tool', id: 'create-set', label: 'Create Set' } },
  {
    developmentIntelligence: {
      kind: 'tool', id: 'delete-set-confirmation', label: 'Delete Set confirmation',
      relationships: [{ kind: 'owned-by', to: 'feature:project' }],
    },
  },
  {
    developmentIntelligence: {
      kind: 'tool', id: 'rename-set', label: 'Rename Set',
      relationships: [{ kind: 'owned-by', to: 'feature:project' }],
    },
  },
] as const;
