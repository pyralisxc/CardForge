/** Current contextual creator tool semantics for Development Intelligence. */
export const CREATOR_TOOL_DEVELOPMENT_INTELLIGENCE = [
  { developmentIntelligence: { kind: 'tool', id: 'design', label: 'Design', relationships: [{ kind: 'owned-by', to: 'feature:template-editor' }] } },
  { developmentIntelligence: { kind: 'tool', id: 'generate', label: 'Generate', relationships: [{ kind: 'owned-by', to: 'feature:card-generator' }] } },
  { developmentIntelligence: { kind: 'tool', id: 'output', label: 'Output', relationships: [{ kind: 'owned-by', to: 'feature:card-generator' }] } },
  { developmentIntelligence: { kind: 'tool', id: 'pipeline', label: 'Pipeline', relationships: [{ kind: 'owned-by', to: 'feature:pipeline' }] } },
] as const;
