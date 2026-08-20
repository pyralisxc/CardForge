import { registerAgentCardTools } from './mcpAgentCardTools';
import { registerAgentTemplateTools as registerTemplateTools } from './mcpAgentTemplateToolsCore';
import { registerCloudSetTools } from './mcpCloudSetTools';

export const registerAgentTemplateTools = (
  options: Parameters<typeof registerTemplateTools>[0],
) => {
  registerTemplateTools(options);
  registerAgentCardTools(options);
  registerCloudSetTools(options);
};
