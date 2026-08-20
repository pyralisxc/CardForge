import { registerAgentCardTools } from './mcpAgentCardTools';
import { registerAgentTemplateTools as registerTemplateTools } from './mcpAgentTemplateToolsCore';

export const registerAgentTemplateTools = (
  options: Parameters<typeof registerTemplateTools>[0],
) => {
  registerTemplateTools(options);
  registerAgentCardTools(options);
};
