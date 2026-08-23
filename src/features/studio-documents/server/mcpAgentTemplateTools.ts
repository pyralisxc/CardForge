import { registerAccountWorkflowTools } from './mcpAccountWorkflowTools';
import { registerAgentCardTools } from './mcpAgentCardTools';
import { registerAgentTemplateTools as registerTemplateTools } from './mcpAgentTemplateToolsCore';
import { registerCloudSetTools } from './mcpCloudSetTools';
import { registerProjectSourceTools } from './mcpProjectSourceTools';

export const registerAgentTemplateTools = (
  options: Parameters<typeof registerTemplateTools>[0],
) => {
  registerAccountWorkflowTools(options);
  registerTemplateTools(options);
  registerAgentCardTools(options);
  registerCloudSetTools(options);
  registerProjectSourceTools(options);
};
