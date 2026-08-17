---
name: create-editable-template
description: Create and review private editable CardForge Templates, then optionally continue an exact chosen Template into Forge Review.
---

# Create editable CardForge Templates

Use the CardForge Studio tools when the user wants an editable visual Template rather than a flattened image.

## Workflow

1. Gather the title, canvas size or aspect ratio, visible copy, and intended editable layers from the user's request.
2. Do not invent campaign metadata, specialty tags, use-case tags, descriptions, preview URLs, or publication claims.
3. Call `create_editable_template` with a private Template containing only supported, user-grounded content.
4. Give the user the returned Studio link so they can inspect and visually edit the result.
5. Use `list_editable_templates` before referring to an unknown document id. Use `get_editable_template` before discussing the contents of a saved draft.
6. Call `continue_template_in_pipeline` only when the user explicitly chooses the Studio document and wants a Forge Review draft. If the document contains multiple Templates, require the exact Template id.
7. Explain that the Pipeline handoff is still a draft. The developer completes missing review metadata in Forge Review, and only the CardForge owner can publish.

All access, watermark, export, developer, and publication gates remain owned and enforced by CardForge.
