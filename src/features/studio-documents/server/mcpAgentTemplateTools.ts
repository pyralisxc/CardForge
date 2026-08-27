import { registerPersonalLibraryTools } from '@/features/personal-library/server';
import { registerAccountWorkflowTools } from './mcpAccountWorkflowTools';
import { registerAgentCardTools } from './mcpAgentCardTools';
import { registerAgentTemplateTools as registerTemplateTools } from './mcpAgentTemplateToolsCore';
import { registerProjectSourceTools } from './mcpProjectSourceTools';
import { registerWorkingDocumentTools } from './mcpWorkingDocumentTools';

export const registerAgentTemplateTools = (
  options: Parameters<typeof registerTemplateTools>[0],
) => {
  registerAccountWorkflowTools(options);
  registerTemplateTools(options);
  registerAgentCardTools(options);
  registerWorkingDocumentTools(options);
  registerProjectSourceTools(options);
  registerPersonalLibraryTools(options);
};
