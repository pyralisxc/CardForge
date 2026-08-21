export * from './model';
export { TemplateDraftPreviewClient } from './components/TemplateDraftPreviewClient';
export { useStudioDocumentHandoff } from './hooks/useStudioDocumentHandoff';
export { hydrateStudioDocumentAssets, hydrateStudioDocumentAssetValue } from './client/studioDocumentAssetHydration';
export * from './assetReferences';
export {
  forgetAgentTemplateLink,
  getAgentTemplateLink,
  rememberAgentTemplateLink,
  syncAgentTemplateSave,
  type AgentTemplateSyncResult,
} from './lib/agentTemplateRoundTrip';
