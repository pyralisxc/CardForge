import { createMcpHandler } from 'mcp-handler';

import { registerAgentTemplateTools } from './mcpAgentTemplateTools';
import { CARDFORGE_MCP_CONTRACT_VERSION } from './mcpContractVersion';
import { registerEditableTemplateTools } from './mcpEditableTemplateTools';
import { registerCardForgePluginSkills } from './mcpPluginSkills';
import { getMcpStudioAccess } from './mcpStudioAccess';
import { createMcpToolError } from './mcpToolError';

const publicOrigin = () => (
  process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '') || 'https://cardforges.com'
);

export const cardForgeMcpHandler = createMcpHandler(
  (server) => {
    registerCardForgePluginSkills(server);
    const options = {
      server,
      publicOrigin: publicOrigin(),
      getAccess: getMcpStudioAccess,
      toolError: createMcpToolError,
    };
    registerAgentTemplateTools(options);
    registerEditableTemplateTools(options);
  },
  {
    serverInfo: { name: 'cardforge-studio', version: CARDFORGE_MCP_CONTRACT_VERSION },
    capabilities: {
      extensions: {
        'io.modelcontextprotocol/skills': {},
      },
    },
    instructions: [
      'Act as a design director and production planner before creating a new CardForge Template.',
      'For a new design, establish purpose, audience, exact dimensions or physical format, visual direction, copy needs, Studio-editable fields, and an explicit asset inventory with quantities and roles.',
      'Resolve the desired quality target exactly once: simple, professional, or premium. Infer it when the request is clear. If it is not clear and the user has not delegated all creative decisions, ask one concise quality question contrasting a faster native/library-first result with a more image-rich professional or premium result. If the user explicitly delegates all creative decisions without naming a quality target, default to professional. Record the quality target in productionPlan.visualDirection.notes.',
      'Before create_editable_template, inventory every meaningful visual slot for the requested deliverable rather than applying a card-only checklist. Consider hero/main art, background/environment, border/frame, brand/logo/product imagery, supporting imagery, and icons/emblems where relevant. Every slot must intentionally use native structure, a selected CardForge library asset, an editable user image slot, or produced artwork.',
      'When the user selects or supplies a frame, frame image, or frame kit, treat it as the composition skeleton. If it already draws title plates, rules boxes, stat regions, or other visible boundaries, do not recreate those boundaries with redundant bordered text elements or opaque panels. Editable text inside an existing framed region should normally remain transparent and borderless unless another panel is explicitly requested.',
      'For any image the user is expected to replace later, create a native image element and a fieldContract with type image, bind the contract to that element, and include its key in productionPlan.editableFieldKeys. This applies to cards, posters, marketing graphics, reference layouts, and other image-bearing deliverables.',
      'For fixed hero or main artwork, create a native image element with a stable id, target that id from the planned asset, and attach the artwork with binding element.image. Successful upload is not placement proof: preview the Template and verify the intended image element no longer shows placeholder or unrelated artwork.',
      'For professional and premium work, do not silently substitute generic filler shapes for missing high-value imagery and do not use placeholder art unless the user explicitly asks for a placeholder/prototyping stage.',
      'Use get_studio_creation_guide when the workflow or native capabilities are unclear, and search_studio_library before inventing a new asset when CardForge may already have a suitable template, style, font, texture, divider, icon, image, frame, or border.',
      'Before create_editable_template, summarize the production plan to the user and get approval unless the user already explicitly delegated the creative decisions. Record decisionMode confirmed only after approval and delegated only after explicit delegation.',
      'Once a Studio document exists with decisionMode confirmed or delegated, treat its production plan as locked. Do not ask for the same approval, repeat discovery, or restart planning during ordinary copy, layout, style, or artwork revisions. Continue with get_editable_template, update_editable_template, attach_template_artwork, and preview_template_draft. Reopen planning only if the user materially changes purpose, deliverable, output size, quality target, or explicitly requests a new plan.',
      'Use one planned asset requirement per distinct custom image. Keep custom-generated requirements status needed at creation, generate the image, then attach it with attach_template_artwork using the planned requirement id and appropriate native binding.',
      'Use fieldContracts for content the user should be able to edit in Studio, and bind every planned editable field and asset target to stable native element ids.',
      'CardForge embeds attached artwork into the Template itself. Do not resend already attached image bytes during ordinary revisions; keep the same planned asset id and CardForge will preserve the embedded artwork.',
      'Create with native CardForge fields rather than generic design-tool vocabulary. Rich native appearance, typography, image positioning, shape roles, grouping, and physical dimensions are supported.',
      'After creation and after meaningful revisions or artwork changes, call preview_template_draft so the user can visually inspect the exact current CardForge render in chat. Inspect its assetBindings, imageElements, borderedTextElementIds, and warnings; resolve any binding warning before calling the draft finished.',
      'Use get_editable_template and update_editable_template against the current revision when another pass materially improves the design or the user requests changes. Re-preview the same draft until they are satisfied.',
      'Only after visual approval should the user open the Studio link. Opening an agent draft installs or updates the same Template in the user personal local Template library rather than publishing it or creating revision copies.',
      'Never claim a private Template is published. Forge Review and the contribution Pipeline are separate explicit steps.',
    ].join(' '),
    maxSubscriptions: 0,
  },
);
